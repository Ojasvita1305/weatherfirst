import { REQUEST_TIMEOUT_MS } from './config.js';
import { STRINGS } from './strings.js';

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const round = (value, decimals = 0) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function convertTemp(celsius, unit) {
  if (!Number.isFinite(celsius)) return null;
  return unit === 'f' ? (celsius * 9) / 5 + 32 : celsius;
}

export const tempUnit = (unit) => (unit === 'f' ? '°F' : '°C');

export function formatTemp(celsius, unit, { decimals = 0, withUnit = false } = {}) {
  const value = convertTemp(celsius, unit);
  if (!Number.isFinite(value)) return '—';
  const rounded = round(value, decimals);
  const text = decimals > 0 ? formatNumber(rounded, decimals) : String(Math.round(rounded));
  return withUnit ? `${text}${tempUnit(unit)}` : `${text}°`;
}

export function formatTempValue(celsius, unit, { decimals = 0 } = {}) {
  const value = convertTemp(celsius, unit);
  if (!Number.isFinite(value)) return '—';
  return formatNumber(round(value, decimals), decimals);
}

export function formatWind(kph) {
  return Number.isFinite(kph) ? `${Math.round(kph)} km/h` : '—';
}

export function formatPressure(hpa) {
  return Number.isFinite(hpa) ? `${Math.round(hpa)} hPa` : '—';
}

export function formatVisibility(km) {
  return Number.isFinite(km) ? `${formatNumber(km, 1)} km` : '—';
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : '—';
}

export function uvLabel(uv) {
  if (!Number.isFinite(uv)) return '';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

export function countryFlag(code) {
  if (!code || String(code).length !== 2) return '';
  const upper = String(code).toUpperCase();
  try {
    return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
  } catch {
    return '';
  }
}

export function formatHour(isoLocal) {
  if (!isoLocal || typeof isoLocal !== 'string') return '—';
  const time = isoLocal.includes('T')
    ? isoLocal.split('T')[1]
    : isoLocal.includes(' ')
      ? isoLocal.split(' ')[1]
      : isoLocal;
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  if (!Number.isFinite(hours)) return '—';
  const minutes = Number(minutesRaw);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  const minuteText = Number.isFinite(minutes) && minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : '';
  return `${display}${minuteText} ${suffix}`;
}

export function formatObserved(isoLocal) {
  return formatHour(isoLocal);
}

export function formatLocalClock(timezone) {
  const now = new Date();
  try {
    const datePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || undefined,
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(now);
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return `${datePart} · ${timePart}`;
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  }
}

export function cityDateString(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayLabel(dateString, timezone) {
  if (!dateString) return '—';
  const today = cityDateString(timezone);
  if (dateString === today) return STRINGS.weather.today;
  if (dateString === addDays(today, 1)) return STRINGS.weather.tomorrow;
  return formatWeekday(dateString, 'short');
}

export function formatWeekday(dateString, width = 'long') {
  if (!dateString) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: width, timeZone: 'UTC' }).format(
      new Date(`${dateString}T12:00:00Z`),
    );
  } catch {
    return '—';
  }
}

export function shortDate(dateString) {
  if (!dateString) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${dateString}T12:00:00Z`));
  } catch {
    return '—';
  }
}

export function relativeTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '—';
  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hr ago';
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function sentenceList(items) {
  const list = items.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isAbortError(error) {
  return Boolean(error) && (error.name === 'AbortError' || error.code === 20);
}

export class ApiError extends Error {
  constructor(type, message, { status = 0, retryable = true } = {}) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.status = status;
    this.retryable = retryable;
  }
}

const ERROR_MESSAGES = {
  offline: STRINGS.errors.offline,
  config: STRINGS.errors.config,
  rate_limit: STRINGS.errors.rateLimit,
  unavailable: STRINGS.errors.unavailable,
  timeout: STRINGS.errors.timeout,
  city_not_found: STRINGS.errors.notFound,
  not_found: STRINGS.errors.notFound,
  malformed: STRINGS.errors.malformed,
  unknown: STRINGS.errors.unknown,
};

export function friendlyError(error) {
  if (!error) return STRINGS.errors.unknown;
  if (error.type && ERROR_MESSAGES[error.type]) return ERROR_MESSAGES[error.type];
  return STRINGS.errors.unknown;
}

/**
 * Fetch JSON with a 10 second timeout, an optional external AbortSignal and
 * normalised errors. Returns the parsed body plus the raw response text so the
 * developer data viewer can show exactly what the API sent.
 */
export async function fetchJson(url, { signal, timeoutMs = REQUEST_TIMEOUT_MS, headers } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError('offline', STRINGS.errors.offline);
  }

  const controller = new AbortController();
  let timedOut = false;
  let abortedExternally = false;

  const handleExternalAbort = () => {
    abortedExternally = true;
    controller.abort();
  };

  if (signal) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    signal.addEventListener('abort', handleExternalAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', ...(headers || {}) },
    });

    const raw = await response.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        throw new ApiError('malformed', STRINGS.errors.malformed, { status: response.status });
      }
    }

    if (!response.ok) {
      const type = data && data.error && data.error.type;
      if (type) {
        throw new ApiError(type, data.error.message || ERROR_MESSAGES[type] || STRINGS.errors.unknown, {
          status: response.status,
        });
      }
      if (response.status === 429) {
        throw new ApiError('rate_limit', STRINGS.errors.rateLimit, { status: 429 });
      }
      if (response.status === 404) {
        throw new ApiError('not_found', STRINGS.errors.notFound, { status: 404 });
      }
      if (response.status >= 500) {
        throw new ApiError('unavailable', STRINGS.errors.unavailable, { status: response.status });
      }
      throw new ApiError('unknown', STRINGS.errors.unknown, { status: response.status });
    }

    if (data == null) {
      throw new ApiError('malformed', STRINGS.errors.malformed, { status: response.status });
    }

    return { data, raw };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (abortedExternally && !timedOut) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (timedOut) {
      throw new ApiError('timeout', STRINGS.errors.timeout);
    }
    if (isAbortError(error)) {
      throw error;
    }
    throw new ApiError('unavailable', STRINGS.errors.unavailable);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', handleExternalAbort);
  }
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable; the app still works in memory */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function legacyCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function copyText(text) {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path (permission denied, etc.) */
    }
  }
  return legacyCopy(text);
}

export function formatCoordinates(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lon).toFixed(2)}° ${lonDir}`;
}
