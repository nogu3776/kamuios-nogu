import {
  ALL_CATEGORY_ID,
  DEFAULT_ACTIVE_CATEGORY,
  SUPPORTED_CATEGORIES,
  PROMPT_GENERATOR_DEFAULT_VARIANTS,
  PROMPT_GENERATOR_DEFAULT_MODE
} from './constants.js';
import {
  isSupportedCategory,
  normalizeCategory,
  normalizeTypeToken
} from './utils.js';

export function createDefaultHistoryFilters() {
  return {
    category: ALL_CATEGORY_ID,
    prefix: 'all'
  };
}

export function sanitizeHistoryFilters(raw) {
  const defaults = createDefaultHistoryFilters();
  const filters = { ...defaults };
  if (!raw || typeof raw !== 'object') {
    return filters;
  }

  if (typeof raw.category === 'string') {
    const candidate = raw.category.trim().toLowerCase();
    if (candidate === ALL_CATEGORY_ID) {
      filters.category = ALL_CATEGORY_ID;
    } else if (candidate === 'other') {
      filters.category = 'other';
    } else if (isSupportedCategory(candidate)) {
      filters.category = candidate;
    }
  }

  if (typeof raw.prefix === 'string') {
    const candidate = raw.prefix.trim().toLowerCase();
    if (!candidate || candidate === 'all') {
      filters.prefix = 'all';
    } else if (candidate === 'other') {
      filters.prefix = 'other';
    } else {
      const normalized = normalizeTypeToken(candidate);
      filters.prefix = normalized || 'all';
    }
  }

  return filters;
}

export const HISTORY_DEFAULT_VISIBLE_COUNT = 20;
export const HISTORY_VISIBLE_INCREMENT = 30;
export const MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT = 30;
export const MEDIA_LIBRARY_VISIBLE_INCREMENT = 30;

export const state = {
  categories: [],
  enginesByCategory: new Map(),
  engineIndex: new Map(),
  enginesLoading: new Set(),
  selected: new Map(),
  inputs: new Map(),
  history: [],
  historyActiveId: null,
  historyFilters: createDefaultHistoryFilters(),
  historyManualSelection: false,
  historyVisibleCount: HISTORY_DEFAULT_VISIBLE_COUNT,
  engineCategoryInitialized: false,
  activeEngineCategory: ALL_CATEGORY_ID,
  categoryTabs: {},
  prompt: '',
  soundText: '',
  engineSearchKeyword: '',
  engineTypeFilters: new Map(),
  filePrefix: '',
  activeTemplateContext: null,
  currentRunTemplateContext: null,
  isRunning: false,
  resultsByCategory: {},
  activeCategory: DEFAULT_ACTIVE_CATEGORY,
  templates: [],
  scanPath: '',
  backendOrigin: '',
  mcpConfigDirectory: '',
  mcpActiveConfigCount: 0,
  templateDefaults: [],
  templateCustom: [],
  templateHidden: new Set(),
  templateMenuFilters: {
    category: ALL_CATEGORY_ID,
    type: 'all',
    query: ''
  },
  docMetadata: new Map(),
  media: {
    items: [],
    filtered: [],
    isLoading: false,
    error: '',
    selected: [],
    activeSlot: '',
    lastLoadedAt: 0,
    searchKeyword: '',
    sortMode: 'name',
    typeFilter: 'all',
    visibleCount: MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT,
    orderByPath: new Map(),
    orderByUrl: new Map(),
    soraIndex: new Map(),
    soraIndexLoadedAt: 0
  },
  promptGenerator: {
    mode: PROMPT_GENERATOR_DEFAULT_MODE,
    loading: false,
    error: '',
    message: '',
    suggestions: [],
    lastPrompt: '',
    lastMode: PROMPT_GENERATOR_DEFAULT_MODE,
    requestId: 0,
    showPanel: false,
    variantCount: PROMPT_GENERATOR_DEFAULT_VARIANTS,
    selectedCategory: '',
    selectedType: '',
    guidanceByType: {},
    activeGuidance: '',
    categoryDirty: false,
    typeDirty: false,
    guidanceDirty: false
  },
  jobs: new Map(),
  jobPollers: new Map(),
  currentJobId: '',
  currentRunResults: new Map(),
  completedEngineKeys: new Set(),
  currentHistoryEntryId: '',
  currentJobEngines: [],
  activeJobSnapshot: null,
  engineDisplayOrder: new Map(),
  batchControls: {
    isPlaying: false,
    loopEnabled: true,
    groups: []
  },
  sora: {
    mode: 't2v',
    remixEligible: false
  },
  showFailures: true,
  showInputs: true,
  showParameters: true,
  resultsPromptExpanded: false,
  resultsFileFilter: 'all'
};

SUPPORTED_CATEGORIES.forEach((category) => {
  state.categoryTabs[category] = 'engine';
  state.resultsByCategory[category] = [];
});

export const HISTORY_STORAGE_KEY = 'kc-showcase-history-v1';
export const TEMPLATE_STORAGE_KEY = 'kc-showcase-templates-v1';
export const FILE_PREFIX_STORAGE_KEY = 'kc-showcase-file-prefix-v1';
export const FAILURE_VISIBILITY_STORAGE_KEY = 'kc-showcase-show-failures';
export const INPUT_VISIBILITY_STORAGE_KEY = 'kc-showcase-show-inputs';
export const PARAM_VISIBILITY_STORAGE_KEY = 'kc-showcase-show-params';
export const RESULTS_FILE_FILTER_STORAGE_KEY = 'kc-showcase-results-file-filter';
export const TEMPLATE_LIMIT = Number.POSITIVE_INFINITY;
export const MAX_HISTORY_ENTRIES = Number.POSITIVE_INFINITY;
export const PROMPT_PLACEHOLDER = 'プロンプトを入力してください';
export const SOUND_TEXT_PLACEHOLDER = '音声テキストを入力してください';
export const PROMPT_MIN_HEIGHT = 36;
export const PROMPT_MAX_HEIGHT = 360;
export const JOB_POLL_INTERVAL_MS = 2500;
export const JOB_POLL_ERROR_DELAY_MS = 5000;
export const PARAMS_POPOVER_HIDE_DELAY_MS = 420;

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch (err) {
    console.warn('[Showcase] localStorage access blocked', err);
    return null;
  }
}

function safeSetItem(key, value, { label } = {}) {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch (err) {
    const context = label ? `[Showcase] ${label}` : '[Showcase] localStorage setItem failed';
    console.warn(context, err);
    return false;
  }
}

function safeGetItem(key, { label } = {}) {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }
  try {
    const value = storage.getItem(key);
    return typeof value === 'string' ? value : null;
  } catch (err) {
    const context = label ? `[Showcase] ${label}` : '[Showcase] localStorage getItem failed';
    console.warn(context, err);
    return null;
  }
}

function safeRemoveItem(key, { label } = {}) {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }
  try {
    storage.removeItem(key);
    return true;
  } catch (err) {
    const context = label ? `[Showcase] ${label}` : '[Showcase] localStorage removeItem failed';
    console.warn(context, err);
    return false;
  }
}

function normalizeBooleanPreference(value, defaultValue) {
  if (typeof value !== 'string') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') {
    return true;
  }
  if (normalized === '0' || normalized === 'false') {
    return false;
  }
  return defaultValue;
}

function parseJsonPreference(raw, key, { label, parseLabel } = {}) {
  if (!raw) {
    return null;
  }
  const parseMessage = parseLabel || label || 'localStorage JSON parse failed';
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Showcase] ${parseMessage}`, err);
    const cleanupLabel = `${parseMessage} cleanup`;
    safeRemoveItem(key, { label: cleanupLabel });
    return null;
  }
}

export const preferenceStorage = {
  readString(key, { label } = {}) {
    return safeGetItem(key, { label });
  },
  writeString(key, value, { label } = {}) {
    const next = typeof value === 'string' ? value : value == null ? '' : String(value);
    return safeSetItem(key, next, { label });
  },
  readBoolean(key, { label, defaultValue = true } = {}) {
    const stored = safeGetItem(key, { label });
    return normalizeBooleanPreference(stored, defaultValue);
  },
  writeBoolean(key, value, { label } = {}) {
    const normalized = value ? '1' : '0';
    return safeSetItem(key, normalized, { label });
  },
  readJson(key, { label, parseLabel } = {}) {
    const raw = safeGetItem(key, { label });
    return parseJsonPreference(raw, key, { label, parseLabel });
  },
  writeJson(key, value, { label } = {}) {
    try {
      const serialized = JSON.stringify(value);
      return safeSetItem(key, serialized, { label });
    } catch (err) {
      const context = label ? `[Showcase] ${label}` : '[Showcase] localStorage JSON stringify failed';
      console.warn(context, err);
      return false;
    }
  },
  remove(key, { label } = {}) {
    return safeRemoveItem(key, { label });
  }
};

export function ensureTemplateMenuFilters() {
  const defaults = {
    category: ALL_CATEGORY_ID,
    type: 'all',
    query: ''
  };
  if (!state.templateMenuFilters || typeof state.templateMenuFilters !== 'object') {
    state.templateMenuFilters = { ...defaults };
  }
  const filters = state.templateMenuFilters;
  let category = filters.category;
  if (category === undefined || category === null || category === '') {
    category = state.activeEngineCategory || ALL_CATEGORY_ID;
  }
  if (!category) {
    category = ALL_CATEGORY_ID;
  }
  const normalizedCategory = String(category).toLowerCase() === ALL_CATEGORY_ID
    ? ALL_CATEGORY_ID
    : normalizeCategory(category);
  filters.category = normalizedCategory || ALL_CATEGORY_ID;

  let type = typeof filters.type === 'string' ? filters.type.trim().toLowerCase() : 'all';
  if (!type) {
    type = 'all';
  }
  if (type !== 'all' && type !== 'other') {
    const normalizedType = normalizeTypeToken(type);
    filters.type = normalizedType || 'all';
  } else {
    filters.type = type;
  }

  if (typeof filters.query !== 'string') {
    filters.query = '';
  }

  return filters;
}

export function getEngineMeta(engineId) {
  if (!engineId && engineId !== 0) return null;
  return state.engineIndex.get(engineId) || null;
}
