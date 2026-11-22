import { STRINGS } from '../strings.js';
import { metricIcon, weatherIcon } from '../icons.js';
import {
  conditionTone,
  getAqiCategory,
  getForecastSummary,
  getRecommendation,
  wmoIconType,
} from '../interpretation.js';
import {
  dayLabel,
  escapeHtml,
  formatHour,
  formatObserved,
  formatPercent,
  formatPressure,
  formatTemp,
  formatTempValue,
  formatVisibility,
  formatWind,
  relativeTime,
  shortDate,
  tempUnit,
  uvLabel,
} from '../utils.js';

const RETRY_BUTTON = (source) =>
  `<button type="button" class="btn btn-retry" data-action="retry" data-source="${source}">
    ${metricIcon('refresh')} ${STRINGS.weather.retry}
  </button>`;

function notice(text, tone = 'warn') {
  return `<div class="section-notice section-notice--${tone}" role="status">
    <span>${escapeHtml(text)}</span>
  </div>`;
}

function refreshNotice(section, source) {
  if (section.stale) {
    return `<div class="section-notice section-notice--warn" role="status">
      <span>${STRINGS.weather.stale}</span>
      <button type="button" class="link-button" data-action="retry" data-source="${source}">${STRINGS.weather.retry}</button>
    </div>`;
  }
  if (section.refreshError) {
    return `<div class="section-notice section-notice--warn" role="status">
      <span>${escapeHtml(STRINGS.weather.refreshFailed)}</span>
      <button type="button" class="link-button" data-action="retry" data-source="${source}">${STRINGS.weather.retry}</button>
    </div>`;
  }
  return '';
}

function errorCard(title, errorMessage, source) {
  return `<article class="card state-card" role="alert">
    <span class="state-icon">${metricIcon('alert')}</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(errorMessage)}</p>
    ${RETRY_BUTTON(source)}
  </article>`;
}

/* ------------------------------------------------------------------ */
/* Skeletons (FR-01.4)                                                 */
/* ------------------------------------------------------------------ */

export function renderCurrentSkeleton(container) {
  container.innerHTML = `<article class="card current-card skeleton-card" aria-hidden="true">
    <div class="sk sk-pill"></div>
    <div class="sk-main">
      <div class="sk sk-circle"></div>
      <div class="sk-temp"><div class="sk sk-temp-line"></div><div class="sk sk-line sk-line--short"></div></div>
    </div>
    <div class="sk sk-banner"></div>
    <div class="sk-grid">
      ${Array.from({ length: 8 }, () => '<div class="sk sk-tile"></div>').join('')}
    </div>
  </article>`;
}

export function renderForecastSkeleton(container) {
  container.innerHTML = `<article class="card forecast-card skeleton-card" aria-hidden="true">
    <div class="sk sk-pill"></div>
    <div class="sk sk-line sk-line--wide"></div>
    <div class="sk-list">
      ${Array.from({ length: 7 }, () => '<div class="sk sk-row"></div>').join('')}
    </div>
  </article>`;
}

/* ------------------------------------------------------------------ */
/* Current conditions (FR-05 / FR-06)                                  */
/* ------------------------------------------------------------------ */

export function renderCurrent(container, { section, city, unit, airSection, onRetry, onOpenAir }) {
  if (!section) return;

  if (section.status === 'loading' && !section.data) {
    renderCurrentSkeleton(container);
    return;
  }

  if (section.status === 'error' && !section.data) {
    container.innerHTML = errorCard(
      STRINGS.weather.loadError,
      section.error?.message || STRINGS.errors.unknown,
      'current',
    );
    container.querySelector('[data-action="retry"]')?.addEventListener('click', () => onRetry('current'));
    return;
  }

  const current = section.data;
  if (!current) {
    renderCurrentSkeleton(container);
    return;
  }

  const today = section.today || null;
  const airAqi = airSection?.data?.aqi;
  const aqiCategory = getAqiCategory(airAqi);
  const recommendation = getRecommendation({ current, today, airAqi });
  const tone = conditionTone(current);

  const observed = current.lastUpdated ? formatObserved(current.lastUpdated) : '';
  const updated = relativeTime(section.meta?.fetchedAt);
  const source = section.meta?.source || 'WeatherAPI.com';

  const high = today?.maxC;
  const low = today?.minC;

  const metrics = [
    {
      icon: 'humidity',
      label: STRINGS.weather.humidity,
      value: formatPercent(current.humidity),
    },
    {
      icon: 'wind',
      label: STRINGS.weather.wind,
      value: formatWind(current.windKph),
      note: current.windDir ? `from ${current.windDir}` : '',
      arrow: Number.isFinite(current.windDegree) ? current.windDegree : null,
    },
    {
      icon: 'pressure',
      label: STRINGS.weather.pressure,
      value: formatPressure(current.pressureMb),
    },
    {
      icon: 'visibility',
      label: STRINGS.weather.visibility,
      value: formatVisibility(current.visibilityKm),
    },
    {
      icon: 'cloud',
      label: STRINGS.weather.cloud,
      value: formatPercent(current.cloud),
    },
    {
      icon: 'uv',
      label: STRINGS.weather.uv,
      value: Number.isFinite(current.uv) ? `${Math.round(current.uv)}` : '—',
      note: uvLabel(current.uv),
    },
    {
      icon: 'sunrise',
      label: STRINGS.weather.sunrise,
      value: today?.sunrise ? formatHour(today.sunrise) : '—',
    },
    {
      icon: 'sunset',
      label: STRINGS.weather.sunset,
      value: today?.sunset ? formatHour(today.sunset) : '—',
    },
  ];

  const aqiBadge =
    aqiCategory && Number.isFinite(airAqi)
      ? `<button type="button" class="aqi-badge" data-action="open-air" style="--aqi-color:${aqiCategory.color}" title="Open the Air Quality tab">
          <span class="aqi-badge-dot" aria-hidden="true"></span>
          <span class="aqi-badge-value">AQI ${Math.round(airAqi)}</span>
          <span class="aqi-badge-label">${escapeHtml(aqiCategory.shortLabel || aqiCategory.label)}</span>
        </button>`
      : '';

  const secondary = recommendation?.secondary
    ? `<p class="headline-air">
        ${escapeHtml(recommendation.secondary.text)}
        <button type="button" class="link-button link-button--light" data-action="open-air">${escapeHtml(recommendation.secondary.linkLabel)} →</button>
      </p>`
    : '';

  container.innerHTML = `
    <article class="card current-card current-card--${tone}">
      ${refreshNotice(section, 'current')}
      <div class="current-top">
        <div class="current-status">
          <span class="live-pill">${escapeHtml(STRINGS.weather.now)}</span>
          <span class="current-observed">${observed ? `${STRINGS.weather.observed} ${observed}` : ''}</span>
        </div>
        ${aqiBadge}
      </div>

      <div class="current-main">
        <div class="current-icon">${weatherIcon(current.condition?.iconType || 'cloudy')}</div>
        <div class="current-temp">
          <div class="temp-line">
            <span class="temp-value">${formatTempValue(current.tempC, unit)}</span>
            <span class="temp-unit">${tempUnit(unit)}</span>
          </div>
          <p class="condition-text">${escapeHtml(current.condition?.text || '—')}</p>
          <p class="feels-like">${STRINGS.weather.feelsLike} ${formatTemp(current.feelsC, unit, { withUnit: true })}</p>
        </div>
        <div class="current-hi-lo" aria-label="Today's high and low">
          <span class="hi-lo hi"><span class="hi-lo-label">${STRINGS.weather.high}</span> ${formatTemp(high, unit)}</span>
          <span class="hi-lo lo"><span class="hi-lo-label">${STRINGS.weather.low}</span> ${formatTemp(low, unit)}</span>
        </div>
      </div>

      <div class="headline headline--${escapeHtml(recommendation?.key || 'fair')}">
        <span class="headline-icon">${metricIcon('spark')}</span>
        <div class="headline-body">
          <p class="headline-kicker">Today's take</p>
          <p class="headline-title">${escapeHtml(recommendation?.title || 'Fair Day')}</p>
          <p class="headline-text">${escapeHtml(recommendation?.text || '')}</p>
          ${secondary}
        </div>
      </div>

      <div class="metrics">
        ${metrics
          .map(
            (metric) => `
          <div class="metric">
            <span class="metric-icon">${metricIcon(metric.icon)}</span>
            <div class="metric-body">
              <span class="metric-label">${escapeHtml(metric.label)}</span>
              <strong class="metric-value">${escapeHtml(metric.value)}</strong>
              ${
                metric.arrow != null
                  ? `<span class="wind-note"><span class="wind-arrow" style="transform:rotate(${metric.arrow}deg)" aria-hidden="true">${metricIcon('arrow')}</span>${escapeHtml(metric.note)}</span>`
                  : metric.note
                    ? `<span class="metric-note">${escapeHtml(metric.note)}</span>`
                    : ''
              }
            </div>
          </div>`,
          )
          .join('')}
      </div>

      <p class="disclaimer">${escapeHtml(STRINGS.weather.disclaimer)}</p>

      <footer class="card-foot">
        <span>${escapeHtml(source)}</span>
        <span>${observed ? `${STRINGS.weather.observed} ${observed}` : ''}${updated ? ` · ${STRINGS.weather.updated} ${updated}` : ''}</span>
      </footer>
    </article>
  `;

  container.querySelectorAll('[data-action="retry"]').forEach((button) => {
    button.addEventListener('click', () => onRetry('current'));
  });
  container.querySelectorAll('[data-action="open-air"]').forEach((button) => {
    button.addEventListener('click', () => onOpenAir());
  });
}

/* ------------------------------------------------------------------ */
/* 7-day forecast (FR-07)                                              */
/* ------------------------------------------------------------------ */

function hourlyDetail(day, forecast, city, unit) {
  const hours = forecast.hours.filter((hour) => hour.time.startsWith(day.date));
  if (hours.length === 0) {
    return `<p class="hourly-empty">${escapeHtml(STRINGS.weather.noHourly)}</p>`;
  }

  let currentHour = '';
  try {
    currentHour = new Intl.DateTimeFormat('en-GB', {
      timeZone: city.timezone || 'UTC',
      hour: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    currentHour = String(new Date().getHours()).padStart(2, '0');
  }

  const isToday = day.date === cityDateForTimezone(city.timezone);
  return `<div class="hourly-wrap">
    <div class="hourly-scroll" role="list" aria-label="${escapeHtml(STRINGS.weather.hourly)} for ${escapeHtml(shortDate(day.date))}">
      ${hours
        .map((hour) => {
          const hourNumber = hour.time.slice(11, 13);
          const isNow = isToday && hourNumber === currentHour;
          return `<div class="hour${isNow ? ' is-now' : ''}" role="listitem">
            <span class="hour-time">${isNow ? 'Now' : formatHour(hour.time)}</span>
            ${weatherIcon(wmoIconType(hour.code), { className: 'hour-icon' })}
            <strong class="hour-temp">${formatTemp(hour.tempC, unit)}</strong>
            <span class="hour-rain">${metricIcon('rain')} ${formatPercent(hour.rainChance)}</span>
            <span class="hour-wind">${formatWind(hour.windKph)}</span>
          </div>`;
        })
        .join('')}
    </div>
  </div>`;
}

function cityDateForTimezone(timezone) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function renderForecast(container, { section, city, unit, expandedDay, onRetry, onToggleDay }) {
  if (!section) return;

  if (section.status === 'loading' && !section.data) {
    renderForecastSkeleton(container);
    return;
  }

  if (!section.data && section.status !== 'error') {
    renderForecastSkeleton(container);
    return;
  }

  if (section.status === 'error' && !section.data) {
    container.innerHTML = errorCard(
      STRINGS.weather.forecastError,
      section.error?.message || STRINGS.errors.unknown,
      'forecast',
    );
    container.querySelector('[data-action="retry"]')?.addEventListener('click', () => onRetry('forecast'));
    return;
  }

  const forecast = section.data;
  if (!forecast || !Array.isArray(forecast.days) || forecast.days.length === 0) {
    container.innerHTML = errorCard(
      STRINGS.weather.forecastError,
      STRINGS.errors.malformed,
      'forecast',
    );
    container.querySelector('[data-action="retry"]')?.addEventListener('click', () => onRetry('forecast'));
    return;
  }

  const days = forecast.days;
  const summary = getForecastSummary(days, city.timezone, unit);
  const source = section.meta?.source || 'Open-Meteo';
  const updated = relativeTime(section.meta?.fetchedAt);
  const weekMin = Math.min(...days.map((day) => (Number.isFinite(day.minC) ? day.minC : Infinity)));
  const weekMax = Math.max(...days.map((day) => (Number.isFinite(day.maxC) ? day.maxC : -Infinity)));
  const safeMin = Number.isFinite(weekMin) ? weekMin : 0;
  const safeMax = Number.isFinite(weekMax) ? weekMax : safeMin + 1;
  const span = safeMax > safeMin ? safeMax - safeMin : 1;

  container.innerHTML = `
    <article class="card forecast-card">
      ${refreshNotice(section, 'forecast')}
      <header class="card-head">
        <div>
          <p class="eyebrow">${escapeHtml(STRINGS.weather.forecastEyebrow)}</p>
          <h2>${escapeHtml(STRINGS.weather.forecastTitle)}</h2>
        </div>
        <span class="source-pill">${escapeHtml(source)}</span>
      </header>

      <p class="forecast-summary">${escapeHtml(summary)}</p>

      ${days.length < 7 ? notice(STRINGS.weather.fewerDays.replace('{n}', String(days.length)), 'info') : ''}

      <div class="forecast-list">
        ${days
          .map((day, index) => {
            const low = Number.isFinite(day.minC) ? day.minC : safeMin;
            const high = Number.isFinite(day.maxC) ? day.maxC : safeMax;
            const left = Math.max(0, Math.min(100, ((low - safeMin) / span) * 100));
            const width = Math.max(6, Math.min(100 - left, ((high - low) / span) * 100));
            const expanded = expandedDay === day.date;
            const detailId = `hourly-${index}`;
            return `<div class="day${expanded ? ' is-open' : ''}">
              <button
                type="button"
                class="day-row"
                data-date="${escapeHtml(day.date)}"
                aria-expanded="${expanded ? 'true' : 'false'}"
                aria-controls="${detailId}"
              >
                <span class="day-summary">
                  <span class="day-name">
                    <strong>${escapeHtml(dayLabel(day.date, city.timezone))}</strong>
                    <small>${escapeHtml(shortDate(day.date))}</small>
                  </span>
                  <span class="day-icon">${weatherIcon(day.iconType)}</span>
                  <span class="day-cond">${escapeHtml(day.condition)}</span>
                  <span class="range" aria-hidden="true">
                    <span class="range-fill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span>
                  </span>
                  <span class="day-temps">
                    <strong>${formatTemp(day.maxC, unit)}</strong>
                    <span>${formatTemp(day.minC, unit)}</span>
                  </span>
                  <span class="day-chevron">${metricIcon('chevron')}</span>
                </span>
                <span class="day-extras">
                  <span class="day-extra">${metricIcon('rain')} ${formatPercent(day.rainChance)} · ${Number.isFinite(day.precipMm) ? `${day.precipMm.toFixed(1)} mm` : '—'}</span>
                  <span class="day-extra">${metricIcon('wind')} ${formatWind(day.windMaxKph)}</span>
                  <span class="day-extra">${metricIcon('uv')} UV ${Number.isFinite(day.uvMax) ? Math.round(day.uvMax) : '—'}</span>
                </span>
              </button>
              <div class="day-detail" id="${detailId}" ${expanded ? '' : 'hidden'}>
                <p class="day-detail-title">${escapeHtml(STRINGS.weather.hourly)}</p>
                ${expanded ? hourlyDetail(day, forecast, city, unit) : ''}
              </div>
            </div>`;
          })
          .join('')}
      </div>

      <footer class="card-foot">
        <span>${escapeHtml(source)}</span>
        <span>${updated ? `${STRINGS.weather.updated} ${updated}` : ''}</span>
      </footer>
    </article>
  `;

  container.querySelectorAll('[data-action="retry"]').forEach((button) => {
    button.addEventListener('click', () => onRetry('forecast'));
  });

  container.querySelectorAll('.day-row').forEach((button) => {
    button.addEventListener('click', () => onToggleDay(button.dataset.date));
  });
}
