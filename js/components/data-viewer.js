import { STRINGS } from '../strings.js';
import { copyText, escapeHtml, formatNumber, relativeTime } from '../utils.js';

const entries = {
  current: null,
  forecast: null,
  air: null,
};

let activeSource = 'current';
let activeView = 'formatted';
let toastFn = () => {};

const sourceLabels = {
  current: STRINGS.dataViewer.current,
  forecast: STRINGS.dataViewer.forecast,
  air: STRINGS.dataViewer.air,
};

function currentText() {
  const entry = entries[activeSource];
  if (!entry) return '';
  if (activeView === 'raw') return entry.raw || '';
  try {
    return JSON.stringify(entry.data, null, 2);
  } catch {
    return entry.raw || '';
  }
}

function render() {
  const output = document.querySelector('#json-output');
  const copyButton = document.querySelector('#copy-json');
  if (!output) return;

  const entry = entries[activeSource];
  if (!entry) {
    output.textContent = STRINGS.dataViewer.noSource;
    if (copyButton) copyButton.disabled = true;
    return;
  }

  const text = currentText();
  const sizeKb = formatNumber(new Blob([text]).size / 1024, 1);
  const meta = `${sourceLabels[activeSource]} · ${entry.source || ''} · ${relativeTime(entry.fetchedAt)} · ${sizeKb} KB`;

  output.innerHTML = `<span class="json-meta">${escapeHtml(meta)}</span>\n${escapeHtml(text)}`;
  if (copyButton) copyButton.disabled = false;
}

export function initDataViewer({ onToast } = {}) {
  toastFn = onToast || (() => {});

  document.querySelectorAll('[data-source]').forEach((button) => {
    button.addEventListener('click', () => {
      activeSource = button.dataset.source;
      document.querySelectorAll('[data-source]').forEach((item) => {
        item.setAttribute('aria-selected', item === button ? 'true' : 'false');
      });
      render();
    });
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      activeView = button.dataset.view === 'raw' ? 'raw' : 'formatted';
      document.querySelectorAll('[data-view]').forEach((item) => {
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      render();
    });
  });

  document.querySelector('#copy-json')?.addEventListener('click', async () => {
    const text = currentText();
    if (!text) return;
    const ok = await copyText(text);
    toastFn(ok ? STRINGS.dataViewer.copied : STRINGS.dataViewer.copyFailed);
  });

  render();
}

export function updateDataViewer(source, entry) {
  if (!(source in entries) || !entry) return;
  entries[source] = {
    data: entry.data,
    raw: entry.raw,
    fetchedAt: entry.fetchedAt || Date.now(),
    source: entry.source || '',
  };
  render();
}

export function clearDataViewer() {
  entries.current = null;
  entries.forecast = null;
  entries.air = null;
  render();
}

