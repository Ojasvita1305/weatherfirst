import {
  AQI_CATEGORIES,
  AQI_SCALE_MAX,
  POLLUTANTS,
  THRESHOLDS,
} from './config.js';
import {
  clamp,
  formatTemp,
  formatWeekday,
  sentenceList,
} from './utils.js';

/* ------------------------------------------------------------------ */
/* Air quality                                                         */
/* ------------------------------------------------------------------ */

export function getAqiCategory(aqi) {
  if (!Number.isFinite(aqi)) return null;
  const value = clamp(aqi, 0, AQI_SCALE_MAX);
  return (
    AQI_CATEGORIES.find((category) => value >= category.min && value <= category.max) ||
    AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
  );
}

export function getAqiCategoryByKey(key) {
  return AQI_CATEGORIES.find((category) => category.key === key) || null;
}

export function getAqiScaleMarker(aqi) {
  if (!Number.isFinite(aqi)) return 0;
  return clamp((aqi / AQI_SCALE_MAX) * 100, 0, 100);
}

export function getDominantPollutant(pollutants) {
  if (!Array.isArray(pollutants) || pollutants.length === 0) return null;
  const scored = pollutants.filter((item) => Number.isFinite(item.subIndex));
  if (scored.length === 0) return null;
  return scored.reduce((best, item) => (item.subIndex > best.subIndex ? item : best), scored[0]);
}

export function getPollutantMarker(subIndex) {
  if (!Number.isFinite(subIndex)) return { label: '—', level: 'unknown' };
  if (subIndex <= 50) return { label: 'Good', level: 'good' };
  if (subIndex <= 100) return { label: 'Moderate', level: 'moderate' };
  return { label: 'Elevated', level: 'elevated' };
}

export function pollutantSubIndex(aqi, pollutantKey) {
  const pollutant = POLLUTANTS.find((item) => item.key === pollutantKey);
  if (!pollutant) return null;
  return aqi && aqi[pollutant.aqiField] != null ? aqi[pollutant.aqiField] : null;
}

/* ------------------------------------------------------------------ */
/* Headline recommendation (FR-06)                                     */
/* ------------------------------------------------------------------ */

const RECOMMENDATIONS = {
  rain: {
    key: 'rain',
    title: 'Rain Check',
    text: 'Carry an umbrella to avoid the chances of rain.',
  },
  heat: {
    key: 'heat',
    title: 'Heat Alert',
    text: "If you don't want to be fried, avoid midday sun and stay hydrated.",
  },
  cold: {
    key: 'cold',
    title: 'Bundle Up',
    text: 'Bone chilling. Wear layers.',
  },
  wind: {
    key: 'wind',
    title: 'Breezy Mode',
    text: 'Expect strong winds. Avoid the combo of lip gloss and open hair.',
  },
  uv: {
    key: 'uv',
    title: 'Sunscreen Day',
    text: 'Apply SPF 30+ and wear sunglasses. Wear scarf also.',
  },
  perfect: {
    key: 'perfect',
    title: 'Perfect Day',
    text: "It's a once-in-a-lifetime kind of day — go for it.",
  },
  warm: {
    key: 'warm',
    title: 'Warm Day',
    text: 'It is warm out. Stay hydrated and take it easy in the afternoon.',
  },
  cool: {
    key: 'cool',
    title: 'Cool Day',
    text: 'A light layer should do it. Enjoy the fresh air.',
  },
  fair: {
    key: 'fair',
    title: 'Fair Day',
    text: 'A steady day. Check the details before you head out.',
  },
};

function isRainy(current, today) {
  const text = String(current?.condition?.text || '').toLowerCase();
  const rainPattern = /rain|drizzle|shower|thunder|storm|sleet/;
  const chance = Number.isFinite(current?.chanceOfRain) ? current.chanceOfRain : 0;
  const forecastChance = Number.isFinite(today?.rainChance) ? today.rainChance : 0;
  return (
    rainPattern.test(text) ||
    chance > THRESHOLDS.rainChance ||
    forecastChance > THRESHOLDS.rainChance
  );
}

/**
 * Priority order from FR-06:
 * Rain > Heat Alert > Bundle Up > Breezy Mode > Sunscreen Day > Perfect Day.
 */
export function getRecommendation({ current, today, airAqi }) {
  if (!current) return null;

  const tempC = Number.isFinite(current.tempC) ? current.tempC : null;
  const feelsC = Number.isFinite(current.feelsC) ? current.feelsC : tempC;
  const windKph = Number.isFinite(current.windKph) ? current.windKph : 0;
  const uv = Number.isFinite(current.uv) ? current.uv : 0;

  let recommendation;

  if (isRainy(current, today)) {
    recommendation = RECOMMENDATIONS.rain;
  } else if (feelsC != null && feelsC > THRESHOLDS.hotFeelsC) {
    recommendation = RECOMMENDATIONS.heat;
  } else if (tempC != null && tempC < THRESHOLDS.coldC) {
    recommendation = RECOMMENDATIONS.cold;
  } else if (windKph > THRESHOLDS.windyKph) {
    recommendation = RECOMMENDATIONS.wind;
  } else if (uv >= THRESHOLDS.highUv) {
    recommendation = RECOMMENDATIONS.uv;
  } else if (
    tempC != null &&
    tempC >= THRESHOLDS.pleasantMinC &&
    tempC <= THRESHOLDS.pleasantMaxC &&
    windKph < THRESHOLDS.calmWindKph
  ) {
    recommendation = RECOMMENDATIONS.perfect;
  } else if (tempC != null && tempC > THRESHOLDS.pleasantMaxC) {
    recommendation = RECOMMENDATIONS.warm;
  } else if (tempC != null && tempC < THRESHOLDS.pleasantMinC) {
    recommendation = RECOMMENDATIONS.cool;
  } else {
    recommendation = RECOMMENDATIONS.fair;
  }

  const secondary =
    Number.isFinite(airAqi) && airAqi > THRESHOLDS.poorAqi
      ? {
          text: 'Air quality is poor. Limit outdoor exertion.',
          linkLabel: 'Open Air Quality',
        }
      : null;

  return { ...recommendation, secondary };
}

/* ------------------------------------------------------------------ */
/* Forecast summary (FR-07.7)                                          */
/* ------------------------------------------------------------------ */

export function getForecastSummary(days, timezone, unit) {
  if (!Array.isArray(days) || days.length === 0) return '';

  const rainyDays = days.filter(
    (day) => (Number.isFinite(day.rainChance) && day.rainChance > 50) || (Number.isFinite(day.precipMm) && day.precipMm >= 0.5),
  );

  const warmest = days.reduce((best, day) => {
    if (!Number.isFinite(day.maxC)) return best;
    if (!best || day.maxC > best.maxC) return day;
    return best;
  }, null);

  const rainSentence =
    rainyDays.length > 0
      ? `Rain expected ${sentenceList(
          rainyDays.slice(0, 3).map((day) => formatWeekday(day.date).toLowerCase()),
        )}.`
      : 'No rain expected this week.';

  if (!warmest) return rainSentence;

  const warmestDay = formatWeekday(warmest.date);
  return `${rainSentence} Warmest day is ${warmestDay} at ${formatTemp(warmest.maxC, unit)}.`;
}

/* ------------------------------------------------------------------ */
/* Weather codes and icons                                             */
/* ------------------------------------------------------------------ */

const WMO_TEXT = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Dense drizzle',
  56: 'Freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};

export function wmoText(code) {
  return WMO_TEXT[code] || 'Variable conditions';
}

export function wmoIconType(code) {
  if (code === 0) return 'clear-day';
  if (code === 1 || code === 2) return 'partly-day';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code === 61 || code === 63) return 'rain';
  if (code === 65) return 'heavy-rain';
  if (code === 66 || code === 67) return 'sleet';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

export function weatherApiIconType(code, isDay, text) {
  const description = String(text || '').toLowerCase();

  if (description.includes('thunder')) return 'thunder';
  if (description.includes('blizzard') || description.includes('snow') || description.includes('ice pellets')) {
    return 'snow';
  }
  if (description.includes('sleet') || description.includes('freezing rain') || description.includes('freezing drizzle')) {
    return 'sleet';
  }
  if (description.includes('drizzle')) return 'drizzle';
  if (description.includes('rain') || description.includes('shower')) return 'rain';
  if (description.includes('fog') || description.includes('mist') || description.includes('haze') || description.includes('smoke')) {
    return 'fog';
  }
  if (description.includes('overcast')) return 'overcast';
  if (description.includes('partly')) return isDay ? 'partly-day' : 'partly-night';
  if (description.includes('cloud')) return 'cloudy';
  if (description.includes('clear') || description.includes('sunny')) {
    return isDay ? 'clear-day' : 'clear-night';
  }

  if (code === 1000) return isDay ? 'clear-day' : 'clear-night';
  if (code === 1003) return isDay ? 'partly-day' : 'partly-night';
  if (code === 1006 || code === 1009) return 'cloudy';
  if ([1030, 1135, 1147].includes(code)) return 'fog';
  if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) {
    return 'rain';
  }
  if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) {
    return 'snow';
  }
  if ([1069, 1072, 1168, 1171, 1198, 1201, 1204, 1207, 1249, 1252, 1261, 1264].includes(code)) {
    return 'sleet';
  }
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 'thunder';
  return 'cloudy';
}

export function conditionTone(current) {
  if (!current) return 'clear';
  const icon = current.condition?.iconType || '';
  if (icon === 'thunder') return 'storm';
  if (icon === 'rain' || icon === 'heavy-rain' || icon === 'drizzle') return 'rain';
  if (icon === 'snow' || icon === 'sleet') return 'snow';
  if (icon === 'fog') return 'fog';
  if (icon === 'overcast' || icon === 'cloudy') return 'cloud';
  if (icon === 'clear-night') return 'night';
  if (current.tempC != null && current.tempC > 35) return 'hot';
  return 'clear';
}
