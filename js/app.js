import { DEFAULT_CITY, POPULAR_CITIES, SOURCES, STORAGE_KEYS, TABS } from './config.js';
import { getAirQuality, getCurrent, getForecast, getMapGrid, invalidate } from './api.js';
import { getAqiCategory } from './interpretation.js';
import { STRINGS } from './strings.js';
import {
  formatLocalClock,
  isAbortError,
  qs,
  storage,
} from './utils.js';
import { initHeader } from './components/header.js';
import {
  renderCurrent,
  renderForecast,
} from './components/weather.js';
import { renderAir } from './components/air-quality.js';
import {
  clearDataViewer,
  initDataViewer,
  updateDataViewer,
} from './components/data-viewer.js';
import {
  ensureMap,
  invalidateMapSize,
  isMapReady,
  setMapGrid,
  updateMapContext as syncMapContext,
} from './components/maps.js';

const emptySection = () => ({
  status: 'idle',
  data: null,
  meta: null,
  error: null,
  refreshError: null,
  stale: false,
});

const emptyMapSection = () => ({
  status: 'idle',
  data: null,
  meta: null,
  error: null,
  refreshError: null,
  stale: false,
  cityKey: null,
});

function normaliseCity(city) {
  if (!city) return null;
  const lat = Number(city.lat);
  const lon = Number(city.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return {
    name: String(city.name || 'Location').trim() || 'Location',
    region: String(city.region || '').trim(),
    country: String(city.country || '').trim(),
    countryCode: String(city.countryCode || '').toUpperCase().slice(0, 2),
    lat,
    lon,
    timezone: city.timezone || 'UTC',
  };
}

function loadSavedCity() {
  const saved = storage.get(STORAGE_KEYS.city, null);
  const normalised = normaliseCity(saved);
  return normalised || { ...DEFAULT_CITY };
}

const storedUnit = storage.get(STORAGE_KEYS.unit, 'c');
const storedLayer = storage.get(STORAGE_KEYS.mapLayer, 'precipitation');
const storedOpacity = Number(storage.get(STORAGE_KEYS.mapOpacity, 0.6));

const store = {
  city: loadSavedCity(),
  unit: storedUnit === 'f' ? 'f' : 'c',
  activeTab: 'weather',
  expandedDay: null,
  epoch: 0,
  mapEpoch: 0,
  map: {
    loaded: false,
    layer: ['precipitation', 'clouds', 'temperature', 'wind'].includes(storedLayer) ? storedLayer : 'precipitation',
    opacity: Number.isFinite(storedOpacity) ? Math.min(1, Math.max(0.2, storedOpacity)) : 0.6,
  },
  data: {
    current: emptySection(),
    forecast: emptySection(),
    air: emptySection(),
    map: emptyMapSection(),
  },
  controllers: {},
};

const cityKey = (city) => `${Number(city.lat).toFixed(3)},${Number(city.lon).toFixed(3)}`;

let header = null;
let toastTimer = null;

const TAB_CONFIG = [
  { key: 'weather', button: 'tab-weather', panel: 'panel-weather' },
  { key: 'air-quality', button: 'tab-air', panel: 'panel-air' },
  { key: 'maps', button: 'tab-maps', panel: 'panel-maps' },
];

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */

function toast(message) {
  const element = qs('#toast');
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    element.hidden = true;
  }, 4500);
}

function updateCityHeader() {
  const city = store.city;
  qs('#city-name').textContent = city.name;
  const meta = [city.region, city.country].filter(Boolean).join(', ');
  qs('#city-meta').textContent = meta || 'Selected location';
  qs('#local-time').textContent = formatLocalClock(city.timezone);
  document.title = `${city.name} — WeatherFirst`;
}

function updateAqiBadge() {
  const badge = qs('#tab-aqi');
  const tab = qs('#tab-air');
  if (!badge || !tab) return;

  const air = store.data.air.data;
  const aqi = air?.aqi;
  if (!Number.isFinite(aqi)) {
    badge.hidden = true;
    badge.textContent = '';
    tab.removeAttribute('aria-label');
    return;
  }

  const category = getAqiCategory(aqi);
  badge.hidden = false;
  badge.textContent = String(Math.round(aqi));
  badge.dataset.category = category?.key || '';
  badge.style.setProperty('--badge-color', category?.color || '#64748b');
  tab.setAttribute('aria-label', `Air Quality, AQI ${Math.round(aqi)}, ${category?.label || 'unavailable'}`);
}

function setSection(source, patch) {
  store.data[source] = { ...store.data[source], ...patch };
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderCurrentSection() {
  renderCurrent(qs('#current-section'), {
    section: {
      ...store.data.current,
      today: store.data.forecast.data?.days?.[0] || null,
    },
    city: store.city,
    unit: store.unit,
    airSection: store.data.air,
    onRetry: retry,
    onOpenAir: openAirTab,
  });
}

function renderForecastSection() {
  renderForecast(qs('#forecast-section'), {
    section: store.data.forecast,
    city: store.city,
    unit: store.unit,
    expandedDay: store.expandedDay,
    onRetry: retry,
    onToggleDay: (date) => {
      store.expandedDay = store.expandedDay === date ? null : date;
      renderForecastSection();
    },
  });
}

function renderAirSection() {
  renderAir(qs('#air-section'), {
    section: store.data.air,
    city: store.city,
    onRetry: retry,
  });
}

function renderSection(source) {
  if (source === 'current') renderCurrentSection();
  if (source === 'forecast') renderForecastSection();
  if (source === 'air') renderAirSection();
}

function renderAll() {
  renderCurrentSection();
  renderForecastSection();
  renderAirSection();
  updateAqiBadge();
}

/* ------------------------------------------------------------------ */
/* City and data loading                                               */
/* ------------------------------------------------------------------ */

function mergeCity(apiCity) {
  if (!apiCity) return;
  const merged = normaliseCity({
    ...store.city,
    name: apiCity.name || store.city.name,
    region: apiCity.region || store.city.region,
    country: apiCity.country || store.city.country,
    countryCode: store.city.countryCode || apiCity.countryCode,
    lat: Number.isFinite(apiCity.lat) ? apiCity.lat : store.city.lat,
    lon: Number.isFinite(apiCity.lon) ? apiCity.lon : store.city.lon,
    timezone: apiCity.timezone || store.city.timezone,
  });
  if (!merged) return;

  const changed =
    merged.name !== store.city.name ||
    merged.region !== store.city.region ||
    merged.country !== store.city.country ||
    merged.lat !== store.city.lat ||
    merged.lon !== store.city.lon ||
    merged.timezone !== store.city.timezone;

  store.city = merged;
  storage.set(STORAGE_KEYS.city, merged);

  if (changed) {
    header?.setCity(merged);
    updateCityHeader();
  }
}

function loadCity(city, { reason = 'select' } = {}) {
  const next = normaliseCity(city);
  if (!next) {
    toast('That location is not valid. Try searching for a city.');
    return;
  }

  const previousKey = cityKey(store.city);
  const nextKey = cityKey(next);
  const newCity = previousKey !== nextKey || next.name !== store.city.name;

  store.epoch += 1;
  const epoch = store.epoch;

  Object.values(store.controllers).forEach((controller) => controller?.abort());
  store.controllers = {};

  store.city = next;
  store.expandedDay = null;
  storage.set(STORAGE_KEYS.city, next);

  if (newCity) {
    store.data.current = emptySection();
    store.data.forecast = emptySection();
    store.data.air = emptySection();
    clearDataViewer();
  }

  header?.setCity(next);
  updateCityHeader();
  renderAll();

  if (newCity) {
    store.mapEpoch += 1;
    store.controllers.map?.abort();
    store.data.map = emptyMapSection();
    setMapGrid({ ...store.data.map, status: 'loading' });
    syncMapContext({
      city: store.city,
      unit: store.unit,
      current: null,
      layer: store.map.layer,
      opacity: store.map.opacity,
    });
  }

  if (store.activeTab === 'maps' && isMapReady()) {
    loadMapGrid();
  }

  ['current', 'forecast', 'air'].forEach((source) => {
    loadSection(source, { force: false, epoch });
  });

  if (reason === 'location') {
    toast(STRINGS.location.resolved);
  }
}

async function loadSection(source, { force = false, epoch = store.epoch } = {}) {
  if (!['current', 'forecast', 'air'].includes(source)) return;

  const city = store.city;

  store.controllers[source]?.abort();
  if (force) invalidate(source, city);

  const controller = new AbortController();
  store.controllers[source] = controller;

  setSection(source, {
    status: 'loading',
    error: null,
    refreshError: null,
    stale: false,
  });
  renderSection(source);
  if (source === 'air') updateAqiBadge();

  try {
    let result;
    if (source === 'current') result = await getCurrent(city, controller.signal);
    else if (source === 'forecast') result = await getForecast(city, controller.signal);
    else result = await getAirQuality(city, controller.signal);

    if (epoch !== store.epoch) return;

    if (source === 'current') {
      const normalised = result.current;

      // WeatherAPI resolves coordinates to the nearest station. Keep the
      // user-selected city label, but use the station name for "Use my location".
      if (store.city.name === STRINGS.location.provisionalName) {
        mergeCity({
          ...normalised.city,
          lat: store.city.lat,
          lon: store.city.lon,
        });
      }

      setSection('current', {
        status: 'success',
        data: normalised,
        meta: {
          fetchedAt: result.fetchedAt,
          source: SOURCES.current,
          cached: result.cached,
        },
        error: null,
        refreshError: null,
        stale: false,
      });
      updateDataViewer('current', {
        data: result.data,
        raw: result.raw,
        fetchedAt: result.fetchedAt,
        source: SOURCES.current,
      });
      renderCurrentSection();
      updateAqiBadge();
      syncMapContext({
        city: store.city,
        unit: store.unit,
        current: normalised,
        layer: store.map.layer,
        opacity: store.map.opacity,
      });
      return;
    }

    if (source === 'forecast') {
      setSection('forecast', {
        status: 'success',
        data: result.forecast,
        meta: {
          fetchedAt: result.fetchedAt,
          source: SOURCES.forecast,
          cached: result.cached,
        },
        error: null,
        refreshError: null,
        stale: false,
      });
      updateDataViewer('forecast', {
        data: result.data,
        raw: result.raw,
        fetchedAt: result.fetchedAt,
        source: SOURCES.forecast,
      });
      renderForecastSection();
      renderCurrentSection();
      return;
    }

    setSection('air', {
      status: 'success',
      data: result.air,
      meta: {
        fetchedAt: result.fetchedAt,
        source: SOURCES.air,
        cached: result.cached,
      },
      error: null,
      refreshError: null,
      stale: false,
    });
    updateDataViewer('air', {
      data: result.data,
      raw: result.raw,
      fetchedAt: result.fetchedAt,
      source: SOURCES.air,
    });
    renderAirSection();
    renderCurrentSection();
    updateAqiBadge();
  } catch (error) {
    if (isAbortError(error) || epoch !== store.epoch) return;

    const previous = store.data[source];
    if (previous.data) {
      setSection(source, {
        status: 'success',
        refreshError: error,
        stale: !navigator.onLine,
      });
    } else {
      setSection(source, {
        status: 'error',
        error,
        refreshError: null,
        stale: !navigator.onLine,
      });
    }

    renderSection(source);
    if (source === 'forecast') renderCurrentSection();
    if (source === 'air') {
      renderCurrentSection();
      updateAqiBadge();
    }
  }
}

async function loadMapGrid({ force = false } = {}) {
  if (!isMapReady()) return;

  const city = store.city;
  const key = cityKey(city);
  const epoch = ++store.mapEpoch;

  store.controllers.map?.abort();
  const controller = new AbortController();
  store.controllers.map = controller;

  if (force) invalidate('map', city);

  setSection('map', {
    status: 'loading',
    data: null,
    error: null,
    cityKey: key,
    meta: null,
  });
  setMapGrid(store.data.map);

  try {
    const result = await getMapGrid(city, controller.signal);
    if (epoch !== store.mapEpoch) return;

    setSection('map', {
      status: 'success',
      data: result.grid,
      meta: {
        fetchedAt: result.fetchedAt,
        source: SOURCES.map,
        cached: result.cached,
      },
      error: null,
      cityKey: key,
    });
    setMapGrid(store.data.map);
  } catch (error) {
    if (isAbortError(error) || epoch !== store.mapEpoch) return;
    setSection('map', {
      status: 'error',
      data: null,
      error,
      cityKey: key,
    });
    setMapGrid(store.data.map);
  }
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function getInitialTab() {
  const hash = window.location.hash.replace('#', '').trim();
  return TABS.includes(hash) ? hash : 'weather';
}

function activateTab(tab, { updateHash = true, focus = false } = {}) {
  const target = TABS.includes(tab) ? tab : 'weather';
  store.activeTab = target;

  TAB_CONFIG.forEach((config) => {
    const button = qs(`#${config.button}`);
    const panel = qs(`#${config.panel}`);
    const active = config.key === target;
    if (button) {
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    }
    if (panel) panel.hidden = !active;
  });

  document.body.dataset.tab = target;

  if (updateHash) {
    const nextHash = `#${target}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }

  if (target === 'maps') {
    openMaps();
  } else {
    invalidateMapSize();
  }
}

function openAirTab() {
  activateTab('air-quality');
  qs('#panel-air')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function openMaps({ forceGrid = false } = {}) {
  const container = qs('#map-section');
  if (!container) return;

  await ensureMap(container, {
    city: store.city,
    unit: store.unit,
    layer: store.map.layer,
    opacity: store.map.opacity,
    current: store.data.current.data,
    onLayerChange: (layer) => {
      store.map.layer = layer;
      storage.set(STORAGE_KEYS.mapLayer, layer);
    },
    onOpacityChange: (opacity) => {
      store.map.opacity = opacity;
      storage.set(STORAGE_KEYS.mapOpacity, opacity);
    },
    onRetry: () => retry('map'),
  });

  store.map.loaded = true;

  if (!isMapReady()) return;

  const key = cityKey(store.city);
  const mapSection = store.data.map;

  if (mapSection.status === 'loading' && mapSection.cityKey === key) return;

  if (!forceGrid && mapSection.status === 'success' && mapSection.cityKey === key) {
    setMapGrid(mapSection);
    return;
  }

  if (!forceGrid && mapSection.status === 'error' && mapSection.cityKey === key) {
    setMapGrid(mapSection);
    return;
  }

  loadMapGrid({ force: forceGrid });
}

function initTabs() {
  TAB_CONFIG.forEach((config) => {
    const button = qs(`#${config.button}`);
    button?.addEventListener('click', () => activateTab(config.key));
  });

  qs('#tabs')?.addEventListener('keydown', (event) => {
    const index = TABS.indexOf(store.activeTab);
    let nextIndex = null;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;

    if (nextIndex != null) {
      event.preventDefault();
      activateTab(TABS[nextIndex], { focus: true });
    }
  });

  window.addEventListener('hashchange', () => {
    const tab = window.location.hash.replace('#', '').trim();
    if (TABS.includes(tab) && tab !== store.activeTab) {
      activateTab(tab, { updateHash: false });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Unit toggle, location, retry                                        */
/* ------------------------------------------------------------------ */

function setUnit(unit) {
  const next = unit === 'f' ? 'f' : 'c';
  if (next === store.unit) {
    header?.setUnit(next);
    return;
  }
  store.unit = next;
  storage.set(STORAGE_KEYS.unit, next);
  header?.setUnit(next);
  renderCurrentSection();
  renderForecastSection();
  syncMapContext({ unit: next });
}

function useLocation(coords) {
  const provisional = {
    name: STRINGS.location.provisionalName,
    region: '',
    country: '',
    countryCode: '',
    lat: coords.lat,
    lon: coords.lon,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
  loadCity(provisional, { reason: 'location' });
}

function locationError(message) {
  toast(message);
  header?.setHint(message, 'error');
}

function retry(source) {
  if (source === 'map') {
    openMaps({ forceGrid: true });
    return;
  }
  loadSection(source, { force: true });
}

/* ------------------------------------------------------------------ */
/* Offline handling                                                    */
/* ------------------------------------------------------------------ */

function updateOfflineBanner() {
  const banner = qs('#offline-banner');
  if (!banner) return;
  banner.hidden = navigator.onLine;
}

function handleOffline() {
  updateOfflineBanner();
  ['current', 'forecast', 'air'].forEach((source) => {
    if (store.data[source].data) {
      setSection(source, { stale: true });
    }
  });
  renderAll();
}

function handleOnline() {
  updateOfflineBanner();
  ['current', 'forecast', 'air'].forEach((source) => {
    const section = store.data[source];
    if (section.data || section.status === 'error') {
      loadSection(source, { force: true });
    }
  });
  if (store.activeTab === 'maps' && isMapReady()) {
    loadMapGrid({ force: true });
  }
}

/* ------------------------------------------------------------------ */
/* Initialisation                                                      */
/* ------------------------------------------------------------------ */

function init() {
  initDataViewer({ onToast: toast });

  header = initHeader({
    getCity: () => store.city,
    unit: store.unit,
    onSelectCity: (city) => loadCity(city, { reason: 'search' }),
    onUseLocation: useLocation,
    onLocationError: locationError,
    onUnitChange: setUnit,
    onSearchError: (error) => {
      if (error?.type === 'offline') toast(STRINGS.search.offline);
    },
  });

  initTabs();
  updateCityHeader();
  renderAll();

  const initialTab = getInitialTab();
  activateTab(initialTab, { updateHash: false });
  if (!TABS.includes(window.location.hash.replace('#', '').trim())) {
    window.history.replaceState(null, '', `#${initialTab}`);
  }

  loadCity(store.city, { reason: 'init' });
  updateOfflineBanner();

  window.setInterval(updateCityHeader, 30000);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateCityHeader();
  });

  // Expose only the read-only snapshot for debugging in the console.
  window.WeatherFirst = {
    get state() {
      return {
        city: store.city,
        unit: store.unit,
        activeTab: store.activeTab,
        sections: Object.fromEntries(
          Object.entries(store.data).map(([key, value]) => [
            key,
            { status: value.status, hasData: Boolean(value.data), stale: value.stale },
          ]),
        ),
      };
    },
  };
}

init();
