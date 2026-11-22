import { POPULAR_CITIES, SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from '../config.js';
import { searchCities } from '../api.js';
import { STRINGS } from '../strings.js';
import {
  countryFlag,
  debounce,
  escapeHtml,
  formatNumber,
  isAbortError,
  qs,
  uid,
} from '../utils.js';

/**
 * Shared header: search with autocomplete, popular-city chips, geolocation and
 * the °C/°F toggle. Everything here applies to all three tabs.
 */
export function initHeader({ getCity, unit, onSelectCity, onUseLocation, onLocationError, onUnitChange, onSearchError }) {
  const form = qs('#search-form');
  const input = qs('#city-input');
  const suggestionsList = qs('#suggestions');
  const hint = qs('#search-hint');
  const chips = qs('#city-chips');
  const locateBtn = qs('#locate-btn');
  const locateLabel = qs('.locate-label', locateBtn);
  const unitButtons = Array.from(document.querySelectorAll('.unit-toggle [data-unit]'));

  let results = [];
  let activeIndex = -1;
  let queryForResults = '';
  let controller = null;
  let searchToken = 0;
  let suppressInput = false;
  let locating = false;

  function setHint(text, tone = '') {
    hint.textContent = text || '';
    hint.dataset.tone = tone;
    hint.hidden = !text;
  }

  function setExpanded(expanded) {
    input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    suggestionsList.hidden = !expanded;
    if (!expanded) {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function closeSuggestions() {
    results = [];
    activeIndex = -1;
    queryForResults = '';
    setExpanded(false);
    suggestionsList.innerHTML = '';
  }

  function renderSuggestions(items, query) {
    results = items;
    activeIndex = -1;
    queryForResults = query;
    suggestionsList.innerHTML = items
      .map((item, index) => {
        const flag = countryFlag(item.countryCode);
        const region = [item.region, item.country].filter(Boolean).join(', ');
        const population = item.population ? formatNumber(item.population) : '';
        return `
          <li
            class="suggestion"
            id="suggestion-${index}"
            role="option"
            aria-selected="false"
            data-index="${index}"
          >
            <span class="suggestion-flag" aria-hidden="true">${flag || '•'}</span>
            <span class="suggestion-main">
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(region || 'Location')}</small>
            </span>
            ${population ? `<span class="suggestion-pop">${population}</span>` : ''}
          </li>
        `;
      })
      .join('');
    setExpanded(items.length > 0);
  }

  function setActive(index) {
    const options = Array.from(suggestionsList.querySelectorAll('.suggestion'));
    if (options.length === 0) return;
    activeIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === activeIndex;
      option.classList.toggle('is-active', selected);
      option.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    const active = options[activeIndex];
    input.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  }

  function selectCity(city) {
    suppressInput = true;
    input.value = city.name;
    suppressInput = false;
    closeSuggestions();
    setHint('');
    onSelectCity(city);
  }

  async function runSearch(rawQuery, { selectIfSingle = false, fromSubmit = false } = {}) {
    const query = String(rawQuery || '').trim();
    if (!query) {
      setHint(STRINGS.search.empty, 'error');
      closeSuggestions();
      return;
    }
    if (query.length < SEARCH_MIN_CHARS) {
      setHint(STRINGS.search.tooShort, 'info');
      closeSuggestions();
      return;
    }

    if (controller) controller.abort();
    controller = new AbortController();
    const token = ++searchToken;

    setHint(STRINGS.search.searching, 'info');
    input.setAttribute('aria-busy', 'true');

    try {
      const found = await searchCities(query, controller.signal);
      if (token !== searchToken) return;

      if (found.length === 0) {
        closeSuggestions();
        setHint(STRINGS.search.notFound, 'error');
        return;
      }

      if (found.length === 1 && selectIfSingle) {
        selectCity(found[0]);
        return;
      }

      renderSuggestions(found, query);
      setHint(
        found.length === 1 ? STRINGS.search.oneMatch : `${found.length} ${STRINGS.search.results}`,
        'info',
      );

      if (fromSubmit && found.length > 1) {
        setActive(0);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      if (token !== searchToken) return;
      closeSuggestions();
      setHint(STRINGS.search.failed, 'error');
      if (onSearchError) onSearchError(error);
    } finally {
      if (token === searchToken) input.removeAttribute('aria-busy');
    }
  }

  const debouncedSearch = debounce((value) => runSearch(value), SEARCH_DEBOUNCE_MS);

  input.addEventListener('input', () => {
    if (suppressInput) return;
    const value = input.value;
    const trimmed = value.trim();

    if (trimmed.length < SEARCH_MIN_CHARS) {
      if (controller) controller.abort();
      searchToken += 1;
      closeSuggestions();
      setHint(trimmed.length === 0 ? '' : STRINGS.search.tooShort, trimmed.length === 0 ? '' : 'info');
      return;
    }

    if (queryForResults && queryForResults !== trimmed) {
      closeSuggestions();
    }
    debouncedSearch(value);
  });

  input.addEventListener('focus', () => {
    if (results.length > 0) setExpanded(true);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (suggestionsList.hidden) {
        if (results.length > 0) setExpanded(true);
        return;
      }
      setActive(activeIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!suggestionsList.hidden) setActive(activeIndex - 1);
      return;
    }

    if (event.key === 'Enter') {
      if (!suggestionsList.hidden && activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault();
        selectCity(results[activeIndex]);
      }
      return;
    }

    if (event.key === 'Escape') {
      closeSuggestions();
      setHint('');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = input.value.trim();

    if (!query) {
      setHint(STRINGS.search.empty, 'error');
      closeSuggestions();
      return;
    }

    if (!suggestionsList.hidden && activeIndex >= 0 && results[activeIndex]) {
      selectCity(results[activeIndex]);
      return;
    }

    if (queryForResults === query && results.length > 1) {
      setExpanded(true);
      setHint(STRINGS.search.multiple, 'info');
      setActive(0);
      return;
    }

    runSearch(query, { selectIfSingle: true, fromSubmit: true });
  });

  suggestionsList.addEventListener('mousedown', (event) => {
    // Keep focus on the input so the click is not lost to the blur handler.
    event.preventDefault();
  });

  suggestionsList.addEventListener('click', (event) => {
    const option = event.target.closest('.suggestion');
    if (!option) return;
    const index = Number(option.dataset.index);
    if (results[index]) selectCity(results[index]);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#search')) {
      closeSuggestions();
    }
  });

  /* Popular city chips -------------------------------------------------- */

  function renderChips(city) {
    chips.innerHTML = POPULAR_CITIES.map((item) => {
      const active = city && item.name.toLowerCase() === String(city.name || '').toLowerCase();
      return `
        <button
          type="button"
          class="chip${active ? ' is-active' : ''}"
          data-city="${escapeHtml(item.name)}"
          aria-pressed="${active ? 'true' : 'false'}"
          title="Show weather for ${escapeHtml(item.name)}"
        >
          <span class="chip-flag" aria-hidden="true">${countryFlag(item.countryCode)}</span>
          <span>${escapeHtml(item.name)}</span>
        </button>
      `;
    }).join('');
  }

  chips.addEventListener('click', (event) => {
    const button = event.target.closest('.chip');
    if (!button) return;
    const selected = POPULAR_CITIES.find((item) => item.name === button.dataset.city);
    if (selected) {
      suppressInput = true;
      input.value = selected.name;
      suppressInput = false;
      closeSuggestions();
      setHint('');
      onSelectCity(selected);
    }
  });

  /* Unit toggle --------------------------------------------------------- */

  unitButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const unit = button.dataset.unit === 'f' ? 'f' : 'c';
      onUnitChange(unit);
    });
  });

  function setUnit(unit) {
    unitButtons.forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.unit === unit ? 'true' : 'false');
    });
  }

  /* Geolocation --------------------------------------------------------- */

  function setLocating(value) {
    locating = value;
    locateBtn.disabled = value;
    locateBtn.classList.toggle('is-busy', value);
    if (locateLabel) locateLabel.textContent = value ? STRINGS.location.locating : STRINGS.location.button;
  }

  locateBtn.addEventListener('click', () => {
    if (locating) return;

    if (!('geolocation' in navigator)) {
      onLocationError(STRINGS.location.unsupported);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onUseLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        setLocating(false);
        let message = STRINGS.location.unavailable;
        if (error && error.code === 1) message = STRINGS.location.denied;
        if (error && error.code === 3) message = STRINGS.location.timeout;
        onLocationError(message);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });

  function setCity(city) {
    if (!city) return;
    input.value = city.name;
    renderChips(city);
    closeSuggestions();
    setHint('');
  }

  renderChips(getCity());
  setUnit(unit || 'c');

  return {
    setCity,
    setUnit,
    focusSearch: () => input.focus(),
    setHint,
    setLocating,
  };
}
