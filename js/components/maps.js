import { MAP_LAYERS } from '../config.js';
import { STRINGS, interpolate } from '../strings.js';
import { metricIcon } from '../icons.js';
import {
  clamp,
  escapeHtml,
  formatTemp,
  formatTempValue,
  formatWind,
  tempUnit,
} from '../utils.js';

let map = null;
let baseLayer = null;
let overlay = null;
let marker = null;
let leaflet = null;
let leafletPromise = null;
let mapContainer = null;
let mapReady = false;
let baseTileErrors = 0;
let activated = false;
let initPromise = null;

let context = {
  city: null,
  unit: 'c',
  layer: 'precipitation',
  opacity: 0.6,
  current: null,
};

let callbacks = {
  onLayerChange: () => {},
  onOpacityChange: () => {},
  onRetry: () => {},
};

let gridSection = null;
let lastCityKey = '';

const els = {
  map: null,
  legend: null,
  status: null,
  activate: null,
  caption: null,
  summary: null,
  opacity: null,
  opacityValue: null,
  layerButtons: [],
};

const cityKey = (city) => (city ? `${Number(city.lat).toFixed(3)},${Number(city.lon).toFixed(3)}` : '');

function getLayer(key = context.layer) {
  return MAP_LAYERS.find((layer) => layer.key === key) || MAP_LAYERS[0];
}

function seriesKey(layer) {
  return {
    precipitation: 'precipitation',
    clouds: 'clouds',
    temperature: 'temperature',
    wind: 'wind',
  }[layer.key] || layer.key;
}

/* ------------------------------------------------------------------ */
/* Leaflet lazy loader (FR-13.5)                                       */
/* ------------------------------------------------------------------ */

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const cssHref = new URL('assets/vendor/leaflet/leaflet.css', document.baseURI).href;
    const scriptSrc = new URL('assets/vendor/leaflet/leaflet.js', document.baseURI).href;

    let cssLink = document.querySelector('link[data-leaflet-css]');
    const cssReady = new Promise((cssResolve, cssReject) => {
      if (cssLink && cssLink.dataset.loaded === 'true') {
        cssResolve();
        return;
      }
      if (!cssLink) {
        cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssHref;
        cssLink.dataset.leafletCss = 'true';
        document.head.appendChild(cssLink);
      }
      cssLink.addEventListener('load', () => {
        cssLink.dataset.loaded = 'true';
        cssResolve();
      });
      cssLink.addEventListener('error', () => cssReject(new Error('Leaflet CSS failed to load')));
    });

    let script = document.querySelector('script[data-leaflet-js]');
    const scriptReady = new Promise((scriptResolve, scriptReject) => {
      if (script && script.dataset.loaded === 'true' && window.L) {
        scriptResolve();
        return;
      }
      if (!script) {
        script = document.createElement('script');
        script.src = scriptSrc;
        script.async = true;
        script.dataset.leafletJs = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        if (window.L) scriptResolve();
        else scriptReject(new Error('Leaflet did not initialise'));
      });
      script.addEventListener('error', () => scriptReject(new Error('Leaflet JS failed to load')));
    });

    Promise.all([cssReady, scriptReady])
      .then(() => {
        leaflet = window.L;
        resolve(leaflet);
      })
      .catch((error) => {
        leafletPromise = null;
        reject(error);
      });
  });

  return leafletPromise;
}

/* ------------------------------------------------------------------ */
/* Shell and controls                                                  */
/* ------------------------------------------------------------------ */

function renderShell(container, options) {
  mapContainer = container;
  container.innerHTML = `<div class="map-shell">
    <div class="map-toolbar">
      <div class="layer-switch" role="group" aria-label="${escapeHtml(STRINGS.maps.layer)}">
        ${MAP_LAYERS.map(
          (layer) => `<button type="button" class="layer-btn${layer.key === options.layer ? ' is-active' : ''}" data-layer="${layer.key}" aria-pressed="${layer.key === options.layer ? 'true' : 'false'}">${escapeHtml(layer.label)}</button>`,
        ).join('')}
      </div>
      <div class="map-tools">
        <label class="opacity-control">
          <span>${escapeHtml(STRINGS.maps.opacity)}</span>
          <input type="range" min="20" max="100" step="5" value="${Math.round(clamp(options.opacity, 0.2, 1) * 100)}" id="map-opacity" />
          <output for="map-opacity" id="map-opacity-value">${Math.round(clamp(options.opacity, 0.2, 1) * 100)}%</output>
        </label>
        <button type="button" class="btn btn-ghost map-recenter" id="map-recenter">
          ${metricIcon('compass')} ${escapeHtml(STRINGS.maps.recenter)}
        </button>
      </div>
    </div>

    <div class="map-frame">
      <div class="map" id="map" role="region" aria-label="Interactive weather map for ${escapeHtml(options.city?.name || 'the selected city')}" aria-describedby="map-summary"></div>
      <div class="map-ui">
        <div class="map-legend" id="map-legend"></div>
        <div class="map-status" id="map-status" role="status" hidden></div>
        <button type="button" class="map-activate" id="map-activate" hidden>${escapeHtml(STRINGS.maps.activate)}</button>
      </div>
    </div>

    <p class="map-caption" id="map-caption"></p>
    <p class="sr-only" id="map-summary"></p>
  </div>`;

  els.map = container.querySelector('#map');
  els.legend = container.querySelector('#map-legend');
  els.status = container.querySelector('#map-status');
  els.activate = container.querySelector('#map-activate');
  els.caption = container.querySelector('#map-caption');
  els.summary = container.querySelector('#map-summary');
  els.opacity = container.querySelector('#map-opacity');
  els.opacityValue = container.querySelector('#map-opacity-value');
  els.layerButtons = Array.from(container.querySelectorAll('.layer-btn'));

  els.layerButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setMapLayer(button.dataset.layer);
      callbacks.onLayerChange(button.dataset.layer);
    });
  });

  els.opacity.addEventListener('input', () => {
    const value = Number(els.opacity.value) / 100;
    setMapOpacity(value);
    callbacks.onOpacityChange(value);
  });

  container.querySelector('#map-recenter').addEventListener('click', recenter);

  els.activate.addEventListener('click', activateTouch);

  showStatus(STRINGS.maps.loading);
}

function showStatus(text, { hint = '', retry = false } = {}) {
  if (!els.status) return;
  els.status.hidden = false;
  els.status.innerHTML = `<strong>${escapeHtml(text)}</strong>${hint ? `<span>${escapeHtml(hint)}</span>` : ''}${
    retry
      ? `<button type="button" class="link-button" id="map-retry">${escapeHtml(STRINGS.maps.retry)}</button>`
      : ''
  }`;
  if (retry) {
    els.status.querySelector('#map-retry')?.addEventListener('click', () => callbacks.onRetry('map'));
  }
}

function hideStatus() {
  if (els.status) {
    els.status.hidden = true;
    els.status.innerHTML = '';
  }
}

/* ------------------------------------------------------------------ */
/* Map initialisation                                                  */
/* ------------------------------------------------------------------ */

function isCoarsePointer() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function initMap(options) {
  const city = options.city;
  const coarse = isCoarsePointer();

  map = leaflet.map(els.map, {
    center: [city.lat, city.lon],
    zoom: 9,
    minZoom: 4,
    maxZoom: 16,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: !coarse,
    touchZoom: !coarse,
    doubleClickZoom: !coarse,
    attributionControl: true,
  });

  // The status card occupies the top-left corner, so keep zoom controls clear
  // of it (and of the layer status that can appear there).
  leaflet.control.zoom({ position: 'topright' }).addTo(map);

  baseLayer = leaflet
    .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    })
    .addTo(map);

  baseLayer.on('tileerror', () => {
    baseTileErrors += 1;
    if (baseTileErrors === 4) {
      showStatus(STRINGS.maps.tilesUnavailable, { hint: 'The weather layer may still be available.' });
    }
  });

  const icon = leaflet.divIcon({
    className: 'city-marker',
    html: '<span class="city-marker-pulse"></span><span class="city-marker-dot"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  marker = leaflet.marker([city.lat, city.lon], {
    icon,
    title: city.name,
    keyboard: true,
    alt: `${city.name} weather`,
  }).addTo(map);

  marker.bindPopup(popupHtml(), {
    closeButton: false,
    autoPanPadding: [24, 24],
    offset: [0, -6],
  });

  map.whenReady(() => {
    map.invalidateSize();
    hideStatus();
  });

  if (coarse) {
    els.activate.hidden = false;
    activated = false;
  }

  mapReady = true;
}

function activateTouch() {
  if (!map || !leaflet) return;
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  activated = true;
  els.activate.hidden = true;
  showStatus(STRINGS.maps.active);
  window.setTimeout(() => {
    if (els.status && els.status.textContent === STRINGS.maps.active) hideStatus();
  }, 1800);
}

function recenter() {
  if (!map || !context.city) return;
  const zoom = Math.max(map.getZoom(), 9);
  map.setView([context.city.lat, context.city.lon], zoom, { animate: true });
  marker?.openPopup();
}

/* ------------------------------------------------------------------ */
/* Colour scale and canvas overlay                                     */
/* ------------------------------------------------------------------ */

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function colorAt(stops, value) {
  if (!Number.isFinite(value)) return null;
  if (value <= stops[0].value) return stops[0].color;
  for (let index = 1; index < stops.length; index += 1) {
    if (value <= stops[index].value) {
      const previous = stops[index - 1];
      const current = stops[index];
      const span = current.value - previous.value || 1;
      const t = clamp((value - previous.value) / span, 0, 1);
      const a = hexToRgb(previous.color);
      const b = hexToRgb(current.color);
      const mix = (from, to) => Math.round(from + (to - from) * t);
      return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
    }
  }
  return stops[stops.length - 1].color;
}

function buildOverlay(grid, layer) {
  if (!grid || !grid.values) return null;
  const values = grid.values[seriesKey(layer)];
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!values.some((value) => Number.isFinite(value))) return null;

  const size = grid.size || Math.round(Math.sqrt(values.length));
  const canvasSize = 720;
  const cell = canvasSize / size;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const value = values[row * size + column];
      if (!Number.isFinite(value)) continue;
      const color = colorAt(layer.stops, value);
      if (!color) continue;

      let alpha = 0.68;
      if (layer.key === 'precipitation') {
        alpha = value <= 0.01 ? 0 : clamp(0.25 + value / 10, 0.25, 0.85);
      } else if (layer.key === 'clouds') {
        alpha = 0.12 + (clamp(value, 0, 100) / 100) * 0.58;
      } else if (layer.key === 'wind') {
        alpha = 0.58;
      }

      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(column * cell - 1, row * cell - 1, cell + 2, cell + 2);
    }
  }

  ctx.globalAlpha = 1;
  return {
    url: canvas.toDataURL('image/png'),
    empty: !values.some((value) => value > 0.01),
  };
}

function renderOverlay() {
  if (!mapReady || !leaflet) return;

  const layer = getLayer();
  const section = gridSection;

  if (!section || section.status === 'loading') {
    if (overlay) {
      map.removeLayer(overlay);
      overlay = null;
    }
    if (!section?.data) showStatus(STRINGS.maps.loading);
    renderLegend();
    return;
  }

  if (section.status === 'error' || !section.data) {
    if (overlay) {
      map.removeLayer(overlay);
      overlay = null;
    }
    showStatus(STRINGS.maps.layerUnavailable, {
      hint: STRINGS.maps.layerUnavailableHint,
      retry: true,
    });
    renderLegend();
    return;
  }

  const grid = section.data;
  const image = buildOverlay(grid, layer);

  if (!image) {
    if (overlay) {
      map.removeLayer(overlay);
      overlay = null;
    }
    showStatus(STRINGS.maps.layerUnavailable, {
      hint: STRINGS.maps.layerUnavailableHint,
      retry: true,
    });
    renderLegend();
    return;
  }

  if (!overlay) {
    overlay = leaflet.imageOverlay(image.url, [
      [grid.bounds.south, grid.bounds.west],
      [grid.bounds.north, grid.bounds.east],
    ], {
      opacity: context.opacity,
      interactive: false,
      className: 'weather-overlay',
    }).addTo(map);
  } else {
    overlay.setUrl(image.url);
    overlay.setBounds([
      [grid.bounds.south, grid.bounds.west],
      [grid.bounds.north, grid.bounds.east],
    ]);
    overlay.setOpacity(context.opacity);
  }

  hideStatus();
  if (image.empty) {
    showStatus(STRINGS.maps.empty, { hint: layer.emptyLabel });
  }
  renderLegend();
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */

function legendUnit(layer) {
  return layer.key === 'temperature' ? tempUnit(context.unit) : layer.unit;
}

function legendBounds(layer) {
  if (layer.key === 'temperature') {
    return {
      min: formatTempValue(layer.min, context.unit),
      max: formatTempValue(layer.max, context.unit),
    };
  }
  return {
    min: String(layer.min),
    max: `${layer.max}${layer.key === 'clouds' ? '%' : layer.key === 'precipitation' ? '+' : layer.key === 'wind' ? '+' : ''}`,
  };
}

function renderLegend() {
  if (!els.legend) return;
  const layer = getLayer();
  const bounds = legendBounds(layer);
  const gradient = `linear-gradient(90deg, ${layer.stops
    .map((stop) => {
      const percent = ((stop.value - layer.min) / (layer.max - layer.min)) * 100;
      return `${stop.color} ${clamp(percent, 0, 100).toFixed(1)}%`;
    })
    .join(', ')})`;

  const current = context.current;
  const cityLine = current
    ? `<p class="legend-city">At ${escapeHtml(context.city?.name || 'city')}: <strong>${formatTemp(current.tempC, context.unit)}</strong> · ${escapeHtml(current.condition?.text || '')}</p>`
    : '';

  els.legend.innerHTML = `<div class="legend-head">
      <span>${escapeHtml(layer.label)}</span>
      <span class="legend-unit">${escapeHtml(legendUnit(layer))}</span>
    </div>
    <div class="legend-bar" style="background:${gradient}"></div>
    <div class="legend-scale"><span>${escapeHtml(bounds.min)}</span><span>${escapeHtml(bounds.max)}</span></div>
    ${cityLine}
    <p class="legend-source">${escapeHtml(STRINGS.maps.source)}</p>`;

  updateCaption();
}

function updateCaption() {
  if (!els.caption || !context.city) return;
  const layer = getLayer();
  const text = interpolate(STRINGS.maps.caption, {
    city: context.city.name,
    layer: layer.label.toLowerCase(),
  });
  els.caption.textContent = `${text} ${STRINGS.maps.attribution}.`;
  if (els.summary) {
    els.summary.textContent = `Weather map showing ${layer.label.toLowerCase()} around ${context.city.name}. The colour scale runs from ${legendBounds(layer).min} to ${legendBounds(layer).max} ${legendUnit(layer)}. Weather data from Open-Meteo, base map from OpenStreetMap.`;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function ensureMap(container, options) {
  callbacks = {
    onLayerChange: options.onLayerChange || callbacks.onLayerChange,
    onOpacityChange: options.onOpacityChange || callbacks.onOpacityChange,
    onRetry: options.onRetry || callbacks.onRetry,
  };

  const previousCityKey = lastCityKey;
  context = {
    city: options.city,
    unit: options.unit || 'c',
    layer: options.layer || 'precipitation',
    opacity: clamp(options.opacity ?? 0.6, 0.2, 1),
    current: options.current || null,
  };
  lastCityKey = cityKey(options.city);

  if (mapReady && map) {
    map.invalidateSize();
    applyContext({ recenter: previousCityKey !== lastCityKey });
    return;
  }

  if (initPromise) {
    await initPromise;
    if (mapReady && map) {
      map.invalidateSize();
      applyContext({ recenter: false });
    }
    return;
  }

  renderShell(container, context);

  initPromise = (async () => {
    try {
      leaflet = await loadLeaflet();
      if (!leaflet) throw new Error('Leaflet unavailable');
      initMap(context);
      applyContext({ recenter: true });
      if (gridSection) renderOverlay();
    } catch (error) {
      mapReady = false;
      showStatus(STRINGS.maps.mapUnavailable, {
        hint: STRINGS.maps.mapUnavailableHint,
        retry: true,
      });
      if (els.legend) {
        els.legend.innerHTML = `<div class="legend-head"><span>${escapeHtml(STRINGS.maps.layerUnavailable)}</span></div>`;
      }
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

function applyContext({ recenter: shouldRecenter = false } = {}) {
  if (!map || !context.city) return;

  if (shouldRecenter) {
    map.setView([context.city.lat, context.city.lon], map.getZoom(), { animate: true });
  }

  if (marker) {
    marker.setLatLng([context.city.lat, context.city.lon]);
    marker.setPopupContent(popupHtml());
    marker.options.title = context.city.name;
    marker.options.alt = `${context.city.name} weather`;

    // Leaflet only writes title/alt to the marker element when it is created,
    // so keep the existing element's accessible name in sync on city changes.
    const markerElement = marker.getElement();
    if (markerElement) {
      markerElement.setAttribute('title', `${context.city.name} weather`);
      markerElement.setAttribute('aria-label', `${context.city.name} weather`);
    }
  }

  els.layerButtons.forEach((button) => {
    const active = button.dataset.layer === context.layer;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  if (els.opacity) {
    els.opacity.value = String(Math.round(context.opacity * 100));
    if (els.opacityValue) els.opacityValue.textContent = `${Math.round(context.opacity * 100)}%`;
  }

  renderOverlay();
  updateCaption();
}

function popupHtml() {
  const current = context.current;
  const city = context.city;
  if (!city) return '';
  if (!current) {
    return `<div class="map-popup"><strong>${escapeHtml(city.name)}</strong><span>Current conditions unavailable</span></div>`;
  }
  return `<div class="map-popup">
    <strong>${escapeHtml(city.name)}</strong>
    <span class="map-popup-temp">${formatTemp(current.tempC, context.unit, { withUnit: true })}</span>
    <span>${escapeHtml(current.condition?.text || '')}</span>
    <small>WeatherAPI.com</small>
  </div>`;
}

export function setMapLayer(layerKey) {
  const layer = MAP_LAYERS.find((item) => item.key === layerKey);
  if (!layer) return;
  context.layer = layer.key;
  if (els.layerButtons) {
    els.layerButtons.forEach((button) => {
      const active = button.dataset.layer === layer.key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  renderOverlay();
  updateCaption();
}

export function setMapOpacity(value) {
  context.opacity = clamp(Number(value) || 0.6, 0.2, 1);
  if (els.opacity) {
    els.opacity.value = String(Math.round(context.opacity * 100));
    if (els.opacityValue) els.opacityValue.textContent = `${Math.round(context.opacity * 100)}%`;
  }
  if (overlay) overlay.setOpacity(context.opacity);
}

export function setMapGrid(section) {
  gridSection = section;
  if (mapReady) renderOverlay();
}

export function updateMapContext({ city, unit, current, layer, opacity }) {
  if (city) {
    const nextKey = cityKey(city);
    const cityChanged = nextKey !== lastCityKey;
    context.city = city;
    lastCityKey = nextKey;
    if (cityChanged && mapReady) {
      map.setView([city.lat, city.lon], map.getZoom(), { animate: true });
    }
  }
  if (unit) context.unit = unit;
  if (current !== undefined) context.current = current;
  if (layer) context.layer = layer;
  if (opacity != null) context.opacity = clamp(opacity, 0.2, 1);
  if (mapReady) applyContext({ recenter: false });
}

export function invalidateMapSize() {
  if (map) {
    map.invalidateSize();
  }
}

export function isMapReady() {
  return mapReady;
}
