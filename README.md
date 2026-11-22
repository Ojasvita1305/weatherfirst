# WeatherFirst

**Know the sky, the air and the week ahead before you step out.**

Live app: **https://weatherfirst-six.vercel.app**

WeatherFirst is a responsive weather dashboard built with plain HTML, CSS and
vanilla JavaScript. It shows current conditions, a 7-day forecast, US AQI air
quality and an interactive weather map for any city, with Mumbai as the default.

## Features

- **Weather tab** — current conditions from WeatherAPI.com, an app-generated
  "today's take", key metrics, sunrise/sunset and a 7-day forecast with an
  expandable hourly breakdown.
- **Air quality tab** — US AQI hero, health guidance, dominant pollutant,
  pollutant cards with sub-indices, a 24-hour trend and a 3-day outlook.
- **Maps tab** — Leaflet + OpenStreetMap base map with precipitation, cloud,
  temperature and wind overlays generated from an Open-Meteo grid. Includes an
  opacity slider, legend, city marker popup, recenter button and layer
  persistence.
- **Search** — 300 ms debounced Open-Meteo geocoding autocomplete (up to 5
  results), disambiguation, stale-response protection, empty-input validation
  and a clear not-found message.
- **Location** — geolocation is only requested after the user taps "Use my
  location"; denial leaves the current city untouched.
- **Resilience** — independent loading, error and retry states for every
  section, a 10-minute client cache, offline/stale banner and cached-data
  fallback.
- **Developer data viewer** — collapsed by default; formatted/raw JSON for each
  successful source, with copy support.
- **Accessibility** — ARIA tabs and combobox, keyboard navigation, skip link,
  focus states and 44 px touch targets on small screens.
- **Responsive** — works from 320 px phones (fixed bottom tab bar) up to wide
  desktops without horizontal page overflow.

## Tech

- Static HTML/CSS/vanilla ES modules.
- One Vercel serverless function (`api/weather.js`) that proxies WeatherAPI.com
  so the API key stays server-side. The proxy validates requests, maps upstream
  errors and applies a best-effort per-IP rate limit.
- Open-Meteo for geocoding, the 7-day forecast, hourly data and air quality.
- Leaflet 1.9.4 is vendored in `assets/vendor/leaflet/`; map tiles come from
  OpenStreetMap.

## Data sources

| Data | Source |
| --- | --- |
| Current conditions | WeatherAPI.com via `/api/weather` |
| 7-day forecast + hourly | Open-Meteo Forecast API |
| US AQI + pollutants | Open-Meteo Air Quality API |
| City search | Open-Meteo Geocoding API |
| Map base tiles | OpenStreetMap |
| Map overlays | Open-Meteo grid (9×9 points, rendered as a canvas heatmap) |

WeatherAPI's free plan only returns three forecast days, so the required 7-day
forecast and hourly detail come from Open-Meteo. AQI values and categories use
the US EPA scale reported by Open-Meteo; the app does not estimate pollution.

## Local development

Requirements: Node.js 20+ and the Vercel CLI.

1. Copy `.env.example` to `.env` and add your WeatherAPI key:
   ```bash
   WEATHERAPI_KEY=your_weatherapi_key_here
   ```
2. Install the Vercel CLI if needed: `npm i -g vercel`
3. Run `vercel dev` (or `npm run dev`) and open the printed local URL.

The key is read only by the serverless function. Never put it in client-side
JavaScript.

## Deploying

1. Import this repository into Vercel.
2. Add `WEATHERAPI_KEY` under **Project → Settings → Environment Variables** for
   Production, Preview and Development.
3. Deploy. Every push to `main` triggers a new production deployment.

## Project structure

```
index.html                 app shell and tab panels
css/styles.css             design system, states and responsive layout
js/app.js                  state, loading, tabs, geolocation, retries
js/api.js                  provider adapters, normalisers and caching
js/config.js               cities, thresholds, AQI categories, map layers
js/strings.js              user-facing copy
js/utils.js                formatting, fetch/error, storage and copy helpers
js/interpretation.js       recommendations, AQI helpers, icon mapping
js/icons.js                inline SVG icon set
js/components/             header, weather, air quality, maps, data viewer
api/weather.js             serverless WeatherAPI.com proxy
assets/vendor/leaflet/     vendored Leaflet 1.9.4
```

## Notes

- The map overlays are generated client-side from a 9×9 Open-Meteo grid and
  drawn as a blurred canvas image layer. They are indicative, not official
  meteorological raster products.
- Rate limiting in a serverless function is per instance and best-effort; it is
  a safeguard, not a hard global quota.
- Health guidance follows standard US EPA AQI categories. It is informational
  and is not an official weather or health advisory.
