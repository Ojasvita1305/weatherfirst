'use strict';

/**
 * Thin serverless proxy for WeatherAPI.com.
 *
 * The API key is read from the WEATHERAPI_KEY environment variable and is never
 * sent to, or readable by, the browser. Only the current-conditions endpoint is
 * exposed; forecast and air quality come from keyless Open-Meteo endpoints.
 */

const WEATHERAPI_URL = 'https://api.weatherapi.com/v1/current.json';
const UPSTREAM_TIMEOUT_MS = 8000;
const RATE_LIMIT = 90;
const RATE_WINDOW_MS = 60 * 1000;

/** @type {Map<string, {count: number, resetAt: number}>} */
const buckets = new Map();

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (buckets.size > 500) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

function sendJson(res, status, body, cacheable) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheable ? 'public, s-maxage=600, stale-while-revalidate=1200' : 'no-store');
  res.end(JSON.stringify(body));
}

function fail(res, status, type, message) {
  sendJson(res, status, { error: { type, message } }, false);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'method_not_allowed', 'Method not allowed.');
  }

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return fail(res, 500, 'config', 'Service configuration error.');
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return fail(res, 429, 'rate_limit', 'Too many requests. Please try again in a minute.');
  }

  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return fail(res, 400, 'bad_request', 'Invalid request.');
  }

  const action = url.searchParams.get('action') || 'current';
  if (action !== 'current') {
    return fail(res, 400, 'bad_request', 'Unsupported action.');
  }

  let query;
  const latRaw = url.searchParams.get('lat');
  const lonRaw = url.searchParams.get('lon');

  if (latRaw !== null || lonRaw !== null) {
    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return fail(res, 400, 'bad_request', 'Invalid coordinates.');
    }
    query = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  } else {
    query = String(url.searchParams.get('q') || '').trim();
    if (query.length < 1 || query.length > 120 || /[\u0000-\u001f\u007f]/.test(query)) {
      return fail(res, 400, 'bad_request', 'Enter a city name to search.');
    }
  }

  const upstream = new URL(WEATHERAPI_URL);
  upstream.searchParams.set('key', apiKey);
  upstream.searchParams.set('q', query);
  upstream.searchParams.set('aqi', 'no');
  upstream.searchParams.set('lang', 'en');

  let response;
  try {
    response = await fetch(upstream, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return timedOut
      ? fail(res, 504, 'timeout', 'The weather service took too long to respond.')
      : fail(res, 502, 'unavailable', 'Weather service is temporarily unavailable.');
  }

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return fail(res, 502, 'malformed', 'Weather service returned an unexpected response.');
  }

  if (!response.ok || (payload && payload.error)) {
    const code = payload && payload.error ? payload.error.code : null;

    if (response.status === 429) {
      res.setHeader('Retry-After', '60');
      return fail(res, 429, 'rate_limit', 'Too many requests. Please try again in a minute.');
    }

    if (
      response.status === 401 ||
      response.status === 403 ||
      [1002, 2006, 2007, 2008, 2009, 2010].includes(code)
    ) {
      // Never surface the upstream message — it can contain configuration detail.
      return fail(res, 500, 'config', 'Service configuration error.');
    }

    if (code === 1006 || response.status === 400) {
      return fail(res, 404, 'city_not_found', 'City not found. Check the spelling or try a nearby city.');
    }

    return fail(res, 502, 'unavailable', 'Weather service is temporarily unavailable.');
  }

  if (!payload || !payload.location || !payload.current) {
    return fail(res, 502, 'malformed', 'Weather service returned an unexpected response.');
  }

  res.setHeader('X-Data-Source', 'WeatherAPI.com');
  sendJson(res, 200, payload, true);
};
