import { escapeHtml } from './utils.js';

const WEATHER_ICONS = {
  'clear-day': `
    <svg viewBox="0 0 64 64" focusable="false">
      <circle cx="32" cy="32" r="12.5" fill="#fbbf24" />
      <circle cx="32" cy="32" r="8" fill="#fde68a" />
      <g stroke="#f59e0b" stroke-width="3.4" stroke-linecap="round">
        <path d="M32 5.5v7" /><path d="M32 51.5v7" /><path d="M5.5 32h7" /><path d="M51.5 32h7" />
        <path d="M13.3 13.3l5 5" /><path d="M45.7 45.7l5 5" /><path d="M50.7 13.3l-5 5" /><path d="M18.3 45.7l-5 5" />
      </g>
    </svg>`,
  'clear-night': `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M41 9.5c-10.6 2.3-17.3 12.2-15 22.8 2.3 10.6 12.2 17.3 22.8 15-4.7 4.6-11.2 7.2-18.1 7.2-14.4 0-26-11.6-26-26 0-10.8 6.6-20.1 16-24 4.6-1.7 9.5-2.4 14.2-1.7z" fill="#c7d2fe" />
      <circle cx="47" cy="17" r="2.2" fill="#e0e7ff" /><circle cx="53" cy="27" r="1.5" fill="#e0e7ff" /><circle cx="43" cy="9" r="1.3" fill="#e0e7ff" />
    </svg>`,
  'partly-day': `
    <svg viewBox="0 0 64 64" focusable="false">
      <circle cx="23" cy="23" r="9.5" fill="#fbbf24" />
      <g stroke="#f59e0b" stroke-width="3" stroke-linecap="round">
        <path d="M23 6.5v5.2" /><path d="M23 34.3v5.2" /><path d="M6.5 23h5.2" /><path d="M34.3 23h5.2" />
        <path d="M11.3 11.3l3.7 3.7" /><path d="M31 31l3.7 3.7" /><path d="M34.7 11.3L31 15" /><path d="M15 31l-3.7 3.7" />
      </g>
      <path d="M20 47c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C35.2 32.8 39 30.6 43.4 30.6 49.8 30.6 55 35.8 55 42.2S49.8 53.8 43.4 53.8H25c-2.8 0-5-2.3-5-5.1z" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2.2" />
    </svg>`,
  'partly-night': `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M35 9c-7.6 1.8-12.4 9.2-10.6 16.8 1.8 7.6 9.2 12.4 16.8 10.6-3.5 3.4-8.3 5.4-13.4 5.4-10.7 0-19.3-8.6-19.3-19.3 0-8 4.9-14.9 11.9-17.8 4.6-1.9 9.8-1.9 14.6.3z" fill="#c7d2fe" />
      <path d="M22 47c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C37.2 32.8 41 30.6 45.4 30.6 51.8 30.6 57 35.8 57 42.2S51.8 53.8 45.4 53.8H27c-2.8 0-5-2.3-5-5.1z" fill="#eef2ff" stroke="#94a3b8" stroke-width="2.2" />
    </svg>`,
  cloudy: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M17 45c0-6.1 4.9-11 11-11 1.1 0 2.1.2 3.1.5C33.6 31 37.4 29 41.7 29 48 29 53 34 53 40.2S48 51 41.7 51H22c-2.8 0-5-2.2-5-5z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2.2" />
      <path d="M24 38.5h20" stroke="#cbd5e1" stroke-width="2.4" stroke-linecap="round" />
    </svg>`,
  overcast: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M11 36c0-5.5 4.4-10 9.9-10 1 0 2 .2 2.9.5 2.2-3 5.7-5 9.7-5 6.5 0 11.8 5.2 11.8 11.6S39.8 44.7 33.3 44.7H20c-2.4 0-4.4-2-4.4-4.5z" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2" />
      <path d="M20 47c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C35.2 32.8 39 30.6 43.4 30.6 49.8 30.6 55 35.8 55 42.2S49.8 53.8 43.4 53.8H25c-2.8 0-5-2.3-5-5.1z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2.2" />
    </svg>`,
  fog: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M17 34c0-5.5 4.4-10 9.9-10 1 0 2 .2 2.9.5 2.2-3 5.7-5 9.7-5 6.5 0 11.8 5.2 11.8 11.6S45.8 42.7 39.3 42.7H26c-2.4 0-4.4-2-4.4-4.5z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2" />
      <g stroke="#94a3b8" stroke-width="2.8" stroke-linecap="round">
        <path d="M14 48h36" /><path d="M19 54h26" /><path d="M11 42h8" />
      </g>
    </svg>`,
  drizzle: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M17 36c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C33.2 22.8 37 20.6 41.4 20.6 47.8 20.6 53 25.8 53 32.2S47.8 43.8 41.4 43.8H22c-2.8 0-5-2.3-5-5.1z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2.2" />
      <g fill="#38bdf8"><path d="M24 47l-2 6h3l2-6z" /><path d="M34 47l-2 6h3l2-6z" /><path d="M44 47l-2 6h3l2-6z" /></g>
    </svg>`,
  rain: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M17 35c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C33.2 21.8 37 19.6 41.4 19.6 47.8 19.6 53 24.8 53 31.2S47.8 42.8 41.4 42.8H22c-2.8 0-5-2.3-5-5.1z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2.2" />
      <g stroke="#38bdf8" stroke-width="3.2" stroke-linecap="round">
        <path d="M24 47l-2 7" /><path d="M34 47l-2 7" /><path d="M44 47l-2 7" />
      </g>
    </svg>`,
  'heavy-rain': `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M15 34c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C31.2 20.8 35 18.6 39.4 18.6 45.8 18.6 51 23.8 51 30.2S45.8 41.8 39.4 41.8H20c-2.8 0-5-2.3-5-5.1z" fill="#cbd5e1" stroke="#64748b" stroke-width="2.2" />
      <g stroke="#2563eb" stroke-width="3.2" stroke-linecap="round">
        <path d="M20 46l-2 7" /><path d="M28 46l-2 7" /><path d="M36 46l-2 7" /><path d="M44 46l-2 7" /><path d="M52 46l-2 7" />
      </g>
    </svg>`,
  thunder: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M16 33c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C32.2 19.8 36 17.6 40.4 17.6 46.8 17.6 52 22.8 52 29.2S46.8 40.8 40.4 40.8H21c-2.8 0-5-2.3-5-5.1z" fill="#cbd5e1" stroke="#64748b" stroke-width="2.2" />
      <path d="M35 38l-8 13h7l-3 10 11-15h-7l4-8z" fill="#facc15" stroke="#f59e0b" stroke-width="1.4" stroke-linejoin="round" />
    </svg>`,
  snow: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M17 34c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C33.2 20.8 37 18.6 41.4 18.6 47.8 18.6 53 23.8 53 30.2S47.8 41.8 41.4 41.8H22c-2.8 0-5-2.3-5-5.1z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2.2" />
      <g stroke="#60a5fa" stroke-width="2" stroke-linecap="round">
        <path d="M24 47v8M20.5 49l7 4M27.5 49l-7 4" />
        <path d="M38 47v8M34.5 49l7 4M41.5 49l-7 4" />
        <path d="M50 47v8M46.5 49l7 4M53.5 49l-7 4" />
      </g>
    </svg>`,
  sleet: `
    <svg viewBox="0 0 64 64" focusable="false">
      <path d="M17 34c0-6 4.8-10.8 10.8-10.8 1 0 2 .1 3 .4C33.2 20.8 37 18.6 41.4 18.6 47.8 18.6 53 23.8 53 30.2S47.8 41.8 41.4 41.8H22c-2.8 0-5-2.3-5-5.1z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2.2" />
      <path d="M25 47l-2 7" stroke="#38bdf8" stroke-width="3.2" stroke-linecap="round" />
      <path d="M39 47v8M35.5 49l7 4M42.5 49l-7 4" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" />
    </svg>`,
  wind: `
    <svg viewBox="0 0 64 64" focusable="false">
      <g fill="none" stroke="#38bdf8" stroke-width="3.4" stroke-linecap="round">
        <path d="M8 24h28a6 6 0 10-6-6" />
        <path d="M8 34h38a6 6 0 11-6 6" />
        <path d="M8 44h18" />
      </g>
    </svg>`,
};

export function weatherIcon(type, { className = '', label = '' } = {}) {
  const svg = WEATHER_ICONS[type] || WEATHER_ICONS.cloudy;
  const accessible = label
    ? `role="img" aria-label="${escapeHtml(label)}"`
    : 'aria-hidden="true"';
  return `<span class="wx-icon ${escapeHtml(className)}" ${accessible}>${svg}</span>`;
}

const METRIC_ICONS = {
  humidity: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5s6 6.2 6 10.3a6 6 0 11-12 0c0-4.1 6-10.3 6-10.3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9.5 14.5a2.6 2.6 0 002.6 2.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h10a3 3 0 10-3-3M3 12h13.5a2.5 2.5 0 11-2.5 2.5M3 16h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  pressure: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 12l4-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M6.5 15.5a6 6 0 0111 0" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"/></svg>`,
  visibility: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 18c0-2.8 2.2-5 5-5 .5 0 1 .1 1.5.2A4.2 4.2 0 0117 11a4.5 4.5 0 010 9H8.5a2 2 0 01-2-2z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  uv: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M6 14a6 6 0 0112 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 2.5v3M5.5 6l1.4 1.4M18.5 6l-1.4 1.4M2.5 10h2M19.5 10h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  sunset: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18M6 14a6 6 0 0112 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 5.5v-3M5.5 9l1.4-1.4M18.5 9l-1.4-1.4M2.5 10h2M19.5 10h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M9 21l3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  rain: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14.5a4.5 4.5 0 01.7-9 5.5 5.5 0 0110.5 1.7A3.9 3.9 0 0118 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M6 10l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="currentColor" opacity=".7"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 6.3M20 5v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l9 16H3l9-16z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`,
  info: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>`,
};

export function metricIcon(name) {
  return METRIC_ICONS[name] || METRIC_ICONS.info;
}
