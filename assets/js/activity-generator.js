import { getActivities } from './activities/registry.js';

const COPY = {
  en: {
    sourceLegend: 'Activity text source',
    single: 'Single voice',
    dialogue: 'Dialogue',
    custom: 'Custom',
    customPlaceholder: 'Paste or type the text for your word search…',
    setup: 'Choose words',
    update: 'Update from text',
    hide: 'Hide activity',
    show: 'Show activity',
    stale: 'The source text has changed. Your current activity is unchanged.',
    empty: 'Enter text or a dialogue script to create a word search.',
    updateConfirm: 'Updating this activity will replace its current setup and progress. Continue?'
  },
  es: {
    sourceLegend: 'Fuente del texto',
    single: 'Single voice',
    dialogue: 'Dialogue',
    custom: 'Custom',
    customPlaceholder: 'Pega o escribe aquí el texto para tu sopa de letras…',
    setup: 'Elegir palabras',
    update: 'Actualizar desde el texto',
    hide: 'Ocultar actividad',
    show: 'Mostrar actividad',
    stale: 'El texto original cambió. La actividad actual no se ha modificado.',
    empty: 'Escribe un texto o diálogo para crear una sopa de letras.',
    updateConfirm: 'Actualizar reemplazará la configuración y el progreso de esta actividad. ¿Continuar?'
  }
};

let nextSourceGroup = 0;

export function createActivityGenerator(container, getSourceText, getSourceMode, setSourceMode) {
  if (!container || typeof getSourceText !== 'function' ||
      typeof getSourceMode !== 'function' || typeof setSourceMode !== 'function') {
    throw new TypeError('Activity generator requires text/mode getters and a mode setter.');
  }
  const language = document.documentElement.lang === 'es' ? 'es' : 'en';
  const t = COPY[language];
  const activity = getActivities()[0];
  const title = activity?.label?.[language] || activity?.label?.en || 'Word Search';
  let instance = null;
  let source = '';
  let hidden = false;
  let audioMode = getSourceMode() === 'dialogue' ? 'dialogue' : 'single';
  let selectedSource = audioMode;

  container.classList.add('lc-activity-generator', 'activity-card');
  container.setAttribute('aria-label', title);
  const heading = document.createElement('h2');
  heading.textContent = title;
  const sourceGroup = document.createElement('fieldset');
  sourceGroup.className = 'lc-activity-sources';
  const sourceLegend = document.createElement('legend');
  sourceLegend.textContent = t.sourceLegend;
  sourceGroup.append(sourceLegend);
  const sourceRadios = new Map();
  const sourceName = `lc-activity-source-${++nextSourceGroup}`;
  for (const [value, labelText] of [['single', t.single], ['dialogue', t.dialogue], ['custom', t.custom]]) {
    const label = document.createElement('label');
    label.className = 'lc-activity-source-option';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = sourceName;
    radio.value = value;
    radio.checked = value === selectedSource;
    const text = document.createElement('span');
    text.textContent = labelText;
    label.append(radio, text);
    sourceGroup.append(label);
    sourceRadios.set(value, radio);
  }
  const customText = document.createElement('textarea');
  customText.className = 'lc-activity-custom-text';
  customText.placeholder = t.customPlaceholder;
  customText.setAttribute('aria-label', t.custom);
  customText.hidden = true;
  const controls = document.createElement('div');
  controls.className = 'lc-activity-controls';
  const setupButton = document.createElement('button');
  setupButton.type = 'button';
  setupButton.className = 'lc-activity-primary';
  setupButton.textContent = t.setup;
  const updateButton = document.createElement('button');
  updateButton.type = 'button';
  updateButton.className = 'lc-activity-secondary';
  updateButton.textContent = t.update;
  updateButton.hidden = true;
  const visibilityButton = document.createElement('button');
  visibilityButton.type = 'button';
  visibilityButton.className = 'lc-activity-secondary';
  visibilityButton.textContent = t.hide;
  visibilityButton.hidden = true;
  const status = document.createElement('p');
  status.className = 'lc-activity-source-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const host = document.createElement('div');
  host.className = 'lc-activity-host';
  controls.append(setupButton, updateButton, visibilityButton);
  container.replaceChildren(heading, sourceGroup, customText, controls, status, host);

  function getCurrentText() {
    return selectedSource === 'custom' ? customText.value : String(getSourceText() ?? '');
  }

  function sourceIsEmpty() {
    return !getCurrentText().trim();
  }

  function syncSourceToAudioMode() {
    const nextMode = getSourceMode() === 'dialogue' ? 'dialogue' : 'single';
    if (nextMode === audioMode) return;
    audioMode = nextMode;
    selectedSource = nextMode;
    sourceRadios.get('single').checked = nextMode === 'single';
    sourceRadios.get('dialogue').checked = nextMode === 'dialogue';
    sourceRadios.get('custom').checked = false;
    customText.hidden = true;
  }

  function refreshSourceState() {
    syncSourceToAudioMode();
    const latest = getCurrentText();
    const changed = Boolean(instance && latest !== source);
    setupButton.disabled = sourceIsEmpty();
    updateButton.hidden = !changed || sourceIsEmpty();
    visibilityButton.hidden = !instance;
    visibilityButton.textContent = hidden ? t.show : t.hide;
    status.textContent = sourceIsEmpty() ? t.empty : (changed ? t.stale : '');
  }

  function showSetup() {
    if (!activity || sourceIsEmpty()) {
      refreshSourceState();
      return;
    }
    if (!instance) {
      source = getCurrentText();
      instance = { api: activity.mount(host, { text: source }, { language }) };
    }
    hidden = false;
    host.hidden = false;
    refreshSourceState();
  }

  setupButton.addEventListener('click', showSetup);
  sourceRadios.forEach((radio, mode) => radio.addEventListener('change', () => {
    if (!radio.checked) return;
    selectedSource = mode;
    customText.hidden = mode !== 'custom';
    if (mode === 'custom') {
      customText.focus();
      refreshSourceState();
      return;
    }
    setSourceMode(mode);
    refreshSourceState();
  }));
  customText.addEventListener('input', refreshSourceState);
  visibilityButton.addEventListener('click', () => {
    hidden = !hidden;
    host.hidden = hidden;
    refreshSourceState();
  });
  updateButton.addEventListener('click', () => {
    if (!instance || sourceIsEmpty()) {
      refreshSourceState();
      return;
    }
    if (!window.confirm(t.updateConfirm)) return;
    source = getCurrentText();
    instance.api.updateData({ text: source });
    hidden = false;
    host.hidden = false;
    refreshSourceState();
  });

  refreshSourceState();

  return {
    refreshSourceState,
    destroy() {
      instance?.api.destroy();
      instance = null;
      container.replaceChildren();
    }
  };
}
