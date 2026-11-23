import {
  API,
  CACHE_TTL_MS,
  MAP_GRID_LAT_SPAN,
  MAP_GRID_SIZE,
  POLLUTANTS,
  SEARCH_RESULT_LIMIT,
  STORAGE_KEYS,
} from './config.js';
import { wmoIconType, wmoText, weatherApiIconType } from './interpretation.js';
import { ApiError, fetchJson } from './utils.js';

const memoryCache = new Map();
const inflight = new Map();

const num = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const cacheKey = (source, city) =>
  `${source}:${Number(city.lat).toFixed(3)},${Number(city.lon).toFixed(3)}`;

const sessionKey = (key) => `${STORAGE_KEYS.cache}:${key}`;

function readSessionCache(key) {
  try {
    const raw = window.sessionStorage.getItem(sessionKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !Number.isFinite(entry.fetchedAt)) return null;
    return entry;
  } catch {
    return null;
  }
}

function pruneSessionCache() {
  try {
    const prefix = `${STORAGE_KEYS.cache}:`;
    const entries = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      try {
        const parsed = JSON.parse(window.sessionStorage.getItem(key) || '{}');
        entries.push({ key, fetchedAt: Number(parsed.fetchedAt) || 0 });
      } catch {
        entries.push({ key, fetchedAt: 0 });
      }
    }
    if (entries.length <= 12) return;
    entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
    entries.slice(0, entries.length - 12).forEach(({ key }) => window.sessionStorage.removeItem(key));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function writeSessionCache(key, entry) {
  try {
    window.sessionStorage.setItem(sessionKey(key), JSON.stringify(entry));
    pruneSessionCache();
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

async function cachedFetch(source, city, url, options = {}) {
  const key = cacheKey(source, city);
  const now = Date.now();

  const memoryHit = memoryCache.get(key);
  if (memoryHit && now - memoryHit.fetchedAt < CACHE_TTL_MS) {
    return { ...memoryHit, cached: true };
  }

  const sessionHit = readSessionCache(key);
  if (sessionHit && now - sessionHit.fetchedAt < CACHE_TTL_MS) {
    memoryCache.set(key, sessionHit);
    return { ...sessionHit, cached: true };
  }

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    const { data, raw } = await fetchJson(url, options);
    const entry = {
      data,
      raw,
      fetchedAt: Date.now(),
      source,
    };
    memoryCache.set(key, entry);
    writeSessionCache(key, entry);
    return { ...entry, cached: false };
  })().finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function invalidate(source, city) {
  const key = cacheKey(source, city);
  memoryCache.delete(key);
  inflight.delete(key);
  try {
    window.sessionStorage.removeItem(sessionKey(key));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Normalisers                                                         */
/* ------------------------------------------------------------------ */

function normaliseCurrent(payload, fallbackCity) {
  if (!payload || !payload.location || !payload.current) {
    throw new ApiError('malformed', 'Weather service returned an unexpected response.');
  }

  const { location, current } = payload;
  const iconType = weatherApiIconType(current.condition?.code, current.is_day, current.condition?.text);

  return {
    city: {
      name: location.name || fallbackCity.name,
      region: location.region || fallbackCity.region || '',
      country: location.country || fallbackCity.country || '',
      countryCode: fallbackCity.countryCode || '',
      lat: num(location.lat) ?? fallbackCity.lat,
      lon: num(location.lon) ?? fallbackCity.lon,
      timezone: location.tz_id || fallbackCity.timezone || 'UTC',
    },
    localtime: location.localtime || '',
    tempC: num(current.temp_c),
    feelsC: num(current.feelslike_c),
    tempF: num(current.temp_f),
    feelsF: num(current.feelslike_f),
    condition: {
      text: current.condition?.text || '—',
      code: num(current.condition?.code),
      iconType,
      isDay: Boolean(current.is_day),
    },
    humidity: num(current.humidity),
    windKph: num(current.wind_kph),
    windMph: num(current.wind_mph),
    windDir: current.wind_dir || '',
    windDegree: num(current.wind_degree),
    gustKph: num(current.gust_kph),
    pressureMb: num(current.pressure_mb),
    visibilityKm: num(current.vis_km),
    cloud: num(current.cloud),
    uv: num(current.uv),
    dewpointC: num(current.dewpoint_c),
    precipMm: num(current.precip_mm),
    chanceOfRain: num(current.chance_of_rain),
    lastUpdated: current.last_updated || '',
    lastUpdatedEpoch: num(current.last_updated_epoch),
  };
}

function normaliseForecast(payload) {
  if (!payload || !payload.daily || !Array.isArray(payload.daily.time)) {
    throw new ApiError('malformed', 'Forecast service returned an unexpected response.');
  }

  const { daily, hourly } = payload;

  const days = daily.time
    .map((date, index) => ({
      date,
      code: num(daily.weather_code?.[index]),
      condition: wmoText(daily.weather_code?.[index]),
      iconType: wmoIconType(daily.weather_code?.[index]),
      maxC: num(daily.temperature_2m_max?.[index]),
      minC: num(daily.temperature_2m_min?.[index]),
      rainChance: num(daily.precipitation_probability_max?.[index]),
      precipMm: num(daily.precipitation_sum?.[index]),
      windMaxKph: num(daily.wind_speed_10m_max?.[index]),
      uvMax: num(daily.uv_index_max?.[index]),
      sunrise: daily.sunrise?.[index] || '',
      sunset: daily.sunset?.[index] || '',
    }))
    .filter((day) => Boolean(day.date));

  if (days.length === 0) {
    throw new ApiError('malformed', 'Forecast service returned no daily data.');
  }

  const hours = (hourly?.time || [])
    .map((time, index) => ({
      time,
      tempC: num(hourly.temperature_2m?.[index]),
      code: num(hourly.weather_code?.[index]),
      rainChance: num(hourly.precipitation_probability?.[index]),
      precipMm: num(hourly.precipitation?.[index]),
      windKph: num(hourly.wind_speed_10m?.[index]),
      humidity: num(hourly.relative_humidity_2m?.[index]),
      uv: num(hourly.uv_index?.[index]),
    }))
    .filter((hour) => Boolean(hour.time));

  return {
    timezone: payload.timezone || 'UTC',
    utcOffsetSeconds: num(payload.utc_offset_seconds) ?? 0,
    days,
    hours,
  };
}

function dailyAqiPeaks(hourly, currentTime, count = 3) {
  if (!Array.isArray(hourly) || hourly.length === 0) return [];
  const today = currentTime ? currentTime.slice(0, 10) : hourly[0].time.slice(0, 10);
  const byDate = new Map();

  hourly.forEach(({ time, aqi }) => {
    if (!time || !Number.isFinite(aqi)) return;
    const date = time.slice(0, 10);
    if (date <= today) return;
    const existing = byDate.get(date);
    if (!existing || aqi > existing.peakAqi) {
      byDate.set(date, { date, peakAqi: aqi });
    }
  });

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count);
}

function normaliseAirQuality(payload) {
  if (!payload || !payload.current) {
    throw new ApiError('malformed', 'Air quality service returned an unexpected response.');
  }

  const { current } = payload;
  const aqi = num(current.us_aqi);
  const pollutants = POLLUTANTS.map((pollutant) => ({
    key: pollutant.key,
    label: pollutant.label,
    longLabel: pollutant.longLabel,
    unit: pollutant.unit,
    explainer: pollutant.explainer,
    value: num(current[pollutant.key]),
    subIndex: num(current[pollutant.aqiField]),
  }));

  const hasPollutants = pollutants.some((pollutant) => Number.isFinite(pollutant.value));

  const hourly = (payload.hourly?.time || [])
    .map((time, index) => ({ time, aqi: num(payload.hourly.us_aqi?.[index]) }))
    .filter((hour) => Number.isFinite(hour.aqi));

  const observedTime = current.time || '';

  return {
    available: Number.isFinite(aqi) || hasPollutants,
    aqi,
    pollutants,
    hourly,
    dailyPeaks: dailyAqiPeaks(hourly, observedTime, 3),
    observedTime,
    timezone: payload.timezone || 'UTC',
  };
}

function normaliseSearch(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const seen = new Set();
  const unique = [];

  for (const result of results) {
    if (!result || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
      continue;
    }
    const key = `${result.name}|${result.admin1 || ''}|${result.country || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: result.id,
      name: result.name,
      region: result.admin1 || result.admin2 || '',
      country: result.country || '',
      countryCode: result.country_code || '',
      lat: Number(result.latitude),
      lon: Number(result.longitude),
      timezone: result.timezone || 'UTC',
      population: num(result.population) ?? 0,
    });
    if (unique.length >= SEARCH_RESULT_LIMIT) break;
  }

  return unique;
}

function normaliseMapGrid(payload, bounds, size) {
  const points = Array.isArray(payload) ? payload : [payload];
  const values = {
    temperature: [],
    clouds: [],
    precipitation: [],
    wind: [],
  };

  points.forEach((point) => {
    const current = point?.current || {};
    values.temperature.push(num(current.temperature_2m));
    values.clouds.push(num(current.cloud_cover));
    values.precipitation.push(num(current.precipitation));
    values.wind.push(num(current.wind_speed_10m));
  });

  const available = Object.values(values).some((series) => series.some((value) => Number.isFinite(value)));

  return {
    bounds,
    size,
    values,
    available,
    time: points[0]?.current?.time || '',
    timezone: points[0]?.timezone || 'UTC',
  };
}

/* ------------------------------------------------------------------ */
/* Public provider adapter                                             */
/* ------------------------------------------------------------------ */

export async function getCurrent(city, signal) {
  const url = new URL(API.proxy, window.location.origin);
  url.searchParams.set('action', 'current');
  url.searchParams.set('lat', String(city.lat));
  url.searchParams.set('lon', String(city.lon));

  const entry = await cachedFetch('current', city, url.toString(), { signal });
  return {
    ...entry,
    current: normaliseCurrent(entry.data, city),
  };
}

export async function getForecast(city, signal) {
  const url = new URL(API.forecast);
  url.searchParams.set('latitude', String(city.lat));
  url.searchParams.set('longitude', String(city.lon));
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
      'uv_index_max',
      'sunrise',
      'sunset',
    ].join(','),
  );
  url.searchParams.set(
    'hourly',
    ['temperature_2m', 'weather_code', 'precipitation_probability', 'precipitation', 'wind_speed_10m', 'relative_humidity_2m', 'uv_index'].join(','),
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('wind_speed_unit', 'kmh');

  const entry = await cachedFetch('forecast', city, url.toString(), { signal });
  return {
    ...entry,
    forecast: normaliseForecast(entry.data),
  };
}

export async function getAirQuality(city, signal) {
  const url = new URL(API.airQuality);
  url.searchParams.set('latitude', String(city.lat));
  url.searchParams.set('longitude', String(city.lon));
  url.searchParams.set(
    'current',
    [
      'us_aqi',
      'us_aqi_pm2_5',
      'us_aqi_pm10',
      'us_aqi_ozone',
      'us_aqi_nitrogen_dioxide',
      'us_aqi_sulphur_dioxide',
      'us_aqi_carbon_monoxide',
      'pm2_5',
      'pm10',
      'ozone',
      'nitrogen_dioxide',
      'sulphur_dioxide',
      'carbon_monoxide',
    ].join(','),
  );
  url.searchParams.set('hourly', 'us_aqi');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '4');

  const entry = await cachedFetch('air', city, url.toString(), { signal });
  return {
    ...entry,
    air: normaliseAirQuality(entry.data),
  };
}

export async function searchCities(query, signal) {
  const url = new URL(API.geocode);
  url.searchParams.set('name', query);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const { data } = await fetchJson(url.toString(), { signal, timeoutMs: 8000 });
  return normaliseSearch(data);
}

/**
 * Reverse geocoding is only used to label the coordinates returned by the
 * Geolocation API. WeatherAPI resolves the nearest station, which can be a
 * village or locality (for example "Samardha Kaliyasot" next to Bhopal), so
 * ask OpenStreetMap for the administrative address and prefer city-level
 * names over suburb/locality names.
 */
const CITY_NAME_FIELDS = [
  'city',
  'town',
  'municipality',
  'state_district',
  'county',
  'village',
  'suburb',
  'city_district',
];

function pickCityName(address) {
  if (!address || typeof address !== 'object') return null;
  for (const field of CITY_NAME_FIELDS) {
    const value = address[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function reverseGeocode(lat, lon, signal) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const url = new URL(API.reverseGeocode);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', lat.toFixed(5));
  url.searchParams.set('lon', lon.toFixed(5));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'en');

  const { data } = await fetchJson(url.toString(), { signal, timeoutMs: 6000 });
  const address = data && data.address;
  const name = pickCityName(address);
  if (!name) return null;

  return {
    name,
    region: address.state || address.state_district || '',
    country: address.country || '',
    countryCode: String(address.country_code || '').toUpperCase(),
    lat,
    lon,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

export async function getMapGrid(city, signal) {
  const size = MAP_GRID_SIZE;
  const latSpan = MAP_GRID_LAT_SPAN;
  const cosLat = Math.max(0.25, Math.cos((city.lat * Math.PI) / 180));
  const lonSpan = Math.min(12, latSpan / cosLat);

  const north = Math.min(85, city.lat + latSpan / 2);
  const south = Math.max(-85, city.lat - latSpan / 2);
  const west = city.lon - lonSpan / 2;
  const east = city.lon + lonSpan / 2;

  const latitudes = [];
  const longitudes = [];
  for (let row = 0; row < size; row += 1) {
    const latitude = north - (row / (size - 1)) * (north - south);
    for (let column = 0; column < size; column += 1) {
      const longitude = west + (column / (size - 1)) * (east - west);
      latitudes.push(Number(latitude.toFixed(4)));
      longitudes.push(Number(longitude.toFixed(4)));
    }
  }

  const url = new URL(API.forecast);
  url.searchParams.set('latitude', latitudes.join(','));
  url.searchParams.set('longitude', longitudes.join(','));
  url.searchParams.set('current', 'temperature_2m,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  const entry = await cachedFetch('map', city, url.toString(), { signal });
  const bounds = { south, west, north, east };

  return {
    ...entry,
    grid: normaliseMapGrid(entry.data, bounds, size),
  };
}
