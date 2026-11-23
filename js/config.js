/**
 * Single source of truth for configuration, thresholds and static reference data.
 * No weather values live here — only city coordinates, scales and interpretation rules.
 */

export const APP = {
  name: 'WeatherFirst',
  version: '1.1',
  tagline: 'Know the sky, the air and the week ahead before you step out.',
};

export const CACHE_TTL_MS = 10 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 10 * 1000;
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_RESULT_LIMIT = 5;

export const DEFAULT_CITY = Object.freeze({
  name: 'Mumbai',
  region: 'Maharashtra',
  country: 'India',
  countryCode: 'IN',
  lat: 19.076,
  lon: 72.8777,
  timezone: 'Asia/Kolkata',
});

export const POPULAR_CITIES = Object.freeze([
  { name: 'Mumbai', region: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 19.076, lon: 72.8777, timezone: 'Asia/Kolkata' },
  { name: 'New Delhi', region: 'Delhi', country: 'India', countryCode: 'IN', lat: 28.6139, lon: 77.209, timezone: 'Asia/Kolkata' },
  { name: 'Bengaluru', region: 'Karnataka', country: 'India', countryCode: 'IN', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata' },
  { name: 'Hyderabad', region: 'Telangana', country: 'India', countryCode: 'IN', lat: 17.385, lon: 78.4867, timezone: 'Asia/Kolkata' },
  { name: 'Chennai', region: 'Tamil Nadu', country: 'India', countryCode: 'IN', lat: 13.0827, lon: 80.2707, timezone: 'Asia/Kolkata' },
  { name: 'Kolkata', region: 'West Bengal', country: 'India', countryCode: 'IN', lat: 22.5726, lon: 88.3639, timezone: 'Asia/Kolkata' },
  { name: 'Pune', region: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 18.5204, lon: 73.8567, timezone: 'Asia/Kolkata' },
  { name: 'Ahmedabad', region: 'Gujarat', country: 'India', countryCode: 'IN', lat: 23.0225, lon: 72.5714, timezone: 'Asia/Kolkata' },
  { name: 'Indore', region: 'Madhya Pradesh', country: 'India', countryCode: 'IN', lat: 22.7196, lon: 75.8577, timezone: 'Asia/Kolkata' },
  { name: 'New York', region: 'New York', country: 'United States', countryCode: 'US', lat: 40.7128, lon: -74.006, timezone: 'America/New_York' },
  { name: 'London', region: 'England', country: 'United Kingdom', countryCode: 'GB', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
]);

export const API = Object.freeze({
  proxy: '/api/weather',
  geocode: 'https://geocoding-api.open-meteo.com/v1/search',
  reverseGeocode: 'https://nominatim.openstreetmap.org/reverse',
  forecast: 'https://api.open-meteo.com/v1/forecast',
  airQuality: 'https://air-quality-api.open-meteo.com/v1/air-quality',
});

export const SOURCES = Object.freeze({
  current: 'WeatherAPI.com',
  forecast: 'Open-Meteo',
  air: 'Open-Meteo Air Quality',
  map: 'Open-Meteo · OpenStreetMap',
});

export const STORAGE_KEYS = Object.freeze({
  city: 'wf:city:v1',
  unit: 'wf:unit:v1',
  mapLayer: 'wf:map-layer:v1',
  mapOpacity: 'wf:map-opacity:v1',
  cache: 'wf:cache:v1',
});

export const TABS = Object.freeze(['weather', 'air-quality', 'maps']);

/** FR-06 / FR-07 interpretation thresholds. Keep every number here. */
export const THRESHOLDS = Object.freeze({
  coldC: 10,
  pleasantMinC: 20,
  pleasantMaxC: 30,
  hotFeelsC: 38,
  rainChance: 60,
  windyKph: 40,
  highUv: 8,
  poorAqi: 150,
  calmWindKph: 30,
});

export const AQI_SCALE_MAX = 500;

/** FR-08.2 — six categories. Colour is always paired with a text label. */
export const AQI_CATEGORIES = Object.freeze([
  {
    key: 'good',
    label: 'Good',
    range: '0–50',
    min: 0,
    max: 50,
    color: '#0f9d58',
    soft: '#e4f6ec',
    ink: '#075e36',
    guidance: 'Air is clean. Enjoy outdoor activities.',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    range: '51–100',
    min: 51,
    max: 100,
    color: '#c47a05',
    soft: '#fdf1d7',
    ink: '#744603',
    guidance: 'Fine for most. Very sensitive people should limit long outdoor exertion.',
  },
  {
    key: 'sensitive',
    label: 'Unhealthy for Sensitive Groups',
    shortLabel: 'Sensitive groups',
    range: '101–150',
    min: 101,
    max: 150,
    color: '#d85a14',
    soft: '#fde9d8',
    ink: '#853206',
    guidance: 'Children, elderly and people with asthma or heart conditions should reduce outdoor exertion.',
  },
  {
    key: 'unhealthy',
    label: 'Unhealthy',
    range: '151–200',
    min: 151,
    max: 200,
    color: '#c92d2d',
    soft: '#fbe2e2',
    ink: '#8a1717',
    guidance: 'Everyone should reduce prolonged outdoor exertion. Consider a mask.',
  },
  {
    key: 'very-unhealthy',
    label: 'Very Unhealthy',
    range: '201–300',
    min: 201,
    max: 300,
    color: '#7c3aed',
    soft: '#f0e8fd',
    ink: '#4f1d9c',
    guidance: 'Avoid outdoor activity. Keep windows closed.',
  },
  {
    key: 'hazardous',
    label: 'Hazardous',
    range: '301+',
    min: 301,
    max: 500,
    color: '#7f1d1d',
    soft: '#f3dede',
    ink: '#4f1111',
    guidance: 'Stay indoors. Avoid all outdoor exertion.',
  },
]);

/** FR-08.3 / FR-08.9 — pollutant cards. `aqiField` is supplied by Open-Meteo. */
export const POLLUTANTS = Object.freeze([
  {
    key: 'pm2_5',
    label: 'PM2.5',
    longLabel: 'Fine particles',
    unit: 'µg/m³',
    aqiField: 'us_aqi_pm2_5',
    explainer: 'Fine particles from traffic, burning and dust.',
  },
  {
    key: 'pm10',
    label: 'PM10',
    longLabel: 'Coarse particles',
    unit: 'µg/m³',
    aqiField: 'us_aqi_pm10',
    explainer: 'Coarse dust and pollen that irritate airways.',
  },
  {
    key: 'ozone',
    label: 'O₃',
    longLabel: 'Ozone',
    unit: 'µg/m³',
    aqiField: 'us_aqi_ozone',
    explainer: 'Ground-level ozone formed in sunlight.',
  },
  {
    key: 'nitrogen_dioxide',
    label: 'NO₂',
    longLabel: 'Nitrogen dioxide',
    unit: 'µg/m³',
    aqiField: 'us_aqi_nitrogen_dioxide',
    explainer: 'Traffic and combustion fumes.',
  },
  {
    key: 'sulphur_dioxide',
    label: 'SO₂',
    longLabel: 'Sulphur dioxide',
    unit: 'µg/m³',
    aqiField: 'us_aqi_sulphur_dioxide',
    explainer: 'Coal and fuel burning.',
  },
  {
    key: 'carbon_monoxide',
    label: 'CO',
    longLabel: 'Carbon monoxide',
    unit: 'µg/m³',
    aqiField: 'us_aqi_carbon_monoxide',
    explainer: 'Incomplete combustion from vehicles and stoves.',
  },
]);

/** FR-09.2 / FR-09.4 — four map layers with fixed colour scales. */
export const MAP_LAYERS = Object.freeze([
  {
    key: 'precipitation',
    label: 'Precipitation',
    field: 'precipitation',
    unit: 'mm/h',
    min: 0,
    max: 10,
    decimals: 1,
    emptyLabel: 'No precipitation in this area right now.',
    stops: [
      { value: 0, color: '#bfdbfe' },
      { value: 0.1, color: '#93c5fd' },
      { value: 1, color: '#3b82f6' },
      { value: 4, color: '#6366f1' },
      { value: 10, color: '#7c3aed' },
    ],
  },
  {
    key: 'clouds',
    label: 'Clouds',
    field: 'cloud_cover',
    unit: '%',
    min: 0,
    max: 100,
    decimals: 0,
    emptyLabel: 'Clear skies in this area right now.',
    stops: [
      { value: 0, color: '#f8fafc' },
      { value: 25, color: '#e2e8f0' },
      { value: 55, color: '#94a3b8' },
      { value: 80, color: '#64748b' },
      { value: 100, color: '#334155' },
    ],
  },
  {
    key: 'temperature',
    label: 'Temperature',
    field: 'temperature_2m',
    unit: '°C',
    min: -10,
    max: 45,
    decimals: 0,
    emptyLabel: 'Temperature data is unavailable for this area.',
    stops: [
      { value: -10, color: '#312e81' },
      { value: 0, color: '#3b82f6' },
      { value: 10, color: '#22d3ee' },
      { value: 20, color: '#facc15' },
      { value: 30, color: '#fb923c' },
      { value: 40, color: '#ef4444' },
      { value: 45, color: '#991b1b' },
    ],
  },
  {
    key: 'wind',
    label: 'Wind',
    field: 'wind_speed_10m',
    unit: 'km/h',
    min: 0,
    max: 80,
    decimals: 0,
    emptyLabel: 'Wind data is unavailable for this area.',
    stops: [
      { value: 0, color: '#e0f2fe' },
      { value: 10, color: '#67e8f9' },
      { value: 20, color: '#34d399' },
      { value: 40, color: '#fbbf24' },
      { value: 60, color: '#f97316' },
      { value: 80, color: '#dc2626' },
    ],
  },
]);

export const MAP_GRID_SIZE = 9;
export const MAP_GRID_LAT_SPAN = 5.5;
