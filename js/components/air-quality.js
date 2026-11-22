import { AQI_CATEGORIES } from '../config.js';
import { STRINGS } from '../strings.js';
import { metricIcon } from '../icons.js';
import {
  getAqiCategory,
  getAqiScaleMarker,
  getDominantPollutant,
  getPollutantMarker,
} from '../interpretation.js';
import {
  dayLabel,
  escapeHtml,
  formatHour,
  formatNumber,
  formatObserved,
  relativeTime,
  shortDate,
} from '../utils.js';

function retryButton(source = 'air') {
  return `<button type="button" class="btn btn-retry" data-action="retry" data-source="${source}">
    ${metricIcon('refresh')} ${STRINGS.air.retry}
  </button>`;
}

function errorCard(message) {
  return `<article class="card state-card" role="alert">
    <span class="state-icon">${metricIcon('alert')}</span>
    <h2>${escapeHtml(STRINGS.air.error)}</h2>
    <p>${escapeHtml(message)}</p>
    ${retryButton()}
  </article>`;
}

export function renderAirSkeleton(container) {
  container.innerHTML = `<div class="air-layout" aria-hidden="true">
    <article class="card aqi-hero skeleton-card">
      <div class="sk sk-pill"></div>
      <div class="sk sk-aqi"></div>
      <div class="sk sk-line sk-line--wide"></div>
      <div class="sk sk-banner"></div>
    </article>
    <article class="card skeleton-card">
      <div class="sk sk-pill"></div>
      <div class="sk sk-chart"></div>
    </article>
    <article class="card skeleton-card">
      <div class="sk sk-pill"></div>
      <div class="sk sk-banner"></div>
    </article>
    <div class="pollutants-grid">
      ${Array.from({ length: 6 }, () => '<div class="card pollutant skeleton-card"><div class="sk sk-line"></div><div class="sk sk-temp-line"></div><div class="sk sk-line sk-line--short"></div></div>').join('')}
    </div>
  </div>`;
}

function trendChart(hours) {
  if (!hours.length) return '';

  const width = 640;
  const height = 190;
  const pad = { left: 38, right: 14, top: 16, bottom: 34 };
  const values = hours.map((hour) => hour.aqi);
  const rawMax = Math.max(...values);
  const max = Math.max(200, Math.ceil(rawMax / 50) * 50);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  const x = (index) => pad.left + (hours.length === 1 ? plotWidth / 2 : (index / (hours.length - 1)) * plotWidth);
  const y = (value) => pad.top + (1 - value / max) * plotHeight;

  const line = hours
    .map((hour, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(hour.aqi).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(hours.length - 1).toFixed(1)} ${(height - pad.bottom).toFixed(1)} L${x(0).toFixed(1)} ${(height - pad.bottom).toFixed(1)} Z`;

  const ticks = [0, 50, 100, 150, 200];
  if (max > 200) ticks.push(max);
  const tickMarkup = ticks
    .map(
      (tick) => `<g>
        <line x1="${pad.left}" x2="${width - pad.right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#dbe3ec" stroke-width="1" stroke-dasharray="3 4" />
        <text x="${pad.left - 8}" y="${y(tick) + 4}" text-anchor="end" class="chart-label">${tick}</text>
      </g>`,
    )
    .join('');

  const labelIndexes = [0, 4, 8, 12, 16, 20, 23].filter((index) => index < hours.length);
  const labelMarkup = labelIndexes
    .map(
      (index) =>
        `<text x="${x(index)}" y="${height - 12}" text-anchor="middle" class="chart-label">${formatHour(hours[index].time)}</text>`,
    )
    .join('');

  const dots = hours
    .map((hour, index) => {
      const category = getAqiCategory(hour.aqi);
      return `<circle cx="${x(index)}" cy="${y(hour.aqi)}" r="2.8" fill="${category?.color || '#0b3b8c'}" stroke="#fff" stroke-width="1.2" />`;
    })
    .join('');

  const peak = hours.reduce((best, hour) => (!best || hour.aqi > best.aqi ? hour : best), null);
  const cleanest = hours.reduce((best, hour) => (!best || hour.aqi < best.aqi ? hour : best), null);

  return `<div class="trend-chart">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="aqi-trend-title aqi-trend-desc">
      <title id="aqi-trend-title">AQI for the next 24 hours</title>
      <desc id="aqi-trend-desc">Hourly US AQI from ${formatHour(hours[0].time)} to ${formatHour(hours[hours.length - 1].time)}. Peak ${peak?.aqi} at ${formatHour(peak?.time)}, cleanest ${cleanest?.aqi} at ${formatHour(cleanest?.time)}.</desc>
      <defs>
        <linearGradient id="aqi-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b3b8c" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#0b3b8c" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      ${tickMarkup}
      <path d="${area}" fill="url(#aqi-area)" />
      <path d="${line}" fill="none" stroke="#0b3b8c" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
      ${dots}
      ${labelMarkup}
    </svg>
    <p class="trend-caption">
      Peak <strong>${peak?.aqi ?? '—'}</strong> at ${formatHour(peak?.time)} ·
      Cleanest <strong>${cleanest?.aqi ?? '—'}</strong> at ${formatHour(cleanest?.time)}
    </p>
  </div>`;
}

function scaleLegend(aqi) {
  const marker = getAqiScaleMarker(aqi);
  return `<article class="card aqi-scale">
    <header class="card-head">
      <div>
        <p class="eyebrow">${escapeHtml(STRINGS.air.scale)}</p>
        <h2>Where this AQI sits</h2>
      </div>
      <span class="source-pill">US EPA</span>
    </header>
    <div class="scale-track" role="img" aria-label="AQI scale from 0 to 500. Current AQI ${Number.isFinite(aqi) ? Math.round(aqi) : 'unavailable'}.">
      ${AQI_CATEGORIES.map(
        (category) =>
          `<span class="scale-segment" style="flex:${category.max - category.min + 1} 0 0;background:${category.color}"></span>`,
      ).join('')}
      <span class="scale-marker" style="left:${marker.toFixed(2)}%">
        <span class="scale-marker-value">${Number.isFinite(aqi) ? Math.round(aqi) : '—'}</span>
      </span>
    </div>
    <div class="scale-numbers" aria-hidden="true">
      <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300</span><span>500</span>
    </div>
    <ul class="scale-key">
      ${AQI_CATEGORIES.map(
        (category) =>
          `<li><span class="scale-dot" style="background:${category.color}"></span><span>${escapeHtml(category.label)}</span><small>${escapeHtml(category.range)}</small></li>`,
      ).join('')}
    </ul>
  </article>`;
}

function outlook(data, city) {
  if (!Array.isArray(data.dailyPeaks) || data.dailyPeaks.length === 0) return '';

  return `<article class="card aqi-outlook">
    <header class="card-head">
      <div>
        <p class="eyebrow">${escapeHtml(STRINGS.air.outlook)}</p>
        <h2>Plan around the peaks</h2>
      </div>
    </header>
    <div class="outlook-grid">
      ${data.dailyPeaks
        .map((day) => {
          const category = getAqiCategory(day.peakAqi);
          return `<div class="outlook-day" style="--day-color:${category?.color || '#64748b'}">
            <span class="outlook-name">${escapeHtml(dayLabel(day.date, city.timezone))}</span>
            <small>${escapeHtml(shortDate(day.date))}</small>
            <strong class="outlook-aqi">${Math.round(day.peakAqi)}</strong>
            <span class="outlook-category">${escapeHtml(category?.label || '—')}</span>
            <span class="outlook-bar"><span style="width:${getAqiScaleMarker(day.peakAqi).toFixed(1)}%"></span></span>
          </div>`;
        })
        .join('')}
    </div>
    <p class="card-note">${escapeHtml(STRINGS.air.outlookHint)}</p>
  </article>`;
}

function pollutantCard(pollutant, dominantKey) {
  const marker = getPollutantMarker(pollutant.subIndex);
  const isDominant = pollutant.key === dominantKey;
  return `<article class="card pollutant${isDominant ? ' is-dominant' : ''}" data-level="${marker.level}">
    <header class="pollutant-head">
      <div>
        <h3>${escapeHtml(pollutant.label)}</h3>
        <small>${escapeHtml(pollutant.longLabel)}</small>
      </div>
      <span class="pollutant-marker" data-level="${marker.level}">${escapeHtml(marker.label)}</span>
    </header>
    <p class="pollutant-value">
      <strong>${Number.isFinite(pollutant.value) ? formatNumber(pollutant.value, 1) : '—'}</strong>
      <span>${escapeHtml(pollutant.unit)}</span>
    </p>
    <p class="pollutant-sub">${escapeHtml(STRINGS.air.subIndex)} ${Number.isFinite(pollutant.subIndex) ? Math.round(pollutant.subIndex) : '—'}</p>
    <p class="pollutant-desc">${escapeHtml(pollutant.explainer)}</p>
    ${isDominant ? `<span class="dominant-tag">${escapeHtml(STRINGS.air.dominant)}</span>` : ''}
  </article>`;
}

export function renderAir(container, { section, city, onRetry }) {
  if (!section) return;

  if (section.status === 'loading' && !section.data) {
    renderAirSkeleton(container);
    return;
  }

  if (section.status === 'error' && !section.data) {
    container.innerHTML = errorCard(section.error?.message || STRINGS.errors.unknown);
    container.querySelector('[data-action="retry"]')?.addEventListener('click', () => onRetry('air'));
    return;
  }

  const data = section.data;
  if (!data) {
    renderAirSkeleton(container);
    return;
  }

  if (!data.available) {
    container.innerHTML = `<article class="card state-card" role="status">
      <span class="state-icon">${metricIcon('info')}</span>
      <h2>${escapeHtml(STRINGS.air.unavailable)}</h2>
      <p>${escapeHtml(STRINGS.air.unavailableHint)}</p>
      ${retryButton()}
    </article>`;
    container.querySelector('[data-action="retry"]')?.addEventListener('click', () => onRetry('air'));
    return;
  }

  const aqi = data.aqi;
  const category = getAqiCategory(aqi);
  const dominant = getDominantPollutant(data.pollutants);
  const observed = data.observedTime ? formatObserved(data.observedTime) : '';
  const updated = relativeTime(section.meta?.fetchedAt);
  const source = section.meta?.source || 'Open-Meteo Air Quality';

  const currentIndex = data.hourly.findIndex((hour) => !data.observedTime || hour.time >= data.observedTime.slice(0, 13));
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const next24 = data.hourly.slice(startIndex, startIndex + 24);

  const refresh = section.stale
    ? `<div class="section-notice section-notice--warn" role="status">
        <span>${escapeHtml(STRINGS.air.stale)}</span>
        <button type="button" class="link-button" data-action="retry" data-source="air">${STRINGS.air.retry}</button>
      </div>`
    : section.refreshError
      ? `<div class="section-notice section-notice--warn" role="status">
          <span>${escapeHtml(STRINGS.air.refreshFailed)}</span>
          <button type="button" class="link-button" data-action="retry" data-source="air">${STRINGS.air.retry}</button>
        </div>`
      : '';

  container.innerHTML = `<div class="air-layout">
    ${refresh}

    <article class="card aqi-hero" style="--aqi-color:${category?.color || '#64748b'};--aqi-soft:${category?.soft || '#eef2f6'};--aqi-ink:${category?.ink || '#334155'}">
      <div class="aqi-hero-top">
        <div class="aqi-hero-main">
          <p class="eyebrow">${escapeHtml(STRINGS.air.eyebrow)}</p>
          <div class="aqi-number">
            <span>${Number.isFinite(aqi) ? Math.round(aqi) : '—'}</span>
            <small>${escapeHtml(STRINGS.air.usAqi)}</small>
          </div>
          <p class="aqi-category">${escapeHtml(category?.label || 'Unavailable')}</p>
        </div>
        <div class="aqi-dominant">
          <p class="eyebrow">${escapeHtml(STRINGS.air.dominant)}</p>
          <p class="dominant-name">${escapeHtml(dominant?.label || '—')}</p>
          <span class="dominant-sub">${Number.isFinite(dominant?.subIndex) ? `Sub-index ${Math.round(dominant.subIndex)}` : '—'}</span>
        </div>
      </div>
      <p class="aqi-guidance">${escapeHtml(category?.guidance || 'Air quality data is incomplete for this location.')}</p>
      <div class="aqi-hero-foot">
        <span>${escapeHtml(source)}</span>
        <span>${observed ? `${STRINGS.air.observed} ${observed}` : ''}${updated ? ` · ${STRINGS.air.updated} ${updated}` : ''}</span>
      </div>
    </article>

    ${
      next24.length > 1
        ? `<article class="card aqi-trend">
            <header class="card-head">
              <div>
                <p class="eyebrow">${escapeHtml(STRINGS.air.trend)}</p>
                <h2>Find a cleaner hour</h2>
              </div>
              <span class="source-pill">Hourly</span>
            </header>
            <p class="card-note">${escapeHtml(STRINGS.air.trendHint)}</p>
            ${trendChart(next24)}
          </article>`
        : ''
    }

    ${scaleLegend(aqi)}
    ${outlook(data, city)}

    <section class="pollutants-section" aria-labelledby="pollutants-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(STRINGS.air.pollutants)}</p>
          <h2 id="pollutants-title">What is in the air</h2>
        </div>
        <p class="section-sub">${escapeHtml(STRINGS.air.pollutantsHint)}</p>
      </div>
      <div class="pollutants-grid">
        ${data.pollutants.map((pollutant) => pollutantCard(pollutant, dominant?.key)).join('')}
      </div>
    </section>

    <p class="aqi-source-note">
      ${escapeHtml(source)} · US EPA AQI scale. Values are reported by the data source, not estimated by WeatherFirst.
    </p>
  </div>`;

  container.querySelectorAll('[data-action="retry"]').forEach((button) => {
    button.addEventListener('click', () => onRetry('air'));
  });
}
