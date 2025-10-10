import installLiveReloadGuard from './live-reload-guard.js';
import showcaseTemplate from './templates/showcase-ui.js';
import {
  API_BASE,
  SHOWCASE_API_BASE,
  HISTORY_API_ENDPOINT,
  TEMPLATES_API_ENDPOINT,
  PROMPT_GENERATOR_ENDPOINT,
  RELOAD_RELEASE_DELAY_MS,
  DEFAULT_ACTIVE_CATEGORY,
  ALL_CATEGORY_ID,
  ALL_CATEGORY_LABEL,
  CATEGORY_DEFINITIONS,
  CATEGORY_DEFINITION_MAP,
  PREFIX_TO_CATEGORY,
  TYPE_PREFIX_TO_CATEGORY,
  SUPPORTED_CATEGORIES,
  CATEGORY_LABELS,
  PREFIXES_REQUIRING_MEDIA,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  THREED_EXTENSIONS,
  MIME_EXTENSION_OVERRIDES,
  MEDIA_HINTS,
  MEDIA_FILTER_PRIORITY,
  MEDIA_SELECTION_TYPE_ORDER,
  MEDIA_INPUT_ALLOWED_TYPES,
  MEDIA_HINT_LOOKUP,
  MEDIA_PARAM_BADGE_EXCLUDE_TOKENS,
  MEDIA_PARAM_INDICATOR_TOKENS,
  MEDIA_TYPE_DISPLAY,
  SOUND_TEXT_PARAM_KEYS,
  PROMPT_GENERATOR_DEFAULT_MODE,
  PROMPT_GENERATOR_DEFAULT_TYPE,
  PROMPT_GENERATOR_MODES,
  PROMPT_GENERATOR_MAX_SUGGESTIONS,
  PROMPT_GENERATOR_DEFAULT_VARIANTS,
  PROMPT_GENERATOR_STATUS_TIMEOUT_MS,
  PROMPT_GENERATOR_LYRICS_ENABLED_TYPES,
  PROMPT_GENERATOR_LYRICS_LANGUAGE_OPTIONS,
  PROMPT_GENERATOR_LYRICS_KEYWORD_LIMIT,
  PROMPT_GENERATOR_LYRICS_CHAR_MIN,
  PROMPT_GENERATOR_LYRICS_CHAR_MAX,
  PROMPT_GENERATOR_LYRICS_KEYWORDS_MAX_LENGTH,
  PROMPT_GENERATOR_LYRICS_STRUCTURE_MAX_LENGTH,
  PROMPT_GENERATOR_LYRICS_SECTION_LIMIT,
  PROMPT_GENERATOR_LYRICS_DEFAULTS,
  PROMPT_GENERATOR_LYRICS_LEGACY_MAP,
  PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES,
  PROMPT_GENERATOR_SOUND_TEXT_AUTO_TYPES,
  PROMPT_GENERATOR_SOUND_TEXT_CHAR_MIN,
  PROMPT_GENERATOR_SOUND_TEXT_CHAR_MAX,
  PROMPT_GENERATOR_SOUND_TEXT_KEYWORDS_MAX_LENGTH,
  PROMPT_GENERATOR_SOUND_TEXT_NOTES_MAX_LENGTH,
  PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT,
  PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS,
  PROMPT_KEY_EXCLUDE_TOKENS,
  PROMPT_GENERATOR_CATEGORY_OPTIONS,
  ENGINE_PARAMETER_REQUIRED_HINTS,
  ENGINE_PARAMETER_OPTION_SUPPRESS
} from './showcase/constants.js';

import {
  analyzeEngineParameters,
  categoryLabel,
  detectPromptKeyFromProperties,
  deriveMediaFilterTags,
  engineRequiresPrompt,
  engineRequiresSoundText,
  extractEnginePrefix,
  extractFileExtension,
  extractFilename,
  fallbackSlotLabel,
  normalizeSlotLabel,
  formatSlotLabelForDisplay,
  normalizeAssignmentSlotLabels,
  normalizeShowcaseAssetUrl,
  getPromptKey,
  groupMediaEntriesByType,
  inferCategoryFromTokens,
  inferMediaTypeFromParameter,
  isPreviewable3dEntry,
  isSupportedCategory,
  normalizeCategory,
  normalizeMediaGroupType,
  normalizeTemplateEntry,
  normalizeTypeToken,
  requiresMediaForPrefix,
  resolveTypePrefix,
  sanitizeMediaEntryForPayload,
  selectPrimaryMediaFilter,
  tokenizeKey,
  tokenizeMediaValue,
  applyAssetSrcWithFallback
} from './showcase/utils.js';
import {
  state,
  createDefaultHistoryFilters,
  sanitizeHistoryFilters,
  ensureTemplateMenuFilters,
  preferenceStorage,
  getEngineMeta,
  HISTORY_STORAGE_KEY,
  TEMPLATE_STORAGE_KEY,
  FILE_PREFIX_STORAGE_KEY,
  FAILURE_VISIBILITY_STORAGE_KEY,
  INPUT_VISIBILITY_STORAGE_KEY,
  PARAM_VISIBILITY_STORAGE_KEY,
  RESULTS_FILE_FILTER_STORAGE_KEY,
  TEMPLATE_LIMIT,
  MAX_HISTORY_ENTRIES,
  HISTORY_DEFAULT_VISIBLE_COUNT,
  HISTORY_VISIBLE_INCREMENT,
  MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT,
  MEDIA_LIBRARY_VISIBLE_INCREMENT,
  PROMPT_PLACEHOLDER,
  SOUND_TEXT_PLACEHOLDER,
  PROMPT_MIN_HEIGHT,
  PROMPT_MAX_HEIGHT,
  JOB_POLL_INTERVAL_MS,
  JOB_POLL_ERROR_DELAY_MS,
  PARAMS_POPOVER_HIDE_DELAY_MS
} from './showcase/state.js';
import {
  PROMPT_GENERATOR_TYPE_OPTIONS,
  PROMPT_GENERATOR_GUIDANCE_BY_TYPE,
  PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY,
  PROMPT_GENERATOR_VARIANT_OPTIONS,
  PROMPT_GENERATOR_FLOAT_MARGIN,
  PROMPT_GENERATOR_FLOAT_OFFSET,
  PROMPT_GENERATOR_TYPE_CATEGORY_MAP
} from './showcase/prompt-config.js';
import {
  ALL_TYPE_FILTERS,
  knownTypesForCategory,
  determineEngineTypeKey,
  engineMatchesSearch,
  filterEnginesByKeyword,
  getEnginesInCategory,
  createDisplayOrderMap,
  resolveEngineDisplayOrder,
  deriveEngineLabel,
  deriveDocumentationUrl,
  loadDocMetadata,
  getDocMetadata,
  ensureEngineInputs
} from './showcase/engine.js';
import {
  cloneParameterDefault,
  getSchemaDefaultValue,
  ensureParameterDefaults
} from './showcase/parameters.js';
import {
  openParamsPopover,
  closeParamsPopover,
  scheduleParamsPopoverClose,
  cancelParamsPopoverClose,
  isParamsPopoverEngaged,
  getActiveParamsPopover
} from './showcase/param-ui.js';
import {
  attachHoverPlayback,
  bindShowcaseMediaLifecycle,
  applyLoopSettingToMedia,
  updateBatchControlVisuals,
  registerBatchControlGroup,
  computeMediaSlotDefinitions,
  getMediaSlotAssignments,
  findSlotDefinitionById,
  findNextEmptySlotId,
  resolveActiveMediaSlot,
  assignMediaToSlot,
  createMediaSelectionPayload,
  getSelectedMediaList,
  setSelectedMediaList,
  registerMediaSelectionListener,
  deriveMediaBindingValue,
  buildMediaAssignmentsForEngine,
  resolveMediaEntryType,
  closeLightbox,
  configureMediaLightboxHooks,
  render3dDownloadMessage,
  mount3dPreview,
  createLightboxEntryFromSource,
  createLightboxEntriesFromSources,
  openMediaLightbox,
  createResultInputThumb,
  hasMediaUrl,
  loadMediaLibrary,
  normalizeFileTimestamp,
  assignMediaOrderLookup,
  getMediaSelectionOrderInfo,
  renderMediaLibrary,
  removeSelectedMediaEntry,
  clearAllMediaSelections,
  shouldUseMediaSlotLayout,
  configureMediaUiHandlers
} from './showcase/media.js';

installLiveReloadGuard({ alwaysBlockReload: true });

const SHOWCASE_LAYOUT_MIN_HEIGHT = 780;
const SHOWCASE_LAYOUT_MAX_HEIGHT = 4440;
const SHOWCASE_ENGINE_HEIGHT_PADDING = 96;
const SHOWCASE_ENGINE_LIST_MIN_HEIGHT = 360;
const SHOWCASE_LAYOUT_EPSILON = 6;
let showcaseLayoutSyncHandle = null;
let lastShowcaseLayoutHeight = 0;

function scheduleShowcaseLayoutSync() {
  if (typeof window === 'undefined') return;
  if (showcaseLayoutSyncHandle !== null) return;
  showcaseLayoutSyncHandle = window.requestAnimationFrame(() => {
    showcaseLayoutSyncHandle = null;
    syncShowcaseLayoutHeight();
  });
}

function syncShowcaseLayoutHeight() {
  if (typeof document === 'undefined') return;
  const wrapper = document.querySelector('.kc-showcase-wrapper');
  if (!(wrapper instanceof HTMLElement)) return;
  const enginesColumn = wrapper.querySelector('.kc-column--engines');
  const selectionSummary = document.getElementById('kc-selection-summary');
  const enginesPanelBody = enginesColumn?.querySelector('.kc-panel__body--engines');
  const enginesToolbar = document.getElementById('kc-engine-toolbar');

  if (!(enginesColumn instanceof HTMLElement) || !(selectionSummary instanceof HTMLElement) || !(enginesPanelBody instanceof HTMLElement)) {
    if (lastShowcaseLayoutHeight !== 0) {
      wrapper.style.removeProperty('--kc-showcase-height');
      lastShowcaseLayoutHeight = 0;
    }
    return;
  }

  const viewportHeight = Math.max(
    SHOWCASE_LAYOUT_MIN_HEIGHT,
    Number.isFinite(window.innerHeight) ? window.innerHeight : 0
  );

  const columnHeight = Math.ceil(enginesColumn.scrollHeight || enginesColumn.offsetHeight || 0);
  const toolbarHeight = Math.ceil(enginesToolbar?.getBoundingClientRect().height || 0);
  const bodyHeight = Math.ceil(enginesPanelBody.getBoundingClientRect().height || 0);
  const desiredBodyHeight = toolbarHeight + SHOWCASE_ENGINE_LIST_MIN_HEIGHT;

  let targetHeight = Math.max(
    viewportHeight,
    columnHeight + SHOWCASE_ENGINE_HEIGHT_PADDING
  );

  if (bodyHeight < desiredBodyHeight) {
    targetHeight += desiredBodyHeight - bodyHeight;
  }

  targetHeight = Math.min(SHOWCASE_LAYOUT_MAX_HEIGHT, targetHeight);

  if (targetHeight <= viewportHeight + SHOWCASE_LAYOUT_EPSILON) {
    if (lastShowcaseLayoutHeight !== 0) {
      wrapper.style.removeProperty('--kc-showcase-height');
      lastShowcaseLayoutHeight = 0;
    }
    return;
  }

  if (Math.abs(targetHeight - lastShowcaseLayoutHeight) <= SHOWCASE_LAYOUT_EPSILON) {
    return;
  }

  lastShowcaseLayoutHeight = targetHeight;
  wrapper.style.setProperty('--kc-showcase-height', `${targetHeight}px`);
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    scheduleShowcaseLayoutSync();
  });
}

function isShowcaseSyncDisabled() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__kcDisableShowcaseSync);
}

let reloadReleaseTimer = null;
let beforeUnloadHandler = null;

function setReloadBlock(active, { delayMs = RELOAD_RELEASE_DELAY_MS, release = true, manual = false } = {}) {
  if (typeof window === 'undefined') return;

  if (!beforeUnloadHandler) {
    beforeUnloadHandler = (event) => {
      if (!window.__kcBlockManualReload) return;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', beforeUnloadHandler, { capture: true });
  }

  if (reloadReleaseTimer) {
    clearTimeout(reloadReleaseTimer);
    reloadReleaseTimer = null;
  }

  if (active) {
    window.__kcBlockReload = true;
    window.__kcBlockManualReload = Boolean(manual);
    return;
  }

  if (!release) {
    window.__kcBlockReload = true;
    window.__kcBlockManualReload = Boolean(manual);
    return;
  }

  const delay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : RELOAD_RELEASE_DELAY_MS;
  if (delay <= 0) {
    window.__kcBlockReload = false;
    window.__kcBlockManualReload = false;
    return;
  }
  reloadReleaseTimer = window.setTimeout(() => {
    window.__kcBlockReload = false;
    window.__kcBlockManualReload = false;
    reloadReleaseTimer = null;
  }, delay);
}

if (typeof window !== 'undefined') {
  window.__kcAllowReload = (delayMs = 0) => {
    setReloadBlock(false, { release: true, delayMs });
  };
}
function normalizeGuidancePack(entry, { mode = PROMPT_GENERATOR_DEFAULT_MODE } = {}) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return { en: trimmed, ja: trimmed };
  }
  if (entry && typeof entry === 'object') {
    const en = typeof entry.en === 'string' && entry.en.trim() ? entry.en.trim() : '';
    const ja = typeof entry.ja === 'string' && entry.ja.trim() ? entry.ja.trim() : '';
    if (en || ja) {
      return {
        en: en || ja,
        ja: ja || en
      };
    }
    const normalizedMode = normalizePromptGeneratorMode(mode);
    const nested = entry[normalizedMode] || entry.default || entry.enhance || entry.expand;
    if (nested && nested !== entry) {
      return normalizeGuidancePack(nested, { mode: normalizedMode });
    }
  }
  return null;
}

function getDefaultPromptGeneratorGuidancePack(type, category, mode = PROMPT_GENERATOR_DEFAULT_MODE) {
  const normalizedType = normalizeTypeToken(type);
  if (normalizedType && PROMPT_GENERATOR_GUIDANCE_BY_TYPE.has(normalizedType)) {
    const pack = normalizeGuidancePack(PROMPT_GENERATOR_GUIDANCE_BY_TYPE.get(normalizedType), { mode });
    if (pack) return pack;
  }
  const inferredCategory = normalizeCategory(
    category
      || (normalizedType ? PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(normalizedType) : '')
      || DEFAULT_ACTIVE_CATEGORY
  );
  if (PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY.has(inferredCategory)) {
    const pack = normalizeGuidancePack(PROMPT_GENERATOR_GUIDANCE_BY_CATEGORY.get(inferredCategory), { mode });
    if (pack) return pack;
  }
  return {
    en: 'Provide detailed instructions about the goal, preferred style, constraints, and desired outputs.',
    ja: '生成したい内容の目的、スタイル、制約、期待する出力を具体的に記述してください。'
  };
}

function resolveHistory3dThumbnail(entry, result) {
  const candidates = [];
  const pushCandidate = (value) => {
    if (!value && value !== 0) return;
    const normalized = normalizeShowcaseAssetUrl(value);
    if (!normalized) return;
    const token = normalized.split('?')[0].split('#')[0];
    if (!token || token.lastIndexOf('.') === -1) return;
    const ext = token.slice(token.lastIndexOf('.') + 1).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(result?.thumbnailUrl);
  pushCandidate(result?.previewUrl);

  const results = Array.isArray(entry?.results) ? entry.results : [];
  if (results.length) {
    const targetRequest = (result?.requestId || '').trim();
    const targetEngine = (result?.engineId || '').trim();
    const targetPrefix = (result?.filePrefix || result?.savedFile?.prefix || '').trim().toLowerCase();
    results.forEach((item) => {
      if (!item || item === result) return;
      const candidateUrl = item.imageUrl || '';
      if (!candidateUrl) return;
      const mediaType = resolveMediaEntryType({
        filterType: item.filterType || item.type || '',
        type: item.type || '',
        url: candidateUrl,
        path: item.fileName || ''
      });
      if (mediaType !== 'image') return;
      const sameRequest = targetRequest && item.requestId && item.requestId === targetRequest;
      const sameEngine = targetEngine && item.engineId && item.engineId === targetEngine;
      const candidatePrefix = (item.filePrefix || item.savedFile?.prefix || '').trim().toLowerCase();
      const samePrefix = targetPrefix && candidatePrefix && candidatePrefix === targetPrefix;
      if (!(sameRequest || sameEngine || samePrefix)) return;
      pushCandidate(candidateUrl);
    });
  }

  return candidates[0] || '';
}


const SORA_ENGINE_ID = 't2v-kamui-openai-sora';
const SORA_DEFAULT_SIZE = '1280x720';
const SORA_DEFAULT_SECONDS = '8';
const SORA_MODEL_OPTIONS = ['sora-2', 'sora-2-pro'];
const SORA_SIZE_OPTIONS = ['1280x720', '720x1280', '1792x1024', '1024x1792'];
const SORA_PRO_ONLY_SIZES = new Set(['1792x1024', '1024x1792']);
const SORA_SECONDS_OPTIONS = ['4', '8', '12'];

const ENGINE_PARAMETER_OPTION_HINTS = Object.freeze({
  [SORA_ENGINE_ID]: {
    model: {
      replace: true,
      options: [
        { value: 'sora-2', label: 'Sora 2 (Fast / Flexible)' },
        { value: 'sora-2-pro', label: 'Sora 2 Pro (Production)' }
      ],
      default: 'sora-2'
    },
    size: {
      replace: true,
      options: [
        { value: '1280x720', label: '1280x720 (横長)' },
        { value: '720x1280', label: '720x1280 (縦長)' },
        { value: '1792x1024', label: '1792x1024 (横長・Pro専用)' },
        { value: '1024x1792', label: '1024x1792 (縦長・Pro専用)' }
      ],
      default: SORA_DEFAULT_SIZE
    },
    seconds: {
      replace: true,
      options: [
        { value: '4', label: '4 秒' },
        { value: '8', label: '8 秒' },
        { value: '12', label: '12 秒' }
      ],
      default: SORA_DEFAULT_SECONDS
    }
  },
  't2v-kamui-kling-video-v25-turbo-pro': {
    duration: {
      options: [
        { value: '5', label: '5 秒' },
        { value: '10', label: '10 秒' }
      ]
    },
    aspect_ratio: {
      options: [
        { value: '16:9', label: '16:9 (横長)' },
        { value: '9:16', label: '9:16 (縦長)' },
        { value: '1:1', label: '1:1 (正方形)' }
      ]
    }
  },
  'a2v-kamui-veed-fabric-1-0': {
    resolution: {
      options: [
        { value: '480p', label: '480p' },
        { value: '720p', label: '720p' }
      ],
      default: '480p'
    }
  },
  'i2i3d-kamui-tripo3d-image-to-3d': {
    style: {
      options: [
        { value: 'default', label: 'Default' }
      ],
      default: 'default'
    }
  }
});


function collectMediaParameterMetaForType(selectedEngines, type) {
  const entries = new Map();
  selectedEngines.forEach((engine) => {
    const meta = getEngineMeta(engine.id);
    const params = meta?.mediaParams?.[type];
    if (!Array.isArray(params)) return;
    params.forEach((param) => {
      if (!param || !param.key) return;
      const key = param.key;
      if (!shouldDisplayMediaParamBadge(key, type, meta)) {
        return;
      }
      const tokens = tokenizeKey(key);
      if (tokens.some((token) => MEDIA_PARAM_BADGE_EXCLUDE_TOKENS.has(token))) {
        return;
      }
      if (!entries.has(key)) {
        entries.set(key, {
          key,
          required: Boolean(param.required)
        });
      } else if (param.required) {
        const current = entries.get(key);
        current.required = true;
      }
    });
  });
  return Array.from(entries.values()).filter((entry) => Boolean(entry.required));
}

function shouldDisplayMediaParamBadge(key, type, engineMeta) {
  if (!key) return false;
  if (type === 'other') return false;
  const tokens = tokenizeKey(key);
  if (!tokens.length) return false;
  const hasIndicatorToken = tokens.some((token) => MEDIA_PARAM_INDICATOR_TOKENS.has(token));
  if (!hasIndicatorToken && tokens.some((token) => MEDIA_PARAM_BADGE_EXCLUDE_TOKENS.has(token))) {
    return false;
  }
  const schema = engineMeta?.tools?.submit?.parameters?.properties?.[key];
  const inferred = normalizeMediaGroupType(inferMediaTypeFromParameter(key, schema));
  if (!inferred || inferred === 'other') {
    return false;
  }
  return inferred === type;
}

function getSoundTextParamKeys(meta) {
  if (!meta) return [];
  if (Array.isArray(meta.soundTextKeys) && meta.soundTextKeys.length) return meta.soundTextKeys;
  if (meta.soundTextKey) return [meta.soundTextKey];
  return ['text'];
}

const CATEGORY_OVERRIDES = {};

const BADGE_THEME_PREFIX = 'kc-theme--';
const BADGE_THEME_MAP = new Map([
  ['t2i', 't2i'],
  ['i2i', 'i2i'],
  ['t2v', 't2v'],
  ['i2v', 'i2v'],
  ['r2v', 'r2v'],
  ['s2v', 's2v'],
  ['a2v', 'a2v'],
  ['v2v', 'v2v'],
  ['v2a', 'v2a'],
  ['v2sfx', 'v2sfx'],
  ['t2a', 't2a'],
  ['t2s', 't2s'],
  ['tts', 'tts'],
  ['t2m', 't2m'],
  ['i2i3d', 'i2i3d'],
  ['t2visual', 't2visual'],
  ['file', 'file'],
  ['train', 'train'],
  ['misc', 'misc']
]);

const CATEGORY_THEME_MAP = {
  image: 'image',
  text: 'image',
  img: 'image',
  images: 'image',
  video: 'video',
  sound: 'sound',
  '3d': '3d',
  other: 'other',
  all: 'all'
};

function normalizeThemeToken(token) {
  if (token === undefined || token === null) return '';
  return String(token).trim().toLowerCase();
}

function resolveBadgeTheme(tokens, fallbackCategory) {
  const queue = Array.isArray(tokens) ? tokens : [tokens];

  for (const token of queue) {
    const literal = normalizeThemeToken(token);
    if (!literal) continue;
    if (BADGE_THEME_MAP.has(literal)) {
      return BADGE_THEME_MAP.get(literal);
    }
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, literal)) {
      return CATEGORY_THEME_MAP[literal];
    }
    const normalizedType = normalizeTypeToken(literal);
    if (normalizedType && BADGE_THEME_MAP.has(normalizedType)) {
      return BADGE_THEME_MAP.get(normalizedType);
    }
    const normalizedCategory = normalizeCategory(literal);
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, normalizedCategory)) {
      return CATEGORY_THEME_MAP[normalizedCategory];
    }
  }

  const fallbacks = Array.isArray(fallbackCategory) ? fallbackCategory : [fallbackCategory];
  for (const candidate of fallbacks) {
    const literal = normalizeThemeToken(candidate);
    if (!literal) continue;
    if (BADGE_THEME_MAP.has(literal)) {
      return BADGE_THEME_MAP.get(literal);
    }
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, literal)) {
      return CATEGORY_THEME_MAP[literal];
    }
    const normalizedCategory = normalizeCategory(literal);
    if (Object.prototype.hasOwnProperty.call(CATEGORY_THEME_MAP, normalizedCategory)) {
      return CATEGORY_THEME_MAP[normalizedCategory];
    }
  }

  return '';
}

function clearBadgeTheme(target) {
  if (!target || !target.classList) return;
  Array.from(target.classList).forEach((cls) => {
    if (cls && cls.startsWith(BADGE_THEME_PREFIX)) {
      target.classList.remove(cls);
    }
  });
  if (target.dataset && Object.prototype.hasOwnProperty.call(target.dataset, 'kcTheme')) {
    delete target.dataset.kcTheme;
  }
}

function applyBadgeTheme(target, tokens, options = {}) {
  if (!target || !target.classList) return '';
  const { fallbackCategory = '' } = options;
  const theme = resolveBadgeTheme(tokens, fallbackCategory);
  clearBadgeTheme(target);
  if (theme) {
    target.classList.add(`${BADGE_THEME_PREFIX}${theme}`);
    if (target.dataset) {
      target.dataset.kcTheme = theme;
    }
  }
  return theme;
}

function coerceTemplateContextShape(input) {
  if (!input || typeof input !== 'object') return null;
  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
    : [];
  const overrides = (input.overrides && typeof input.overrides === 'object')
    ? {
        prompt: Boolean(input.overrides.prompt),
        filePrefix: Boolean(input.overrides.filePrefix),
        soundText: Boolean(input.overrides.soundText)
      }
    : null;
  const provided = {
    prompt: typeof input.prompt === 'string',
    filePrefix: typeof input.filePrefix === 'string' && input.filePrefix.trim() !== '',
    soundText: typeof input.soundText === 'string' && input.soundText.trim() !== '',
    memo: typeof input.memo === 'string' && input.memo.trim() !== ''
  };
  return {
    id: typeof input.id === 'string' ? input.id : '',
    name: typeof input.name === 'string' ? input.name : '',
    category: normalizeCategory(input.category || ''),
    type: normalizeTypeToken(input.type || ''),
    memo: typeof input.memo === 'string' ? input.memo : '',
    prompt: typeof input.prompt === 'string' ? input.prompt : '',
    filePrefix: typeof input.filePrefix === 'string' ? input.filePrefix.trim() : '',
    soundText: typeof input.soundText === 'string' ? input.soundText : '',
    description: typeof input.description === 'string' ? input.description : '',
    tags,
    source: typeof input.source === 'string' ? input.source : '',
    appliedAt: Number.isFinite(input.appliedAt) ? input.appliedAt : null,
    overrides,
    provided
  };
}

function normalizeTemplateContext(raw, fallback = null) {
  const primary = coerceTemplateContextShape(raw);
  const fallbackShape = fallback ? coerceTemplateContextShape(fallback) : null;
  if (!primary && !fallbackShape) {
    return null;
  }
  const base = primary || fallbackShape;
  const result = { ...base };
  if (fallbackShape) {
    if (!result.id && fallbackShape.id) result.id = fallbackShape.id;
    if (!result.name && fallbackShape.name) result.name = fallbackShape.name;
    if (!result.category && fallbackShape.category) result.category = fallbackShape.category;
    if (!result.type && fallbackShape.type) result.type = fallbackShape.type;
    if (!result.memo && fallbackShape.memo) result.memo = fallbackShape.memo;
    if (!result.prompt && fallbackShape.prompt) result.prompt = fallbackShape.prompt;
    if (!result.filePrefix && fallbackShape.filePrefix) result.filePrefix = fallbackShape.filePrefix;
    if (!result.soundText && fallbackShape.soundText) result.soundText = fallbackShape.soundText;
    if (!result.description && fallbackShape.description) result.description = fallbackShape.description;
    if (!result.source && fallbackShape.source) result.source = fallbackShape.source;
    if (!result.tags.length && fallbackShape.tags.length) {
      result.tags = fallbackShape.tags.slice();
    }
    result.provided = {
      prompt: Boolean(result.provided?.prompt || fallbackShape.provided?.prompt),
      filePrefix: Boolean(result.provided?.filePrefix || fallbackShape.provided?.filePrefix),
      soundText: Boolean(result.provided?.soundText || fallbackShape.provided?.soundText),
      memo: Boolean(result.provided?.memo || fallbackShape.provided?.memo)
    };
  } else if (!result.provided) {
    result.provided = {
      prompt: Boolean(result.prompt),
      filePrefix: Boolean(result.filePrefix),
      soundText: Boolean(result.soundText),
      memo: Boolean(result.memo)
    };
  }

  result.appliedAt = Number.isFinite(result.appliedAt) ? result.appliedAt : Date.now();
  result.overrides = result.overrides
    ? {
        prompt: Boolean(result.overrides.prompt),
        filePrefix: Boolean(result.overrides.filePrefix),
        soundText: Boolean(result.overrides.soundText)
      }
    : {
        prompt: false,
        filePrefix: false,
        soundText: false
      };
  result.tags = Array.isArray(result.tags) ? result.tags : [];
  return result;
}

function cloneTemplateContext(source, fallback = null) {
  const normalized = normalizeTemplateContext(source, fallback);
  if (!normalized) return null;
  return {
    ...normalized,
    tags: normalized.tags.slice(),
    overrides: { ...normalized.overrides },
    provided: { ...normalized.provided }
  };
}

function createTemplateContextSnapshot(source = null, fallback = null) {
  if (source) {
    return cloneTemplateContext(source, fallback);
  }
  return cloneTemplateContext(state.activeTemplateContext, fallback);
}

function setActiveTemplateContext(context) {
  const snapshot = cloneTemplateContext(context);
  if (!snapshot) {
    state.activeTemplateContext = null;
    syncTemplatePreviewUi();
    return;
  }
  if (!Number.isFinite(snapshot.appliedAt)) {
    snapshot.appliedAt = Date.now();
  }
  state.activeTemplateContext = snapshot;
  updateActiveTemplateOverrides({ syncUi: false });
  syncTemplatePreviewUi();
}

function clearActiveTemplateContext({ syncUi = true } = {}) {
  state.activeTemplateContext = null;
  if (syncUi) {
    syncTemplatePreviewUi();
  }
}

function updateActiveTemplateOverrides({ syncUi = true } = {}) {
  const ctx = state.activeTemplateContext;
  if (!ctx) return;
  const promptBaseline = (ctx.prompt || '').trim();
  const prefixBaseline = (ctx.filePrefix || '').trim();
  const soundBaseline = (ctx.soundText || '').trim();
  const currentPrompt = (state.prompt || '').trim();
  const currentPrefix = (state.filePrefix || '').trim();
  const currentSound = (state.soundText || '').trim();
  const provided = ctx.provided || {};
  const nextOverrides = {
    prompt: currentPrompt !== promptBaseline,
    filePrefix: provided.filePrefix ? currentPrefix !== prefixBaseline : false,
    soundText: provided.soundText ? currentSound !== soundBaseline : false
  };
  const hasChanges = !ctx.overrides
    || ctx.overrides.prompt !== nextOverrides.prompt
    || ctx.overrides.filePrefix !== nextOverrides.filePrefix
    || ctx.overrides.soundText !== nextOverrides.soundText;
  if (hasChanges) {
    state.activeTemplateContext = {
      ...ctx,
      overrides: nextOverrides
    };
  }
  if (syncUi) {
    syncTemplatePreviewUi();
  }
}

function listTemplatesForInference() {
  const defaults = Array.isArray(state.templateDefaults) ? state.templateDefaults : [];
  const custom = Array.isArray(state.templateCustom) ? state.templateCustom : [];
  const visible = Array.isArray(state.templates) ? state.templates : [];
  const combined = [...defaults, ...custom, ...visible];
  const seen = new Set();
  const result = [];
  combined.forEach((tpl) => {
    if (!tpl || typeof tpl !== 'object') return;
    const key = tpl.id || `${tpl.category || ''}-${tpl.name || ''}-${tpl.prompt || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(tpl);
  });
  return result;
}

function inferTemplateContextFromPrompt(prompt, { filePrefix = '' } = {}) {
  const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (!trimmedPrompt) return null;
  const trimmedPrefix = typeof filePrefix === 'string' ? filePrefix.trim() : '';
  const templates = listTemplatesForInference();
  if (!templates.length) return null;
  const matches = templates.filter((tpl) => (
    typeof tpl?.prompt === 'string' && tpl.prompt.trim() === trimmedPrompt
  ));
  if (!matches.length) return null;
  let candidate = matches[0];
  if (trimmedPrefix) {
    const prefixMatch = matches.find((tpl) => (
      typeof tpl.filePrefix === 'string' && tpl.filePrefix.trim() === trimmedPrefix
    ));
    if (prefixMatch) {
      candidate = prefixMatch;
    }
  }
  return candidate ? cloneTemplateContext(candidate) : null;
}

function resolveEntryTemplateContext(entry) {
  if (!entry || typeof entry !== 'object') return null;
  let context = null;
  if (entry.templateContext) {
    context = cloneTemplateContext(entry.templateContext);
  }
  if (!context && Array.isArray(entry.results)) {
    for (const result of entry.results) {
      if (result && result.templateContext) {
        context = cloneTemplateContext(result.templateContext, entry.templateContext);
        break;
      }
    }
  }
  if (!context) {
    const prompt = (entry.prompt || '').trim();
    if (prompt) {
      let inferredPrefix = '';
      if (entry.templateContext?.filePrefix) {
        inferredPrefix = entry.templateContext.filePrefix;
      } else if (Array.isArray(entry.results)) {
        const withPrefix = entry.results.find((item) => item && (item.filePrefix || item.savedFile?.prefix));
        if (withPrefix) {
          inferredPrefix = withPrefix.filePrefix || withPrefix.savedFile?.prefix || '';
        }
      }
      context = inferTemplateContextFromPrompt(prompt, { filePrefix: inferredPrefix });
    }
  }
  return context;
}

let activePromptPopover = null;
let activeResultsModal = null;
let activeTemplateMenu = null;
let templateMenuCloseTimer = null;
let activeTemplateModal = null;
let activePromptModal = null;
let activeMcpConfigModal = null;
let promptGeneratorStatusTimer = null;
let promptGeneratorMenuState = null;
let promptGeneratorHostElement = null;
let engineLoadingOverlay = null;

function isAllCategory(category) {
  if (!category && category !== 0) return false;
  return String(category).toLowerCase() === ALL_CATEGORY_ID;
}

function getSoraState() {
  if (!state.sora || typeof state.sora !== 'object') {
    state.sora = {
      mode: 't2v',
      remixEligible: false
    };
  } else {
    if (typeof state.sora.mode !== 'string') {
      state.sora.mode = 't2v';
    }
    if (typeof state.sora.remixEligible !== 'boolean') {
      state.sora.remixEligible = false;
    }
    if (Object.prototype.hasOwnProperty.call(state.sora, 'qualityMode')) {
      delete state.sora.qualityMode;
    }
  }
  return state.sora;
}

function normalizeSoraSize(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^0-9x]/g, '');
  if (SORA_SIZE_OPTIONS.includes(normalized)) {
    return normalized;
  }
  return SORA_DEFAULT_SIZE;
}

function hasSoraVideoId(entry) {
  if (!entry) return false;
  return Boolean(
    entry.videoId
    || entry.soraVideoId
    || (entry.sora && entry.sora.videoId)
    || (entry.savedFile && entry.savedFile.videoId)
  );
}

function extractSoraVideoId(entry) {
  if (!entry) return '';
  return entry.videoId
    || entry.soraVideoId
    || (entry.sora && entry.sora.videoId)
    || (entry.savedFile && entry.savedFile.videoId)
    || '';
}

function analyzeSoraMedia(groupedMedia = new Map()) {
  const imageEntries = groupedMedia.get('image') || [];
  const videoEntries = groupedMedia.get('video') || [];
  const soraVideoEntry = videoEntries.find((entry) => hasSoraVideoId(entry));
  if (soraVideoEntry) {
    return {
      mode: 'remix',
      remixEligible: true,
      remixEntry: soraVideoEntry
    };
  }
  if (videoEntries.length) {
    return {
      mode: 'remix',
      remixEligible: false,
      remixEntry: null
    };
  }
  if (imageEntries.length) {
    return {
      mode: 'i2v',
      remixEligible: false,
      remixEntry: null
    };
  }
  return {
    mode: 't2v',
    remixEligible: false,
    remixEntry: null
  };
}

function updateSoraEngineInputs(store, { groupedMedia = new Map() } = {}) {
  const soraState = getSoraState();
  const analysis = analyzeSoraMedia(groupedMedia);
  soraState.mode = analysis.mode;
  soraState.remixEligible = analysis.remixEligible;

  if (!store) {
    return analysis;
  }

  const rawModel = (store.model || '').toString().trim();
  let normalizedModel = SORA_MODEL_OPTIONS.includes(rawModel) ? rawModel : 'sora-2';
  let normalizedSize = normalizeSoraSize(store.size || SORA_DEFAULT_SIZE);
  if (SORA_PRO_ONLY_SIZES.has(normalizedSize) && normalizedModel !== 'sora-2-pro') {
    normalizedModel = 'sora-2-pro';
  }
  store.model = normalizedModel;
  store.size = normalizedSize;
  const rawSeconds = store.seconds;
  let normalizedSeconds;
  if (rawSeconds === undefined || rawSeconds === null || rawSeconds === '') {
    normalizedSeconds = SORA_DEFAULT_SECONDS;
  } else if (typeof rawSeconds === 'number') {
    normalizedSeconds = String(rawSeconds);
  } else {
    normalizedSeconds = String(rawSeconds).trim();
  }
  if (!SORA_SECONDS_OPTIONS.includes(normalizedSeconds)) {
    normalizedSeconds = SORA_DEFAULT_SECONDS;
  }
  store.seconds = normalizedSeconds;
  if (Object.prototype.hasOwnProperty.call(store, 'sora_quality_mode')) {
    delete store.sora_quality_mode;
  }


  if (analysis.mode === 'remix') {
    if (analysis.remixEligible && analysis.remixEntry) {
      const videoId = extractSoraVideoId(analysis.remixEntry);
      if (videoId) {
        store.remix_video_id = videoId;
      }
    } else {
      delete store.remix_video_id;
    }
    delete store.input_reference;
  } else if (analysis.mode === 'i2v') {
    delete store.remix_video_id;
  } else {
    delete store.remix_video_id;
    delete store.input_reference;
  }

  return analysis;
}

function renderSoraControls(container, groupedMedia) {
  const soraState = getSoraState();
  const analysis = analyzeSoraMedia(groupedMedia);
  soraState.mode = analysis.mode;
  soraState.remixEligible = analysis.remixEligible;

  if (analysis.mode === 'remix' && !analysis.remixEligible) {
    const warning = document.createElement('div');
    warning.className = 'kc-sora-warning';
    warning.textContent = 'Sora生成動画のみリミックスできます';
    container.append(warning);
  }
}

function applySelectedMediaToEngineInputs() {
  const mediaList = getSelectedMediaList();
  const grouped = groupMediaEntriesByType(mediaList);

  state.selected.forEach((entry, id) => {
    const meta = getEngineMeta(id);
    if (!meta) return;
    const paramsByType = meta.mediaParams || {};
    const store = ensureEngineInputs(meta);
    if (!store) return;
    if (!store.__autoMediaAssignments || typeof store.__autoMediaAssignments !== 'object') {
      store.__autoMediaAssignments = {};
    }
    const autoMap = store.__autoMediaAssignments;

    if (id === SORA_ENGINE_ID) {
      updateSoraEngineInputs(store, { groupedMedia: grouped });
    }

    Object.entries(paramsByType).forEach(([rawType, params]) => {
      if (!Array.isArray(params) || !params.length) return;
      const type = normalizeMediaGroupType(rawType);
      const list = grouped.get(type) || [];
      params.forEach((param, index) => {
        if (!param || !param.key) return;
        if (id === SORA_ENGINE_ID && (param.key === 'input_reference' || param.key === 'inputReferences')) {
          if (store[param.key]) delete store[param.key];
          if (autoMap[param.key]) delete autoMap[param.key];
          return;
        }
        const targetEntry = list[index] || list[0];
        const key = param.key;
        if (targetEntry) {
          const nextValue = deriveMediaBindingValue(targetEntry);
          if (!nextValue) return;
          const currentValue = store[key];
          const lastAuto = autoMap[key];
          const canOverwrite = currentValue === undefined
            || currentValue === null
            || currentValue === ''
            || currentValue === lastAuto;
          if (!canOverwrite && currentValue !== nextValue) {
            return;
          }
          store[key] = nextValue;
          autoMap[key] = nextValue;
        } else if (autoMap[key]) {
          if (store[key] === autoMap[key]) {
            delete store[key];
          }
          delete autoMap[key];
        }
      });
    });
  });
}

registerMediaSelectionListener(applySelectedMediaToEngineInputs);
applySelectedMediaToEngineInputs();

function formatParameterValue(value) {
  if (value === undefined || value === null) return '';
  const MAX_LENGTH = 240;
  const toString = (input) => {
    if (input === undefined || input === null) return '';
    if (typeof input === 'string') return input;
    if (typeof input === 'number' || typeof input === 'boolean') return String(input);
    if (Array.isArray(input)) {
      return input
        .map((item) => toString(item))
        .filter((item) => item && item.trim().length)
        .join(', ');
    }
    try {
      return JSON.stringify(input);
    } catch (err) {
      return '[unserializable]';
    }
  };
  const text = toString(value) || '';
  if (text.length <= MAX_LENGTH) return text;
  return `${text.slice(0, MAX_LENGTH)}… (${text.length} chars)`;
}

function isJobTerminal(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'completed' || normalized === 'failed' || normalized === 'cancelled';
}

function translateJobStatus(status) {
  const normalized = String(status || '').toLowerCase();
  switch (normalized) {
    case 'pending':
      return '待機中';
    case 'running':
      return '実行中...';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    case 'cancelled':
      return 'キャンセル済み';
    case 'cancelling':
      return 'キャンセル中...';
    default:
      return '状況確認中';
  }
}

function translateEngineStatus(engine) {
  const normalized = String(engine?.status || '').toLowerCase();
  switch (normalized) {
    case 'pending':
      return '待機中';
    case 'running':
      return '実行中...';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    case 'cancelled':
      return 'キャンセル済み';
    case 'cancelling':
      return 'キャンセル中...';
    default:
      return '不明';
  }
}

function stopJobPolling(jobId) {
  if (!jobId) return;
  const timer = state.jobPollers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    state.jobPollers.delete(jobId);
  }
}

function stopAllJobPollers() {
  state.jobPollers.forEach((timer, jobId) => {
    clearTimeout(timer);
    state.jobPollers.delete(jobId);
  });
}

function scheduleJobPoll(jobId, delay = JOB_POLL_INTERVAL_MS) {
  if (!jobId) return;
  stopJobPolling(jobId);
  const safeDelay = Math.max(250, Number(delay) || JOB_POLL_INTERVAL_MS);
  const timer = setTimeout(() => {
    state.jobPollers.delete(jobId);
    fetchAndHandleJob(jobId);
  }, safeDelay);
  state.jobPollers.set(jobId, timer);
}

async function fetchAndHandleJob(jobId) {
  try {
    const response = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
    const job = response?.job;
    if (!job || !job.id) {
      throw new Error('ジョブ情報を取得できませんでした');
    }
    handleJobUpdate(job);
    if (!isJobTerminal(job.status)) {
      scheduleJobPoll(jobId, JOB_POLL_INTERVAL_MS);
    }
  } catch (err) {
    console.error('[Showcase] job poll failed', err);
    scheduleJobPoll(jobId, JOB_POLL_ERROR_DELAY_MS);
  }
}

function startJobPolling(jobId, { immediate = true } = {}) {
  if (!jobId) return;
  stopJobPolling(jobId);
  if (immediate) {
    fetchAndHandleJob(jobId);
  } else {
    scheduleJobPoll(jobId, JOB_POLL_INTERVAL_MS);
  }
}

async function requestCancelJob(jobId) {
  if (!jobId) return;
  try {
    const response = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    if (response?.job) {
      handleJobUpdate(response.job);
    }
    startJobPolling(jobId, { immediate: true });
  } catch (err) {
    console.error('[Showcase] job cancel failed', err);
  }
}

async function requestCancelEngine(jobId, engineId) {
  if (!jobId || !engineId) return;
  try {
    const response = await fetchJson(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ engineId })
    });
    if (response?.job) {
      handleJobUpdate(response.job);
    }
    startJobPolling(jobId, { immediate: true });
  } catch (err) {
    console.error('[Showcase] engine cancel failed', err);
  }
}

function ensureCurrentRunCategory(category) {
  const normalized = normalizeCategory(category || DEFAULT_ACTIVE_CATEGORY);
  if (!state.currentRunResults.has(normalized)) {
    state.currentRunResults.set(normalized, []);
  }
  return state.currentRunResults.get(normalized);
}

function convertEngineOutput(engineOutput, job = null, jobEngineSnapshot = null) {
  if (!engineOutput || typeof engineOutput !== 'object') return null;
  const engineId = engineOutput.id;
  if (!engineId) return null;
  const engineMeta = getEngineMeta(engineId);
  const selectedMeta = state.selected.get(engineId);
  const rawItemCategory = normalizeCategory(engineOutput.category);
  const engineCategory = normalizeCategory(engineMeta?.category);
  const selectedCategory = normalizeCategory(selectedMeta?.category);
  const derivedPrefix = extractEnginePrefix(engineId);
  const typePrefix = resolveTypePrefix([
    engineOutput.type,
    engineOutput.kind,
    engineMeta?.sourceCategory,
    derivedPrefix,
    engineOutput.category
  ], derivedPrefix);
  let category = inferCategoryFromTokens([
    rawItemCategory,
    engineCategory,
    selectedCategory,
    engineMeta?.sourceCategory,
    typePrefix
  ], DEFAULT_ACTIVE_CATEGORY);
  if (!category || category === 'other') {
    category = DEFAULT_ACTIVE_CATEGORY;
  }
  const metaInfo = selectedMeta || {
    label: engineMeta?.label || deriveEngineLabel(engineId),
    category,
    requiresMedia: engineMeta?.requiresMedia || false
  };
  const typeToken = typePrefix || resolveTypePrefix([
    category,
    rawItemCategory,
    engineCategory,
    selectedCategory
  ]);
  const sourceCategory = typeToken || '';
  const result = engineOutput.result || {};
  const soraMeta = engineOutput.sora || result.sora || null;
  const savedFiles = Array.isArray(result.savedFiles) ? result.savedFiles : [];
  const logs = Array.isArray(result.logs) ? result.logs.map((entry) => String(entry || '')).filter(Boolean) : [];
  const statusHistory = Array.isArray(result.statusHistory)
    ? result.statusHistory.map((entry) => String(entry || '')).filter(Boolean)
    : [];
  const jobEngine = jobEngineSnapshot || (job && Array.isArray(job.engines)
    ? job.engines.find((engine) => engine.id === engineId)
    : null);
  const engineInputSnapshot = jobEngine?.input && typeof jobEngine.input === 'object'
    ? jobEngine.input
    : {};
  const rawAssignments = Array.isArray(jobEngine?.mediaAssignments)
    ? jobEngine.mediaAssignments
    : [];
  const rawJobMedia = Array.isArray(jobEngine?.media)
    ? jobEngine.media
    : [];
  const primaryAssignmentsRaw = rawAssignments
    .map((assignment, idx) => {
      if (!assignment) return null;
      const sanitized = sanitizeMediaEntryForPayload(assignment.media || assignment, assignment.type || assignment.media?.filterType || '');
      if (!sanitized) return null;
      const slotType = normalizeMediaGroupType(assignment.slotType || assignment.type || sanitized.filterType || '');
      const slotIndex = Number.isFinite(assignment.slotIndex) ? assignment.slotIndex : idx;
      const slotId = assignment.slotId || `${slotType}:${slotIndex}`;
      const slotLabel = normalizeSlotLabel(assignment.slotLabel, {
        type: slotType,
        key: assignment.paramKey || '',
        index: slotIndex
      });
      return {
        slotId,
        slotLabel,
        slotType,
        slotIndex,
        paramKey: assignment.paramKey || '',
        required: Boolean(assignment.required),
        media: sanitized
      };
    })
    .filter(Boolean);
  const primaryAssignments = normalizeAssignmentSlotLabels(primaryAssignmentsRaw);
  const fallbackAssignmentsRaw = (!primaryAssignments.length && rawJobMedia.length)
    ? rawJobMedia.map((entry, idx) => {
        const sanitized = sanitizeMediaEntryForPayload(entry, entry.filterType || entry.type || '');
        if (!sanitized) return null;
        const slotType = normalizeMediaGroupType(entry.slotType || entry.filterType || entry.type || sanitized.filterType || '');
        const slotIndex = Number.isFinite(entry.slotIndex) ? entry.slotIndex : idx;
        const slotId = entry.slotId || `${slotType}:${slotIndex}`;
        const slotLabel = normalizeSlotLabel(entry.slotLabel, {
          type: slotType,
          key: entry.paramKey || '',
          index: slotIndex
        });
        return {
          slotId,
          slotLabel,
          slotType,
          slotIndex,
          paramKey: entry.paramKey || '',
          required: Boolean(entry.required),
          media: sanitized
        };
      }).filter(Boolean)
    : [];
  const fallbackAssignments = normalizeAssignmentSlotLabels(fallbackAssignmentsRaw);
  const inputMedia = primaryAssignments.length ? primaryAssignments : fallbackAssignments;
  const parameterEntries = Object.entries(engineInputSnapshot)
    .filter(([key]) => key && !String(key).startsWith('__'))
    .map(([key, value]) => {
      const formatted = formatParameterValue(value);
      if (!formatted) return null;
      return { key, value: formatted };
    })
    .filter(Boolean);
  const snapshotInputMedia = () => inputMedia.map((assignment) => ({
    ...assignment,
    media: { ...assignment.media }
  }));
  const snapshotParameters = () => parameterEntries.map((entry) => ({ ...entry }));
  const templateSnapshot = createTemplateContextSnapshot(state.currentRunTemplateContext || state.activeTemplateContext);
  const records = [];

  if (engineOutput.success && savedFiles.length) {
    savedFiles.forEach((saved, index) => {
      const savedIndex = Number.isFinite(saved?.index) ? Number(saved.index) : index;
      const savedTotal = Number.isFinite(saved?.total) ? Number(saved.total) : savedFiles.length;
      const mediaUrl = saved ? buildImageUrl(saved) : '';
      const mediaType = mediaUrl
        ? resolveMediaEntryType({
            filterType: saved?.filterType || saved?.mediaType || typeToken,
            type: typeToken || '',
            url: mediaUrl,
            path: saved?.fileName || saved?.filename || ''
          })
        : resolveMediaEntryType({ filterType: typeToken || '', type: typeToken || '' });
      const record = {
        label: metaInfo.label || result.label || engineId,
        engineId,
        status: result.status || 'COMPLETED',
        requestId: result.requestId || '',
        durationMs: result.durationMs || 0,
        imageUrl: mediaUrl,
        logFile: result.logFile || '',
        logs,
        statusHistory,
        fileName: saved?.fileName || saved?.filename || '',
        category,
        sourceCategory,
        type: typeToken || '',
        typePrefixes: sourceCategory ? [sourceCategory] : [],
        savedFile: saved || null,
        savedFileIndex: savedIndex,
        savedFilesCount: savedTotal,
        displayOrder: resolveEngineDisplayOrder(engineId, category),
        filePrefix: result.filePrefix || saved?.prefix || '',
        timestamp: result.completedAt || result.timestamp || saved?.timestamp || '',
        error: '',
        filterType: mediaType,
        inputMedia: snapshotInputMedia(),
        inputParameters: snapshotParameters(),
        templateContext: templateSnapshot ? cloneTemplateContext(templateSnapshot) : null
      };

      if (soraMeta) {
        record.sora = { ...soraMeta };
        const videoId = soraMeta.videoId || record.requestId;
        if (videoId) {
          record.videoId = videoId;
          if (record.savedFile && !record.savedFile.videoId) {
            record.savedFile.videoId = videoId;
          }
        }
      }

      records.push(record);
    });
  } else {
    const fallbackType = resolveMediaEntryType({ filterType: typeToken || '', type: typeToken || '' });
    const record = {
      label: metaInfo.label || result.label || engineId,
      engineId,
      status: engineOutput.success ? (result.status || 'NO_RESULT') : 'ERROR',
      requestId: result.requestId || '',
      durationMs: result.durationMs || 0,
      imageUrl: '',
      logFile: result.logFile || '',
      logs,
      statusHistory,
      fileName: '',
      category,
      sourceCategory,
      type: typeToken || '',
      typePrefixes: sourceCategory ? [sourceCategory] : [],
      savedFile: null,
      savedFileIndex: 0,
      savedFilesCount: savedFiles.length,
      displayOrder: resolveEngineDisplayOrder(engineId, category),
      filePrefix: result.filePrefix || '',
      timestamp: result.completedAt || result.timestamp || '',
      error: engineOutput.success
        ? '生成結果を取得できませんでした'
        : (engineOutput.error || '不明なエラーが発生しました'),
      filterType: fallbackType,
      inputMedia: snapshotInputMedia(),
      inputParameters: snapshotParameters(),
      templateContext: templateSnapshot ? cloneTemplateContext(templateSnapshot) : null
    };

    if (soraMeta) {
      record.sora = { ...soraMeta };
      const videoId = soraMeta.videoId || record.requestId;
      if (videoId) {
        record.videoId = videoId;
      }
    }

    records.push(record);
  }

  return { category, records };
}

function integrateEngineOutput(job, engine) {
  if (!engine || !engine.output) return false;
  const converted = convertEngineOutput(engine.output, job, engine);
  if (!converted) return false;
  const { category, records } = converted;
  if (!records.length) return false;
  const isSuccess = engine?.output?.success === true;
  const hasPreview = records.some((record) => Boolean(record.imageUrl));
  if (isSuccess && !hasPreview) {
    return false;
  }
  const bucket = ensureCurrentRunCategory(category);
  bucket.push(...records);
  state.resultsByCategory[category] = bucket.map((item) => ({ ...item }));
  state.activeCategory = category;
  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) {
    renderResults(resultsContainer);
  }
  const entry = ensureHistoryEntryForCurrentRun({
    prompt: job?.prompt || state.prompt,
    category,
    jobId: job?.id || ''
  });
  syncHistoryEntryFromCurrentResults(entry, {
    prompt: job?.prompt || state.prompt,
    category
  });
  saveHistoryToStorage();
  renderHistory();

  if (engine && (engine.id === SORA_ENGINE_ID || engine.serverId === SORA_ENGINE_ID)) {
    const handleMediaReloadState = () => {
      renderSelectionSummary();
      renderCategories();
    };
    loadMediaLibrary({ force: true, fetchJson, onStateChange: handleMediaReloadState })
      .catch((err) => console.warn('[Showcase] Sora media reload failed', err));
  }

  return true;
}

function finalizeCurrentJob(job) {
  if (!job || !job.id) return;
  stopJobPolling(job.id);
  state.jobs.set(job.id, job);
  const statusLabel = document.getElementById('kc-results-status');
  if (statusLabel) {
    statusLabel.textContent = translateJobStatus(job.status);
  }

  const aggregated = flattenCurrentRunResults();
  if (aggregated.length) {
    const categories = Array.from(state.currentRunResults.keys());
    const primaryCategory = categories[0] || aggregated[0]?.category || DEFAULT_ACTIVE_CATEGORY;
    const entry = ensureHistoryEntryForCurrentRun({
      prompt: job.prompt || state.prompt,
      category: primaryCategory,
      jobId: job.id
    });
    syncHistoryEntryFromCurrentResults(entry, {
      prompt: job.prompt || state.prompt,
      category: primaryCategory
    });
    state.activeCategory = primaryCategory;
    state.historyActiveId = entry.id;
    renderHistory();
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) {
      renderResults(resultsContainer);
    }
    saveHistoryToStorage();
  }

  state.currentRunResults = new Map();
  state.completedEngineKeys = new Set();
  state.currentHistoryEntryId = '';
  state.currentRunTemplateContext = null;
  if (state.currentJobId === job.id) {
    state.currentJobId = '';
  }
  state.activeJobSnapshot = null;
  state.currentJobEngines = [];
  state.engineDisplayOrder = new Map();
  state.isRunning = false;
  setReloadBlock(false, { release: false });
  renderCategories();
  updateRunButtonState();
}

function handleJobUpdate(job) {
  if (!job || !job.id) return;
  const previousJob = state.activeJobSnapshot && state.activeJobSnapshot.id === job.id
    ? state.activeJobSnapshot
    : null;
  const previousStatusMap = new Map();
  if (previousJob && Array.isArray(previousJob.engines)) {
    previousJob.engines.forEach((engine) => {
      if (engine && engine.id) {
        previousStatusMap.set(engine.id, engine.status || '');
      }
    });
  }
  const previousJobStatus = previousJob ? previousJob.status : '';
  state.jobs.set(job.id, job);
  state.activeJobSnapshot = job;
  const engines = Array.isArray(job.engines) ? job.engines : [];
  let shouldRerender = !previousJob;
  state.currentJobEngines = engines.map((engine) => {
    const currentStatus = engine?.status || 'pending';
    if (engine && engine.id) {
      const previousStatus = previousStatusMap.get(engine.id) || '';
      if (previousStatus !== currentStatus) {
        shouldRerender = true;
      }
    }
    return {
      id: engine?.id,
      label: engine?.label || '',
      displayLabel: engine?.displayLabel || engine?.label || '',
      category: engine?.category || DEFAULT_ACTIVE_CATEGORY,
      status: currentStatus
    };
  });
  if (!(state.engineDisplayOrder instanceof Map)) {
    state.engineDisplayOrder = new Map();
  }
  engines.forEach((engine, idx) => {
    if (!engine || !engine.id) return;
    if (!state.engineDisplayOrder.has(engine.id)) {
      state.engineDisplayOrder.set(engine.id, {
        order: idx,
        category: normalizeCategory(engine.category || DEFAULT_ACTIVE_CATEGORY)
      });
    }
  });
  const statusLabel = document.getElementById('kc-results-status');
  if (statusLabel) {
    statusLabel.textContent = translateJobStatus(job.status);
  }
  engines.forEach((engine) => {
    const key = `${job.id}:${engine.id}`;
    if (engine.output && !state.completedEngineKeys.has(key) && (engine.status === 'completed' || engine.status === 'failed' || engine.status === 'cancelled')) {
      const integrated = integrateEngineOutput(job, engine);
      if (integrated) {
        state.completedEngineKeys.add(key);
        shouldRerender = true;
      }
    }
  });
  if (previousJobStatus !== job.status) {
    shouldRerender = true;
  }
  const resultsContainer = document.getElementById('kc-results');
  if (shouldRerender && resultsContainer) {
    renderResults(resultsContainer);
  }
  if (isJobTerminal(job.status)) {
    finalizeCurrentJob(job);
  }
}

function detectMediaFilterType(file) {
  if (!file) return 'other';
  const tags = deriveMediaFilterTags(file);
  if (!tags.length) return 'other';
  return selectPrimaryMediaFilter(tags);
}

function getTypeFilterOptions(category) {
  const normalized = (category || '').toLowerCase();
  const options = [{ id: 'all', label: 'ALL' }];
  const list = knownTypesForCategory(normalized);
  list.forEach((item) => {
    const label = item.toUpperCase();
    options.push({ id: item, label });
  });
  if (normalized === 'all') {
    options.push({ id: 'other', label: 'OTHER' });
  }
  return options;
}

function templateMatchesCategory(template, activeCategory) {
  if (!template) return false;
  const category = normalizeCategory(activeCategory || DEFAULT_ACTIVE_CATEGORY);
  if (category === ALL_CATEGORY_ID) {
    return true;
  }

  const raw = (template.category || '').trim();
  const normalizedTemplateCategory = raw.toLowerCase();
  const isOtherCategory = category === 'other';

  const allowedTypes = new Set(knownTypesForCategory(category));
  const normalizedTemplateType = normalizeTypeToken(template.type);
  if (normalizedTemplateType) {
    if (allowedTypes.has(normalizedTemplateType)) {
      return true;
    }
  }

  if (isOtherCategory) {
    if (!normalizedTemplateCategory) {
      return false;
    }
    if (normalizedTemplateCategory === 'all') {
      return false;
    }
    if (normalizedTemplateCategory === 'other') {
      return true;
    }

    const normalizedTokenForOther = normalizeTypeToken(normalizedTemplateCategory);
    if (normalizedTokenForOther && knownTypesForCategory('other').includes(normalizedTokenForOther)) {
      return true;
    }

    const inferredOther = normalizeCategory(normalizedTemplateCategory);
    return inferredOther === 'other';
  }

  if (!raw) {
    return true;
  }

  if (normalizedTemplateCategory === 'all') {
    return true;
  }

  if (normalizedTemplateCategory === category) {
    return true;
  }

  const normalizedCategoryFromTemplate = normalizeCategory(normalizedTemplateCategory);
  if (normalizedCategoryFromTemplate === category) {
    return true;
  }

  if (!allowedTypes.size) {
    return normalizedTemplateCategory === category;
  }

  const normalizedToken = normalizeTypeToken(normalizedTemplateCategory);
  if (normalizedToken && allowedTypes.has(normalizedToken)) {
    return true;
  }

  if (allowedTypes.has(normalizedTemplateCategory)) {
    return true;
  }

  return false;
}

function categorizeServerMeta(meta) {
  if (!meta) return 'other';
  if (meta.id && CATEGORY_OVERRIDES[meta.id]) {
    const override = CATEGORY_OVERRIDES[meta.id];
    if (CATEGORY_DEFINITION_MAP.has(override)) {
      return override;
    }
  }
  const source = (meta.category || '').toLowerCase();
  if (PREFIX_TO_CATEGORY.has(source)) {
    return PREFIX_TO_CATEGORY.get(source);
  }
  const inferred = extractEnginePrefix(meta.id || meta.label || '');
  if (PREFIX_TO_CATEGORY.has(inferred)) {
    return PREFIX_TO_CATEGORY.get(inferred);
  }
  return 'other';
}

function ensureCategoryCollections(category) {
  const cat = normalizeCategory(category);
  if (!Object.prototype.hasOwnProperty.call(state.categoryTabs, cat)) {
    state.categoryTabs[cat] = 'engine';
  }
  if (!Object.prototype.hasOwnProperty.call(state.resultsByCategory, cat)) {
    state.resultsByCategory[cat] = [];
  }
}

function schemaTypes(schema) {
  if (!schema || schema.type === undefined || schema.type === null) return [];
  return Array.isArray(schema.type) ? schema.type : [schema.type];
}

function normalizeOptionValue(schema, raw) {
  if (!schema) return raw;
  const types = schemaTypes(schema);
  if (!types.length) return raw;

  if (types.includes('object') || types.includes('array')) {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return JSON.parse(trimmed);
        } catch (err) {
          return raw;
        }
      }
    }
    return raw;
  }

  if (types.includes('boolean')) {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      if (/^(true|false)$/i.test(raw.trim())) {
        return raw.trim().toLowerCase() === 'true';
      }
    }
  }

  if (types.includes('integer') || types.includes('number')) {
    if (typeof raw === 'number') {
      return types.includes('integer') ? Math.trunc(raw) : raw;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed) {
        const parsed = Number(trimmed);
        if (!Number.isNaN(parsed)) {
          return types.includes('integer') ? Math.trunc(parsed) : parsed;
        }
      }
    }
    return raw;
  }

  if (typeof raw === 'string') {
    return raw.trim();
  }
  return raw;
}

function coerceParameterValue(schema, raw) {
  if (raw === undefined || raw === null) return raw;
  if (typeof raw !== 'string') return raw;

  const types = schemaTypes(schema);
  const trimmed = raw.trim();

  if (!types.length) {
    return raw;
  }

  if (trimmed === '') {
    if (types.includes('string') && types.length === 1) {
      return '';
    }
    return undefined;
  }

  if (types.includes('integer') || types.includes('number')) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return types.includes('integer') ? Math.trunc(num) : num;
    }
  }

  if (types.includes('boolean')) {
    if (/^(true|false)$/i.test(trimmed)) {
      return trimmed.toLowerCase() === 'true';
    }
  }

  if (types.includes('object') || types.includes('array')) {
    if ((trimmed.startsWith('{') && trimmed.endsWith('}'))
      || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        // fall through to raw return
      }
    }
  }

  return raw;
}

function formatParameterValueForInput(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return '';
    }
  }
  return String(value);
}

function isSameParameterValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object' && a && b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (err) {
      return false;
    }
  }
  return false;
}

function templateMatchesFilters(template, filters) {
  if (!template) return false;
  const effective = (filters && typeof filters === 'object') ? filters : ensureTemplateMenuFilters();
  const category = effective.category;
  if (!templateMatchesCategory(template, category)) {
    return false;
  }
  const typeFilter = effective.type;
  if (typeFilter && typeFilter !== 'all') {
    const templateType = normalizeTypeToken(template.type);
    if (typeFilter === 'other') {
      const templateCategory = normalizeCategory(template.category);
      if (templateCategory !== 'other') {
        return false;
      }
    } else {
      const normalizedType = normalizeTypeToken(typeFilter);
      if (!normalizedType) {
        return false;
      }
      if (templateType !== normalizedType) {
        return false;
      }
    }
  }
  const query = effective.query;
  if (query && query.trim()) {
    const normalizedQuery = query.trim().toLowerCase();
    const haystackParts = [];
    if (template.name) haystackParts.push(template.name);
    if (template.prompt) haystackParts.push(template.prompt);
    if (template.memo) haystackParts.push(template.memo);
    if (template.soundText) haystackParts.push(template.soundText);
    if (template.filePrefix) haystackParts.push(template.filePrefix);
    if (template.id) haystackParts.push(template.id);
    if (template.description) haystackParts.push(template.description);
    if (Array.isArray(template.tags) && template.tags.length) {
      haystackParts.push(template.tags.join(' '));
    }
    const haystack = haystackParts.join(' ').toLowerCase();
    if (!haystack.includes(normalizedQuery)) {
      return false;
    }
  }
  return true;
}

const ENUM_RANGE_EXPANSION_LIMIT = 200;
const ENUM_OPTION_LIMIT = 100;

function extractEnumOptions(schema, parameterName = '') {
  if (!schema) return [];

  const options = [];
  const seen = new Set();
  const types = schemaTypes(schema);

  // URL パラメータは description からのオプション抽出をスキップ
  const isUrlParameter = parameterName.endsWith('_url') || parameterName.endsWith('_uri');

  const pushOption = (rawValue, label) => {
    if (options.length >= ENUM_OPTION_LIMIT) return;
    const value = normalizeOptionValue(schema, rawValue);
    if (value === undefined || value === null) return;
    const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value, label: label || formatParameterValueForInput(value) });
  };

  if (Array.isArray(schema.enum) && schema.enum.length) {
    schema.enum.forEach((value, index) => {
      const label = (schema.enumTitles && schema.enumTitles[index])
        || (schema.enumNames && schema.enumNames[index])
        || formatParameterValueForInput(value);
      pushOption(value, label);
    });
  }

  const variants = Array.isArray(schema.oneOf) && schema.oneOf.length
    ? schema.oneOf
    : (Array.isArray(schema.anyOf) ? schema.anyOf : null);
  if (variants) {
    variants.forEach((variant) => {
      if (!variant) return;
      if (Object.prototype.hasOwnProperty.call(variant, 'const')) {
        pushOption(variant.const, variant.title || variant.description);
        return;
      }
      if (Array.isArray(variant.enum) && variant.enum.length) {
        pushOption(variant.enum[0], variant.title || variant.description);
      }
    });
  }

  if (Array.isArray(schema.examples)) {
    schema.examples.forEach((example) => {
      pushOption(example);
    });
  }

  // image_size のような、文字列プリセットまたはオブジェクトを許容するパラメータは
  // descriptionからプリセットを抽出する必要がある
  // 例: "square_hd, square, portrait_4_3" などの文字列プリセットがdescriptionに含まれる
  const hasStringPresetInDescription = schema.description && /\b[a-z_]+\s*,\s*[a-z_]+/i.test(schema.description);
  const allowDescriptionExtraction = !isUrlParameter
    && (types.length === 0
      || hasStringPresetInDescription
      || (!types.includes('number') && !types.includes('integer') && !types.includes('array') && !types.includes('object')));

  if (allowDescriptionExtraction) {
    const addOptionsFromText = (text) => {
      if (!text) return;
      let normalized = text.replace(/(?:default|defaults?)\s*(?:[:：]|=)\s*[^,、。．]+/gi, '');
      normalized = normalized.replace(/(?:default|defaults?)\s+(?:is|are)\s+[^,、。．]+/gi, '');
      normalized = normalized.replace(/\bor\b/gi, ',');
      normalized = normalized.replace(/\band\b/gi, ',');
      normalized = normalized.replace(/[\/]/g, ',');
      normalized.split(/[,、]/).map((item) => item.trim()).forEach((rawToken) => {
        if (!rawToken) return;
        if (/^default[:：]/i.test(rawToken)) return;
        if (rawToken.includes('{') || rawToken.includes('}')) return;
        let token = rawToken.replace(/^(?:about|around|approximately)\s+/i, '');
        token = token.replace(/\bseconds?\b/gi, 's');
        token = token.replace(/\bsecs?\b/gi, 's');
        token = token.replace(/\bminutes?\b/gi, 'm');
        token = token.replace(/\bmins?\b/gi, 'm');
        token = token.replace(/\bhours?\b/gi, 'h');
        token = token.replace(/\bframes?\b/gi, 'f');
        token = token.replace(/\s*-\s*/g, '-');
        token = token.replace(/\s+/g, ' ').trim();
        if (/^-?\d+\.$/.test(token)) {
          token = token.slice(0, -1);
        }
        token = token.replace(/[。．。、，,;；:：]+$/g, '');
        const unitMatch = token.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]{1,4})$/);
        if (unitMatch) {
          token = `${unitMatch[1]}${unitMatch[2].toLowerCase()}`;
        }
        if (/\s/.test(token) && !token.includes('_')) return;
        if (/^\+\$/i.test(token)) return;
        const rangeMatch = token.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
        if (rangeMatch) {
          const start = Number(rangeMatch[1]);
          const end = Number(rangeMatch[2]);
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            const rangeSize = Math.floor(Math.abs(end - start)) + 1;
            if (rangeSize <= ENUM_RANGE_EXPANSION_LIMIT) {
              const step = start <= end ? 1 : -1;
              for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
                pushOption(value);
              }
            }
          }
          return;
        }
        pushOption(token);
      });
    };

    const descriptions = collectSchemaDescriptions(schema);
    const optionRegexes = [
      /options?\s*[:：]\s*([^。．\n]+)/gi,
      /options?\s+(?:include|are|available)\s+([^。．\n]+)/gi
    ];

    descriptions.forEach((description) => {
      if (typeof description !== 'string' || !description) return;
      const parenRegex = /\(([^)]+)\)/g;
      let parenMatch;
      while ((parenMatch = parenRegex.exec(description)) !== null) {
        addOptionsFromText(parenMatch[1]);
      }

      optionRegexes.forEach((regex) => {
        regex.lastIndex = 0;
        let optionMatch;
        while ((optionMatch = regex.exec(description)) !== null) {
          addOptionsFromText(optionMatch[1]);
        }
      });
    });
  }

  return options;
}

function createEnumOptionKey(value) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function mergeManualParameterOptions(existing, manual, schema) {
  const base = Array.isArray(existing) ? existing.slice() : [];
  if (!Array.isArray(manual) || !manual.length) {
    return base;
  }
  const seen = new Set(base.map((option) => createEnumOptionKey(option.value)));
  manual.forEach((candidate) => {
    if (!candidate) return;
    const rawValue = Object.prototype.hasOwnProperty.call(candidate, 'value')
      ? candidate.value
      : candidate;
    const normalizedValue = normalizeOptionValue(schema, rawValue);
    const key = createEnumOptionKey(normalizedValue);
    if (seen.has(key)) return;
    const label = candidate && typeof candidate === 'object' && candidate.label
      ? candidate.label
      : formatParameterValueForInput(normalizedValue);
    base.push({ value: normalizedValue, label });
    seen.add(key);
  });
  return base;
}

function getManualParameterOptions(engineMeta, paramKey, schema) {
  if (!engineMeta || !engineMeta.id || !paramKey) {
    return [];
  }
  const hints = ENGINE_PARAMETER_OPTION_HINTS[engineMeta.id];
  if (!hints) return [];
  const raw = hints[paramKey];
  if (!raw) return [];
  let items = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.options)) {
      items = raw.options;
    } else if (Object.prototype.hasOwnProperty.call(raw, 'value')) {
      items = [raw];
    } else {
      items = [];
    }
  } else if (raw || raw === 0) {
    items = [raw];
  }
  if (!items.length) return [];
  return mergeManualParameterOptions([], items, schema);
}

function getManualParameterDefault(engineMeta, paramKey, schema) {
  if (!engineMeta || !engineMeta.id || !paramKey) {
    return undefined;
  }
  const hints = ENGINE_PARAMETER_OPTION_HINTS[engineMeta.id];
  if (!hints) return undefined;
  const raw = hints[paramKey];
  if (!raw || typeof raw !== 'object') return undefined;
  if (!Object.prototype.hasOwnProperty.call(raw, 'default')) return undefined;
  return normalizeOptionValue(schema, raw.default);
}

function sanitizeDefaultToken(token) {
  if (typeof token !== 'string') return '';
  return token
    .trim()
    .replace(/^["'`]/, '')
    .replace(/["'`]+$/, '')
    .replace(/[。．。、，,;；:：.!?]+$/g, '')
    .trim();
}

function extractDefaultTokensFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const normalized = text.replace(/[\u3000\u00A0]/g, ' ');
  const patterns = [
    /defaults?\s*(?:to|is|are|at)\s*([^.,;。．，、]+)/gi,
    /default(?:\s+value)?\s*(?:=|:)?\s*([^.,;。．，、]+)/gi,
    /デフォルト[：:]?\s*([^。,．，、]+)/gi
  ];
  const tokens = [];
  patterns.forEach((regex) => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      const candidate = sanitizeDefaultToken(match[1]);
      if (candidate) {
        tokens.push(candidate);
      }
    }
  });
  return tokens;
}

function deriveDefaultFromDescriptions(schema, options) {
  const descriptions = collectSchemaDescriptions(schema);
  if (!descriptions.length) return undefined;
  for (const description of descriptions) {
    const tokens = extractDefaultTokensFromText(description);
    if (!tokens.length) continue;
    for (const token of tokens) {
      const normalized = normalizeOptionValue(schema, token);
      if (normalized === undefined || normalized === null || normalized === '') continue;
      if (Array.isArray(options) && options.length) {
        let matched = options.find((option) => isSameParameterValue(option.value, normalized));
        if (!matched && typeof normalized === 'string') {
          const lower = normalized.toLowerCase();
          matched = options.find((option) => typeof option.value === 'string' && option.value.toLowerCase() === lower);
        }
        if (matched) {
          return cloneParameterDefault(matched.value);
        }
      } else {
        return cloneParameterDefault(normalized);
      }
    }
  }
  return undefined;
}

function deriveParameterDefault(engineMeta, paramKey, schema, options) {
  const schemaDefault = getSchemaDefaultValue(schema);
  if (schemaDefault !== undefined) {
    return cloneParameterDefault(schemaDefault);
  }

  const manualDefault = getManualParameterDefault(engineMeta, paramKey, schema);
  if (manualDefault !== undefined) {
    return cloneParameterDefault(manualDefault);
  }

  const types = schemaTypes(schema);
  if (types.includes('boolean')) {
    return undefined;
  }

  if (Array.isArray(options) && options.length) {
    const descriptionDefault = deriveDefaultFromDescriptions(schema, options);
    if (descriptionDefault !== undefined) {
      return descriptionDefault;
    }
    if (options.length === 1) {
      return cloneParameterDefault(options[0].value);
    }
  }

  return undefined;
}

function containsCjkCharacters(text) {
  if (!text) return false;
  return /[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
}

function normalizeDescriptionCandidate(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

function collectSchemaDescriptions(schema) {
  if (!schema || typeof schema !== 'object') return [];
  const results = [];
  const push = (value) => {
    const text = normalizeDescriptionCandidate(value);
    if (!text) return;
    if (results.includes(text)) return;
    results.push(text);
  };

  const englishCandidates = [
    schema.descriptionEn,
    schema.descriptionEN,
    schema.description_en,
    schema.description_en_us,
    schema.description_en_US,
    schema.descriptionEnglish,
    schema['description:en'],
    schema['description:en-us'],
    schema['description:en_US'],
    schema.markdownDescription,
    schema.markdown_description,
    schema.longDescription,
    schema.long_description,
    schema.originalDescription,
    schema.original_description,
    schema['x-original-description'],
    schema.xOriginalDescription,
    schema.descriptionDefault,
    schema.description_default,
    schema.defaultDescription,
    schema.default_description
  ];

  englishCandidates.forEach(push);

  const nestedSources = [
    schema.descriptions,
    schema.i18n,
    schema.localization,
    schema.localizedDescriptions,
    schema.metadata && schema.metadata.description,
    schema.meta && schema.meta.description
  ];
  nestedSources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    const keys = ['en', 'en-us', 'en_US', 'en-GB', 'en-gb'];
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        push(source[key]);
      }
    });
  });

  push(schema.description);
  push(schema.title);
  push(schema.summary);
  push(schema.help);
  push(schema.note);

  return results;
}

function extractAsciiSegment(text) {
  if (typeof text !== 'string') return '';
  const ascii = text
    .replace(/[\u3000\u00A0]/g, ' ')
    .replace(/[^\x20-\x7E]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!ascii) return '';
  return /[A-Za-z0-9]/.test(ascii) ? ascii : '';
}

function resolveParameterDescription(schema) {
  if (!schema) return '';
  const descriptions = collectSchemaDescriptions(schema);
  if (!descriptions.length) return '';

  const englishPreferred = descriptions.find((text) => text && !containsCjkCharacters(text) && /[A-Za-z]/.test(text));
  if (englishPreferred) return englishPreferred;

  const nonCjk = descriptions.find((text) => text && !containsCjkCharacters(text));
  if (nonCjk) return nonCjk;

  for (const text of descriptions) {
    const ascii = extractAsciiSegment(text);
    if (ascii) {
      return ascii;
    }
  }

  return descriptions[0] || '';
}

function adjustPromptFieldHeight(field, { force = false } = {}) {
  if (!field) return;
  const manual = field.dataset.manualResize === 'true';
  if (manual && !force) return;
  const min = Number(field.dataset.minHeight) || PROMPT_MIN_HEIGHT;
  const max = Number(field.dataset.maxHeight) || PROMPT_MAX_HEIGHT;
  field.dataset.autoResizing = 'true';
  field.style.height = 'auto';
  const next = Math.min(Math.max(field.scrollHeight, min), max);
  field.style.height = `${next}px`;
  field.dataset.lastObservedHeight = String(next);
  window.setTimeout(() => {
    if (field.dataset.autoResizing === 'true') {
      delete field.dataset.autoResizing;
    }
  }, 0);
  if (force) {
    delete field.dataset.manualResize;
  }
}

function syncPromptPreview() {
  const promptField = document.getElementById('kc-prompt');
  if (!promptField) return;
  const value = state.prompt || '';
  if (promptField.value !== value) {
    promptField.value = value;
  }
  promptField.placeholder = PROMPT_PLACEHOLDER;
  if (promptField.hasAttribute('readonly')) {
    promptField.removeAttribute('readonly');
  }
  promptField.readOnly = false;
  promptField.disabled = false;
  adjustPromptFieldHeight(promptField);
  updatePromptGeneratorControls();
}

function syncTemplatePreviewUi() {
  const preview = document.getElementById('kc-template-preview');
  const nameEl = document.getElementById('kc-template-preview-name');
  const memoEl = document.getElementById('kc-template-preview-memo');
  const resetBtn = document.getElementById('kc-template-reset');
  if (!preview || !nameEl || !memoEl || !resetBtn) return;

  const context = state.activeTemplateContext;
  const hasOverrides = Boolean(context?.overrides?.prompt
    || context?.overrides?.filePrefix
    || context?.overrides?.soundText);

  if (context) {
    preview.hidden = false;
    preview.classList.toggle('is-overridden', hasOverrides);
    nameEl.textContent = context.name || '';
    nameEl.hidden = !context.name;
    if (context.memo) {
      memoEl.textContent = context.memo;
      memoEl.hidden = false;
    } else {
      memoEl.textContent = '';
      memoEl.hidden = true;
    }
    resetBtn.disabled = false;
    resetBtn.removeAttribute('aria-disabled');
  } else {
    preview.hidden = true;
    preview.classList.remove('is-overridden');
    nameEl.textContent = '';
    memoEl.textContent = '';
    resetBtn.disabled = true;
    resetBtn.setAttribute('aria-disabled', 'true');
  }
}

function getSelectedSoundEngines() {
  const list = [];
  if (!(state.selected instanceof Map)) return list;
  state.selected.forEach((entry, id) => {
    const fallback = entry && typeof entry === 'object' ? entry : {};
    const meta = getEngineMeta(id) || { ...fallback, id };
    const category = normalizeCategory(meta?.category || fallback?.category || '');
    if (category === 'sound') {
      list.push({ id, meta, entry: fallback });
    }
  });
  return list;
}

function applySoundTextToInputs(text, { selectedEngines = null } = {}) {
  const targets = Array.isArray(selectedEngines) ? selectedEngines : getSelectedSoundEngines();
  const normalizedText = typeof text === 'string' ? text : '';
  targets.forEach(({ id, meta }) => {
    const engineMeta = meta && meta.id ? meta : { id };
    const store = ensureEngineInputs(engineMeta);
    if (store) {
      const keys = getSoundTextParamKeys(engineMeta);
      const appliedKeys = new Set();
      keys.forEach((key) => {
        appliedKeys.add(key);
        store[key] = normalizedText;
      });
      if (!appliedKeys.size && normalizedText) {
        store.text = normalizedText;
      }
    }
  });
}

function syncSoundTextField({ preferExisting = true } = {}) {
  const wrapper = document.getElementById('kc-sound-text-field');
  const input = document.getElementById('kc-sound-text');
  if (!wrapper || !input) return;

  const soundEngines = getSelectedSoundEngines();
  const shouldShow = soundEngines.length > 0;
  const wasHidden = wrapper.hidden;
  wrapper.hidden = !shouldShow;
  wrapper.classList.toggle('is-visible', shouldShow);

  if (!shouldShow) {
    if (!wasHidden) {
      updateRunButtonState();
    }
    delete input.dataset.manualResize;
    input.style.height = '';
    return;
  }

  let nextValue = state.soundText || '';
  if (preferExisting && (!nextValue || !nextValue.trim())) {
    for (const { meta } of soundEngines) {
      const store = ensureEngineInputs(meta);
      if (!store) continue;
      const keys = getSoundTextParamKeys(meta);
      for (const key of keys) {
        const candidate = typeof store[key] === 'string' ? store[key] : '';
        if (candidate && candidate.trim()) {
          nextValue = candidate;
          break;
        }
      }
      if (nextValue && nextValue.trim()) {
        break;
      }
    }
  }

  if (state.soundText !== nextValue) {
    state.soundText = nextValue;
    updateActiveTemplateOverrides();
  }

  input.placeholder = SOUND_TEXT_PLACEHOLDER;
  if (input.value !== state.soundText) {
    input.value = state.soundText;
  }

  applySoundTextToInputs(state.soundText, { selectedEngines: soundEngines });
  attachPromptResizeHandlers(input);
  adjustPromptFieldHeight(input);
  updateRunButtonState();
}

function normalizePromptGeneratorMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  const match = PROMPT_GENERATOR_MODES.find((def) => def.id === normalized);
  return match ? match.id : PROMPT_GENERATOR_DEFAULT_MODE;
}

function updatePromptGeneratorModeButtons() {
  const container = document.getElementById('kc-prompt-generator');
  if (!container) return;
  const buttons = container.querySelectorAll('[data-role="prompt-generator-mode"]');
  const activeMode = normalizePromptGeneratorMode(state.promptGenerator?.mode);
  buttons.forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const buttonMode = normalizePromptGeneratorMode(btn.dataset.mode);
    const isActive = buttonMode === activeMode;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updatePromptGeneratorStatus() {
  const statusEl = document.getElementById('kc-prompt-generator-status');
  if (!statusEl) return;
  const generatorState = state.promptGenerator || {};
  const { loading, error, message } = generatorState;
  statusEl.classList.remove('is-error', 'is-success');
  if (loading) {
    statusEl.hidden = false;
    statusEl.textContent = 'Geminiがプロンプトを生成しています…';
    return;
  }
  if (error) {
    statusEl.hidden = false;
    statusEl.classList.add('is-error');
    statusEl.textContent = error;
    return;
  }
  if (message) {
    statusEl.hidden = false;
    statusEl.classList.add('is-success');
    statusEl.textContent = message;
    return;
  }
  statusEl.textContent = '';
  statusEl.hidden = true;
}

function ensurePromptGeneratorState() {
  if (!state.promptGenerator || typeof state.promptGenerator !== 'object') {
    state.promptGenerator = {
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
      selectedCategory: DEFAULT_ACTIVE_CATEGORY,
      selectedType: PROMPT_GENERATOR_DEFAULT_TYPE,
      guidanceByType: {},
      activeGuidance: '',
      categoryDirty: false,
      typeDirty: false,
      guidanceDirty: false,
      guidanceTranslationsByType: {},
      activeGuidanceTranslation: '',
      guidanceTranslationDirty: false,
      lastSelectionToken: '',
      lyricsEnabled: PROMPT_GENERATOR_LYRICS_DEFAULTS.enabled,
      lyricsStructure: PROMPT_GENERATOR_LYRICS_DEFAULTS.structure,
      lyricsCharTarget: PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget,
      lyricsLanguage: PROMPT_GENERATOR_LYRICS_DEFAULTS.language,
      lyricsIncludeSectionLabels: PROMPT_GENERATOR_LYRICS_DEFAULTS.includeSectionLabels,
      lyricsKeywords: PROMPT_GENERATOR_LYRICS_DEFAULTS.keywords,
      soundTextEnabled: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.enabled,
      soundTextCharTarget: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget,
      soundTextLanguage: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.language,
      soundTextKeywords: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.keywords,
      soundTextNotes: PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.notes
    };
  }
  if (!state.promptGenerator.guidanceByType || typeof state.promptGenerator.guidanceByType !== 'object') {
    state.promptGenerator.guidanceByType = {};
  }
  if (!state.promptGenerator.guidanceTranslationsByType || typeof state.promptGenerator.guidanceTranslationsByType !== 'object') {
    state.promptGenerator.guidanceTranslationsByType = {};
  }
  if (typeof state.promptGenerator.lyricsEnabled !== 'boolean') {
    state.promptGenerator.lyricsEnabled = PROMPT_GENERATOR_LYRICS_DEFAULTS.enabled;
  }
  if (typeof state.promptGenerator.lyricsStructure !== 'string') {
    state.promptGenerator.lyricsStructure = PROMPT_GENERATOR_LYRICS_DEFAULTS.structure;
  } else {
    state.promptGenerator.lyricsStructure = normalizeLyricsStructure(state.promptGenerator.lyricsStructure);
  }
  if (!Number.isFinite(Number(state.promptGenerator.lyricsCharTarget))) {
    state.promptGenerator.lyricsCharTarget = PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
  } else {
    const clamped = clampLyricsCharTarget(state.promptGenerator.lyricsCharTarget);
    state.promptGenerator.lyricsCharTarget = Number.isFinite(clamped)
      ? clamped
      : PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
  }
  if (!state.promptGenerator.lyricsLanguage) {
    state.promptGenerator.lyricsLanguage = PROMPT_GENERATOR_LYRICS_DEFAULTS.language;
  }
  if (typeof state.promptGenerator.lyricsIncludeSectionLabels !== 'boolean') {
    state.promptGenerator.lyricsIncludeSectionLabels = PROMPT_GENERATOR_LYRICS_DEFAULTS.includeSectionLabels;
  }
  if (typeof state.promptGenerator.lyricsKeywords !== 'string') {
    state.promptGenerator.lyricsKeywords = PROMPT_GENERATOR_LYRICS_DEFAULTS.keywords;
  }
  if (typeof state.promptGenerator.soundTextEnabled !== 'boolean') {
    state.promptGenerator.soundTextEnabled = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.enabled;
  }
  if (!Number.isFinite(Number(state.promptGenerator.soundTextCharTarget))) {
    state.promptGenerator.soundTextCharTarget = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
  } else {
    const clampedVoice = clampSoundTextCharTarget(state.promptGenerator.soundTextCharTarget);
    state.promptGenerator.soundTextCharTarget = Number.isFinite(clampedVoice)
      ? clampedVoice
      : PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
  }
  if (!state.promptGenerator.soundTextLanguage) {
    state.promptGenerator.soundTextLanguage = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.language;
  } else {
    state.promptGenerator.soundTextLanguage = normalizeSoundTextLanguage(state.promptGenerator.soundTextLanguage);
  }
  if (typeof state.promptGenerator.soundTextKeywords !== 'string') {
    state.promptGenerator.soundTextKeywords = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.keywords;
  } else {
    state.promptGenerator.soundTextKeywords = sanitizeSoundTextKeywords(state.promptGenerator.soundTextKeywords);
  }
  if (typeof state.promptGenerator.soundTextNotes !== 'string') {
    state.promptGenerator.soundTextNotes = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.notes;
  } else {
    state.promptGenerator.soundTextNotes = sanitizeSoundTextNotes(state.promptGenerator.soundTextNotes);
  }
  return state.promptGenerator;
}

function normalizeLyricsStructure(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const legacy = PROMPT_GENERATOR_LYRICS_LEGACY_MAP[trimmed.toLowerCase()];
  if (legacy) return legacy;
  const sanitized = trimmed
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  return sanitized.slice(0, PROMPT_GENERATOR_LYRICS_STRUCTURE_MAX_LENGTH);
}

function normalizeLyricsLanguage(value) {
  if (typeof value !== 'string') return PROMPT_GENERATOR_LYRICS_DEFAULTS.language;
  const normalized = value.trim().toLowerCase();
  return PROMPT_GENERATOR_LYRICS_LANGUAGE_OPTIONS.includes(normalized)
    ? normalized
    : PROMPT_GENERATOR_LYRICS_DEFAULTS.language;
}

function extractLyricsSections(structureText) {
  if (typeof structureText !== 'string' || !structureText.trim()) return [];
  const tokens = [];
  structureText
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .forEach((line) => {
      if (!line) return;
      line.split(/[,、]+/).forEach((segment) => {
        const raw = segment.trim();
        if (!raw) return;
        const bracketMatch = raw.match(/^\[(.*)]$/);
        const normalized = (bracketMatch ? bracketMatch[1] : raw).trim();
        if (normalized) {
          tokens.push(normalized);
        }
      });
    });
  return tokens.slice(0, PROMPT_GENERATOR_LYRICS_SECTION_LIMIT);
}

function clampLyricsCharTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(
    PROMPT_GENERATOR_LYRICS_CHAR_MIN,
    Math.min(PROMPT_GENERATOR_LYRICS_CHAR_MAX, Math.trunc(numeric))
  );
  return clamped;
}

function sanitizeLyricsKeywordsInput(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.slice(0, PROMPT_GENERATOR_LYRICS_KEYWORDS_MAX_LENGTH);
  return trimmed.replace(/\s+$/g, '');
}

function splitLyricsKeywords(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[\n,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, PROMPT_GENERATOR_LYRICS_KEYWORD_LIMIT);
}

function normalizeSoundTextLanguage(value) {
  if (typeof value !== 'string') return PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.language;
  const normalized = value.trim().toLowerCase();
  return normalized === 'en' ? 'en' : 'ja';
}

function clampSoundTextCharTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(
    PROMPT_GENERATOR_SOUND_TEXT_CHAR_MIN,
    Math.min(PROMPT_GENERATOR_SOUND_TEXT_CHAR_MAX, Math.trunc(numeric))
  );
  return clamped;
}

function sanitizeSoundTextKeywords(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.slice(0, PROMPT_GENERATOR_SOUND_TEXT_KEYWORDS_MAX_LENGTH);
  return trimmed.replace(/\s+$/g, '');
}

function sanitizeSoundTextNotes(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, PROMPT_GENERATOR_SOUND_TEXT_NOTES_MAX_LENGTH).trimStart();
}

function splitSoundTextKeywords(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[\n,;、]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT);
}

function assembleVoiceScriptContext(generatorState) {
  const voiceScript = {
    enabled: Boolean(generatorState?.soundTextEnabled)
  };
  const language = normalizeSoundTextLanguage(generatorState?.soundTextLanguage);
  if (language) {
    voiceScript.language = language;
    generatorState.soundTextLanguage = language;
  }
  const charTarget = clampSoundTextCharTarget(generatorState?.soundTextCharTarget);
  if (Number.isFinite(charTarget)) {
    voiceScript.charTarget = charTarget;
    generatorState.soundTextCharTarget = charTarget;
  }
  if (generatorState?.soundTextKeywords) {
    const rawKeywords = sanitizeSoundTextKeywords(generatorState.soundTextKeywords);
    generatorState.soundTextKeywords = rawKeywords;
    if (rawKeywords) {
      voiceScript.keywordsText = rawKeywords;
    }
    const keywords = splitSoundTextKeywords(rawKeywords);
    if (keywords.length) {
      voiceScript.keywords = keywords;
    }
  }
  if (generatorState?.soundTextNotes) {
    const notes = sanitizeSoundTextNotes(generatorState.soundTextNotes);
    generatorState.soundTextNotes = notes;
    if (notes) {
      voiceScript.notes = notes;
    }
  }
  return voiceScript;
}

function isSoundTextEnabledType(type) {
  const normalized = type === 'other' ? 'other' : normalizeTypeToken(type || '');
  return PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(normalized);
}

function resolvePromptGeneratorCategoryForType(generatorState) {
  if (!generatorState) return DEFAULT_ACTIVE_CATEGORY;
  const selectedCategory = normalizeCategory(generatorState.selectedCategory || '');
  if (selectedCategory === 'sound') {
    return 'sound';
  }
  const inferredCategory = generatorState.selectedType
    ? PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(generatorState.selectedType)
    : '';
  if (inferredCategory) {
    const normalized = normalizeCategory(inferredCategory);
    if (normalized === 'sound') {
      return 'sound';
    }
    return normalized;
  }
  return selectedCategory;
}

function shouldDisplaySoundTextOptions() {
  const generatorState = ensurePromptGeneratorState();
  const effectiveCategory = resolvePromptGeneratorCategoryForType(generatorState);
  if (effectiveCategory !== 'sound') {
    return false;
  }
  const normalizedType = normalizeTypeToken(generatorState.selectedType || '');
  if (normalizedType) {
    return PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(normalizedType);
  }
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return false;
  }
  let show = false;
  state.selected.forEach((entry, id) => {
    if (show) return;
    const meta = state.engineIndex.get(id) || entry || {};
    let typeKey = normalizeTypeToken(determineEngineTypeKey(meta));
    if (!typeKey && entry && entry !== meta) {
      typeKey = normalizeTypeToken(determineEngineTypeKey(entry));
    }
    if (typeKey && PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(typeKey)) {
      show = true;
    }
  });
  return show;
}

function shouldAutoEnableSoundText() {
  if (!shouldDisplaySoundTextOptions()) {
    return false;
  }
  const generatorState = ensurePromptGeneratorState();
  const normalizedType = normalizeTypeToken(generatorState.selectedType || '');
  if (normalizedType && PROMPT_GENERATOR_SOUND_TEXT_AUTO_TYPES.has(normalizedType)) {
    return true;
  }
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return false;
  }
  let required = false;
  state.selected.forEach((entry, id) => {
    if (required) return;
    const meta = state.engineIndex.get(id) || entry || {};
    if (engineRequiresSoundText(meta, entry)) {
      required = true;
    }
  });
  return required;
}

function isLyricsEnabledType(type) {
  const normalized = type === 'other' ? 'other' : normalizeTypeToken(type || '');
  return PROMPT_GENERATOR_LYRICS_ENABLED_TYPES.has(normalized);
}

function shouldDisplayLyricsOptions() {
  const generatorState = ensurePromptGeneratorState();
  const effectiveCategory = resolvePromptGeneratorCategoryForType(generatorState);
  if (effectiveCategory !== 'sound') {
    return false;
  }
  const normalizedType = normalizeTypeToken(generatorState.selectedType || '');
  if (normalizedType) {
    return isLyricsEnabledType(normalizedType);
  }
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return false;
  }
  let show = false;
  state.selected.forEach((entry, id) => {
    if (show) return;
    const meta = state.engineIndex.get(id) || entry || {};
    let typeKey = normalizeTypeToken(determineEngineTypeKey(meta));
    if (!typeKey && entry && entry !== meta) {
      typeKey = normalizeTypeToken(determineEngineTypeKey(entry));
    }
    if (typeKey && isLyricsEnabledType(typeKey)) {
      show = true;
    }
  });
  return show;
}

function setPromptGeneratorLyricsEnabled(enabled) {
  const generatorState = ensurePromptGeneratorState();
  const next = Boolean(enabled);
  if (generatorState.lyricsEnabled === next) return;
  generatorState.lyricsEnabled = next;
  if (!next) {
    generatorState.lyricsCharTarget = PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
    generatorState.lyricsKeywords = PROMPT_GENERATOR_LYRICS_DEFAULTS.keywords;
  }
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsStructure(structure) {
  const generatorState = ensurePromptGeneratorState();
  const normalized = normalizeLyricsStructure(structure);
  generatorState.lyricsStructure = normalized;
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsLanguage(language) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.lyricsLanguage = normalizeLyricsLanguage(language);
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsIncludeSections(include) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.lyricsIncludeSectionLabels = Boolean(include);
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsCharTarget(value) {
  const generatorState = ensurePromptGeneratorState();
  const clamped = clampLyricsCharTarget(value);
  generatorState.lyricsCharTarget = Number.isFinite(clamped)
    ? clamped
    : PROMPT_GENERATOR_LYRICS_DEFAULTS.charTarget;
  syncPromptGeneratorLyricsControls();
}

function setPromptGeneratorLyricsKeywords(value) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.lyricsKeywords = sanitizeLyricsKeywordsInput(value);
  syncPromptGeneratorLyricsControls();
}

function syncPromptGeneratorLyricsControls() {
  const generatorState = ensurePromptGeneratorState();
  const container = document.getElementById('kc-prompt-generator-lyrics');
  if (!container) return;
  const toggle = document.getElementById('kc-prompt-generator-lyrics-toggle');
  const fields = document.getElementById('kc-prompt-generator-lyrics-fields');
  const structureField = document.getElementById('kc-prompt-generator-lyrics-structure');
  const languageSelect = document.getElementById('kc-prompt-generator-lyrics-language');
  const charInput = document.getElementById('kc-prompt-generator-lyrics-chars');
  const keywordsInput = document.getElementById('kc-prompt-generator-lyrics-keywords');
  const sectionsToggle = document.getElementById('kc-prompt-generator-lyrics-sections');

  const show = shouldDisplayLyricsOptions();
  container.hidden = !show;
  container.style.display = show ? '' : 'none';
  container.classList.toggle('is-active', show);
  container.setAttribute('aria-hidden', show ? 'false' : 'true');

  if (!show) {
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = false;
      toggle.disabled = true;
    }
    if (fields) {
      fields.hidden = true;
      fields.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  const active = generatorState.lyricsEnabled === true;

  if (toggle instanceof HTMLInputElement) {
    toggle.disabled = false;
    toggle.checked = active;
  }
  if (fields) {
    fields.hidden = !active;
    fields.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  const controls = [structureField, languageSelect, charInput, keywordsInput, sectionsToggle]
    .filter((el) => el instanceof HTMLInputElement
      || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement);
  controls.forEach((el) => {
    el.disabled = !active;
  });

  if (!active) {
    return;
  }

  if (structureField instanceof HTMLTextAreaElement || structureField instanceof HTMLInputElement) {
    structureField.value = normalizeLyricsStructure(generatorState.lyricsStructure);
  }
  if (languageSelect instanceof HTMLSelectElement) {
    const desired = normalizeLyricsLanguage(generatorState.lyricsLanguage);
    languageSelect.value = desired;
  }
  if (charInput instanceof HTMLInputElement) {
    charInput.value = Number.isFinite(generatorState.lyricsCharTarget)
      ? String(generatorState.lyricsCharTarget)
      : '';
  }
  if (keywordsInput instanceof HTMLInputElement) {
    keywordsInput.value = generatorState.lyricsKeywords || '';
  }
  if (sectionsToggle instanceof HTMLInputElement) {
    sectionsToggle.checked = generatorState.lyricsIncludeSectionLabels !== false;
  }
}

function setPromptGeneratorSoundTextEnabled(enabled) {
  const generatorState = ensurePromptGeneratorState();
  const next = Boolean(enabled);
  if (generatorState.soundTextEnabled === next) return;
  generatorState.soundTextEnabled = next;
  if (!next) {
    generatorState.soundTextCharTarget = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
    generatorState.soundTextKeywords = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.keywords;
    generatorState.soundTextNotes = PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.notes;
  }
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextLanguage(language) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.soundTextLanguage = normalizeSoundTextLanguage(language);
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextCharTarget(value) {
  const generatorState = ensurePromptGeneratorState();
  const clamped = clampSoundTextCharTarget(value);
  generatorState.soundTextCharTarget = Number.isFinite(clamped)
    ? clamped
    : PROMPT_GENERATOR_SOUND_TEXT_DEFAULTS.charTarget;
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextKeywords(value) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.soundTextKeywords = sanitizeSoundTextKeywords(value);
  syncPromptGeneratorSoundTextControls();
}

function setPromptGeneratorSoundTextNotes(value) {
  const generatorState = ensurePromptGeneratorState();
  generatorState.soundTextNotes = sanitizeSoundTextNotes(value);
  syncPromptGeneratorSoundTextControls();
}

function syncPromptGeneratorSoundTextControls() {
  const generatorState = ensurePromptGeneratorState();
  const container = document.getElementById('kc-prompt-generator-soundtext');
  if (!container) return;
  const toggle = document.getElementById('kc-prompt-generator-soundtext-toggle');
  const fields = document.getElementById('kc-prompt-generator-soundtext-fields');
  const languageSelect = document.getElementById('kc-prompt-generator-soundtext-language');
  const charInput = document.getElementById('kc-prompt-generator-soundtext-chars');
  const keywordsInput = document.getElementById('kc-prompt-generator-soundtext-keywords');
  const notesField = document.getElementById('kc-prompt-generator-soundtext-notes');

  const show = shouldDisplaySoundTextOptions();
  const autoRequired = show ? shouldAutoEnableSoundText() : false;
  if (autoRequired && generatorState.soundTextEnabled !== true) {
    generatorState.soundTextEnabled = true;
  }
  container.hidden = !show;
  container.style.display = show ? '' : 'none';
  container.classList.toggle('is-active', show);
  container.setAttribute('aria-hidden', show ? 'false' : 'true');

  if (!show) {
    if (toggle instanceof HTMLInputElement) {
      toggle.checked = false;
      toggle.disabled = true;
      toggle.dataset.autoRequired = 'false';
    }
    if (fields) {
      fields.hidden = true;
      fields.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  const active = generatorState.soundTextEnabled === true;

  if (toggle instanceof HTMLInputElement) {
    toggle.disabled = false;
    toggle.dataset.autoRequired = autoRequired ? 'true' : 'false';
    toggle.checked = active;
  }
  if (fields) {
    fields.hidden = !active;
    fields.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  const controls = [languageSelect, charInput, keywordsInput, notesField]
    .filter((el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement);
  controls.forEach((el) => {
    el.disabled = !active;
  });

  if (!active) {
    return;
  }

  if (languageSelect instanceof HTMLSelectElement) {
    const desired = normalizeSoundTextLanguage(generatorState.soundTextLanguage);
    languageSelect.value = desired;
  }
  if (charInput instanceof HTMLInputElement) {
    charInput.value = Number.isFinite(generatorState.soundTextCharTarget)
      ? String(generatorState.soundTextCharTarget)
      : '';
  }
  if (keywordsInput instanceof HTMLInputElement) {
    keywordsInput.value = generatorState.soundTextKeywords || '';
  }
  if (notesField instanceof HTMLTextAreaElement) {
    notesField.value = generatorState.soundTextNotes || '';
  }
}

function getPromptGeneratorGuidanceKey(type, mode) {
  const normalizedMode = normalizePromptGeneratorMode(mode);
  const normalizedType = type === 'other' ? 'other' : (normalizeTypeToken(type) || 'other');
  return `${normalizedMode}::${normalizedType}`;
}

function getPromptGeneratorHost() {
  if (promptGeneratorHostElement && document.body.contains(promptGeneratorHostElement)) {
    return promptGeneratorHostElement;
  }
  const host = document.getElementById('kc-prompt-generator-host');
  if (host) {
    promptGeneratorHostElement = host;
    return host;
  }
  const panel = document.getElementById('kc-prompt-generator');
  if (panel && panel.parentElement) {
    const placeholder = document.createElement('div');
    placeholder.className = 'kc-prompt-generator-host';
    placeholder.id = 'kc-prompt-generator-host';
    panel.parentElement.insertBefore(placeholder, panel);
    placeholder.append(panel);
    promptGeneratorHostElement = placeholder;
    return placeholder;
  }
  return null;
}

function positionPromptGeneratorMenu(panel, anchor) {
  if (!panel || !anchor) return;
  const anchorRect = anchor.getBoundingClientRect();
  const margin = PROMPT_GENERATOR_FLOAT_MARGIN;
  const offset = PROMPT_GENERATOR_FLOAT_OFFSET;

  panel.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
  let width = panel.getBoundingClientRect().width;
  if (!width) {
    width = Math.min(560, window.innerWidth - margin * 2);
    panel.style.width = `${width}px`;
  }
  width = panel.getBoundingClientRect().width || width || Math.min(560, window.innerWidth - margin * 2);

  let left = anchorRect.right - width;
  if (left < margin) {
    left = margin;
  }
  if (left + width > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - margin - width);
  }

  let top = anchorRect.bottom + offset;
  let height = panel.getBoundingClientRect().height;
  if (!height) {
    height = panel.scrollHeight;
  }
  if (top + height > window.innerHeight - margin) {
    const above = anchorRect.top - offset - height;
    if (above >= margin) {
      top = above;
    } else {
      top = Math.max(margin, window.innerHeight - margin - Math.min(height, window.innerHeight - margin * 2));
    }
  }

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function openPromptGeneratorMenu(anchor) {
  const panel = document.getElementById('kc-prompt-generator');
  const host = getPromptGeneratorHost();
  if (!panel || !anchor || !host) return;

  if (promptGeneratorMenuState
    && promptGeneratorMenuState.anchor === anchor
    && document.body.contains(panel)) {
    positionPromptGeneratorMenu(panel, anchor);
    return;
  }

  closePromptGeneratorMenu({ preserveState: true });

  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.classList.add('kc-prompt-generator--floating');
  panel.classList.remove('is-open');
  panel.style.visibility = 'hidden';
  panel.style.pointerEvents = 'none';
  document.body.append(panel);

  const reposition = () => {
    positionPromptGeneratorMenu(panel, anchor);
  };

  reposition();
  panel.style.visibility = '';
  panel.style.pointerEvents = '';
  window.requestAnimationFrame(() => {
    panel.classList.add('is-open');
    try {
      panel.focus({ preventScroll: true });
    } catch (err) {
      // フォーカス不可の場合は無視
    }
  });

  const onOutsideClick = (evt) => {
    if (!panel.contains(evt.target) && evt.target !== anchor) {
      setPromptGeneratorPanelVisible(false);
    }
  };
  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      setPromptGeneratorPanelVisible(false);
    }
  };
  const onViewportChange = () => {
    reposition();
  };

  document.addEventListener('mousedown', onOutsideClick);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onViewportChange, { passive: true });
  window.addEventListener('scroll', onViewportChange, { passive: true, capture: true });

  anchor.classList.add('is-active');
  anchor.setAttribute('aria-expanded', 'true');

  promptGeneratorMenuState = {
    anchor,
    host,
    onOutsideClick,
    onKeyDown,
    onViewportChange
  };
}

function closePromptGeneratorMenu({ preserveState = false } = {}) {
  const panel = document.getElementById('kc-prompt-generator');
  const menuState = promptGeneratorMenuState;
  if (menuState) {
    document.removeEventListener('mousedown', menuState.onOutsideClick);
    document.removeEventListener('keydown', menuState.onKeyDown);
    window.removeEventListener('resize', menuState.onViewportChange);
    window.removeEventListener('scroll', menuState.onViewportChange, true);
    if (menuState.anchor) {
      menuState.anchor.classList.remove('is-active');
      menuState.anchor.setAttribute('aria-expanded', 'false');
    }
  }
  if (panel) {
    panel.classList.remove('is-open');
    panel.classList.remove('kc-prompt-generator--floating');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.style.visibility = '';
    panel.style.pointerEvents = '';
    panel.style.top = '';
    panel.style.left = '';
    panel.style.width = '';
    panel.style.maxHeight = '';
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    const host = getPromptGeneratorHost();
    if (host) {
      host.append(panel);
    }
  }
  promptGeneratorMenuState = null;
  if (!preserveState) {
    const generatorState = ensurePromptGeneratorState();
    generatorState.showPanel = false;
  }
}

function syncPromptGeneratorPanelVisibility({ anchor } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const toggle = document.getElementById('kc-prompt-generator-toggle');
  const isVisible = Boolean(generatorState.showPanel);
  if (toggle) {
    toggle.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
    toggle.classList.toggle('is-active', isVisible);
  }

  if (isVisible) {
    const targetAnchor = anchor || promptGeneratorMenuState?.anchor || toggle;
    if (targetAnchor) {
      openPromptGeneratorMenu(targetAnchor);
    }
    return;
  }

  closePromptGeneratorMenu({ preserveState: true });
}

function setPromptGeneratorPanelVisible(visible, { anchor } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const next = Boolean(visible);
  if (generatorState.showPanel === next) {
    syncPromptGeneratorPanelVisibility({ anchor });
    return;
  }
  generatorState.showPanel = next;
  if (next) {
    refreshPromptGeneratorDefaults();
  }
  syncPromptGeneratorPanelVisibility({ anchor });
  if (next) {
    syncPromptGeneratorSelectors({ refreshOptions: true });
    syncPromptGeneratorGuidanceField();
  }
}

function togglePromptGeneratorPanel(anchor) {
  const generatorState = ensurePromptGeneratorState();
  setPromptGeneratorPanelVisible(!generatorState.showPanel, { anchor });
}

function resolvePromptGeneratorGuidanceForType(type, category, mode) {
  const generatorState = ensurePromptGeneratorState();
  const normalizedType = type === 'other' ? 'other' : normalizeTypeToken(type);
  const guidanceKey = getPromptGeneratorGuidanceKey(normalizedType || 'other', mode || generatorState.mode);
  if (guidanceKey) {
    const stored = generatorState.guidanceByType?.[guidanceKey];
    if (typeof stored === 'string' && stored.trim()) {
      return stored;
    }
  }
  return getDefaultPromptGeneratorGuidancePack(normalizedType, category, mode || generatorState.mode).en;
}

function resolvePromptGeneratorGuidanceTranslationForType(type, category, mode) {
  const generatorState = ensurePromptGeneratorState();
  const normalizedType = type === 'other' ? 'other' : normalizeTypeToken(type);
  const guidanceKey = getPromptGeneratorGuidanceKey(normalizedType || 'other', mode || generatorState.mode);
  if (guidanceKey) {
    const stored = generatorState.guidanceTranslationsByType?.[guidanceKey];
    if (typeof stored === 'string' && stored.trim()) {
      return stored;
    }
  }
  return getDefaultPromptGeneratorGuidancePack(normalizedType, category, mode || generatorState.mode).ja;
}

function applyPromptGeneratorGuidanceForCurrentType({ force = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const type = generatorState.selectedType;
  const category = generatorState.selectedCategory;
  const mode = normalizePromptGeneratorMode(generatorState.mode);
  const nextGuidance = resolvePromptGeneratorGuidanceForType(type, category, mode) || '';
  const nextTranslation = resolvePromptGeneratorGuidanceTranslationForType(type, category, mode) || '';
  if (force || !generatorState.guidanceDirty) {
    setPromptGeneratorGuidance(nextGuidance, { fromUser: false, persist: true });
  }
  if (force || !generatorState.guidanceTranslationDirty) {
    setPromptGeneratorGuidanceTranslation(nextTranslation, { fromUser: false, persist: true });
  }
}

function setPromptGeneratorGuidance(text, { fromUser = false, persist = true } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const sanitized = typeof text === 'string' ? text.trim() : '';
  generatorState.activeGuidance = sanitized;
  if (fromUser) {
    generatorState.guidanceDirty = true;
  } else {
    generatorState.guidanceDirty = false;
  }
  if (persist) {
    const rawType = generatorState.selectedType || '';
    const activeType = rawType === 'other' ? 'other' : normalizeTypeToken(rawType);
    const key = getPromptGeneratorGuidanceKey(activeType || 'other', generatorState.mode);
    if (key) {
      generatorState.guidanceByType[key] = sanitized;
    }
  }
  if (!fromUser) {
    syncPromptGeneratorGuidanceField();
  }
}

function setPromptGeneratorGuidanceTranslation(text, { fromUser = false, persist = true } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const sanitized = typeof text === 'string' ? text.trim() : '';
  generatorState.activeGuidanceTranslation = sanitized;
  if (fromUser) {
    generatorState.guidanceTranslationDirty = true;
  } else {
    generatorState.guidanceTranslationDirty = false;
  }
  if (persist) {
    const rawType = generatorState.selectedType || '';
    const activeType = rawType === 'other' ? 'other' : normalizeTypeToken(rawType);
    const key = getPromptGeneratorGuidanceKey(activeType || 'other', generatorState.mode);
    if (key) {
      generatorState.guidanceTranslationsByType[key] = sanitized;
    }
  }
  if (!fromUser) {
    syncPromptGeneratorGuidanceField();
  }
}

function setPromptGeneratorCategory(category, { fromUser = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const normalized = category ? normalizeCategory(category) : '';
  if (generatorState.selectedCategory === normalized) {
    if (fromUser) generatorState.categoryDirty = true;
    return;
  }
  generatorState.selectedCategory = normalized;
  if (fromUser) {
    generatorState.categoryDirty = true;
  } else if (!normalized) {
    generatorState.categoryDirty = false;
  }
  if (!fromUser && !generatorState.typeDirty && generatorState.selectedType) {
    const inferred = PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(generatorState.selectedType);
    if (inferred && inferred !== normalized) {
      // keep category aligned with type unless user explicitly changed it later
      generatorState.selectedCategory = inferred;
    }
  }
  let typeAdjusted = false;
  const allowedTypes = getPromptGeneratorTypeOptionsForCategory(generatorState.selectedCategory);
  if (allowedTypes.length) {
    const hasCurrent = allowedTypes.some((option) => option.id === generatorState.selectedType);
    if (!hasCurrent) {
      const fallbackType = allowedTypes[0]?.id || '';
      if (fallbackType && fallbackType !== generatorState.selectedType) {
        setPromptGeneratorType(fallbackType, { fromUser: false });
        typeAdjusted = true;
      }
    }
  }
  if (!typeAdjusted) {
    applyPromptGeneratorGuidanceForCurrentType({ force: fromUser });
    syncPromptGeneratorSelectors();
  } else {
    syncPromptGeneratorSelectors();
  }
}

function setPromptGeneratorType(type, { fromUser = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const normalized = type === 'other' ? 'other' : normalizeTypeToken(type);
  const previousTypeRaw = generatorState.selectedType || '';
  const previousNormalized = previousTypeRaw === 'other' ? 'other' : normalizeTypeToken(previousTypeRaw);
  if (previousNormalized) {
    const previousKey = getPromptGeneratorGuidanceKey(previousNormalized, generatorState.mode);
    if (typeof generatorState.activeGuidance === 'string') {
      generatorState.guidanceByType[previousKey] = generatorState.activeGuidance;
    }
    if (typeof generatorState.activeGuidanceTranslation === 'string') {
      generatorState.guidanceTranslationsByType[previousKey] = generatorState.activeGuidanceTranslation;
    }
  }
  if (previousNormalized === normalized) {
    if (fromUser) generatorState.typeDirty = true;
    return;
  }
  generatorState.selectedType = normalized;
  if (fromUser) {
    generatorState.typeDirty = true;
  } else if (!normalized) {
    generatorState.typeDirty = false;
  }
  if (!generatorState.categoryDirty) {
    const inferredCategory = normalized ? PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(normalized) : '';
    if (inferredCategory) {
      generatorState.selectedCategory = inferredCategory;
    }
  }
  applyPromptGeneratorGuidanceForCurrentType({ force: true });
  syncPromptGeneratorSelectors();
}

function setPromptGeneratorVariantCount(count) {
  const generatorState = ensurePromptGeneratorState();
  const numeric = Number(count);
  const clamped = Number.isFinite(numeric)
    ? Math.min(Math.max(Math.trunc(numeric), 1), PROMPT_GENERATOR_MAX_SUGGESTIONS)
    : PROMPT_GENERATOR_DEFAULT_VARIANTS;
  if (generatorState.variantCount === clamped) {
    syncPromptGeneratorSelectors();
    return;
  }
  generatorState.variantCount = clamped;
  syncPromptGeneratorSelectors();
}

function syncPromptGeneratorSelectors({ refreshOptions = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const categorySelect = document.getElementById('kc-prompt-generator-category');
  const typeSelect = document.getElementById('kc-prompt-generator-type');
  const variantSelect = document.getElementById('kc-prompt-generator-variants');
  if (categorySelect instanceof HTMLSelectElement) {
    if (refreshOptions || categorySelect.options.length !== PROMPT_GENERATOR_CATEGORY_OPTIONS.length) {
      const fragment = document.createDocumentFragment();
      PROMPT_GENERATOR_CATEGORY_OPTIONS.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        fragment.append(opt);
      });
      categorySelect.replaceChildren(fragment);
    }
    const desiredCategory = generatorState.selectedCategory && PROMPT_GENERATOR_CATEGORY_OPTIONS
      .some((option) => option.id === generatorState.selectedCategory)
      ? generatorState.selectedCategory
      : DEFAULT_ACTIVE_CATEGORY;
    if (generatorState.selectedCategory !== desiredCategory) {
      generatorState.selectedCategory = desiredCategory;
    }
    if (categorySelect.value !== desiredCategory) {
      categorySelect.value = desiredCategory;
    }
  }
  if (typeSelect instanceof HTMLSelectElement) {
    const allowedTypes = getPromptGeneratorTypeOptionsForCategory(generatorState.selectedCategory);
    const fragment = document.createDocumentFragment();
    allowedTypes.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.id;
      opt.textContent = option.label;
      fragment.append(opt);
    });
    typeSelect.replaceChildren(fragment);
    const allowedIds = allowedTypes.map((option) => option.id);
    const fallbackType = allowedIds[0] || '';
    if (!allowedIds.includes(generatorState.selectedType)) {
      generatorState.selectedType = fallbackType;
      generatorState.typeDirty = false;
      generatorState.guidanceDirty = false;
      generatorState.guidanceTranslationDirty = false;
      applyPromptGeneratorGuidanceForCurrentType({ force: true });
    }
    const targetType = generatorState.selectedType || fallbackType || '';
    if (typeSelect.value !== targetType) {
      typeSelect.value = targetType;
    }
  }
  if (variantSelect instanceof HTMLSelectElement) {
    if (refreshOptions && variantSelect.options.length === 0) {
      const fragment = document.createDocumentFragment();
      PROMPT_GENERATOR_VARIANT_OPTIONS.forEach((num) => {
        const opt = document.createElement('option');
        opt.value = String(num);
        opt.textContent = `${num}`;
        fragment.append(opt);
      });
      variantSelect.append(fragment);
    }
    const value = String(generatorState.variantCount || PROMPT_GENERATOR_DEFAULT_VARIANTS);
    if (variantSelect.value !== value) {
      variantSelect.value = value;
    }
  }
  syncPromptGeneratorLyricsControls();
  syncPromptGeneratorSoundTextControls();
}

function syncPromptGeneratorGuidanceField() {
  const generatorState = ensurePromptGeneratorState();
  const inputEn = document.getElementById('kc-prompt-generator-guidance-en');
  if (inputEn instanceof HTMLTextAreaElement) {
    const valueEn = generatorState.activeGuidance || '';
    if (!(document.activeElement === inputEn && generatorState.guidanceDirty)) {
      if (inputEn.value !== valueEn) {
        inputEn.value = valueEn;
      }
    }
  }
  const inputJa = document.getElementById('kc-prompt-generator-guidance-ja');
  if (inputJa instanceof HTMLTextAreaElement) {
    const valueJa = generatorState.activeGuidanceTranslation || '';
    if (!(document.activeElement === inputJa && generatorState.guidanceTranslationDirty)) {
      if (inputJa.value !== valueJa) {
        inputJa.value = valueJa;
      }
    }
  }
}

function derivePromptGeneratorDefaultsFromSelection() {
  const result = {
    category: DEFAULT_ACTIVE_CATEGORY,
    type: PROMPT_GENERATOR_DEFAULT_TYPE,
    engineLabel: '',
    engineId: ''
  };
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return result;
  }
  const firstEntry = state.selected.values().next().value;
  if (!firstEntry) {
    return result;
  }
  const meta = getEngineMeta(firstEntry.id) || firstEntry || {};
  result.engineId = meta.id || firstEntry.id || '';
  result.engineLabel = meta.displayLabel || meta.label || deriveEngineLabel(result.engineId) || result.engineId || '';
  const prefixCandidates = [
    extractEnginePrefix(meta.id),
    extractEnginePrefix(meta.label),
    extractEnginePrefix(meta.displayLabel),
    determineEngineTypeKey(meta)
  ];
  for (const candidate of prefixCandidates) {
    const normalized = normalizeTypeToken(candidate);
    if (normalized) {
      result.type = normalized;
      break;
    }
  }
  const inferredCategory = meta.category
    || PROMPT_GENERATOR_TYPE_CATEGORY_MAP.get(result.type)
    || state.activeEngineCategory
    || DEFAULT_ACTIVE_CATEGORY;
  result.category = normalizeCategory(inferredCategory || DEFAULT_ACTIVE_CATEGORY);
  if (!result.type && result.category && result.category !== 'other') {
    const fallbackType = PROMPT_GENERATOR_TYPE_OPTIONS.find((option) => option.category === result.category);
    if (fallbackType) {
      result.type = fallbackType.id;
    }
  }
  return result;
}

function buildPromptGeneratorSelectionToken() {
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return '__none__';
  }
  const ids = Array.from(state.selected.keys())
    .map((id) => (id === undefined || id === null ? '' : String(id).trim()))
    .filter(Boolean)
    .sort();
  return ids.length ? ids.join('|') : '__empty__';
}

function refreshPromptGeneratorDefaults({ force = false } = {}) {
  const generatorState = ensurePromptGeneratorState();
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  const selectionToken = buildPromptGeneratorSelectionToken();
  const previousTypeRaw = generatorState.selectedType || '';
  const previousNormalized = previousTypeRaw === 'other' ? 'other' : normalizeTypeToken(previousTypeRaw);
  const currentMode = normalizePromptGeneratorMode(generatorState.mode);
  if (previousNormalized) {
    const previousKey = getPromptGeneratorGuidanceKey(previousNormalized, currentMode);
    if (typeof generatorState.activeGuidance === 'string') {
      generatorState.guidanceByType[previousKey] = generatorState.activeGuidance;
    }
    if (typeof generatorState.activeGuidanceTranslation === 'string') {
      generatorState.guidanceTranslationsByType[previousKey] = generatorState.activeGuidanceTranslation;
    }
  }

  const selectionChanged = generatorState.lastSelectionToken !== selectionToken;
  if (selectionChanged) {
    generatorState.lastSelectionToken = selectionToken;
    generatorState.categoryDirty = false;
    generatorState.typeDirty = false;
    generatorState.guidanceDirty = false;
    generatorState.guidanceTranslationDirty = false;
  }

  const shouldForce = force || selectionChanged;

  if (shouldForce || !generatorState.categoryDirty) {
    generatorState.selectedCategory = defaults.category || '';
  }
  if (shouldForce || !generatorState.typeDirty) {
    generatorState.selectedType = defaults.type || '';
  }

  applyPromptGeneratorGuidanceForCurrentType({ force: shouldForce });
  syncPromptGeneratorSelectors({ refreshOptions: true });
  syncPromptGeneratorGuidanceField();
}

function getPromptGeneratorTypeOptionsForCategory(category) {
  const normalized = normalizeCategory(category || DEFAULT_ACTIVE_CATEGORY);
  if (normalized === ALL_CATEGORY_ID) {
    return PROMPT_GENERATOR_TYPE_OPTIONS.slice();
  }
  return PROMPT_GENERATOR_TYPE_OPTIONS.filter((option) => option.category === normalized);
}

function getPromptGeneratorCategoryFallback() {
  const generatorState = ensurePromptGeneratorState();
  if (generatorState.selectedCategory) {
    return generatorState.selectedCategory;
  }
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  return defaults.category || '';
}

function getPromptGeneratorTypeFallback() {
  const generatorState = ensurePromptGeneratorState();
  if (generatorState.selectedType) {
    return generatorState.selectedType;
  }
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  return defaults.type || '';
}
function updatePromptGeneratorControls() {
  const generatorState = ensurePromptGeneratorState();
  const runButton = document.getElementById('kc-prompt-generate');
  if (runButton instanceof HTMLButtonElement) {
    const { loading } = generatorState;
    runButton.disabled = Boolean(loading);
    runButton.setAttribute('aria-busy', loading ? 'true' : 'false');
    runButton.textContent = loading ? '生成中…' : 'プロンプト生成';
  }
  updatePromptGeneratorModeButtons();
  updatePromptGeneratorStatus();
  syncPromptGeneratorPanelVisibility();
  syncPromptGeneratorSelectors();
  syncPromptGeneratorLyricsControls();
  syncPromptGeneratorSoundTextControls();
  syncPromptGeneratorGuidanceField();
}

function schedulePromptGeneratorMessageClear() {
  if (typeof window === 'undefined') return;
  if (promptGeneratorStatusTimer) {
    window.clearTimeout(promptGeneratorStatusTimer);
    promptGeneratorStatusTimer = null;
  }
  if (state.promptGenerator?.loading) return;
  promptGeneratorStatusTimer = window.setTimeout(() => {
    if (state.promptGenerator?.loading) return;
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
    promptGeneratorStatusTimer = null;
  }, PROMPT_GENERATOR_STATUS_TIMEOUT_MS);
}

function normalizeSuggestionTemplate(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const template = {};
  if (typeof entry.name === 'string' && entry.name.trim()) {
    template.name = entry.name.trim();
  }
  if (typeof entry.category === 'string' && entry.category.trim()) {
    template.category = entry.category.trim();
  }
  if (typeof entry.type === 'string' && entry.type.trim()) {
    template.type = entry.type.trim();
  }
  if (typeof entry.filePrefix === 'string' && entry.filePrefix.trim()) {
    template.filePrefix = entry.filePrefix.trim();
  }
  if (typeof entry.soundText === 'string' && entry.soundText.trim()) {
    template.soundText = entry.soundText.trim();
  }
  if (typeof entry.memo === 'string' && entry.memo.trim()) {
    template.memo = entry.memo.trim();
  }
  if (Array.isArray(entry.tags)) {
    const tags = entry.tags
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
    if (tags.length) {
      template.tags = tags;
    }
  }
  return Object.keys(template).length ? template : null;
}

function normalizeSuggestionLyricsEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = entry.trim();
    if (!text) return null;
    return { text: text.length > 6000 ? text.slice(0, 6000) : text };
  }
  if (typeof entry !== 'object') return null;
  const baseText = typeof entry.text === 'string'
    ? entry.text
    : (typeof entry.body === 'string'
        ? entry.body
        : (Array.isArray(entry.lines) ? entry.lines.join('\n') : ''));
  const text = typeof baseText === 'string' ? baseText.trim() : '';
  if (!text) return null;
  const normalized = {
    text: text.length > 6000 ? text.slice(0, 6000) : text
  };
  if (typeof entry.structure === 'string' && entry.structure.trim()) {
    normalized.structure = entry.structure.trim();
  }
  if (typeof entry.language === 'string' && entry.language.trim()) {
    normalized.language = entry.language.trim();
  }
  if (typeof entry.length === 'string' && entry.length.trim()) {
    normalized.length = entry.length.trim();
  }
  if (typeof entry.includeSectionLabels === 'boolean') {
    normalized.includeSectionLabels = entry.includeSectionLabels;
  }
  if (Array.isArray(entry.sections)) {
    const sections = entry.sections
      .map((section) => (typeof section === 'string' ? section.trim() : ''))
      .filter(Boolean)
      .slice(0, 12);
    if (sections.length) {
      normalized.sections = sections;
    }
  }
  if (typeof entry.summary === 'string' && entry.summary.trim()) {
    normalized.summary = entry.summary.trim();
  }
  return normalized;
}

function normalizeVoiceScriptSuggestion(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = entry.trim();
    return text ? { text } : null;
  }
  if (typeof entry !== 'object') return null;
  const textCandidate = entry.text || entry.body || entry.script || entry.content || '';
  const text = typeof textCandidate === 'string' ? textCandidate.trim() : '';
  if (!text) return null;
  const result = { text };
  if (typeof entry.language === 'string' && entry.language.trim()) {
    result.language = entry.language.trim().toLowerCase();
  }
  const charTarget = clampSoundTextCharTarget(entry.charTarget ?? entry.characterTarget);
  if (Number.isFinite(charTarget)) {
    result.charTarget = charTarget;
  }
  if (Array.isArray(entry.keywords)) {
    const keywords = entry.keywords
      .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
      .filter(Boolean)
      .slice(0, PROMPT_GENERATOR_SOUND_TEXT_KEYWORD_LIMIT);
    if (keywords.length) {
      result.keywords = keywords;
    }
  }
  if (typeof entry.keywordsText === 'string' && entry.keywordsText.trim()) {
    result.keywordsText = sanitizeSoundTextKeywords(entry.keywordsText);
  }
  if (typeof entry.notes === 'string' && entry.notes.trim()) {
    result.notes = sanitizeSoundTextNotes(entry.notes);
  }
  return result;
}

function normalizePromptSuggestion(entry, index = 0) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return {
      label: `案${index + 1}`,
      prompt: trimmed,
      description: ''
    };
  }
  if (typeof entry !== 'object') return null;
  const prompt = typeof entry.prompt === 'string' ? entry.prompt.trim() : '';
  if (!prompt) return null;
  const label = typeof entry.label === 'string' && entry.label.trim()
    ? entry.label.trim()
    : (typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : `案${index + 1}`);
  const description = typeof entry.description === 'string' ? entry.description.trim()
    : (typeof entry.notes === 'string' ? entry.notes.trim() : '');
  const tags = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean).slice(0, 4)
    : [];
  const translation = (() => {
    if (typeof entry.translation === 'string' && entry.translation.trim()) {
      return entry.translation.trim();
    }
    if (typeof entry.translationJa === 'string' && entry.translationJa.trim()) {
      return entry.translationJa.trim();
    }
    if (typeof entry.translation_ja === 'string' && entry.translation_ja.trim()) {
      return entry.translation_ja.trim();
    }
    if (typeof entry.promptJa === 'string' && entry.promptJa.trim()) {
      return entry.promptJa.trim();
    }
    if (typeof entry.prompt_ja === 'string' && entry.prompt_ja.trim()) {
      return entry.prompt_ja.trim();
    }
    if (typeof entry.japanese === 'string' && entry.japanese.trim()) {
      return entry.japanese.trim();
    }
    return '';
  })();
  const template = normalizeSuggestionTemplate(entry.template);
  if (template && !template.memo && translation) {
    template.memo = translation;
  }
  const enrichedTemplate = template || {};
  const fallbackCategory = getPromptGeneratorCategoryFallback() || '';
  const fallbackType = getPromptGeneratorTypeFallback() || '';
  if (!enrichedTemplate.category) {
    enrichedTemplate.category = entry.category
      || (entry.meta && entry.meta.category)
      || fallbackCategory;
  }
  if (!enrichedTemplate.type) {
    enrichedTemplate.type = entry.type
      || (entry.meta && entry.meta.type)
      || fallbackType;
  }
  const normalizedTemplateCategory = enrichedTemplate.category
    ? normalizeCategory(enrichedTemplate.category)
    : '';
  const normalizedTemplateType = enrichedTemplate.type
    ? normalizeTypeToken(enrichedTemplate.type)
    : '';
  const entryCategoryNormalized = entry.category ? normalizeCategory(entry.category) : '';
  const entryTypeNormalized = normalizeTypeToken(entry.type);
  const metaCategoryNormalized = entry.meta && entry.meta.category
    ? normalizeCategory(entry.meta.category)
    : '';
  const metaTypeNormalized = entry.meta && entry.meta.type
    ? normalizeTypeToken(entry.meta.type)
    : '';
  const fallbackTypeNormalized = normalizeTypeToken(fallbackType);
  const supportsSoundText = [
    normalizedTemplateCategory,
    entryCategoryNormalized,
    metaCategoryNormalized
  ].some((value) => value === 'sound')
    || [
      normalizedTemplateType,
      entryTypeNormalized,
      metaTypeNormalized,
      fallbackTypeNormalized
    ].some((value) => PROMPT_GENERATOR_SOUND_TEXT_ENABLED_TYPES.has(value));
  const result = { label, prompt, description };
  if (tags.length) {
    result.tags = tags;
  }
  if (enrichedTemplate && Object.keys(enrichedTemplate).length) {
    result.template = enrichedTemplate;
  }
  if (enrichedTemplate.category) {
    result.category = enrichedTemplate.category;
  }
  if (enrichedTemplate.type) {
    result.type = enrichedTemplate.type;
  }
  result.supportsSoundText = supportsSoundText;
  if (translation) {
    result.translation = translation;
  }
  const lyricsEntry = entry.lyrics
    || entry.lyricsText
    || entry.songLyrics
    || (entry.meta && entry.meta.lyrics);
  const normalizedLyrics = normalizeSuggestionLyricsEntry(lyricsEntry);
  if (normalizedLyrics) {
    result.lyrics = normalizedLyrics;
  }
  const voiceScriptEntry = entry.voiceScript
    || entry.voice_text
    || entry.voiceScriptText
    || (entry.meta && entry.meta.voiceScript)
    || (entry.meta && entry.meta.soundText);
  const normalizedVoiceScript = normalizeVoiceScriptSuggestion(voiceScriptEntry);
  if (supportsSoundText && normalizedVoiceScript) {
    result.voiceScript = normalizedVoiceScript;
    if (normalizedVoiceScript.text) {
      result.soundText = normalizedVoiceScript.text;
    }
  } else if (supportsSoundText && typeof entry.soundText === 'string' && entry.soundText.trim()) {
    result.soundText = entry.soundText.trim();
  }
  return result;
}

function renderPromptGeneratorResults() {
  const container = document.getElementById('kc-prompt-generator-results');
  if (!container) return;
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  container.innerHTML = '';
  if (!suggestions.length) {
    return;
  }
  suggestions.forEach((suggestion, index) => {
    if (!suggestion || typeof suggestion.prompt !== 'string') return;
    const item = document.createElement('div');
    item.className = 'kc-prompt-generator__item';

    const header = document.createElement('div');
    header.className = 'kc-prompt-generator__item-header';

    const title = document.createElement('span');
    title.className = 'kc-prompt-generator__item-title';
    const label = suggestion.label || `案${index + 1}`;
    title.textContent = `${index + 1}. ${label}`;
    header.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'kc-prompt-generator__item-actions';

    const supportsSoundText = suggestion.supportsSoundText === true;
    const soundTextContent = supportsSoundText
      ? (() => {
          if (suggestion.soundText && typeof suggestion.soundText === 'string') {
            return suggestion.soundText.trim();
          }
          if (suggestion.voiceScript && typeof suggestion.voiceScript.text === 'string') {
            return suggestion.voiceScript.text.trim();
          }
          return '';
        })()
      : '';
    const hasSoundText = supportsSoundText && Boolean(soundTextContent);

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'kc-prompt-generator__action kc-prompt-generator__action--primary';
    applyBtn.textContent = '採用';
    applyBtn.dataset.action = 'apply';
    applyBtn.dataset.index = String(index);
    actions.appendChild(applyBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'kc-prompt-generator__action';
    copyBtn.textContent = 'コピー';
    copyBtn.dataset.action = 'copy';
    copyBtn.dataset.index = String(index);
    actions.appendChild(copyBtn);

    const templateBtn = document.createElement('button');
    templateBtn.type = 'button';
    templateBtn.className = 'kc-prompt-generator__action';
    templateBtn.textContent = 'テンプレに追加';
    templateBtn.dataset.action = 'template';
    templateBtn.dataset.index = String(index);
    actions.appendChild(templateBtn);

    if (suggestion.lyrics && typeof suggestion.lyrics.text === 'string' && suggestion.lyrics.text.trim()) {
      const copyLyricsBtn = document.createElement('button');
      copyLyricsBtn.type = 'button';
      copyLyricsBtn.className = 'kc-prompt-generator__action';
      copyLyricsBtn.textContent = '歌詞コピー';
      copyLyricsBtn.dataset.action = 'copy-lyrics';
      copyLyricsBtn.dataset.index = String(index);
      actions.appendChild(copyLyricsBtn);
    }
    if (hasSoundText) {
      const copySoundBtn = document.createElement('button');
      copySoundBtn.type = 'button';
      copySoundBtn.className = 'kc-prompt-generator__action';
      copySoundBtn.textContent = '音声テキストコピー';
      copySoundBtn.dataset.action = 'copy-sound-text';
      copySoundBtn.dataset.index = String(index);
      actions.appendChild(copySoundBtn);
    }

    header.appendChild(actions);
    item.appendChild(header);

    if (suggestion.description) {
      const desc = document.createElement('p');
      desc.className = 'kc-prompt-generator__item-description';
      desc.textContent = suggestion.description;
      item.appendChild(desc);
    }

    const textBlock = document.createElement('div');
    textBlock.className = 'kc-prompt-generator__text';
    textBlock.textContent = suggestion.prompt;
    item.appendChild(textBlock);

    if (hasSoundText) {
      const voiceBlock = document.createElement('div');
      voiceBlock.className = 'kc-prompt-generator__soundtext-block';

      const voiceTitle = document.createElement('div');
      voiceTitle.className = 'kc-prompt-generator__soundtext-title';
      voiceTitle.textContent = '音声テキスト案';

      const voiceBody = document.createElement('pre');
      voiceBody.className = 'kc-prompt-generator__soundtext-text';
      voiceBody.textContent = soundTextContent;

      voiceBlock.append(voiceTitle, voiceBody);
      item.appendChild(voiceBlock);
    }

    if (suggestion.lyrics && typeof suggestion.lyrics.text === 'string' && suggestion.lyrics.text.trim()) {
      const lyricsBlock = document.createElement('div');
      lyricsBlock.className = 'kc-prompt-generator__lyrics-block';

      const lyricsTitle = document.createElement('div');
      lyricsTitle.className = 'kc-prompt-generator__lyrics-title';
      lyricsTitle.textContent = '歌詞案';

      const lyricsBody = document.createElement('pre');
      lyricsBody.className = 'kc-prompt-generator__lyrics-text';
      lyricsBody.textContent = suggestion.lyrics.text;

      lyricsBlock.append(lyricsTitle, lyricsBody);
      item.appendChild(lyricsBlock);
    }

    if (suggestion.translation) {
      const translationWrap = document.createElement('div');
      translationWrap.className = 'kc-prompt-generator__translation';

      const translationLabel = document.createElement('div');
      translationLabel.className = 'kc-prompt-generator__translation-label';
      translationLabel.textContent = '日本語訳';

      const translationBody = document.createElement('div');
      translationBody.className = 'kc-prompt-generator__translation-body';
      translationBody.textContent = suggestion.translation;

      translationWrap.append(translationLabel, translationBody);
      item.appendChild(translationWrap);
    }

    container.appendChild(item);
  });
}

function setPromptGeneratorMode(mode) {
  const normalized = normalizePromptGeneratorMode(mode);
  const generatorState = ensurePromptGeneratorState();
  const previousMode = normalizePromptGeneratorMode(generatorState.mode);
  if (previousMode === normalized) {
    updatePromptGeneratorModeButtons();
    return;
  }
  const currentType = generatorState.selectedType || PROMPT_GENERATOR_DEFAULT_TYPE;
  const previousKey = getPromptGeneratorGuidanceKey(currentType, previousMode);
  if (typeof generatorState.activeGuidance === 'string') {
    generatorState.guidanceByType[previousKey] = generatorState.activeGuidance;
  }
  if (typeof generatorState.activeGuidanceTranslation === 'string') {
    generatorState.guidanceTranslationsByType[previousKey] = generatorState.activeGuidanceTranslation;
  }
  generatorState.mode = normalized;
  generatorState.lastMode = normalized;
  generatorState.message = '';
  generatorState.guidanceDirty = false;
  generatorState.guidanceTranslationDirty = false;
  applyPromptGeneratorGuidanceForCurrentType({ force: true });
  updatePromptGeneratorControls();
}

async function copyPromptSuggestion(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  if (!entry || !entry.prompt) return;
  const text = entry.prompt;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    state.promptGenerator.message = 'クリップボードにコピーしました';
    state.promptGenerator.error = '';
    updatePromptGeneratorStatus();
    schedulePromptGeneratorMessageClear();
  } catch (err) {
    console.warn('[Showcase] failed to copy prompt', err);
    state.promptGenerator.error = 'クリップボードへコピーできませんでした';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
  }
}

async function copyPromptLyrics(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  const lyricsText = entry?.lyrics && typeof entry.lyrics.text === 'string' ? entry.lyrics.text : '';
  if (!lyricsText.trim()) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(lyricsText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = lyricsText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    state.promptGenerator.message = '歌詞をクリップボードにコピーしました';
    state.promptGenerator.error = '';
    updatePromptGeneratorStatus();
    schedulePromptGeneratorMessageClear();
  } catch (err) {
    console.warn('[Showcase] failed to copy lyrics', err);
    state.promptGenerator.error = '歌詞をコピーできませんでした';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
  }
}

async function copyPromptSoundText(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  const soundText = (() => {
    if (entry?.soundText && typeof entry.soundText === 'string') {
      return entry.soundText;
    }
    if (entry?.voiceScript && typeof entry.voiceScript.text === 'string') {
      return entry.voiceScript.text;
    }
    return '';
  })();
  if (!soundText || !soundText.trim()) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(soundText);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = soundText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    state.promptGenerator.message = '音声テキストをコピーしました';
    state.promptGenerator.error = '';
    updatePromptGeneratorStatus();
    schedulePromptGeneratorMessageClear();
  } catch (err) {
    console.warn('[Showcase] failed to copy sound text', err);
    state.promptGenerator.error = '音声テキストをコピーできませんでした';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
  }
}

function collectPromptGeneratorContext() {
  const generatorState = ensurePromptGeneratorState();
  const defaults = derivePromptGeneratorDefaultsFromSelection();
  const context = {
    activeCategory: state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY,
    activeCategoryLabel: categoryLabel(state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY),
    engineCount: 0,
    engineTypes: [],
    engineCategories: [],
    requiresMedia: false,
    requiresPrompt: false,
    requiresSoundText: false,
    requiredMediaTypes: [],
    engines: [],
    selectedCategory: generatorState.selectedCategory || defaults.category || '',
    selectedType: generatorState.selectedType || defaults.type || '',
    primaryEngineLabel: defaults.engineLabel || '',
    primaryEngineId: defaults.engineId || '',
    mode: normalizePromptGeneratorMode(generatorState.mode),
    requestedVariantCount: generatorState.variantCount || PROMPT_GENERATOR_DEFAULT_VARIANTS
  };
  if (generatorState.activeGuidance) {
    context.guidance = generatorState.activeGuidance;
  }
  if (generatorState.activeGuidanceTranslation) {
    context.guidanceTranslation = generatorState.activeGuidanceTranslation;
  }
  if (context.selectedCategory) {
    context.selectedCategoryLabel = categoryLabel(context.selectedCategory);
  }
  const canShowSoundText = shouldDisplaySoundTextOptions();

  if (shouldDisplayLyricsOptions() && generatorState.lyricsEnabled) {
    const lyrics = {
      enabled: true,
      language: normalizeLyricsLanguage(generatorState.lyricsLanguage),
      includeSectionLabels: generatorState.lyricsIncludeSectionLabels !== false
    };
    const structureNotes = normalizeLyricsStructure(generatorState.lyricsStructure);
    if (structureNotes) {
      lyrics.structure = structureNotes;
      const sections = extractLyricsSections(structureNotes);
      if (sections.length) {
        lyrics.sections = sections;
      }
    }
    lyrics.format = lyrics.includeSectionLabels ? 'structured' : 'plain';
    const charTarget = clampLyricsCharTarget(generatorState.lyricsCharTarget);
    if (Number.isFinite(charTarget)) {
      lyrics.charTarget = charTarget;
    }
    if (generatorState.lyricsKeywords) {
      const rawKeywords = sanitizeLyricsKeywordsInput(generatorState.lyricsKeywords);
      const keywords = splitLyricsKeywords(rawKeywords);
      generatorState.lyricsKeywords = rawKeywords;
      if (rawKeywords) {
        lyrics.keywordsText = rawKeywords;
      }
      if (keywords.length) {
        lyrics.keywords = keywords;
      }
    }
    context.lyrics = lyrics;
  }
  const hasSelection = state.selected instanceof Map && state.selected.size > 0;

  if (hasSelection) {
    const typeSet = new Set();
    const categorySet = new Set();
    const requiredMediaTypeSet = new Set();
    const engines = [];
    let requiresMedia = false;
    let requiresPrompt = false;
    let requiresSoundText = false;

    state.selected.forEach((entry, id) => {
      const meta = state.engineIndex.get(id) || entry || {};
      const typeToken = determineEngineTypeKey(meta);
      if (typeToken && typeToken !== 'other') {
        typeSet.add(typeToken);
      }
      const engineCategory = normalizeCategory(meta.category || entry.category || context.activeCategory);
      if (engineCategory) {
        categorySet.add(engineCategory);
      }
      const engineRequiresMedia = meta.requiresMedia === true || entry?.requiresMedia === true;
      if (engineRequiresMedia) {
        requiresMedia = true;
      }
      const requiredMediaTypes = Array.isArray(meta.requiredMediaTypes)
        ? meta.requiredMediaTypes
        : Array.isArray(entry?.requiredMediaTypes)
          ? entry.requiredMediaTypes
          : [];
      requiredMediaTypes.forEach((rawType) => {
        const normalized = normalizeMediaGroupType(rawType) || (typeof rawType === 'string' ? rawType.toLowerCase() : '');
        if (normalized) {
          requiredMediaTypeSet.add(normalized);
        }
      });
      if (engineRequiresPrompt(meta)) {
        requiresPrompt = true;
      }
      if (engineRequiresSoundText(meta, entry)) {
        requiresSoundText = true;
      }
      const promptKey = getPromptKey(meta);
      const soundKeys = Array.isArray(meta.soundTextKeys) && meta.soundTextKeys.length
        ? meta.soundTextKeys
        : (Array.isArray(entry?.soundTextKeys) ? entry.soundTextKeys : []);
      engines.push({
        id,
        label: entry?.label || meta.displayLabel || meta.label || deriveEngineLabel(id),
        type: typeToken,
        category: engineCategory,
        requiresMedia: engineRequiresMedia,
        requiredMediaTypes,
        promptKey,
        soundTextKeys: (soundKeys || []).slice(0, 6)
      });
    });

    context.engineCount = state.selected.size;
    context.engineTypes = Array.from(typeSet);
    context.engineCategories = Array.from(categorySet);
    context.requiresMedia = requiresMedia;
    context.requiresPrompt = requiresPrompt;
    context.requiresSoundText = requiresSoundText;
    context.requiredMediaTypes = Array.from(requiredMediaTypeSet);
    context.engines = engines.slice(0, 8);
  }

  const autoRequired = canShowSoundText ? shouldAutoEnableSoundText() : false;
  const shouldAttachVoiceScript = canShowSoundText
    && (generatorState.soundTextEnabled === true || context.requiresSoundText || autoRequired);
  if (shouldAttachVoiceScript) {
    if (generatorState.soundTextEnabled !== true) {
      generatorState.soundTextEnabled = true;
    }
    const voiceScript = assembleVoiceScriptContext(generatorState);
    voiceScript.enabled = true;
    context.voiceScript = voiceScript;
  }

  if (!context.selectedCategory) {
    context.selectedCategory = defaults.category || '';
  }
  if (!context.selectedType) {
    context.selectedType = defaults.type || '';
  }
  if (context.selectedCategory) {
    context.selectedCategoryLabel = categoryLabel(context.selectedCategory);
  }
  return context;
}

function applyPromptSuggestion(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  if (!entry || !entry.prompt) return;
  state.prompt = entry.prompt;
  const templateData = (entry.template && typeof entry.template === 'object') ? entry.template : null;
  if (templateData && typeof templateData.filePrefix === 'string' && templateData.filePrefix.trim()) {
    setFilePrefix(templateData.filePrefix, { persist: true });
  }
  const soundTextCandidate = (() => {
    if (entry.soundText && typeof entry.soundText === 'string' && entry.soundText.trim()) {
      return entry.soundText.trim();
    }
    if (entry.voiceScript && typeof entry.voiceScript.text === 'string' && entry.voiceScript.text.trim()) {
      return entry.voiceScript.text.trim();
    }
    if (templateData && typeof templateData.soundText === 'string' && templateData.soundText.trim()) {
      return templateData.soundText.trim();
    }
    return '';
  })();
  if (entry.supportsSoundText === true && soundTextCandidate) {
    state.soundText = soundTextCandidate;
    applySoundTextToInputs(state.soundText);
    syncSoundTextField({ preferExisting: false });
  }
  setPromptGeneratorPanelVisible(false);
  updateActiveTemplateOverrides();
  syncPromptPreview();
  updateRunButtonState();
  updatePromptGeneratorControls();
  state.promptGenerator.message = `${entry.label || `案${index + 1}`} をプロンプトに反映しました`;
  state.promptGenerator.error = '';
  schedulePromptGeneratorMessageClear();
}

function addPromptSuggestionToTemplate(index) {
  const suggestions = Array.isArray(state.promptGenerator?.suggestions)
    ? state.promptGenerator.suggestions
    : [];
  const entry = suggestions[index];
  if (!entry || !entry.prompt) return;
  const templateData = (entry.template && typeof entry.template === 'object') ? entry.template : {};
  const translationText = typeof entry.translation === 'string' ? entry.translation.trim() : '';
  const templateMemo = typeof templateData.memo === 'string' ? templateData.memo.trim() : '';
  const descriptionText = typeof entry.description === 'string' ? entry.description.trim() : '';
  const memoFallback = translationText || templateMemo || descriptionText;
  addTemplateFromPrompt({
    prompt: entry.prompt,
    name: templateData.name,
    label: entry.label,
    category: templateData.category,
    type: templateData.type,
    filePrefix: templateData.filePrefix,
    memo: memoFallback,
    soundText: templateData.soundText,
    template: templateData,
    title: '候補からテンプレートを作成'
  });
  setPromptGeneratorPanelVisible(false);
  state.promptGenerator.message = `${entry.label || `案${index + 1}`} をテンプレート追加画面に読み込みました`;
  state.promptGenerator.error = '';
  updatePromptGeneratorStatus();
  schedulePromptGeneratorMessageClear();
}

async function triggerPromptGeneration() {
  if (!state.promptGenerator) return;
  if (state.promptGenerator.loading) return;
  const prompt = (state.prompt || '').trim();
  if (!prompt) {
    state.promptGenerator.error = 'プロンプトを入力してください';
    state.promptGenerator.message = '';
    updatePromptGeneratorStatus();
    return;
  }
  const requestId = (state.promptGenerator.requestId || 0) + 1;
  state.promptGenerator.requestId = requestId;
  state.promptGenerator.loading = true;
  state.promptGenerator.error = '';
  state.promptGenerator.message = '';
  updatePromptGeneratorControls();

  try {
    const generatorState = ensurePromptGeneratorState();
    const variantCount = Math.min(
      Math.max(generatorState.variantCount || PROMPT_GENERATOR_DEFAULT_VARIANTS, 1),
      PROMPT_GENERATOR_MAX_SUGGESTIONS
    );
    if (generatorState.selectedType && generatorState.activeGuidance) {
      const key = getPromptGeneratorGuidanceKey(generatorState.selectedType, generatorState.mode);
      generatorState.guidanceByType[key] = generatorState.activeGuidance;
    }
    const payload = {
      prompt,
      mode: normalizePromptGeneratorMode(state.promptGenerator.mode),
      variantCount,
      context: collectPromptGeneratorContext()
    };
    const response = await fetchJson(PROMPT_GENERATOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const suggestions = Array.isArray(response?.suggestions)
      ? response.suggestions.map((entry, index) => normalizePromptSuggestion(entry, index)).filter(Boolean)
      : [];
    state.promptGenerator.suggestions = suggestions.slice(0, variantCount);
    state.promptGenerator.lastPrompt = prompt;
    state.promptGenerator.lastMode = normalizePromptGeneratorMode(state.promptGenerator.mode);
    if (state.promptGenerator.suggestions.length) {
      state.promptGenerator.message = `${state.promptGenerator.suggestions.length}件の候補を生成しました`;
      state.promptGenerator.error = '';
      renderPromptGeneratorResults();
      updatePromptGeneratorStatus();
      schedulePromptGeneratorMessageClear();
    } else {
      state.promptGenerator.error = '候補を取得できませんでした';
      state.promptGenerator.message = '';
      renderPromptGeneratorResults();
      updatePromptGeneratorStatus();
    }
  } catch (err) {
    console.error('[Showcase] prompt generation failed', err);
    let message = 'プロンプト生成に失敗しました';
    if (err && typeof err.message === 'string') {
      message = err.message;
      const jsonMatch = message.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && typeof parsed.error === 'string') {
            message = parsed.error;
          }
        } catch (parseErr) {
          console.warn('[Showcase] failed to parse prompt generator error payload', parseErr);
        }
      }
    }
    state.promptGenerator.error = message;
    state.promptGenerator.message = '';
    renderPromptGeneratorResults();
    updatePromptGeneratorStatus();
  } finally {
    if (state.promptGenerator.requestId === requestId) {
      state.promptGenerator.loading = false;
    }
    updatePromptGeneratorControls();
  }
}

function handlePromptGeneratorClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const role = target.dataset.role;
  if (role === 'prompt-generator-mode') {
    event.preventDefault();
    setPromptGeneratorMode(target.dataset.mode || PROMPT_GENERATOR_DEFAULT_MODE);
    updatePromptGeneratorControls();
    return;
  }
  const action = target.dataset.action;
  if (!action) return;
  const index = Number(target.dataset.index);
  if (!Number.isFinite(index)) return;
  event.preventDefault();
  if (action === 'apply') {
    applyPromptSuggestion(index);
  } else if (action === 'copy') {
    copyPromptSuggestion(index);
  } else if (action === 'template') {
    addPromptSuggestionToTemplate(index);
  } else if (action === 'copy-lyrics') {
    copyPromptLyrics(index);
  } else if (action === 'copy-sound-text') {
    copyPromptSoundText(index);
  }
}

function syncFilePrefixField() {
  const field = document.getElementById('kc-file-prefix');
  if (!field) return;
  const value = state.filePrefix || '';
  if (field.value !== value) {
    field.value = value;
  }
}

function updateVisibilityToggleButton(button, { active, icon, labelOn, labelOff }) {
  if (!(button instanceof HTMLButtonElement)) return;
  const isActive = Boolean(active);
  button.classList.toggle('is-active', isActive);
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  if (typeof icon === 'string') {
    button.textContent = icon;
  }
  const ariaLabel = isActive
    ? `${labelOn}（ボタンで非表示に切り替え）`
    : `${labelOff}（ボタンで表示に切り替え）`;
  button.setAttribute('aria-label', ariaLabel);
  button.title = ariaLabel;
}

function syncInputToggle() {
  const toggleButton = document.getElementById('kc-results-input-toggle');
  if (!(toggleButton instanceof HTMLButtonElement)) return;
  const showing = state.showInputs !== false;
  updateVisibilityToggleButton(toggleButton, {
    active: showing,
    icon: '📥',
    labelOn: 'INPUTメディアを表示中',
    labelOff: 'INPUTメディアは非表示'
  });
}

function syncParameterToggle() {
  const toggleButton = document.getElementById('kc-results-params-toggle');
  if (!(toggleButton instanceof HTMLButtonElement)) return;
  const showing = state.showParameters !== false;
  updateVisibilityToggleButton(toggleButton, {
    active: showing,
    icon: '⚙️',
    labelOn: 'パラメータを表示中',
    labelOff: 'パラメータは非表示'
  });
}

function syncFailureToggle() {
  const toggleButton = document.getElementById('kc-results-failure-toggle');
  if (!(toggleButton instanceof HTMLButtonElement)) return;
  const showing = Boolean(state.showFailures);
  updateVisibilityToggleButton(toggleButton, {
    active: showing,
    icon: '🚫',
    labelOn: 'Failure結果を表示中',
    labelOff: 'Failure結果は非表示'
  });
}

function setFilePrefix(value, { persist = true, skipTemplateOverride = false } = {}) {
  const next = typeof value === 'string' ? value.trim() : '';
  state.filePrefix = next;
  syncFilePrefixField();
  if (!skipTemplateOverride) {
    updateActiveTemplateOverrides();
  }
  if (persist) {
    preferenceStorage.writeString(FILE_PREFIX_STORAGE_KEY, next, {
      label: 'failed to persist file prefix'
    });
  }
}

function attachPromptResizeHandlers(field) {
  if (!field || field.dataset.resizeHandlersAttached === 'true') return;
  let startHeight = null;

  const handlePointerDown = () => {
    startHeight = field.offsetHeight;
  };

  const handlePointerUp = () => {
    if (startHeight !== null) {
      const diff = Math.abs(field.offsetHeight - startHeight);
      if (diff > 1) {
        field.dataset.manualResize = 'true';
      }
      startHeight = null;
    }
  };

  const handleMouseDown = handlePointerDown;
  const handleMouseUp = handlePointerUp;

  const resetToAuto = () => {
    delete field.dataset.manualResize;
    adjustPromptFieldHeight(field, { force: true });
  };

  field.addEventListener('pointerdown', handlePointerDown);
  field.addEventListener('pointerup', handlePointerUp);
  field.addEventListener('pointerleave', () => {
    startHeight = null;
  });
  field.addEventListener('mousedown', handleMouseDown);
  field.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('pointerup', handlePointerUp, true);
  window.addEventListener('mouseup', handleMouseUp, true);
  field.addEventListener('dblclick', resetToAuto);

  if (typeof ResizeObserver !== 'undefined' && !field.__kcResizeObserver) {
    try {
      if (!field.dataset.lastObservedHeight) {
        field.dataset.lastObservedHeight = String(field.offsetHeight || field.scrollHeight || PROMPT_MIN_HEIGHT);
      }
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          if (field.dataset.autoResizing === 'true') return;
          if (!entry || !entry.contentRect) return;
          const height = entry.contentRect.height;
          if (!Number.isFinite(height)) return;
          const previous = Number(field.dataset.lastObservedHeight || 0);
          field.dataset.lastObservedHeight = String(height);
          if (Math.abs(height - previous) < 1) return;
          field.dataset.manualResize = 'true';
        });
      });
      observer.observe(field);
      field.__kcResizeObserver = observer;
      field.dataset.resizeObserverAttached = 'true';
    } catch (err) {
      console.warn('[Showcase] failed to attach prompt ResizeObserver', err);
    }
  }

  field.dataset.resizeHandlersAttached = 'true';
}

function getEngineCountForCategory(categoryId) {
  const normalized = normalizeCategory(categoryId);
  if (normalized === ALL_CATEGORY_ID) {
    if (state.engineIndex instanceof Map && state.engineIndex.size > 0) {
      return state.engineIndex.size;
    }
    const aggregated = state.enginesByCategory.get(ALL_CATEGORY_ID);
    if (Array.isArray(aggregated)) {
      return aggregated.length;
    }
    let total = 0;
    state.enginesByCategory.forEach((list, key) => {
      if (key === ALL_CATEGORY_ID) return;
      if (Array.isArray(list)) total += list.length;
    });
    return total;
  }
  if (state.engineIndex instanceof Map && state.engineIndex.size > 0) {
    let count = 0;
    state.engineIndex.forEach((meta) => {
      const metaCategory = normalizeCategory(meta?.category || meta?.sourceCategory || '');
      if (metaCategory === normalized) {
        count += 1;
      }
    });
    return count;
  }
  const payload = state.enginesByCategory.get(normalized);
  if (Array.isArray(payload)) {
    return payload.length;
  }
  return 0;
}

function renderEngineTabs() {
  const container = document.getElementById('kc-engine-tabs');
  if (!container) return;
  container.innerHTML = '';
  if (!state.categories.length) {
    updateEngineTabVisibility();
    return;
  }
  const tabs = [{ id: ALL_CATEGORY_ID, label: ALL_CATEGORY_LABEL }, ...state.categories];
  tabs.forEach((category) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'kc-panel-tab';
    const isActive = category.id === state.activeEngineCategory;
    applyBadgeTheme(tab, category.id, { fallbackCategory: category.id });
    if (isActive) {
      tab.classList.add('is-active');
    }
    const labelText = String(category.label || categoryLabel(category.id)).toUpperCase();
    const countValue = getEngineCountForCategory(category.id);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'kc-panel-tab__label';
    labelSpan.textContent = labelText;
    tab.append(labelSpan);
    if (Number.isFinite(countValue)) {
      const countSpan = document.createElement('span');
      countSpan.className = 'kc-panel-tab__count';
      countSpan.textContent = countValue.toLocaleString('ja-JP');
      tab.append(countSpan);
    }
    tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    if (Number.isFinite(countValue)) {
      tab.setAttribute('aria-label', `${labelText} (${countValue.toLocaleString('ja-JP')} MCP)`);
    } else {
      tab.setAttribute('aria-label', labelText);
    }
    tab.addEventListener('click', () => {
      if (state.activeEngineCategory !== category.id) {
        setActiveEngineCategory(category.id);
      }
    });
    container.append(tab);
  });
  updateEngineTabVisibility();
}

function renderEngineSubTabs() {
  const container = document.getElementById('kc-engine-subtabs');
  if (!container) return;
  container.innerHTML = '';
  const activeCategory = state.activeEngineCategory;
  ensureCategoryCollections(activeCategory);
  if (!state.categoryTabs[activeCategory]) {
    state.categoryTabs[activeCategory] = 'engine';
  }

  const subtabs = [
    { id: 'engine', label: 'MCP' },
    { id: 'media', label: 'INPUT' }
  ];

  subtabs.forEach((info) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'kc-panel-tab kc-panel-tab--sub';
    if (info.id === 'media') {
      tab.classList.add('kc-panel-tab--input');
    } else if (info.id === 'engine') {
      tab.classList.add('kc-panel-tab--mcp');
    }
    tab.setAttribute('data-tab-id', info.id);
    if (state.categoryTabs[activeCategory] === info.id) {
      tab.classList.add('is-active');
    }
    tab.textContent = info.label;
    tab.addEventListener('click', () => {
      if (state.categoryTabs[activeCategory] === info.id) return;
      state.categoryTabs[activeCategory] = info.id;
      if (info.id === 'media' && state.media.items.length === 0 && !state.media.isLoading) {
        loadMediaLibrary({ fetchJson, onStateChange: renderCategories })
          .catch((err) => console.error('[Showcase] media load failed', err));
      } else {
        renderCategories();
      }
      renderEngineSubTabs();
      closeTemplateMenu();
      closeTemplateModal();
      updateRunButtonState();
    });
    container.append(tab);
  });
  updateEngineTabVisibility();
}

function updateEngineTabVisibility() {
  const mainTabs = document.getElementById('kc-engine-tabs');
  const subTabs = document.getElementById('kc-engine-subtabs');
  const controls = mainTabs?.parentElement;
  const showMain = Boolean(mainTabs && state.categories.length > 1);
  const showSub = Boolean(subTabs && subTabs.children && subTabs.children.length);
  if (mainTabs) {
    mainTabs.style.display = showMain ? 'inline-flex' : 'none';
    mainTabs.classList.toggle('kc-panel-tabs--hidden', !showMain);
  }
  if (subTabs) {
    subTabs.style.display = showSub ? 'inline-flex' : 'none';
  }
  if (controls) {
    if (controls.classList.contains('kc-engine-toolbar')) {
      controls.classList.toggle('kc-engine-toolbar--tabs-hidden', !showMain);
    } else {
      controls.style.display = (showMain || showSub) ? 'flex' : 'none';
    }
  }
}

function createEngineSearchControls() {
  const controls = document.createElement('div');
  controls.className = 'kc-engine-controls kc-engine-controls--toolbar';
  controls.setAttribute('role', 'search');

  const searchWrap = document.createElement('div');
  searchWrap.className = 'kc-engine-search irs-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'MCPを検索';
  searchInput.setAttribute('aria-label', 'MCPを検索');
  searchInput.id = 'kc-engine-search-input';
  searchInput.autocomplete = 'off';
  searchInput.value = state.engineSearchKeyword;
  searchInput.addEventListener('input', () => {
    const { selectionStart, selectionEnd } = searchInput;
    state.engineSearchKeyword = searchInput.value;
    renderCategories();
    requestAnimationFrame(() => {
      const nextInput = document.getElementById('kc-engine-search-input');
      if (!nextInput) return;
      nextInput.focus();
      if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
        try {
          nextInput.setSelectionRange(selectionStart, selectionEnd);
        } catch (err) {
          try {
            const length = nextInput.value.length;
            nextInput.setSelectionRange(length, length);
          } catch (innerErr) {
            // ignore selection fallback errors
          }
        }
      }
    });
  });
  searchWrap.appendChild(searchInput);
  controls.append(searchWrap);
  return controls;
}

function selectEnginesInCategory(categoryId) {
  const list = getEnginesInCategory(categoryId);
  if (!list.length) return false;
  let changed = false;
  list.forEach((engine) => {
    if (!engine || !engine.id) return;
    if (state.selected.has(engine.id)) return;
    ensureEngineInputs(engine);
    state.selected.set(engine.id, {
      id: engine.id,
      label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
      category: engine.category || normalizeCategory(categoryId),
      requiresMedia: Boolean(engine.requiresMedia),
      requiredMediaTypes: Array.isArray(engine.requiredMediaTypes)
        ? engine.requiredMediaTypes.slice()
        : [],
      requiresPrompt: engineRequiresPrompt(engine),
      requiresSoundText: engineRequiresSoundText(engine),
      promptKey: engine.promptKey || getPromptKey(engine),
      soundTextKeys: Array.isArray(engine.soundTextKeys) ? engine.soundTextKeys.slice() : [],
      requiredSoundTextKeys: Array.isArray(engine.requiredSoundTextKeys)
        ? engine.requiredSoundTextKeys.slice()
        : [],
      docSummaryEn: engine.docSummaryEn || '',
      docSummaryJa: engine.docSummaryJa || ''
    });
    changed = true;
  });
  if (changed) {
    applySelectedMediaToEngineInputs();
  }
  return changed;
}

function normalizeEngineTypeFilterValue(value) {
  if (value === undefined || value === null) return '';
  const token = String(value).trim().toLowerCase();
  if (!token || token === 'all') return '';
  if (token === 'other') return 'other';
  return normalizeTypeToken(token) || '';
}

function sanitizeEngineTypeFilterValues(values, categoryId) {
  const normalizedCategory = normalizeCategory(categoryId);
  const allowed = new Set(knownTypesForCategory(normalizedCategory));
  const source = values instanceof Set
    ? values
    : (Array.isArray(values) ? new Set(values) : new Set(values ? [values] : []));
  const result = new Set();
  source.forEach((value) => {
    const normalized = normalizeEngineTypeFilterValue(value);
    if (!normalized) return;
    if (normalized !== 'other' && !allowed.has(normalized)) return;
    result.add(normalized);
  });
  return result;
}

function areSetsEqual(left, right) {
  if (left === right) return true;
  if (!(left instanceof Set) || !(right instanceof Set)) return false;
  if (left.size !== right.size) return false;
  for (const entry of left) {
    if (!right.has(entry)) return false;
  }
  return true;
}

function getEngineTypeFilterSet(categoryId = state.activeEngineCategory) {
  const normalizedCategory = normalizeCategory(categoryId);
  const storage = state.engineTypeFilters;
  let rawValues = null;
  if (storage instanceof Map) {
    rawValues = storage.get(normalizedCategory) || null;
  } else if (storage && typeof storage === 'object' && Object.prototype.hasOwnProperty.call(storage, normalizedCategory)) {
    const candidate = storage[normalizedCategory];
    if (candidate instanceof Set) {
      rawValues = candidate;
    } else if (Array.isArray(candidate)) {
      rawValues = candidate;
    }
  }
  const sanitized = sanitizeEngineTypeFilterValues(rawValues, normalizedCategory);
  if (storage instanceof Map) {
    const previous = storage.get(normalizedCategory);
    if (!sanitized.size) {
      if (previous) storage.delete(normalizedCategory);
    } else if (!areSetsEqual(previous, sanitized)) {
      storage.set(normalizedCategory, sanitized);
    }
  } else {
    if (!state.engineTypeFilters || typeof state.engineTypeFilters !== 'object') {
      state.engineTypeFilters = {};
    }
    if (sanitized.size) {
      state.engineTypeFilters[normalizedCategory] = Array.from(sanitized);
    } else {
      delete state.engineTypeFilters[normalizedCategory];
    }
  }
  return sanitized;
}

function setEngineTypeFilterSet(categoryId, nextValues) {
  const normalizedCategory = normalizeCategory(categoryId);
  const sanitized = sanitizeEngineTypeFilterValues(nextValues, normalizedCategory);
  const storage = state.engineTypeFilters;
  if (storage instanceof Map) {
    const previous = storage.get(normalizedCategory);
    if (!sanitized.size) {
      if (!previous || previous.size === 0) return false;
      storage.delete(normalizedCategory);
      return true;
    }
    if (areSetsEqual(previous, sanitized)) return false;
    storage.set(normalizedCategory, sanitized);
    return true;
  }
  if (!state.engineTypeFilters || typeof state.engineTypeFilters !== 'object') {
    state.engineTypeFilters = {};
  }
  const previous = state.engineTypeFilters[normalizedCategory];
  if (!sanitized.size) {
    if (!previous || (Array.isArray(previous) && previous.length === 0)) return false;
    delete state.engineTypeFilters[normalizedCategory];
    return true;
  }
  const nextArray = Array.from(sanitized);
  if (Array.isArray(previous)
    && previous.length === nextArray.length
    && previous.every((item) => nextArray.includes(item))) {
    return false;
  }
  state.engineTypeFilters[normalizedCategory] = nextArray;
  return true;
}

function toggleEngineTypeFilter(typeKey, categoryId = state.activeEngineCategory) {
  const normalizedCategory = normalizeCategory(categoryId);
  const normalizedKey = normalizeEngineTypeFilterValue(typeKey);
  if (!normalizedKey) return false;
  const allowed = new Set(knownTypesForCategory(normalizedCategory));
  if (normalizedKey !== 'other' && !allowed.has(normalizedKey)) {
    return false;
  }
  const current = getEngineTypeFilterSet(normalizedCategory);
  if (current.has(normalizedKey)) {
    current.delete(normalizedKey);
  } else {
    current.add(normalizedKey);
  }
  return setEngineTypeFilterSet(normalizedCategory, current);
}

function clearEngineTypeFilters(categoryId = state.activeEngineCategory) {
  return setEngineTypeFilterSet(categoryId, new Set());
}

function rerenderCategoriesPreservingScroll() {
  const enginesContainer = document.getElementById('kc-engines');
  const previousScrollTop = enginesContainer ? enginesContainer.scrollTop : 0;
  renderCategories();
  if (enginesContainer) {
    requestAnimationFrame(() => {
      enginesContainer.scrollTop = previousScrollTop;
    });
  }
}

function renderEngineStats({
  isLoading = false,
  engines = [],
  filteredEngines = null,
  visibleEngines = null,
  categoryId = state.activeEngineCategory,
  searchKeyword = state.engineSearchKeyword,
  visible = true
} = {}) {
  const container = document.getElementById('kc-engine-stats');
  if (!container) return;

  container.innerHTML = '';
  container.style.display = visible ? 'flex' : 'none';
  if (!visible) {
    return;
  }
  container.classList.add('kc-engine-stats--enhanced');

  const statsWrap = document.createElement('div');
  statsWrap.className = 'kc-engine-stats__tags';
  container.append(statsWrap);

  if (isLoading) {
    const loading = document.createElement('span');
    loading.className = 'kc-engine-stats__loading';
    loading.textContent = 'MCP一覧を更新中...';
    statsWrap.append(loading);
    return;
  }

  const baseList = Array.isArray(engines) ? engines : [];
  const labelHost = document.getElementById('kc-engine-toolbar-label');
  const applyToolbarCount = (total, visible, filtersActive) => {
    if (!labelHost) return;
    labelHost.textContent = 'MCP';
    labelHost.removeAttribute('aria-label');
    if (!Number.isFinite(total)) return;
    const badge = document.createElement('span');
    badge.className = 'kc-engine-toolbar__count';
    const totalLabel = total.toLocaleString('ja-JP');
    const visibleLabel = Number.isFinite(visible) ? visible.toLocaleString('ja-JP') : totalLabel;
    badge.textContent = filtersActive && Number.isFinite(visible)
      ? `${visibleLabel}/${totalLabel}`
      : totalLabel;
    labelHost.appendChild(badge);
    const ariaParts = ['MCP'];
    const summaryText = filtersActive && Number.isFinite(visible)
      ? `表示中 ${visibleLabel} 件 / 全 ${totalLabel} 件`
      : `全 ${totalLabel} 件`;
    ariaParts.push(summaryText);
    const ariaLabel = ariaParts.join(' ');
    labelHost.setAttribute('aria-label', ariaLabel);
    labelHost.title = summaryText;
  };

  const totalCount = baseList.length;

  if (!baseList.length) {
    applyToolbarCount(totalCount, 0, false);
    const empty = document.createElement('span');
    empty.className = 'kc-engine-stat__total';
    empty.textContent = 'MCP数: 0';
    statsWrap.append(empty);
    return;
  }
  statsWrap.innerHTML = '';

  const displayList = Array.isArray(filteredEngines)
    ? filteredEngines
    : baseList;

  const normalizedCategory = normalizeCategory(categoryId);
  const activeTypeFilters = getEngineTypeFilterSet(normalizedCategory);
  const hasActiveTypeFilters = activeTypeFilters.size > 0;
  const visibleList = Array.isArray(visibleEngines) ? visibleEngines : displayList;
  const visibleCount = visibleList.length;
  applyToolbarCount(totalCount, visibleCount, hasActiveTypeFilters);

  const allowedTypes = new Set(knownTypesForCategory(normalizedCategory));
  const counts = new Map();

  displayList.forEach((engine) => {
    const key = determineEngineTypeKey(engine, allowedTypes);
    const normalizedKey = normalizeEngineTypeFilterValue(key) || 'other';
    const isSelected = engine && state.selected.has(engine.id);
    const entry = counts.get(normalizedKey);
    if (entry) {
      entry.count += 1;
      if (isSelected) entry.selected += 1;
    } else {
      counts.set(normalizedKey, {
        key: normalizedKey,
        label: normalizedKey === 'other' ? 'OTHER' : normalizedKey.toUpperCase(),
        count: 1,
        selected: isSelected ? 1 : 0
      });
    }
  });

  if (hasActiveTypeFilters) {
    activeTypeFilters.forEach((token) => {
      if (!counts.has(token)) {
        counts.set(token, {
          key: token,
          label: token === 'other' ? 'OTHER' : token.toUpperCase(),
          count: 0,
          selected: 0
        });
      }
    });
  }

  if (!counts.size) {
    const empty = document.createElement('span');
    empty.className = 'kc-engine-stat__total';
    empty.textContent = hasActiveTypeFilters
      ? `表示中：${visibleCount.toLocaleString('ja-JP')}件`
      : 'タイプ統計なし';
    statsWrap.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    Array.from(counts.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((bucket) => {
        const tag = document.createElement('span');
        tag.className = 'kc-engine-stat__tag';
        const isFiltered = activeTypeFilters.has(bucket.key);
        const hasSelectionInType = bucket.selected > 0;
        tag.classList.toggle('is-active', isFiltered);
        tag.classList.toggle('has-selection', hasSelectionInType);
        tag.setAttribute('role', 'button');
        tag.setAttribute('tabindex', '0');
        tag.setAttribute('aria-pressed', isFiltered ? 'true' : 'false');

        if (isFiltered || hasSelectionInType) {
          applyBadgeTheme(tag, bucket.key, { fallbackCategory: normalizedCategory });
          tag.classList.add('kc-engine-stat__tag--themed');
        } else {
          clearBadgeTheme(tag);
          tag.classList.remove('kc-engine-stat__tag--themed');
        }

        const label = document.createElement('span');
        label.className = 'kc-engine-stat__label';
        label.textContent = bucket.label;

        const value = document.createElement('span');
        value.className = 'kc-engine-stat__value kc-engine-stat__value--accent';
        value.textContent = bucket.count.toLocaleString('ja-JP');

        tag.append(label, value);

        const summaryParts = [`${bucket.label}: ${bucket.count}件`];
        if (bucket.selected > 0) {
          summaryParts.push(`選択中: ${bucket.selected}件`);
        }
        if (isFiltered) {
          summaryParts.push('フィルタ適用中');
        }
        tag.setAttribute('aria-label', summaryParts.join(' / '));
        tag.title = isFiltered
          ? `${bucket.label}タイプのフィルタを解除`
          : `${bucket.label}タイプでフィルタ`;

        const handleToggle = (evt) => {
          evt.preventDefault();
          if (!toggleEngineTypeFilter(bucket.key, normalizedCategory)) return;
          rerenderCategoriesPreservingScroll();
        };
        tag.addEventListener('click', handleToggle);
        tag.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            handleToggle(evt);
          }
        });
        fragment.append(tag);
      });
    statsWrap.append(fragment);
  }
}

function renderSelectionSummary() {
  const root = document.getElementById('kc-selection-summary');
  const mcpContainer = document.getElementById('kc-selected-mcp');
  const mediaContainer = document.getElementById('kc-selected-media');
  const metrics = document.getElementById('kc-selection-metrics');
  const mcpActions = document.getElementById('kc-selected-mcp-actions');
  const mediaActions = document.getElementById('kc-selected-media-actions');
  if (!root || !mcpContainer || !mediaContainer) return;

  mcpContainer.innerHTML = '';
  mediaContainer.innerHTML = '';
  if (mcpActions) mcpActions.innerHTML = '';
  if (mediaActions) mediaActions.innerHTML = '';

  const selectedEngines = Array.from(state.selected.values());
  const mediaList = getSelectedMediaList();

  syncSoundTextField();

  if (metrics) {
    const selectedLabel = selectedEngines.length.toLocaleString('ja-JP');
    metrics.innerHTML = `<span class="kc-selection-summary__metrics-current">選択中のMCP <strong>${selectedLabel}</strong></span>`;
    metrics.setAttribute('aria-label', `選択中のMCP ${selectedLabel} 件`);
  }

  const buildActionButton = (label, title, handler, disabled = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kc-selection-summary__action';
    btn.textContent = label;
    if (title) btn.title = title;
    btn.disabled = disabled;
    if (!disabled) {
      btn.addEventListener('click', (evt) => {
        evt.preventDefault();
        handler();
      });
    }
    return btn;
  };

  if (mcpActions) {
    const hasSelection = selectedEngines.length > 0;
    const clearBtn = buildActionButton(
      '全解除',
      '選択中のMCPを全て解除',
      () => clearAllSelections(),
      !hasSelection
    );
    mcpActions.append(clearBtn);
  }

  if (selectedEngines.length) {
    const list = document.createElement('div');
    list.className = 'kc-selection-mcp-list';

    selectedEngines.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'kc-selection-mcp-item';
      item.textContent = entry.displayLabel || entry.label || deriveEngineLabel(entry.id) || entry.id || '-';
      list.append(item);
    });

    mcpContainer.append(list);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'kc-selection-placeholder';
    placeholder.textContent = '未選択';
    mcpContainer.append(placeholder);
  }

  const groupedMedia = groupMediaEntriesByType(mediaList);
  const orderByPath = new Map();
  const orderByUrl = new Map();
  const slotDefinitions = computeMediaSlotDefinitions(selectedEngines);
  const slotAssignmentsData = getMediaSlotAssignments(slotDefinitions);
  const activeSlotId = resolveActiveMediaSlot(slotDefinitions, slotAssignmentsData.assignments);
  const typeOrder = MEDIA_SELECTION_TYPE_ORDER;
  const groupsRoot = document.createElement('div');
  groupsRoot.className = 'kc-selection-media-groups';
  let groupsRendered = 0;

  const hasSoraSelected = selectedEngines.some((entry) => entry.id === SORA_ENGINE_ID);
  if (mediaActions) {
    if (hasSoraSelected) {
      renderSoraControls(mediaActions, groupedMedia);
    } else {
      const soraState = getSoraState();
      soraState.mode = 't2v';
      soraState.remixEligible = false;
    }
  }

  const createTile = (item, order, typeLabel, globalIndex) => {
    const tile = document.createElement('div');
    tile.className = 'kc-selection-media-tile';
    tile.setAttribute('role', 'listitem');

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'kc-selection-media-thumb';
    thumbWrap.dataset.type = typeLabel;
    const orderBadge = document.createElement('span');
    orderBadge.className = 'kc-selection-media-order';
    orderBadge.classList.add(`kc-selection-media-order--${typeLabel}`);
    orderBadge.textContent = String(order);
    orderBadge.setAttribute('aria-label', `${(MEDIA_TYPE_DISPLAY[typeLabel]?.label || typeLabel).toUpperCase()} #${order}`);

    const appendVideoPreview = (video) => {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.autoplay = false;
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.addEventListener('loadeddata', () => {
        try {
          video.currentTime = 0;
          video.pause();
        } catch (err) {
          // ignore seek errors
        }
      });
      thumbWrap.append(video);
    };

    if (item.filterType === 'video' && item.url) {
      const video = document.createElement('video');
      applyAssetSrcWithFallback(video, item.url, { type: 'video' });
      if (item.thumbUrl) {
        video.poster = item.thumbUrl;
      }
      appendVideoPreview(video);
    } else if (item.thumbUrl) {
      const img = document.createElement('img');
      applyAssetSrcWithFallback(img, item.thumbUrl);
      img.alt = item.name || item.path;
      thumbWrap.append(img);
    } else if (item.url && item.filterType === 'image') {
      const img = document.createElement('img');
      applyAssetSrcWithFallback(img, item.url);
      img.alt = item.name || item.path;
      img.loading = 'lazy';
      thumbWrap.append(img);
    } else {
      const badge = document.createElement('span');
      badge.className = 'kc-selection-media-ext';
      badge.textContent = (item.ext || item.filterType || '').toUpperCase() || '?';
      thumbWrap.append(badge);
    }

    thumbWrap.append(orderBadge);

    const identifier = item.path || item.url || `${typeLabel}-${order}`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'kc-selection-media-remove';
    removeBtn.setAttribute('aria-label', `${item.name || item.path || '選択中のメディア'}を解除`);
    removeBtn.title = 'このメディアを解除';
    removeBtn.innerHTML = '<span aria-hidden="true">×</span>';
    removeBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      removeSelectedMediaEntry(item, globalIndex, identifier);
    });
    thumbWrap.append(removeBtn);

    tile.dataset.mediaType = typeLabel;
    tile.append(thumbWrap);

    const name = document.createElement('span');
    name.className = 'kc-selection-media-name';
    name.textContent = item.name || item.path || `メディア${order}`;
    tile.append(name);

    return tile;
  };

  typeOrder.forEach((type) => {
    const items = groupedMedia.get(type) || [];
    const slots = slotDefinitions.get(type) || [];
    const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
    const useSlotLayout = shouldUseMediaSlotLayout(type, slots);
    const paramMeta = collectMediaParameterMetaForType(selectedEngines, type);
    const extras = slotAssignmentsData.extrasByType.get(type) || [];

    if (!useSlotLayout && !items.length && !paramMeta.length) {
      return;
    }
    if (useSlotLayout && !slots.length && !items.length && !paramMeta.length) {
      return;
    }

    const group = document.createElement('section');
    group.className = 'kc-selection-media-group';

    const header = document.createElement('div');
    header.className = 'kc-selection-media-group__header';

    const title = document.createElement('span');
    title.className = 'kc-selection-media-group__title';
    title.textContent = baseLabel;
    header.append(title);

    if (paramMeta.length) {
      const paramsWrap = document.createElement('div');
      paramsWrap.className = 'kc-selection-media-group__params';
      paramMeta.sort((a, b) => a.key.localeCompare(b.key));
      paramMeta.forEach((param) => {
        const badge = document.createElement('span');
        badge.className = 'kc-selection-media-param';
        badge.textContent = param.key;
        if (param.required) {
          badge.classList.add('is-required');
          badge.setAttribute('title', `${param.key} は必須入力です`);
        }
        paramsWrap.append(badge);
      });
      header.append(paramsWrap);
    }

    group.append(header);

    let orderCounter = 0;

    if (useSlotLayout) {
      const slotsContainer = document.createElement('div');
      slotsContainer.className = 'kc-selection-media-slots';
      slots.forEach((slot) => {
        const entry = slotAssignmentsData.assignments.get(slot.slotId);
        const shouldRenderSlot = slot?.visible !== false || entry;
        if (!shouldRenderSlot) {
          return;
        }

        const slotElement = document.createElement('div');
        slotElement.className = 'kc-selection-media-slot';
        if (slot?.visible === false) {
          slotElement.classList.add('kc-selection-media-slot--additional');
        }
        slotElement.dataset.slotId = slot.slotId;
        slotElement.setAttribute('role', 'button');
        slotElement.setAttribute('tabindex', '0');
        const isActive = activeSlotId === slot.slotId;
        slotElement.classList.toggle('is-active', isActive);
        slotElement.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        const slotLabel = document.createElement('div');
        slotLabel.className = 'kc-selection-media-slot__label';
        const fallbackLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
        const baseLabel = typeof slot.label === 'string' && slot.label.trim()
          ? slot.label
          : fallbackLabel;
        const labelText = slot?.visible === false
          ? `${fallbackLabel} (追加)`
          : baseLabel;
        slotLabel.textContent = labelText;
        if (slot.required) {
          const badge = document.createElement('span');
          badge.className = 'kc-selection-media-slot__badge';
          badge.textContent = '必須';
          slotLabel.append(badge);
        }
        slotElement.append(slotLabel);

        const slotBody = document.createElement('div');
        slotBody.className = 'kc-selection-media-slot__body';
        if (entry) {
          const globalIndex = mediaList.indexOf(entry);
          orderCounter += 1;
          assignMediaOrderLookup(entry, type, orderCounter, orderByPath, orderByUrl);
          const tile = createTile(entry, orderCounter, type, globalIndex);
          slotBody.append(tile);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'kc-selection-placeholder kc-selection-placeholder--slot';
          placeholder.textContent = '未選択';
          slotBody.append(placeholder);
        }
        slotElement.append(slotBody);

        const activateSlot = () => {
          if (state.media.activeSlot !== slot.slotId) {
            state.media.activeSlot = slot.slotId;
            renderSelectionSummary();
          }
        };

        slotElement.addEventListener('click', (evt) => {
          if (evt.target.closest('.kc-selection-media-remove')) return;
          activateSlot();
        });
        slotElement.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            activateSlot();
          }
        });

        slotsContainer.append(slotElement);
      });

      group.append(slotsContainer);

      if (extras.length) {
        const extrasTrack = document.createElement('div');
        extrasTrack.className = 'kc-selection-media-track kc-selection-media-track--extras';
        extrasTrack.setAttribute('role', 'list');
        extras.forEach((item) => {
          const globalIndex = mediaList.indexOf(item);
          orderCounter += 1;
          assignMediaOrderLookup(item, type, orderCounter, orderByPath, orderByUrl);
          const tile = createTile(item, orderCounter, type, globalIndex);
          extrasTrack.append(tile);
        });
        group.append(extrasTrack);
      }
    } else if (items.length) {
      const track = document.createElement('div');
      track.className = 'kc-selection-media-track';
      track.setAttribute('role', 'list');
      items.forEach((item, index) => {
        const globalIndex = mediaList.indexOf(item);
        orderCounter += 1;
        assignMediaOrderLookup(item, type, orderCounter, orderByPath, orderByUrl);
        const tile = createTile(item, orderCounter, type, globalIndex);
        track.append(tile);
      });
      group.append(track);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'kc-selection-placeholder kc-selection-placeholder--inline';
      placeholder.textContent = '未選択';
      group.append(placeholder);
    }

    groupsRoot.append(group);
    groupsRendered += 1;
  });

  state.media.orderByPath = orderByPath;
  state.media.orderByUrl = orderByUrl;

  if (groupsRendered > 0) {
    mediaContainer.append(groupsRoot);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'kc-selection-placeholder';
    placeholder.textContent = '未選択';
    mediaContainer.append(placeholder);
  }

  if (mediaActions) {
    const hasSelection = mediaList.length > 0;
    const clearBtn = buildActionButton(
      '全解除',
      '選択中のメディアを全て解除',
      () => clearAllMediaSelections(),
      !hasSelection
    );
    mediaActions.append(clearBtn);
  }

  const hasAnySelection = selectedEngines.length > 0 || mediaList.length > 0;
  root.classList.toggle('is-empty', !hasAnySelection);

  refreshPromptGeneratorDefaults();
  updatePromptGeneratorControls();
  scheduleShowcaseLayoutSync();
}


function setActiveEngineCategory(category, options = {}) {
  const { skipHistorySync = false, skipEngineLoad = false } = options;
  const cat = normalizeCategory(category);
  const changed = state.activeEngineCategory !== cat;
  state.activeEngineCategory = cat;
  ensureCategoryCollections(cat);
  if (changed) {
    closeTemplateMenu();
    closeTemplateModal();
    closePromptModal();
  }
  renderEngineTabs();
  renderEngineSubTabs();
  renderCategories();
  updateRunButtonState();
  if (!skipEngineLoad && !isAllCategory(cat) && !state.enginesByCategory.has(cat)) {
    loadEnginesForCategory(cat);
  }
  if (state.categoryTabs[cat] === 'media'
    && state.media.items.length === 0
    && !state.media.isLoading) {
    loadMediaLibrary({ fetchJson, onStateChange: renderCategories })
      .catch((err) => console.error('[Showcase] media load failed', err));
  }
  if (changed) {
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) renderResults(resultsContainer);
  }
  if (!skipHistorySync) {
    renderHistory();
  }
}

function getEntryOrderValue(entry, normalizedCategory, orderMap) {
  if (!entry) return Number.MAX_SAFE_INTEGER;
  if (Number.isFinite(entry.displayOrder)) return entry.displayOrder;
  const engineId = entry.engineId;
  if (engineId && orderMap && orderMap.has(engineId)) {
    const order = orderMap.get(engineId);
    entry.displayOrder = order;
    return order;
  }
  if (engineId && state.engineDisplayOrder instanceof Map && state.engineDisplayOrder.has(engineId)) {
    const meta = state.engineDisplayOrder.get(engineId);
    if (meta && typeof meta.order === 'number') {
      entry.displayOrder = meta.order;
      return meta.order;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

function compareResultEntries(left, right, normalizedCategory, orderMap) {
  const leftOrder = getEntryOrderValue(left, normalizedCategory, orderMap);
  const rightOrder = getEntryOrderValue(right, normalizedCategory, orderMap);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  const leftLabel = (formatEngineLabel(left) || '').toLowerCase();
  const rightLabel = (formatEngineLabel(right) || '').toLowerCase();
  if (leftLabel !== rightLabel) return leftLabel.localeCompare(rightLabel);
  const leftTimestamp = normalizeFileTimestamp(left?.timestamp);
  const rightTimestamp = normalizeFileTimestamp(right?.timestamp);
  if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;
  return 0;
}

function sortEntriesInPlace(entries, normalizedCategory, orderMap) {
  if (!Array.isArray(entries) || entries.length <= 1) {
    return entries;
  }
  const effectiveMap = orderMap || createDisplayOrderMap(normalizedCategory);
  entries.sort((left, right) => compareResultEntries(left, right, normalizedCategory, effectiveMap));
  return entries;
}

function sortResultsForDisplay(results, categoryId) {
  if (!Array.isArray(results) || results.length <= 1) {
    return Array.isArray(results) ? results.slice() : [];
  }
  const normalized = normalizeCategory(categoryId);
  const cloned = results.slice();
  sortEntriesInPlace(cloned, normalized, createDisplayOrderMap(normalized));
  return cloned;
}

function getCurrentResults() {
  const activeEntry = getActiveHistoryEntry();
  const categoryId = normalizeCategory(activeEntry?.category || state.activeCategory);
  if (activeEntry && Array.isArray(activeEntry.results)) {
    return sortResultsForDisplay(activeEntry.results, categoryId);
  }
  const fallback = normalizeCategory(state.activeCategory);
  const results = state.resultsByCategory[fallback] || [];
  return sortResultsForDisplay(results, fallback);
}

function splitResultsByFailure(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const visible = [];
  let failureCount = 0;
  list.forEach((entry) => {
    if (entry && entry.error) {
      failureCount += 1;
      if (state.showFailures) {
        visible.push(entry);
      }
      return;
    }
    visible.push(entry);
  });
  return {
    visible,
    hidden: state.showFailures ? 0 : failureCount,
    failureCount,
    total: list.length
  };
}

function formatEngineLabel(entry) {
  if (!entry) return '-';
  const rawId = entry.engineId || '';
  const rawLabel = entry.label || '';
  const fromId = deriveEngineLabel(rawId, rawLabel);
  if (fromId && fromId !== rawId) return fromId;
  const fromLabel = deriveEngineLabel(rawLabel, rawLabel);
  if (fromLabel && fromLabel !== rawLabel) return fromLabel;
  return (rawLabel || rawId || '-').toLowerCase();
}

function collectResultTypes(entry) {
  if (!entry) return [];
  const tokens = new Set();
  const addToken = (token) => {
    const normalized = normalizeTypeToken(token);
    if (normalized) tokens.add(normalized);
  };
  addToken(entry.type);
  addToken(entry.sourceCategory);
  if (Array.isArray(entry.typePrefixes)) {
    entry.typePrefixes.forEach(addToken);
  }
  if (Array.isArray(entry.sourceCategories)) {
    entry.sourceCategories.forEach(addToken);
  }
  addToken(extractEnginePrefix(entry.engineId || entry.label || ''));
  return Array.from(tokens);
}

function inferExtensionFromMime(mime) {
  if (!mime && mime !== 0) return '';
  const normalized = String(mime).trim().toLowerCase();
  if (!normalized) return '';
  const base = normalized.split(';')[0];
  if (Object.prototype.hasOwnProperty.call(MIME_EXTENSION_OVERRIDES, base)) {
    return MIME_EXTENSION_OVERRIDES[base] || '';
  }
  const suffix = base.includes('/') ? base.split('/').pop() : base;
  if (!suffix) return '';
  const sanitized = suffix.replace(/[^a-z0-9]+/g, '');
  if (!sanitized) return '';
  if (Object.prototype.hasOwnProperty.call(MIME_EXTENSION_OVERRIDES, sanitized)) {
    return MIME_EXTENSION_OVERRIDES[sanitized] || '';
  }
  switch (sanitized) {
    case 'gltfbinary':
      return 'glb';
    case 'gltfjson':
      return 'gltf';
    case 'quicktime':
      return 'mov';
    case 'mpeg':
      return 'mp3';
    case 'pjpeg':
      return 'jpg';
    default:
      return sanitized;
  }
}

function getResultFilterMeta(entry) {
  if (!entry) {
    return { type: '', extension: '' };
  }
  const saved = entry.savedFile || {};
  const savedList = Array.isArray(entry.savedFiles) ? entry.savedFiles : [];
  const candidates = [];
  const enqueue = (value) => {
    if (!value && value !== 0) return;
    const str = String(value).trim();
    if (!str) return;
    candidates.push(str);
  };
  enqueue(entry.fileName || entry.filename || entry.path);
  enqueue(entry.outputPath);
  enqueue(saved.fileName || saved.filename || saved.path);
  enqueue(saved.webPath);
  enqueue(saved.absolute);
  savedList.forEach((item) => {
    if (!item) return;
    enqueue(item.fileName || item.filename || item.path);
  });
  if (entry.imageUrl) {
    enqueue(entry.imageUrl.split('?')[0]);
  }
  if (saved.url) {
    enqueue(String(saved.url).split('?')[0]);
  }
  let extension = '';
  for (const candidate of candidates) {
    const ext = extractFileExtension(candidate);
    if (ext) {
      extension = ext;
      break;
    }
  }
  if (!extension && entry.ext) {
    extension = String(entry.ext).trim().toLowerCase();
  }
  if (!extension && saved.ext) {
    extension = String(saved.ext).trim().toLowerCase();
  }
  if (!extension && entry.mime) {
    extension = inferExtensionFromMime(entry.mime);
  }
  if (!extension && entry.contentType) {
    extension = inferExtensionFromMime(entry.contentType);
  }
  if (!extension && saved.mime) {
    extension = inferExtensionFromMime(saved.mime);
  }
  if (!extension && saved.contentType) {
    extension = inferExtensionFromMime(saved.contentType);
  }
  extension = extension ? extension.toLowerCase() : '';
  const primaryPath = candidates.find((item) => item && item.length) || '';
  const filterProbe = {
    filterType: entry.filterType || entry.type || entry.sourceCategory || saved.filterType || saved.mediaType || '',
    type: entry.type || '',
    mime: entry.mime || entry.contentType || saved.mime || saved.contentType || '',
    ext: extension,
    path: primaryPath,
    url: entry.imageUrl || saved.webPath || saved.absolute || saved.url || ''
  };
  const type = resolveMediaEntryType(filterProbe);
  return { type, extension };
}

function summarizeResultsByFileAttributes(entries) {
  const summary = {
    typeCounts: new Map(),
    extensionCounts: new Map()
  };
  const list = Array.isArray(entries) ? entries : [];
  list.forEach((entry) => {
    const { type, extension } = getResultFilterMeta(entry);
    if (type) {
      summary.typeCounts.set(type, (summary.typeCounts.get(type) || 0) + 1);
    }
    if (extension) {
      summary.extensionCounts.set(extension, (summary.extensionCounts.get(extension) || 0) + 1);
    }
  });
  return summary;
}

function applyResultsFileFilter(entries, filterValue) {
  if (!filterValue || filterValue === 'all') {
    return entries;
  }
  const list = Array.isArray(entries) ? entries : [];
  if (filterValue.startsWith('type:')) {
    const target = filterValue.slice(5);
    if (!target) return list;
    return list.filter((entry) => {
      const { type } = getResultFilterMeta(entry);
      return type === target;
    });
  }
  if (filterValue.startsWith('ext:')) {
    const target = filterValue.slice(4);
    if (!target) return list;
    return list.filter((entry) => {
      const { extension } = getResultFilterMeta(entry);
      return extension === target;
    });
  }
  return list;
}

function updateResultsFileFilterControl(summary) {
  const wrap = document.getElementById('kc-results-file-filter-wrap');
  const select = document.getElementById('kc-results-file-filter');
  if (!wrap || !select) return;
  const typeEntries = Array.from(summary.typeCounts.entries())
    .filter(([type]) => type && type !== 'other')
    .sort((a, b) => a[0].localeCompare(b[0]));
  const otherTypeCount = summary.typeCounts.get('other') || 0;
  const extensionEntries = Array.from(summary.extensionCounts.entries())
    .filter(([ext]) => ext)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const shouldShow = typeEntries.length > 0 || otherTypeCount > 0 || extensionEntries.length > 0;
  if (!shouldShow) {
    wrap.hidden = true;
    select.innerHTML = '';
    const option = document.createElement('option');
    option.value = 'all';
    option.textContent = 'すべて';
    select.append(option);
    select.value = 'all';
    if (state.resultsFileFilter !== 'all') {
      state.resultsFileFilter = 'all';
      preferenceStorage.writeString(RESULTS_FILE_FILTER_STORAGE_KEY, 'all', {
        label: 'failed to persist results file filter'
      });
    }
    return;
  }
  wrap.hidden = false;
  const previousValue = state.resultsFileFilter || 'all';
  select.innerHTML = '';
  const makeOption = (value, label) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  };
  select.append(makeOption('all', 'すべて'));
  if (typeEntries.length || otherTypeCount > 0) {
    const group = document.createElement('optgroup');
    group.label = 'タイプ';
    typeEntries.forEach(([type, count]) => {
      const display = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
      group.append(makeOption(`type:${type}`, `${display} (${count})`));
    });
    if (otherTypeCount > 0) {
      group.append(makeOption('type:other', `OTHER (${otherTypeCount})`));
    }
    select.append(group);
  }
  if (extensionEntries.length) {
    const group = document.createElement('optgroup');
    group.label = '拡張子';
    extensionEntries.forEach(([ext, count]) => {
      group.append(makeOption(`ext:${ext}`, `${ext.toUpperCase()} (${count})`));
    });
    select.append(group);
  }
  const availableValues = new Set(['all']);
  Array.from(select.options).forEach((option) => availableValues.add(option.value));
  const nextValue = availableValues.has(previousValue) ? previousValue : 'all';
  if (nextValue !== state.resultsFileFilter) {
    state.resultsFileFilter = nextValue;
    preferenceStorage.writeString(RESULTS_FILE_FILTER_STORAGE_KEY, nextValue, {
      label: 'failed to persist results file filter'
    });
  }
  select.value = nextValue;
}

function closeResultsModal() {
  if (!activeResultsModal) return;
  const { overlay, onKeyDown } = activeResultsModal;
  document.removeEventListener('keydown', onKeyDown);
  overlay.remove();
  document.body.classList.remove('kc-modal-open');
  activeResultsModal = null;
  updateBatchControlVisuals();
}

function openResultsGallery() {
  const rawResults = getCurrentResults();
  const activeFilter = state.resultsFileFilter || 'all';
  const filteredResults = applyResultsFileFilter(rawResults, activeFilter);
  const partition = splitResultsByFailure(filteredResults);
  const results = partition.visible;
  const hasHiddenFailures = partition.hidden > 0;
  if (!results.length) {
    return;
  }

  const previewEntries = createLightboxEntriesFromSources(results, { preferImageUrl: true });

  closeTemplateMenu();
  closeResultsModal();
  closeLightbox();
  closePromptModal();
  closePromptPopover();

  const overlay = document.createElement('div');
  overlay.className = 'kc-results-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-results-modal__panel';

  const header = document.createElement('div');
  header.className = 'kc-results-modal__header';
  const activeEntry = getActiveHistoryEntry();
  const modalCategory = normalizeCategory(activeEntry?.category || state.activeCategory);
  const modalTypeTokens = results.length ? collectResultTypes(results[0]) : [];
  const modalPrompt = (activeEntry?.prompt || '').trim()
    || getActivePromptForCategory(modalCategory)
    || '';
  const entryTemplateContext = resolveEntryTemplateContext(activeEntry);
  const resultTemplateContext = (() => {
    const withContext = results.find((item) => item && item.templateContext);
    if (withContext && withContext.templateContext) {
      return cloneTemplateContext(withContext.templateContext, entryTemplateContext);
    }
    return null;
  })();
  const templateContext = cloneTemplateContext(entryTemplateContext || resultTemplateContext);
  const displayTypeToken = (templateContext?.type || modalTypeTokens[0] || '').toUpperCase();

  const controls = document.createElement('div');
  controls.className = 'kc-results-controls kc-results-modal__controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', '拡大結果のメディアコントロール');

  const rewindBtn = document.createElement('button');
  rewindBtn.type = 'button';
  rewindBtn.className = 'kc-button-icon';
  rewindBtn.id = 'kc-results-modal-rewind';
  rewindBtn.title = '最初に戻る';
  rewindBtn.setAttribute('aria-label', '最初に戻る');
  rewindBtn.textContent = '⏮';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'kc-button-icon';
  toggleBtn.id = 'kc-results-modal-toggle';
  toggleBtn.title = '全てのメディアを再生';
  toggleBtn.setAttribute('aria-label', '全てのメディアを再生');
  toggleBtn.textContent = '▶';

  const forwardBtn = document.createElement('button');
  forwardBtn.type = 'button';
  forwardBtn.className = 'kc-button-icon';
  forwardBtn.id = 'kc-results-modal-forward';
  forwardBtn.title = '最後まで進む';
  forwardBtn.setAttribute('aria-label', '最後まで進む');
  forwardBtn.textContent = '⏭';

  const loopBtn = document.createElement('button');
  loopBtn.type = 'button';
  loopBtn.className = 'kc-button-icon';
  loopBtn.id = 'kc-results-modal-loop';
  loopBtn.title = 'ループ再生を有効';
  loopBtn.setAttribute('aria-label', 'ループ再生を有効');
  loopBtn.textContent = '🔁';

  controls.append(rewindBtn, toggleBtn, forwardBtn, loopBtn);
  const headerGrid = document.createElement('div');
  headerGrid.className = 'kc-results-modal__header-grid';

  const metaColumn = document.createElement('div');
  metaColumn.className = 'kc-results-modal__meta';

  const badgeRow = document.createElement('div');
  badgeRow.className = 'kc-results-modal__badges';
  const categoryBadgeEl = document.createElement('span');
  categoryBadgeEl.className = 'kc-badge kc-results-modal__badge';
  categoryBadgeEl.textContent = categoryLabel(modalCategory);
  applyBadgeTheme(categoryBadgeEl, modalCategory, { fallbackCategory: modalCategory });
  badgeRow.append(categoryBadgeEl);

  if (displayTypeToken) {
    const typeBadgeEl = document.createElement('span');
    typeBadgeEl.className = 'kc-badge kc-badge--type kc-results-modal__badge';
    typeBadgeEl.textContent = displayTypeToken;
    applyBadgeTheme(typeBadgeEl, displayTypeToken, { fallbackCategory: modalCategory });
    badgeRow.append(typeBadgeEl);
  }
  metaColumn.append(badgeRow);

  if (templateContext?.name) {
    const templateNameEl = document.createElement('div');
    templateNameEl.className = 'kc-results-modal__template-name';
    templateNameEl.textContent = templateContext.name;
    metaColumn.append(templateNameEl);
  }

  headerGrid.append(metaColumn);

  const promptColumn = document.createElement('div');
  promptColumn.className = 'kc-results-modal__prompt';
  if (modalPrompt) {
    promptColumn.textContent = modalPrompt;
  } else if (templateContext?.prompt) {
    promptColumn.textContent = templateContext.prompt;
  } else {
    promptColumn.classList.add('is-empty');
  }
  headerGrid.append(promptColumn);

  const memoColumn = document.createElement('div');
  memoColumn.className = 'kc-results-modal__memo';
  if (templateContext?.memo) {
    memoColumn.textContent = templateContext.memo;
  } else {
    memoColumn.classList.add('is-empty');
  }
  headerGrid.append(memoColumn);

  const controlWrap = document.createElement('div');
  controlWrap.className = 'kc-results-modal__bulk-controls';
  controlWrap.append(controls);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kc-results-modal__close';
  closeBtn.innerHTML = '×';
  closeBtn.setAttribute('aria-label', '閉じる');
  closeBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    closeResultsModal();
  });

  header.append(headerGrid, controlWrap, closeBtn);

  const body = document.createElement('div');
  body.className = 'kc-results-modal__body';

  if (results.length) {
    const grid = document.createElement('div');
    grid.className = 'kc-results-modal__grid';

    if (hasHiddenFailures) {
      const notice = document.createElement('div');
      notice.className = 'kc-results-modal__notice';
      notice.textContent = `Failure結果 ${partition.hidden}件を非表示`;
      body.append(notice);
    }

    results.forEach((entry, index) => {
      const card = document.createElement('div');
      card.className = 'kc-results-modal__card';

      const media = document.createElement('div');
      media.className = 'kc-results-modal__media';
      media.style.margin = '0 auto';

      if (entry.imageUrl) {
        const label = formatEngineLabel(entry) || 'result';
        const mediaType = resolveMediaEntryType({
          filterType: entry.filterType || entry.type || '',
          type: entry.type || '',
          url: entry.imageUrl,
          path: entry.fileName || ''
        });
        const openDetail = () => {
          openMediaLightbox(previewEntries, index);
        };
        let previewEl;
        if (mediaType === 'video') {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.autoplay = true;
          video.controls = true;
          video.className = 'kc-results-modal__video';
          applyAssetSrcWithFallback(video, entry.imageUrl, { type: 'video' });
          applyLoopSettingToMedia(video);
          bindShowcaseMediaLifecycle(video, {
            src: entry.imageUrl,
            mediaType: 'video',
            context: 'results-modal'
          });
          const beginPlayback = () => {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {});
            }
          };
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            beginPlayback();
          } else {
            video.addEventListener('canplay', beginPlayback, { once: true });
          }
          previewEl = video;
        } else if (mediaType === 'sound') {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.preload = 'metadata';
          audio.className = 'kc-results-modal__audio';
          applyAssetSrcWithFallback(audio, entry.imageUrl, { type: 'audio' });
          applyLoopSettingToMedia(audio);
          bindShowcaseMediaLifecycle(audio, {
            src: entry.imageUrl,
            mediaType: 'audio',
            context: 'results-modal'
          });
          previewEl = audio;
        } else if (mediaType === '3d') {
          if (isPreviewable3dEntry({ ...entry, url: entry.imageUrl })) {
            mount3dPreview(media, {
              src: entry.imageUrl,
              alt: label,
              variant: 'modal'
            });
          } else {
            render3dDownloadMessage(media, entry.imageUrl, 'modal');
          }
          previewEl = null;
        } else {
          const img = document.createElement('img');
          applyAssetSrcWithFallback(img, entry.imageUrl);
          img.alt = label;
          previewEl = img;
        }
        if (previewEl) {
          if (mediaType === '3d') {
            previewEl.addEventListener('click', (evt) => {
              evt.stopPropagation();
            });
          } else {
            previewEl.addEventListener('click', openDetail);
          }
          media.append(previewEl);
        } else if (mediaType !== '3d') {
          media.addEventListener('click', openDetail);
        }
        if (mediaType === '3d') {
          media.classList.add('kc-results-modal__media--interactive');
        }
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'kc-result-card__placeholder';
        placeholder.textContent = entry.error ? 'Failure' : 'No Preview';
        media.append(placeholder);
      }

      card.append(media);

      const meta = document.createElement('div');
      meta.className = 'kc-results-modal__meta';
      const titleLine = document.createElement('strong');
      titleLine.textContent = formatEngineLabel(entry) || '-';
      meta.append(titleLine);
      if (entry.fileName) {
        const fileLine = document.createElement('span');
        fileLine.textContent = entry.fileName;
        meta.append(fileLine);
      }
      if (entry.error) {
        const errorLine = document.createElement('span');
        errorLine.textContent = entry.error;
        errorLine.style.color = '#ff8b8b';
        meta.append(errorLine);
      }
      if (entry.imageUrl) {
        const mediaType = resolveMediaEntryType({
          filterType: entry.filterType || entry.type || '',
          type: entry.type || '',
          url: entry.imageUrl,
          path: entry.fileName || ''
        });
        if (mediaType === '3d') {
          const actionsLine = document.createElement('div');
          actionsLine.className = 'kc-results-modal__meta-actions';
          const openBtn = document.createElement('button');
          openBtn.type = 'button';
          openBtn.className = 'kc-results-modal__action';
          openBtn.textContent = '個別表示';
          openBtn.addEventListener('click', (evt) => {
            evt.stopPropagation();
            openMediaLightbox(previewEntries, index);
          });
          actionsLine.append(openBtn);
          meta.append(actionsLine);
        }
      }
      card.append(meta);
      grid.append(card);
    });

    body.append(grid);
  } else {
    const empty = document.createElement('div');
    empty.className = 'kc-results-modal__message';
    empty.textContent = '生成結果がありません';
    body.append(empty);
  }

  panel.append(header, body);
  overlay.append(panel);
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) closeResultsModal();
  });

  document.body.append(overlay);
  document.body.classList.add('kc-modal-open');

  registerBatchControlGroup({
    rewindBtn,
    toggleBtn,
    forwardBtn,
    loopBtn
  });

  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closeResultsModal();
    }
  };

  document.addEventListener('keydown', onKeyDown);

  updateBatchControlVisuals();

  activeResultsModal = {
    overlay,
    onKeyDown
  };
}

function closePromptPopover({ resetState = true } = {}) {
  const panel = document.getElementById('kc-results-prompt-panel');
  const toggle = document.getElementById('kc-results-prompt-button');
  const anchor = activePromptPopover?.anchor;
  const onWindowChange = activePromptPopover?.onWindowChange;
  const onKeyDown = activePromptPopover?.onKeyDown;
  if (onWindowChange) {
    window.removeEventListener('scroll', onWindowChange, true);
    window.removeEventListener('resize', onWindowChange);
  }
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  if (panel) {
    panel.hidden = true;
    panel.classList.remove('is-open');
    panel.style.visibility = '';
    panel.style.left = '';
    panel.style.top = '';
    panel.style.position = '';
    panel.style.right = '';
    panel.style.bottom = '';
    const hostId = panel.dataset.hostId;
    if (hostId) {
      const host = document.getElementById(hostId);
      if (host && panel.parentElement !== host) {
        host.appendChild(panel);
      }
    }
  }
  if (toggle) {
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  if (anchor) {
    anchor.classList.remove('is-open');
  }
  activePromptPopover = null;
  if (resetState) {
    state.resultsPromptExpanded = false;
  }
}

function positionPromptPopoverElement(panel, anchor) {
  if (!panel || !anchor) return;
  const gap = 14;
  const margin = 16;
  const anchorRect = anchor.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  let left = anchorRect.right + gap;
  if (left + panelRect.width + margin > viewportWidth) {
    left = Math.max(margin, viewportWidth - panelRect.width - margin);
  }

  let top = anchorRect.top + (anchorRect.height - panelRect.height) / 2;
  if (top < margin) {
    top = margin;
  }
  if (top + panelRect.height + margin > viewportHeight) {
    top = Math.max(margin, viewportHeight - panelRect.height - margin);
  }

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function openPromptPopover(anchor, payload = {}) {
  const panel = document.getElementById('kc-results-prompt-panel');
  const textTarget = document.getElementById('kc-results-prompt-text');
  const memoTarget = document.getElementById('kc-results-prompt-memo');
  const titleTarget = document.getElementById('kc-results-prompt-panel-title');
  if (!panel || !textTarget) {
    closePromptPopover();
    return;
  }

  const options = typeof payload === 'string'
    ? { promptText: payload }
    : (payload && typeof payload === 'object' ? payload : {});
  const promptText = typeof options.promptText === 'string' ? options.promptText.trim() : '';
  const memoText = typeof options.memoText === 'string' ? options.memoText.trim() : '';
  const templateName = typeof options.templateName === 'string' ? options.templateName.trim() : '';

  if (!promptText && !memoText) {
    closePromptPopover();
    return;
  }

  closePromptPopover({ resetState: false });

  if (titleTarget) {
    titleTarget.textContent = templateName || 'prompt';
  }
  if (memoTarget) {
    if (memoText) {
      memoTarget.textContent = memoText;
      memoTarget.hidden = false;
    } else {
      memoTarget.textContent = '';
      memoTarget.hidden = true;
    }
  }
  textTarget.textContent = promptText;
  textTarget.hidden = !promptText;

  const host = document.getElementById('kc-results-prompt-host') || panel.parentElement;
  if (host && host.id) {
    panel.dataset.hostId = host.id;
  } else if (!panel.dataset.hostId) {
    panel.dataset.hostId = 'kc-results-prompt-host';
  }

  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }

  panel.hidden = false;
  panel.classList.add('is-open');
  panel.style.position = 'fixed';
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  panel.style.visibility = 'hidden';

  if (anchor) {
    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');
  }

  const handleWindowChange = () => {
    positionPromptPopoverElement(panel, anchor || document.getElementById('kc-results-prompt-button'));
  };
  window.addEventListener('scroll', handleWindowChange, true);
  window.addEventListener('resize', handleWindowChange);

  const handleKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closePromptPopover();
      if (anchor) {
        anchor.blur();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  requestAnimationFrame(() => {
    positionPromptPopoverElement(panel, anchor || document.getElementById('kc-results-prompt-button'));
    panel.style.visibility = 'visible';
  });

  state.resultsPromptExpanded = true;
  activePromptPopover = {
    anchor,
    hostId: panel.dataset.hostId || '',
    onWindowChange: handleWindowChange,
    onKeyDown: handleKeyDown
  };
}

function resolveUrl(pathOrUrl) {
  if (/^https?:/i.test(pathOrUrl)) return pathOrUrl;
  const trimmed = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;

  let origin = state.backendOrigin;
  if (!origin && typeof window !== 'undefined') {
    const forced = typeof window.__kcBackendOrigin === 'string' ? window.__kcBackendOrigin.trim() : '';
    if (forced) {
      origin = forced;
    }
  }
  if (!origin && trimmed.startsWith('/api/')) {
    origin = 'http://localhost:7777';
  }

  if (origin) {
    return `${origin}${trimmed}`;
  }
  return trimmed;
}

function fetchJson(url, options) {
  const target = resolveUrl(url);
  return fetch(target, options).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed (${res.status}): ${text}`);
    }
    return res.json();
  });
}

function saveHistoryToStorage() {
  const filters = createDefaultHistoryFilters();
  const payload = {
    version: 4,
    filters,
    entries: state.history.map((entry) => ({
      id: entry.id,
      prompt: entry.prompt,
      createdAt: entry.createdAt,
      category: entry.category,
      sourceCategories: Array.isArray(entry.sourceCategories) ? entry.sourceCategories : [],
      templateContext: entry.templateContext ? cloneTemplateContext(entry.templateContext) : null,
      results: Array.isArray(entry.results)
        ? entry.results.map((item) => ({
            ...item,
            sourceCategory: item.sourceCategory || '',
            type: item.type || '',
            typePrefixes: Array.isArray(item.typePrefixes) ? item.typePrefixes : [],
            templateContext: item.templateContext
              ? cloneTemplateContext(item.templateContext, entry.templateContext)
              : (entry.templateContext ? cloneTemplateContext(entry.templateContext) : null)
          }))
        : []
    }))
  };

  preferenceStorage.writeJson(HISTORY_STORAGE_KEY, payload, {
    label: 'failed to persist history cache'
  });

  if (isShowcaseSyncDisabled()) {
    return;
  }

  const target = resolveUrl(HISTORY_API_ENDPOINT);
  setReloadBlock(true);
  fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .catch((err) => {
      console.warn('[Showcase] history sync failed', err);
    })
    .finally(() => {
      setReloadBlock(false, { release: false });
    });
}

function parseTemplateYaml(text) {
  const normalized = (text || '').replace(/\r/g, '');
  const match = normalized.match(/templates:\s*([\s\S]*)/);
  if (!match) return [];
  const section = match[1];
  const boundaryRegex = /^\s*-\s+id:/gm;
  const templates = [];
  const indices = [];
  let boundaryMatch;
  while ((boundaryMatch = boundaryRegex.exec(section)) !== null) {
    indices.push(boundaryMatch.index);
  }
  indices.push(section.length);
  for (let i = 0; i < indices.length - 1; i += 1) {
    const start = indices[i];
    const end = indices[i + 1];
    if (start === undefined || end === undefined) continue;
    const slice = section.slice(start, end).trim();
    if (!slice) continue;
    const entryText = slice.replace(/^\s*-\s*/, '');
    const lines = entryText.split(/\n/);
    const record = {};
    let lineIndex = 0;
    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      if (!line.trim()) {
        lineIndex += 1;
        continue;
      }
      const keyMatch = line.match(/^\s*([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!keyMatch) {
        lineIndex += 1;
        continue;
      }
      const key = keyMatch[1];
      let value = keyMatch[2];
      if (value === '|') {
        const blockLines = [];
        const keyIndent = line.match(/^\s*/)[0].length;
        const blockIndent = keyIndent + 2;
        lineIndex += 1;
        while (lineIndex < lines.length) {
          const blockLine = lines[lineIndex];
          const indent = blockLine.match(/^\s*/)[0].length;
          if (blockLine.trim() && indent < blockIndent) {
            break;
          }
          const sliceIndex = Math.min(blockIndent, blockLine.length);
          blockLines.push(blockLine.slice(sliceIndex));
          lineIndex += 1;
        }
        while (blockLines.length && blockLines[blockLines.length - 1] === '') {
          blockLines.pop();
        }
        record[key] = blockLines.join('\n');
        continue;
      }
      value = value.replace(/^"(.*)"$/, '$1');
      record[key] = value;
      lineIndex += 1;
    }
    const id = (record.id || '').trim();
    const prompt = (record.prompt || '').trim();
    if (!id || !prompt) continue;
    const name = (record.name || id).trim();
    const category = (record.category || '').trim() || DEFAULT_ACTIVE_CATEGORY;
    const type = (record.type || '').trim();
    const filePrefixRaw = record.filePrefix || record.filename_prefix || record.filenamePrefix || '';
    const filePrefix = typeof filePrefixRaw === 'string' ? filePrefixRaw.trim() : '';
    const memo = typeof record.memo === 'string' ? record.memo.trim() : '';
    const soundText = typeof record.soundText === 'string' ? record.soundText.trim() : '';
    templates.push({
      id,
      name,
      category,
      prompt,
      type,
      filePrefix,
      memo,
      soundText,
      source: 'default'
    });
  }
  return templates;
}

async function loadTemplateCatalog() {
  try {
    const res = await fetch('/data/showcase/prompt-templates.yaml', { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    state.templateDefaults = parseTemplateYaml(text).map((tpl) => normalizeTemplateEntry(tpl));
  } catch (err) {
    console.warn('[Showcase] failed to load template catalog', err);
    state.templateDefaults = [];
  }
}

async function loadTemplatePreferences() {
  let payload = null;
  let needsMigration = false;

  const loadLocal = () => {
    const parsed = preferenceStorage.readJson(TEMPLATE_STORAGE_KEY, {
      label: 'template preferences local load failed',
      parseLabel: 'template preferences local parse failed'
    });
    if (Array.isArray(parsed)) {
      return { payload: { version: 1, hidden: [], custom: parsed }, needsMigration: true };
    }
    if (parsed && typeof parsed === 'object') {
      const normalized = {
        version: Number.isFinite(parsed.version) ? parsed.version : 1,
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        custom: Array.isArray(parsed.custom) ? parsed.custom : []
      };
      return { payload: normalized, needsMigration: !parsed.version || parsed.version < 4 };
    }
    return null;
  };

  const localResult = loadLocal();
  if (localResult) {
    payload = localResult.payload;
    needsMigration = localResult.needsMigration;
  }

  if (!payload) {
    try {
      const response = await fetchJson(TEMPLATES_API_ENDPOINT);
      if (response && typeof response === 'object') {
        payload = {
          version: Number.isFinite(response.version) ? response.version : 4,
          hidden: Array.isArray(response.hidden) ? response.hidden : [],
          custom: Array.isArray(response.custom) ? response.custom : []
        };
        needsMigration = payload.version < 4;
        preferenceStorage.writeJson(TEMPLATE_STORAGE_KEY, payload, {
          label: 'template cache update failed'
        });
      }
    } catch (err) {
      console.warn('[Showcase] template preferences fetch failed', err);
    }
  }

  if (!payload) {
    try {
      const res = await fetch('/data/showcase/prompt-template-prefs.json', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object') {
          payload = {
            version: Number.isFinite(json.version) ? json.version : 4,
            hidden: Array.isArray(json.hidden) ? json.hidden : [],
            custom: Array.isArray(json.custom) ? json.custom : []
          };
          needsMigration = payload.version < 4;
          preferenceStorage.writeJson(TEMPLATE_STORAGE_KEY, payload, {
            label: 'template fallback cache failed'
          });
        }
      }
    } catch (staticErr) {
      console.warn('[Showcase] template fallback load failed', staticErr);
    }
  }

  if (!payload) {
    payload = { version: 4, hidden: [], custom: [] };
  }

  if (payload.version < 4) {
    needsMigration = true;
  }

  const hidden = Array.isArray(payload.hidden)
    ? payload.hidden.filter((id) => typeof id === 'string' && id)
    : [];
  const custom = Array.isArray(payload.custom)
    ? payload.custom
        .filter((tpl) => tpl && typeof tpl.prompt === 'string')
        .map((tpl) => {
          const base = {
            id: typeof tpl.id === 'string' ? tpl.id : `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: typeof tpl.name === 'string' && tpl.name ? tpl.name : (tpl.id || 'テンプレート'),
            prompt: String(tpl.prompt || ''),
            category: String(tpl.category || '').trim() || DEFAULT_ACTIVE_CATEGORY,
            type: typeof tpl.type === 'string' ? tpl.type : '',
            filePrefix: typeof tpl.filePrefix === 'string' ? tpl.filePrefix : '',
            memo: typeof tpl.memo === 'string' ? tpl.memo : '',
            soundText: typeof tpl.soundText === 'string' ? tpl.soundText : '',
            source: 'custom'
          };
          return normalizeTemplateEntry(base);
        })
    : [];

  state.templateHidden = new Set(hidden.map((id) => id.trim()).filter(Boolean));
  state.templateCustom = custom;

  const defaultTemplateIds = new Set((state.templateDefaults || []).map((tpl) => tpl.id).filter(Boolean));
  const dedupedCustom = [];
  const seenCustomIds = new Set();
  let preferencesChanged = false;

  state.templateCustom.forEach((tpl) => {
    if (!tpl || !tpl.id) return;
    if (seenCustomIds.has(tpl.id)) {
      preferencesChanged = true;
      return;
    }
    seenCustomIds.add(tpl.id);
    if (defaultTemplateIds.has(tpl.id) && !state.templateHidden.has(tpl.id)) {
      state.templateHidden.add(tpl.id);
      preferencesChanged = true;
    }
    dedupedCustom.push(tpl);
  });

  if (dedupedCustom.length !== state.templateCustom.length) {
    preferencesChanged = true;
  }

  state.templateCustom = dedupedCustom;

  if (preferencesChanged) {
    needsMigration = true;
  }

  if (needsMigration) {
    saveTemplatePreferences();
  }
}

function saveTemplatePreferences() {
  const payload = {
    version: 4,
    hidden: Array.from(state.templateHidden),
    custom: state.templateCustom.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      prompt: tpl.prompt,
      category: tpl.category,
      type: tpl.type || '',
      filePrefix: tpl.filePrefix || '',
      memo: tpl.memo || '',
      soundText: tpl.soundText || ''
    }))
  };

  preferenceStorage.writeJson(TEMPLATE_STORAGE_KEY, payload, {
    label: 'failed to persist template cache'
  });

  if (isShowcaseSyncDisabled()) {
    return;
  }

  const target = resolveUrl(TEMPLATES_API_ENDPOINT);
  setReloadBlock(true);
  fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .catch((err) => {
      console.warn('[Showcase] template sync failed', err);
    })
    .finally(() => {
      setReloadBlock(false, { release: false });
    });
}

function rebuildTemplates() {
  const defaults = (state.templateDefaults || [])
    .filter((tpl) => !state.templateHidden.has(tpl.id))
    .map((tpl) => normalizeTemplateEntry(tpl));
  const custom = state.templateCustom.map((tpl) => ({
    ...normalizeTemplateEntry(tpl),
    source: 'custom'
  }));
  state.templates = [...defaults, ...custom];
}

function cancelTemplateMenuClose() {
  if (!templateMenuCloseTimer) return;
  clearTimeout(templateMenuCloseTimer);
  templateMenuCloseTimer = null;
}

function scheduleTemplateMenuClose() {
  cancelTemplateMenuClose();
  if (activeTemplateMenu?.menu?.contains(document.activeElement)) {
    return;
  }
  templateMenuCloseTimer = window.setTimeout(() => {
    const menu = activeTemplateMenu?.menu;
    if (menu && menu.contains(document.activeElement)) {
      templateMenuCloseTimer = null;
      return;
    }
    closeTemplateMenu();
  }, PARAMS_POPOVER_HIDE_DELAY_MS);
}

function closeTemplateMenu() {
  cancelTemplateMenuClose();
  if (!activeTemplateMenu) return;
  const { menu, anchor, onOutsideClick, onKeyDown, onWindowChange } = activeTemplateMenu;
  document.removeEventListener('mousedown', onOutsideClick);
  document.removeEventListener('keydown', onKeyDown);
  if (onWindowChange) {
    window.removeEventListener('resize', onWindowChange);
    window.removeEventListener('scroll', onWindowChange, true);
  }
  menu.remove();
  if (anchor) {
    anchor.classList.remove('is-active');
    anchor.setAttribute('aria-expanded', 'false');
  }
  activeTemplateMenu = null;
}

function closeTemplateModal() {
  if (!activeTemplateModal) return;
  const { overlay, onKeyDown } = activeTemplateModal;
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  overlay.remove();
  document.body.classList.remove('kc-template-modal-open');
  activeTemplateModal = null;
}

function closePromptModal() {
  if (!activePromptModal) return;
  const { overlay, onKeyDown } = activePromptModal;
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
  overlay.remove();
  document.body.classList.remove('kc-prompt-modal-open');
  activePromptModal = null;
}

function openPromptModal() {
  const anchor = document.getElementById('kc-prompt');
  if (!anchor) return;

  closePromptModal();

  const overlay = document.createElement('div');
  overlay.className = 'kc-prompt-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-prompt-modal__panel';

  const form = document.createElement('form');
  form.className = 'kc-prompt-modal__form';

  const header = document.createElement('div');
  header.className = 'kc-prompt-modal__header';

  const title = document.createElement('h3');
  title.className = 'kc-prompt-modal__title';
  title.textContent = 'プロンプトを編集';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kc-prompt-modal__close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    closePromptModal();
  });

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'kc-prompt-modal__body';

  const textarea = document.createElement('textarea');
  textarea.className = 'kc-prompt-modal__textarea';
  textarea.placeholder = '生成に使うプロンプトを入力してください';
  textarea.value = state.prompt || '';

  const helper = document.createElement('div');
  helper.className = 'kc-prompt-modal__hint';
  helper.textContent = 'Shift + Enter で改行、Ctrl / Cmd + Enter で保存';

  const errorMsg = document.createElement('div');
  errorMsg.className = 'kc-prompt-modal__error';

  body.append(textarea, helper, errorMsg);

  const footer = document.createElement('div');
  footer.className = 'kc-prompt-modal__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'kc-button kc-button--ghost';
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.addEventListener('click', () => {
    closePromptModal();
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'kc-button kc-button--primary';
  saveBtn.textContent = '保存';

  footer.append(cancelBtn, saveBtn);

  form.append(header, body, footer);
  panel.append(form);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.classList.add('kc-prompt-modal-open');

  const setError = (message) => {
    errorMsg.textContent = message || '';
  };

  const commitPrompt = () => {
    const nextPrompt = textarea.value;
    state.prompt = nextPrompt;
    updateActiveTemplateOverrides();
    syncPromptPreview();
    updateRunButtonState();
    closePromptModal();
    const runButton = document.getElementById('kc-run');
    if (runButton) {
      runButton.focus({ preventScroll: true });
    }
  };

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    commitPrompt();
  });

  saveBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    commitPrompt();
  });

  textarea.addEventListener('keydown', (evt) => {
    if ((evt.metaKey || evt.ctrlKey) && evt.key === 'Enter') {
      evt.preventDefault();
      commitPrompt();
    }
  });

  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) {
      closePromptModal();
    }
  });

  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closePromptModal();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  activePromptModal = {
    overlay,
    onKeyDown
  };

  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function syncMcpConfigButton(countOverride) {
  const button = document.getElementById('kc-mcp-config-button');
  if (!button) return;
  const count = typeof countOverride === 'number'
    ? countOverride
    : (Number.isFinite(state.mcpActiveConfigCount) ? state.mcpActiveConfigCount : 0);
  const baseLabel = 'MCP設定';
  if (count > 0) {
    button.textContent = `${baseLabel} (${count})`;
    button.setAttribute('aria-label', `MCP設定 (選択中 ${count} 件)`);
  } else {
    button.textContent = baseLabel;
    button.setAttribute('aria-label', 'MCP設定');
  }
}

async function updateMcpConfigSummary({ silent = false } = {}) {
  try {
    const payload = await fetchJson(`${API_BASE}/config-files`);
    const files = Array.isArray(payload?.files) ? payload.files : [];
    const activeList = Array.isArray(payload?.active)
      ? payload.active
      : files.filter((file) => file && file.active);
    const activeCount = activeList.length;
    state.mcpActiveConfigCount = activeCount;
    if (typeof payload?.directory === 'string') {
      state.mcpConfigDirectory = payload.directory;
    }
    syncMcpConfigButton(activeCount);
    return payload;
  } catch (err) {
    if (!silent) {
      console.warn('[Showcase] MCP config summary update failed', err);
    }
    return null;
  }
}

function closeMcpConfigModal() {
  if (!activeMcpConfigModal) return;
  const { overlay, onKeyDown } = activeMcpConfigModal;
  if (onKeyDown) {
    document.removeEventListener('keydown', onKeyDown);
  }
  overlay.remove();
  document.body.classList.remove('kc-mcp-config-modal-open');
  activeMcpConfigModal = null;
}

function renderMcpConfigList(modalState, payload) {
  const { listContainer, statusNode, directoryNode } = modalState;
  if (!listContainer) return;
  listContainer.innerHTML = '';
  const files = Array.isArray(payload?.files) ? payload.files : [];
  const directory = typeof payload?.directory === 'string' && payload.directory
    ? payload.directory
    : state.mcpConfigDirectory || '';
  if (directoryNode) {
    directoryNode.textContent = directory ? `ディレクトリ: ${directory}` : 'ディレクトリ: (不明)';
  }
  modalState.currentFiles = files;
  if (statusNode) {
    statusNode.textContent = files.length
      ? ''
      : 'MCPディレクトリにJSONファイルが見つかりません。';
  }
  if (!files.length) {
    modalState.applyButton.disabled = false;
    return;
  }

  files.forEach((file) => {
    if (!file || typeof file.fileName !== 'string') return;
    const item = document.createElement('label');
    item.className = 'kc-mcp-config-modal__item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'kc-mcp-config-modal__checkbox';
    checkbox.value = file.fileName;
    checkbox.checked = Boolean(file.active);

    const info = document.createElement('div');
    info.className = 'kc-mcp-config-modal__info';

    const nameLine = document.createElement('div');
    nameLine.className = 'kc-mcp-config-modal__name';
    nameLine.textContent = file.fileName;

    const pathLine = document.createElement('div');
    pathLine.className = 'kc-mcp-config-modal__path';
    pathLine.textContent = file.relativePath || file.absolutePath || '';

    const metaLine = document.createElement('div');
    metaLine.className = 'kc-mcp-config-modal__meta';
    const sizeLabel = formatFileSize(file.size);
    const timeLabel = formatMcpTimestamp(file.mtimeMs);
    metaLine.textContent = timeLabel ? `${sizeLabel}・${timeLabel}` : sizeLabel;

    info.append(nameLine);
    if (pathLine.textContent) {
      info.append(pathLine);
    }
    info.append(metaLine);

    item.append(checkbox, info);
    listContainer.append(item);
  });
}

async function refreshMcpConfigModal(modalState) {
  if (!modalState) return;
  const { applyButton, refreshButton, statusNode } = modalState;
  modalState.loading = true;
  if (applyButton) applyButton.disabled = true;
  if (refreshButton) refreshButton.disabled = true;
  if (statusNode) statusNode.textContent = '読み込み中...';
  try {
    const payload = await updateMcpConfigSummary({ silent: false });
    renderMcpConfigList(modalState, payload || {});
    if (statusNode && (!payload || !Array.isArray(payload.files))) {
      statusNode.textContent = '設定ファイルを取得できませんでした。';
    }
  } catch (err) {
    if (statusNode) {
      statusNode.textContent = `読み込みに失敗しました: ${err.message}`;
    }
    console.error('[Showcase] MCP config list refresh failed', err);
  } finally {
    modalState.loading = false;
    if (applyButton) applyButton.disabled = false;
    if (refreshButton) refreshButton.disabled = false;
  }
}

async function applyMcpConfigSelection(modalState) {
  if (!modalState || modalState.loading) return;
  const {
    form,
    statusNode,
    applyButton,
    refreshButton
  } = modalState;
  if (!form) return;
  const selected = Array.from(form.querySelectorAll('input[type="checkbox"]'))
    .filter((input) => input.checked)
    .map((input) => input.value);
  modalState.loading = true;
  if (applyButton) applyButton.disabled = true;
  if (refreshButton) refreshButton.disabled = true;
  if (statusNode) statusNode.textContent = '保存中...';
  try {
    startEngineLoadingOverlay('MCP一覧を更新中...');
    const target = resolveUrl(`${API_BASE}/config-files`);
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: selected })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    await updateMcpConfigSummary({ silent: true });
    closeMcpConfigModal();
    clearAllSelections({ clearInputs: true });
    try {
      await loadCatalog();
    } catch (err) {
      console.error('[Showcase] catalog reload failed after MCP config update', err);
    }
  } catch (err) {
    console.error('[Showcase] MCP config update failed', err);
    if (statusNode) {
      statusNode.textContent = `保存に失敗しました: ${err.message}`;
    }
    stopEngineLoadingOverlay();
  } finally {
    modalState.loading = false;
    if (activeMcpConfigModal) {
      if (applyButton) applyButton.disabled = false;
      if (refreshButton) refreshButton.disabled = false;
    }
  }
}

async function openMcpConfigModal() {
  if (activeMcpConfigModal) {
    closeMcpConfigModal();
  }

  const overlay = document.createElement('div');
  overlay.className = 'kc-mcp-config-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-mcp-config-modal__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const form = document.createElement('form');
  form.className = 'kc-mcp-config-modal__form';

  const header = document.createElement('div');
  header.className = 'kc-mcp-config-modal__header';

  const title = document.createElement('h3');
  title.className = 'kc-mcp-config-modal__title';
  title.id = 'kc-mcp-config-modal-title';
  title.textContent = 'MCP設定ファイル';
  panel.setAttribute('aria-labelledby', title.id);

  const headerControls = document.createElement('div');
  headerControls.className = 'kc-mcp-config-modal__header-controls';

  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'kc-button kc-button--ghost';
  refreshButton.textContent = '再読み込み';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'kc-mcp-config-modal__close';
  closeButton.setAttribute('aria-label', '閉じる');
  closeButton.innerHTML = '&times;';

  headerControls.append(refreshButton, closeButton);
  header.append(title, headerControls);

  const body = document.createElement('div');
  body.className = 'kc-mcp-config-modal__body';

  const directoryNode = document.createElement('div');
  directoryNode.className = 'kc-mcp-config-modal__directory';
  directoryNode.textContent = state.mcpConfigDirectory
    ? `ディレクトリ: ${state.mcpConfigDirectory}`
    : 'ディレクトリ: (読み込み待ち)';

  const listContainer = document.createElement('div');
  listContainer.className = 'kc-mcp-config-modal__list';

  const statusNode = document.createElement('div');
  statusNode.className = 'kc-mcp-config-modal__status';

  body.append(directoryNode, listContainer, statusNode);

  const footer = document.createElement('div');
  footer.className = 'kc-mcp-config-modal__footer';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'kc-button kc-button--ghost';
  cancelButton.textContent = 'キャンセル';

  const applyButton = document.createElement('button');
  applyButton.type = 'submit';
  applyButton.className = 'kc-button kc-button--primary';
  applyButton.textContent = '適用';

  footer.append(cancelButton, applyButton);

  form.append(header, body, footer);
  panel.append(form);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.classList.add('kc-mcp-config-modal-open');

  const modalState = {
    overlay,
    panel,
    form,
    listContainer,
    statusNode,
    directoryNode,
    applyButton,
    refreshButton,
    loading: false,
    currentFiles: []
  };

  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closeMcpConfigModal();
    }
  };
  document.addEventListener('keydown', onKeyDown);
  modalState.onKeyDown = onKeyDown;

  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) {
      closeMcpConfigModal();
    }
  });

  closeButton.addEventListener('click', (evt) => {
    evt.preventDefault();
    closeMcpConfigModal();
  });

  cancelButton.addEventListener('click', (evt) => {
    evt.preventDefault();
    closeMcpConfigModal();
  });

  refreshButton.addEventListener('click', (evt) => {
    evt.preventDefault();
    refreshMcpConfigModal(modalState).catch((err) => {
      console.error('[Showcase] MCP config manual refresh failed', err);
    });
  });

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    applyMcpConfigSelection(modalState).catch((err) => {
      console.error('[Showcase] MCP config apply error', err);
    });
  });

  activeMcpConfigModal = modalState;

  await refreshMcpConfigModal(modalState);
}

function startEngineLoadingOverlay(message = '読み込み中...') {
  const host = document.querySelector('.kc-panel__body--engines');
  if (!host) return;
  if (!engineLoadingOverlay || !engineLoadingOverlay.isConnected) {
    engineLoadingOverlay = document.createElement('div');
    engineLoadingOverlay.className = 'kc-engines__loading-overlay';

    const backdrop = document.createElement('div');
    backdrop.className = 'kc-engines__loading-backdrop';

    const content = document.createElement('div');
    content.className = 'kc-engines__loading-content';

    const spinner = document.createElement('div');
    spinner.className = 'kc-spinner';

    const label = document.createElement('div');
    label.className = 'kc-engines__loading-text';
    label.textContent = message;

    content.append(spinner, label);
    engineLoadingOverlay.append(backdrop, content);
  } else {
    const label = engineLoadingOverlay.querySelector('.kc-engines__loading-text');
    if (label) {
      label.textContent = message;
    }
  }

  host.classList.add('is-loading');
  host.append(engineLoadingOverlay);
}

function stopEngineLoadingOverlay() {
  const host = document.querySelector('.kc-panel__body--engines');
  if (host) {
    host.classList.remove('is-loading');
  }
  if (engineLoadingOverlay && engineLoadingOverlay.isConnected) {
    engineLoadingOverlay.remove();
  }
}

function openTemplateEditor(options = {}) {
  closeTemplateModal();
  closePromptModal();

  const {
    title = 'テンプレートの保存',
    initialName = '',
    initialPrompt = '',
    initialCategory = state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY,
    initialType = '',
    initialFilePrefix = '',
    initialMemo = '',
    initialSoundText = '',
    onConfirm,
    onSuccess
  } = options;

  const categoryDefault = isSupportedCategory(initialCategory)
    ? initialCategory
    : DEFAULT_ACTIVE_CATEGORY;

  const overlay = document.createElement('div');
  overlay.className = 'kc-template-modal';

  const panel = document.createElement('div');
  panel.className = 'kc-template-modal__panel';

  const form = document.createElement('form');
  form.className = 'kc-template-modal__form';

  const header = document.createElement('div');
  header.className = 'kc-template-modal__header';

  const heading = document.createElement('h3');
  heading.className = 'kc-template-modal__title';
  heading.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kc-template-modal__close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', '閉じる');
  closeBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    closeTemplateModal();
  });

  header.append(heading, closeBtn);

  const body = document.createElement('div');
  body.className = 'kc-template-modal__body';

  const suffix = Math.random().toString(36).slice(2, 8);

  const nameGroup = document.createElement('div');
  nameGroup.className = 'kc-template-modal__group';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'kc-template-modal__label';
  nameLabel.setAttribute('for', `kc-template-name-${suffix}`);
  nameLabel.textContent = 'テンプレート名';
  const nameInput = document.createElement('input');
  nameInput.className = 'kc-template-modal__input';
  nameInput.type = 'text';
  nameInput.id = `kc-template-name-${suffix}`;
  nameInput.placeholder = '例: 夕景シネマティック';
  nameInput.value = initialName;
  nameGroup.append(nameLabel, nameInput);

  const filePrefixGroup = document.createElement('div');
  filePrefixGroup.className = 'kc-template-modal__group';
  const filePrefixLabel = document.createElement('label');
  filePrefixLabel.className = 'kc-template-modal__label';
  filePrefixLabel.setAttribute('for', `kc-template-file-prefix-${suffix}`);
  filePrefixLabel.textContent = 'ファイル名接頭辞 (任意)';
  const filePrefixInput = document.createElement('input');
  filePrefixInput.className = 'kc-template-modal__input';
  filePrefixInput.type = 'text';
  filePrefixInput.id = `kc-template-file-prefix-${suffix}`;
  filePrefixInput.value = initialFilePrefix;
  filePrefixGroup.append(filePrefixLabel, filePrefixInput);

  const memoGroup = document.createElement('div');
  memoGroup.className = 'kc-template-modal__group';
  const memoLabel = document.createElement('label');
  memoLabel.className = 'kc-template-modal__label';
  memoLabel.setAttribute('for', `kc-template-memo-${suffix}`);
  memoLabel.textContent = 'メモ (任意)';
  const memoField = document.createElement('textarea');
  memoField.className = 'kc-template-modal__textarea kc-template-modal__textarea--compact';
  memoField.id = `kc-template-memo-${suffix}`;
  memoField.placeholder = '補足コメントや和訳などを記入できます';
  memoField.value = initialMemo;
  memoGroup.append(memoLabel, memoField);

  const categoryGroup = document.createElement('div');
  categoryGroup.className = 'kc-template-modal__group';
  const categoryLabelEl = document.createElement('label');
  categoryLabelEl.className = 'kc-template-modal__label';
  categoryLabelEl.setAttribute('for', `kc-template-category-${suffix}`);
  categoryLabelEl.textContent = 'カテゴリ';
  const categorySelect = document.createElement('select');
  categorySelect.className = 'kc-template-modal__select';
  categorySelect.id = `kc-template-category-${suffix}`;
  SUPPORTED_CATEGORIES.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = categoryLabel(cat);
    if (cat === categoryDefault) {
      option.selected = true;
    }
    categorySelect.append(option);
  });
  categoryGroup.append(categoryLabelEl, categorySelect);

  const typeGroup = document.createElement('div');
  typeGroup.className = 'kc-template-modal__group';
  const typeLabelEl = document.createElement('label');
  typeLabelEl.className = 'kc-template-modal__label';
  typeLabelEl.setAttribute('for', `kc-template-type-${suffix}`);
  typeLabelEl.textContent = 'タイプ';
  const typeSelect = document.createElement('select');
  typeSelect.className = 'kc-template-modal__select';
  typeSelect.id = `kc-template-type-${suffix}`;
  let currentType = normalizeTypeToken(initialType);

  let soundTextGroup = null;
  let soundTextField = null;

  const updateTypeOptions = () => {
    const normalizedCategory = normalizeCategory(categorySelect.value || DEFAULT_ACTIVE_CATEGORY);
    const typeOptions = knownTypesForCategory(normalizedCategory);
    typeSelect.innerHTML = '';
    const autoOption = document.createElement('option');
    autoOption.value = '';
    autoOption.textContent = 'カテゴリに合わせる';
    typeSelect.append(autoOption);
    typeOptions.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.toUpperCase();
      typeSelect.append(option);
    });
    if (currentType && typeOptions.includes(currentType)) {
      typeSelect.value = currentType;
    } else {
      typeSelect.value = '';
      currentType = '';
    }
  };

  const updateSoundTextVisibility = () => {
    if (!soundTextGroup || !soundTextField) return;
    const normalizedCategory = normalizeCategory(categorySelect.value || DEFAULT_ACTIVE_CATEGORY);
    const isSoundCategory = normalizedCategory === 'sound';
    soundTextGroup.hidden = !isSoundCategory;
    soundTextGroup.classList.toggle('is-hidden', !isSoundCategory);
    soundTextField.disabled = !isSoundCategory;
  };

  updateTypeOptions();
  updateSoundTextVisibility();
  typeGroup.append(typeLabelEl, typeSelect);

  categorySelect.addEventListener('change', () => {
    updateTypeOptions();
    updateSoundTextVisibility();
  });

  typeSelect.addEventListener('change', () => {
    currentType = normalizeTypeToken(typeSelect.value);
  });

  const promptGroup = document.createElement('div');
  promptGroup.className = 'kc-template-modal__group';
  const promptLabel = document.createElement('label');
  promptLabel.className = 'kc-template-modal__label';
  promptLabel.setAttribute('for', `kc-template-prompt-${suffix}`);
  promptLabel.textContent = 'プロンプト';
  const promptField = document.createElement('textarea');
  promptField.className = 'kc-template-modal__textarea';
  promptField.id = `kc-template-prompt-${suffix}`;
  promptField.placeholder = '構造化したプロンプトを記入してください';
  promptField.value = initialPrompt;
  promptGroup.append(promptLabel, promptField);

  soundTextGroup = document.createElement('div');
  soundTextGroup.className = 'kc-template-modal__group kc-template-modal__group--sound';
  const soundTextLabel = document.createElement('label');
  soundTextLabel.className = 'kc-template-modal__label';
  soundTextLabel.setAttribute('for', `kc-template-sound-text-${suffix}`);
  soundTextLabel.textContent = '音声テキスト';
  soundTextField = document.createElement('textarea');
  soundTextField.className = 'kc-template-modal__textarea kc-template-modal__textarea--compact';
  soundTextField.id = `kc-template-sound-text-${suffix}`;
  soundTextField.placeholder = SOUND_TEXT_PLACEHOLDER;
  soundTextField.value = initialSoundText;
  soundTextGroup.append(soundTextLabel, soundTextField);
  updateSoundTextVisibility();

  const errorMsg = document.createElement('div');
  errorMsg.className = 'kc-template-modal__error';

  body.append(
    nameGroup,
    filePrefixGroup,
    categoryGroup,
    typeGroup,
    promptGroup,
    soundTextGroup,
    memoGroup,
    errorMsg
  );

  const footer = document.createElement('div');
  footer.className = 'kc-template-modal__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'kc-button kc-button--ghost';
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    closeTemplateModal();
  });

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'kc-button kc-button--primary';
  const saveLabel = '保存';
  saveBtn.textContent = saveLabel;

  footer.append(cancelBtn, saveBtn);

  form.append(header, body, footer);
  panel.append(form);
  overlay.append(panel);
  document.body.append(overlay);
  document.body.classList.add('kc-template-modal-open');

  const setError = (message) => {
    errorMsg.textContent = message || '';
  };

  const resetButtons = () => {
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
    saveBtn.textContent = saveLabel;
  };

  const handleSubmit = async () => {
    setError('');
    const name = nameInput.value.trim();
    const prompt = promptField.value.trim();
    const selectedCategory = isSupportedCategory(categorySelect.value)
      ? categorySelect.value
      : DEFAULT_ACTIVE_CATEGORY;
    const selectedType = normalizeTypeToken(typeSelect.value);
    const filePrefix = filePrefixInput.value.trim();
    const memo = memoField.value.trim();
    const isSoundCategory = normalizeCategory(selectedCategory) === 'sound';
    const soundText = isSoundCategory && soundTextField ? soundTextField.value.trim() : '';

    if (!name) {
      setError('テンプレート名を入力してください。');
      nameInput.focus();
      return;
    }
    if (!prompt) {
      setError('プロンプトを入力してください。');
      promptField.focus();
      return;
    }

    let result;
    if (typeof onConfirm === 'function') {
      try {
        result = onConfirm({
          name,
          prompt,
          category: selectedCategory,
          type: selectedType,
          filePrefix,
          memo,
          soundText
        });
        if (result && typeof result.then === 'function') {
          saveBtn.disabled = true;
          cancelBtn.disabled = true;
          saveBtn.textContent = '保存中...';
          result = await result;
        }
      } catch (err) {
        setError(err.message || '保存に失敗しました。');
        resetButtons();
        return;
      }
    }

    if (typeof result === 'string') {
      setError(result);
      resetButtons();
      return;
    }
    if (result === false) {
      resetButtons();
      return;
    }

    closeTemplateModal();
    if (typeof onSuccess === 'function') {
      onSuccess({ name, prompt, category: selectedCategory, type: selectedType, filePrefix, memo, soundText });
    }
  };

  form.addEventListener('submit', (evt) => {
    evt.preventDefault();
    handleSubmit();
  });

  saveBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    handleSubmit();
  });

  activeTemplateModal = {
    overlay,
    onKeyDown: null
  };

  requestAnimationFrame(() => {
    nameInput.focus();
    nameInput.setSelectionRange(nameInput.value.length, nameInput.value.length);
  });
}

function positionTemplateMenu(menu, anchor) {
  if (!menu || !anchor) return;
  const margin = PROMPT_GENERATOR_FLOAT_MARGIN;
  menu.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
  positionPromptGeneratorMenu(menu, anchor);
}

function applyTemplate(template) {
  if (!template) return;
  const context = cloneTemplateContext(template);
  const normalizedCategory = normalizeCategory(context?.category || template.category || state.activeCategory);
  state.prompt = context?.prompt || (typeof template.prompt === 'string' ? template.prompt : '');
  if (typeof (context?.soundText ?? template.soundText) === 'string' && (context?.soundText ?? template.soundText)) {
    state.soundText = (context?.soundText ?? template.soundText) || '';
  } else if (normalizedCategory === 'sound') {
    state.soundText = '';
  }
  const templatePrefix = context?.filePrefix || (typeof template.filePrefix === 'string' ? template.filePrefix.trim() : '');
  if (templatePrefix) {
    setFilePrefix(templatePrefix, { skipTemplateOverride: true });
  }
  syncPromptPreview();
  updateRunButtonState();
  syncSoundTextField({ preferExisting: false });
  setActiveTemplateContext({
    ...context,
    category: normalizedCategory,
    appliedAt: Date.now()
  });
  const promptField = document.getElementById('kc-prompt');
  if (promptField) {
    delete promptField.dataset.manualResize;
    adjustPromptFieldHeight(promptField, { force: true });
    promptField.focus({ preventScroll: true });
    const end = promptField.value.length;
    promptField.setSelectionRange(end, end);
  }
}

function resetTemplateState({ focusPrompt = true } = {}) {
  clearActiveTemplateContext();
  state.prompt = '';
  updateActiveTemplateOverrides();
  syncPromptPreview();
  state.soundText = '';
  applySoundTextToInputs('');
  syncSoundTextField({ preferExisting: false });
  setFilePrefix('', { persist: true });
  updateRunButtonState();
  if (focusPrompt) {
    const promptField = document.getElementById('kc-prompt');
    if (promptField) {
      promptField.focus({ preventScroll: true });
    }
  }
}

function handleTemplateDelete(template, menu) {
  if (!template) return;
  if (template.source === 'default') {
    state.templateHidden.add(template.id);
  } else {
    state.templateCustom = state.templateCustom.filter((tpl) => tpl.id !== template.id);
  }
  rebuildTemplates();
  saveTemplatePreferences();
  populateTemplateMenu(menu);
}

function generateTemplateId(name, category) {
  const base = (name || 'template').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'template';
  const existing = new Set();
  (state.templateDefaults || []).forEach((tpl) => existing.add(tpl.id));
  state.templateCustom.forEach((tpl) => existing.add(tpl.id));
  let candidate = `tpl-${category}-${base}`;
  let counter = 2;
  while (existing.has(candidate)) {
    candidate = `tpl-${category}-${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function addTemplateFromPrompt(options = {}) {
  const currentCategory = state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY;
  const templateData = (options && typeof options.template === 'object') ? options.template : {};
  const promptCandidate = typeof options.prompt === 'string' ? options.prompt.trim() : '';
  const promptValue = promptCandidate || state.prompt.trim();
  closeTemplateMenu();

  const primaryNameCandidate = [options.name, templateData.name, options.label]
    .find((value) => typeof value === 'string' && value.trim());
  const defaultName = primaryNameCandidate
    ? primaryNameCandidate.trim()
    : (promptValue ? `テンプレ ${state.templateCustom.length + 1}` : '');

  const categoryCandidate = (() => {
    if (typeof options.category === 'string' && options.category.trim()) {
      return options.category.trim();
    }
    if (typeof templateData.category === 'string' && templateData.category.trim()) {
      return templateData.category.trim();
    }
    return '';
  })();
  const normalizedCandidate = categoryCandidate ? normalizeCategory(categoryCandidate) : '';
  const initialCategory = normalizedCandidate || currentCategory;

  const typeCandidate = (() => {
    if (typeof options.type === 'string' && options.type.trim()) {
      return options.type.trim();
    }
    if (typeof templateData.type === 'string' && templateData.type.trim()) {
      return templateData.type.trim();
    }
    return '';
  })();
  let preferredType = typeCandidate ? normalizeTypeToken(typeCandidate) : '';
  if (!preferredType) {
    const prefix = normalizeTypeToken(state.historyFilters.prefix);
    if (prefix && prefix !== 'other') {
      preferredType = prefix;
    } else {
      const types = knownTypesForCategory(initialCategory);
      preferredType = types.length ? types[0] : '';
    }
  }

  const initialFilePrefix = (() => {
    const candidates = [options.filePrefix, templateData.filePrefix, state.filePrefix];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  })();

  const initialMemo = (() => {
    const candidates = [options.memo, templateData.memo];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  })();

  const initialSoundText = (() => {
    const candidates = [options.soundText, templateData.soundText, state.soundText];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  })();

  const modalTitle = typeof options.title === 'string' && options.title.trim()
    ? options.title.trim()
    : '新規テンプレートを追加';

  openTemplateEditor({
    title: modalTitle,
    initialName: defaultName,
    initialPrompt: promptValue,
    initialCategory,
    initialType: preferredType,
    initialFilePrefix,
    initialMemo,
    initialSoundText,
    onConfirm: ({ name, prompt, category, type, filePrefix, memo, soundText }) => {
      const template = normalizeTemplateEntry({
        id: generateTemplateId(name, type || category),
        name,
        prompt,
        category,
        type,
        filePrefix,
        memo,
        soundText,
        source: 'custom'
      }, category);
      state.templateCustom = [template, ...state.templateCustom].slice(0, TEMPLATE_LIMIT);
      rebuildTemplates();
      saveTemplatePreferences();
      return true;
    },
    onSuccess: ({ prompt, filePrefix, category, soundText }) => {
      const anchor = document.getElementById('kc-template');
      if (anchor) {
        openTemplateMenu(anchor);
      }
      let templateTouched = false;
      if (!state.prompt.trim()) {
        state.prompt = prompt;
        templateTouched = true;
        syncPromptPreview();
        updateRunButtonState();
      }
      if (filePrefix) {
        setFilePrefix(filePrefix);
        templateTouched = true;
      }
      if (normalizeCategory(category) === 'sound') {
        state.soundText = soundText || '';
        syncSoundTextField({ preferExisting: false });
        templateTouched = true;
      }
      if (templateTouched) {
        updateActiveTemplateOverrides();
      }
    }
  });
}

function syncTemplateMenuControls(menu) {
  const filters = ensureTemplateMenuFilters();
  const categorySelect = menu.querySelector('#kc-template-filter-category');
  if (categorySelect instanceof HTMLSelectElement) {
    const categoryOptions = PROMPT_GENERATOR_CATEGORY_OPTIONS;
    if (categorySelect.dataset.bound !== '1') {
      const fragment = document.createDocumentFragment();
      categoryOptions.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label;
        fragment.append(opt);
      });
      categorySelect.replaceChildren(fragment);
      categorySelect.dataset.bound = '1';
    }
    const allowedIds = new Set(categoryOptions.map((option) => option.id));
    if (!allowedIds.has(filters.category)) {
      filters.category = allowedIds.has(state.activeEngineCategory) ? state.activeEngineCategory : ALL_CATEGORY_ID;
    }
    if (categorySelect.value !== filters.category) {
      categorySelect.value = filters.category;
    }
  }

  const typeSelect = menu.querySelector('#kc-template-filter-type');
  if (typeSelect instanceof HTMLSelectElement) {
    const typeOptions = getTypeFilterOptions(filters.category);
    const fragment = document.createDocumentFragment();
    typeOptions.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.id;
      opt.textContent = option.label;
      fragment.append(opt);
    });
    typeSelect.replaceChildren(fragment);
    const allowed = typeOptions.map((option) => option.id);
    if (!allowed.includes(filters.type)) {
      filters.type = 'all';
    }
    if (typeSelect.value !== filters.type) {
      typeSelect.value = filters.type;
    }
  }

  const searchInput = menu.querySelector('#kc-template-filter-search');
  if (searchInput instanceof HTMLInputElement) {
    if (!searchInput.placeholder) {
      searchInput.placeholder = 'テンプレートを検索';
    }
    if (searchInput.value !== filters.query) {
      searchInput.value = filters.query;
    }
  }

  return filters;
}

function populateTemplateMenu(menu) {
  const list = menu.querySelector('.kc-template-menu__list');
  if (!list) return;
  list.innerHTML = '';
  const filters = syncTemplateMenuControls(menu);
  const previewRoot = menu.querySelector('.kc-template-menu__preview');
  const previewBody = menu.querySelector('.kc-template-menu__preview-body');
  const previewName = menu.querySelector('.kc-template-menu__preview-name');
  const previewType = menu.querySelector('.kc-template-menu__preview-type');
  const previewMemo = menu.querySelector('.kc-template-menu__preview-memo');
  const previewSoundLabel = menu.querySelector('.kc-template-menu__preview-label--sound');
  const previewSound = menu.querySelector('.kc-template-menu__preview-sound');
  const previewPlaceholder = previewBody?.dataset?.placeholder || 'テンプレートをホバーするとプロンプトを表示します';
  const previewNamePlaceholder = previewName?.dataset?.placeholder || 'テンプレート未選択';
  const previewMemoPlaceholder = previewMemo?.dataset?.placeholder || 'メモは設定されていません';
  const previewSoundPlaceholder = previewSound?.dataset?.placeholder || '音声テキストは設定されていません';
  const defaultCategory = normalizeCategory(filters.category === ALL_CATEGORY_ID
    ? (state.activeEngineCategory || DEFAULT_ACTIVE_CATEGORY)
    : filters.category);
  let activeItem = null;
  const setPreview = (template, itemEl = null) => {
    if (!previewBody || !previewRoot || !previewName) return;
    if (activeItem && activeItem !== itemEl) {
      activeItem.classList.remove('is-preview-active');
    }
    if (itemEl) {
      activeItem = itemEl;
      activeItem.classList.add('is-preview-active');
    } else {
      if (activeItem) {
        activeItem.classList.remove('is-preview-active');
      }
      activeItem = null;
    }
    const name = template?.name?.trim();
    const prompt = template?.prompt?.trim();
    const memo = template?.memo?.trim();
    const normalizedTemplateCategory = template ? normalizeCategory(template.category) : '';
    const badgeFallbackCategory = normalizedTemplateCategory
      || (filters.category !== ALL_CATEGORY_ID ? normalizeCategory(filters.category) : defaultCategory);
    const soundText = template?.soundText?.trim();
    previewName.textContent = name || previewNamePlaceholder;
    previewName.classList.toggle('is-placeholder', !name);
    if (previewType) {
      previewType.style.display = 'none';
      previewType.textContent = '';
      clearBadgeTheme(previewType);
      if (template) {
        const typeToken = normalizeTypeToken(template.type);
        if (typeToken) {
          previewType.textContent = typeToken.toUpperCase();
          previewType.style.display = 'inline-flex';
          applyBadgeTheme(previewType, typeToken, { fallbackCategory: badgeFallbackCategory });
        }
      }
    }
    if (prompt) {
      previewBody.textContent = prompt;
      previewRoot.classList.remove('kc-template-menu__preview--placeholder');
    } else {
      previewBody.textContent = previewPlaceholder;
      previewRoot.classList.add('kc-template-menu__preview--placeholder');
    }
    if (previewMemo) {
      if (memo) {
        previewMemo.textContent = memo;
        previewMemo.classList.remove('is-placeholder');
      } else {
        previewMemo.textContent = previewMemoPlaceholder;
        previewMemo.classList.add('is-placeholder');
      }
    }
    if (previewSound && previewSoundLabel) {
      const isSoundTemplate = template && normalizedTemplateCategory === 'sound';
      if (isSoundTemplate) {
        previewSoundLabel.hidden = false;
        previewSound.hidden = false;
        if (soundText) {
          previewSound.textContent = soundText;
          previewSound.classList.remove('is-placeholder');
        } else {
          previewSound.textContent = previewSoundPlaceholder;
          previewSound.classList.add('is-placeholder');
        }
      } else {
        previewSoundLabel.hidden = true;
        previewSound.hidden = true;
        previewSound.textContent = previewSoundPlaceholder;
        previewSound.classList.add('is-placeholder');
      }
    }
  };
  setPreview(null);
  const relevant = state.templates.filter((tpl) => templateMatchesFilters(tpl, filters));
  const sortedTemplates = relevant.slice().sort((a, b) => {
    const typeA = normalizeTypeToken(a.type) || 'zzzz';
    const typeB = normalizeTypeToken(b.type) || 'zzzz';
    const typeCompare = typeA.localeCompare(typeB, 'ja', { sensitivity: 'base' });
    if (typeCompare !== 0) return typeCompare;
    const nameA = (a.name || '').trim();
    const nameB = (b.name || '').trim();
    return nameA.localeCompare(nameB, 'ja', { sensitivity: 'base' });
  });
  const countEl = menu.querySelector('.kc-template-menu__count');
  if (countEl) {
    const categoryId = filters.category === ALL_CATEGORY_ID ? ALL_CATEGORY_ID : normalizeCategory(filters.category);
    const categoryText = categoryLabel(categoryId).toUpperCase();
    let typeText = 'ALL';
    if (filters.type && filters.type !== 'all') {
      typeText = filters.type === 'other' ? 'OTHER' : filters.type.toUpperCase();
    }
    countEl.textContent = `${categoryText} / ${typeText} · ${sortedTemplates.length}件`;
  }
  if (!sortedTemplates.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-template-empty';
    empty.textContent = '該当するテンプレートがありません';
    list.append(empty);
    setPreview(null);
    return;
  }
  sortedTemplates.forEach((template) => {
    const item = document.createElement('div');
    item.className = 'kc-template-item';

    const name = document.createElement('span');
    name.className = 'kc-template-item__name';
    name.textContent = template.name;

    const actions = document.createElement('div');
    actions.className = 'kc-template-item__actions';

    const badges = document.createElement('div');
    badges.className = 'kc-template-item__badges';

    const typeToken = normalizeTypeToken(template.type);
    if (typeToken) {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'kc-template-item__badge kc-template-item__badge--type kc-badge kc-badge--micro';
      typeBadge.textContent = typeToken.toUpperCase();
      const badgeFallbackCategory = normalizeCategory(template.category || defaultCategory);
      applyBadgeTheme(typeBadge, typeToken, { fallbackCategory: badgeFallbackCategory });
      badges.append(typeBadge);
    }

    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'kc-template-item__badge kc-template-item__badge--category kc-badge kc-badge--micro';
    const categoryId = normalizeCategory(template.category || defaultCategory);
    categoryBadge.textContent = categoryLabel(categoryId);
    applyBadgeTheme(categoryBadge, categoryId, { fallbackCategory: categoryId });
    badges.append(categoryBadge);

    actions.append(badges);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'kc-template-item__edit';
    editBtn.title = 'テンプレートを編集';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      closeTemplateMenu();
      openTemplateEditor({
        title: `${template.name} を編集`,
        initialName: template.name,
        initialPrompt: template.prompt,
        initialCategory: template.category,
        initialType: template.type,
        initialFilePrefix: template.filePrefix || '',
        initialMemo: template.memo || '',
        initialSoundText: template.soundText || '',
        onConfirm: ({ name, prompt, category, type, filePrefix, memo, soundText }) => {
          const updated = {
            id: template.id,
            name,
            prompt,
            category,
            type,
            filePrefix,
            memo,
            soundText,
            source: 'custom'
          };
          const normalized = normalizeTemplateEntry(updated, category);
          normalized.source = 'custom';
          const existingCustom = state.templateCustom.filter((tpl) => tpl.id !== template.id);
          if (template.source === 'default') {
            state.templateHidden.add(template.id);
          }
          state.templateCustom = [normalized, ...existingCustom].slice(0, TEMPLATE_LIMIT);
          rebuildTemplates();
          saveTemplatePreferences();
          const currentPrompt = state.prompt || '';
          if (currentPrompt.trim() && currentPrompt.trim() === (template.prompt || '').trim()) {
            state.prompt = prompt;
            syncPromptPreview();
            updateRunButtonState();
            updateActiveTemplateOverrides();
          }
          if (normalizeCategory(category) === 'sound') {
            state.soundText = soundText || '';
            syncSoundTextField({ preferExisting: false });
            updateActiveTemplateOverrides();
          }
          return true;
        },
        onSuccess: ({ prompt, filePrefix, category, soundText }) => {
          const anchorBtn = document.getElementById('kc-template');
          if (anchorBtn) {
            openTemplateMenu(anchorBtn);
          }
          let templateTouched = false;
          if (!state.prompt.trim()) {
            state.prompt = prompt;
            templateTouched = true;
            syncPromptPreview();
            updateRunButtonState();
          }
          if (filePrefix) {
            setFilePrefix(filePrefix);
            templateTouched = true;
          }
          if (normalizeCategory(category) === 'sound') {
            state.soundText = soundText || '';
            syncSoundTextField({ preferExisting: false });
            templateTouched = true;
          }
          if (templateTouched) {
            updateActiveTemplateOverrides();
          }
        }
      });
    });
    actions.append(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'kc-template-item__delete';
    deleteBtn.title = template.source === 'default' ? 'テンプレートを非表示' : 'テンプレートを削除';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const confirmation = template.source === 'default'
        ? 'このテンプレートを一覧から非表示にしますか？'
        : 'このテンプレートを削除しますか？';
      if (!window.confirm(confirmation)) return;
      handleTemplateDelete(template, menu);
    });
    actions.append(deleteBtn);

    item.append(name, actions);
    item.addEventListener('click', () => {
      applyTemplate(template);
      closeTemplateMenu();
    });
    item.addEventListener('mouseenter', () => {
      setPreview(template, item);
    });
    item.addEventListener('focus', () => {
      setPreview(template, item);
    });

    list.append(item);
  });

  if (!menu.dataset.templatePreviewLeaveBound) {
    const handleLeave = (evt) => {
      if (!menu.contains(evt.relatedTarget)) {
        setPreview(null);
      }
    };
    menu.addEventListener('mouseleave', handleLeave);
    menu.dataset.templatePreviewLeaveBound = 'true';
  }

  if (activeTemplateMenu && activeTemplateMenu.menu === menu) {
    requestAnimationFrame(() => {
      positionTemplateMenu(menu, activeTemplateMenu.anchor);
    });
  }
}

function openTemplateMenu(anchor) {
  if (!anchor) return;
  cancelTemplateMenuClose();
  if (activeTemplateMenu && activeTemplateMenu.anchor === anchor) {
    closeTemplateMenu();
    return;
  }
  closeTemplateMenu();

  const menu = document.createElement('div');
  menu.className = 'kc-template-menu';
  menu.tabIndex = -1;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.style.visibility = 'hidden';
  menu.style.pointerEvents = 'none';

  const header = document.createElement('div');
  header.className = 'kc-template-menu__header';
  const headerMain = document.createElement('div');
  headerMain.className = 'kc-template-menu__header-main';
  const headerTitle = document.createElement('div');
  headerTitle.className = 'kc-template-menu__title';
  headerTitle.textContent = 'テンプレート';
  const headerCount = document.createElement('span');
  headerCount.className = 'kc-template-menu__count';
  headerMain.append(headerTitle, headerCount);

  const filterWrap = document.createElement('div');
  filterWrap.className = 'kc-template-menu__filters';

  const categorySelect = document.createElement('select');
  categorySelect.id = 'kc-template-filter-category';
  categorySelect.className = 'kc-template-filter';
  categorySelect.setAttribute('aria-label', 'カテゴリで絞り込み');
  filterWrap.append(categorySelect);

  const typeSelect = document.createElement('select');
  typeSelect.id = 'kc-template-filter-type';
  typeSelect.className = 'kc-template-filter';
  typeSelect.setAttribute('aria-label', 'タイプで絞り込み');
  filterWrap.append(typeSelect);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'kc-template-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.id = 'kc-template-filter-search';
  searchInput.className = 'kc-template-search__input';
  searchInput.placeholder = 'テンプレートを検索';
  searchInput.setAttribute('aria-label', 'テンプレートを検索');
  searchWrap.append(searchInput);
  filterWrap.append(searchWrap);

  header.append(headerMain, filterWrap);
  menu.append(header);

  const content = document.createElement('div');
  content.className = 'kc-template-menu__content';

  const preview = document.createElement('div');
  preview.className = 'kc-template-menu__preview kc-template-menu__preview--placeholder';
  const previewHeader = document.createElement('div');
  previewHeader.className = 'kc-template-menu__preview-header';
  const previewName = document.createElement('div');
  previewName.className = 'kc-template-menu__preview-name';
  previewName.dataset.placeholder = 'テンプレート未選択';
  previewName.textContent = previewName.dataset.placeholder;
  const previewType = document.createElement('span');
  previewType.className = 'kc-template-menu__preview-type kc-badge kc-badge--tiny';
  previewType.style.display = 'none';
  previewHeader.append(previewName, previewType);
  const previewLabel = document.createElement('div');
  previewLabel.className = 'kc-template-menu__preview-label';
  previewLabel.textContent = 'プロンプト';
  const previewBody = document.createElement('div');
  previewBody.className = 'kc-template-menu__preview-body';
  previewBody.dataset.placeholder = 'テンプレートをホバーするとプロンプトを表示します';
  previewBody.textContent = previewBody.dataset.placeholder;
  const previewSoundLabel = document.createElement('div');
  previewSoundLabel.className = 'kc-template-menu__preview-label kc-template-menu__preview-label--sound';
  previewSoundLabel.textContent = '音声テキスト';
  previewSoundLabel.hidden = true;
  const previewSound = document.createElement('div');
  previewSound.className = 'kc-template-menu__preview-sound is-placeholder';
  previewSound.dataset.placeholder = '音声テキストは設定されていません';
  previewSound.textContent = previewSound.dataset.placeholder;
  previewSound.hidden = true;
  const previewMemoLabel = document.createElement('div');
  previewMemoLabel.className = 'kc-template-menu__preview-label';
  previewMemoLabel.textContent = 'メモ';
  const previewMemo = document.createElement('div');
  previewMemo.className = 'kc-template-menu__preview-memo is-placeholder';
  previewMemo.dataset.placeholder = 'メモは設定されていません';
  previewMemo.textContent = previewMemo.dataset.placeholder;
  preview.append(
    previewHeader,
    previewLabel,
    previewBody,
    previewSoundLabel,
    previewSound,
    previewMemoLabel,
    previewMemo
  );

  const list = document.createElement('div');
  list.className = 'kc-template-menu__list';

  content.append(preview, list);
  menu.append(content);

  const footer = document.createElement('div');
  footer.className = 'kc-template-menu__footer';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'kc-template-add';
  addBtn.textContent = '＋ 新規テンプレートを追加';
  addBtn.addEventListener('click', (evt) => {
    evt.preventDefault();
    addTemplateFromPrompt();
  });
  footer.append(addBtn);
  menu.append(footer);

  document.body.append(menu);

  const menuState = {
    menu,
    anchor,
    onOutsideClick: null,
    onKeyDown: null,
    onWindowChange: null
  };
  activeTemplateMenu = menuState;

  const reposition = () => {
    positionTemplateMenu(menu, anchor);
  };

  const handleCategoryChange = (evt) => {
    const select = evt.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const templateFilters = ensureTemplateMenuFilters();
    const value = select.value;
    if (value === ALL_CATEGORY_ID) {
      templateFilters.category = ALL_CATEGORY_ID;
    } else {
      templateFilters.category = normalizeCategory(value);
    }
    const allowedTypes = getTypeFilterOptions(templateFilters.category).map((option) => option.id);
    if (!allowedTypes.includes(templateFilters.type)) {
      templateFilters.type = 'all';
    }
    populateTemplateMenu(menu);
    reposition();
  };
  const handleTypeChange = (evt) => {
    const select = evt.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const templateFilters = ensureTemplateMenuFilters();
    const value = select.value;
    if (value === 'all' || value === 'other') {
      templateFilters.type = value;
    } else {
      const normalized = normalizeTypeToken(value);
      templateFilters.type = normalized || 'all';
    }
    populateTemplateMenu(menu);
    reposition();
  };
  const handleSearchInput = (evt) => {
    const input = evt.target;
    if (!(input instanceof HTMLInputElement)) return;
    cancelTemplateMenuClose();
    const templateFilters = ensureTemplateMenuFilters();
    templateFilters.query = input.value;
    populateTemplateMenu(menu);
    reposition();
  };

  categorySelect.addEventListener('change', handleCategoryChange);
  typeSelect.addEventListener('change', handleTypeChange);
  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('search', handleSearchInput);
  searchInput.addEventListener('focus', cancelTemplateMenuClose);

  populateTemplateMenu(menu);
  reposition();

  menu.style.visibility = '';
  menu.style.pointerEvents = '';

  requestAnimationFrame(() => {
    reposition();
    menu.classList.add('is-open');
    try {
      menu.focus({ preventScroll: true });
    } catch (err) {
      // フォーカスできない場合は無視
    }
  });

  const handleWindowChange = () => {
    if (!document.body.contains(menu)) {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
      return;
    }
    requestAnimationFrame(reposition);
  };

  window.addEventListener('resize', handleWindowChange, { passive: true });
  window.addEventListener('scroll', handleWindowChange, { passive: true, capture: true });

  menu.addEventListener('mouseenter', cancelTemplateMenuClose);
  menu.addEventListener('mouseleave', scheduleTemplateMenuClose);
  menu.addEventListener('focusin', cancelTemplateMenuClose);
  menu.addEventListener('focusout', (evt) => {
    if (!menu.contains(evt.relatedTarget)) {
      scheduleTemplateMenuClose();
    }
  });

  const onOutsideClick = (evt) => {
    if (!menu.contains(evt.target) && evt.target !== anchor) {
      closeTemplateMenu();
    }
  };
  const onKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      closeTemplateMenu();
    }
  };
  document.addEventListener('mousedown', onOutsideClick);
  document.addEventListener('keydown', onKeyDown);

  anchor.classList.add('is-active');
  anchor.setAttribute('aria-expanded', 'true');

  menuState.onOutsideClick = onOutsideClick;
  menuState.onKeyDown = onKeyDown;
  menuState.onWindowChange = handleWindowChange;
  activeTemplateMenu = menuState;
}

function ingestHistoryEntries(entries) {
  const mapped = Array.isArray(entries)
    ? entries.map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const rawCategory = normalizeCategory(entry.category);
        const rawResults = Array.isArray(entry.results)
          ? entry.results.map((item) => ({ ...item }))
          : [];
        const entryTemplateContext = normalizeTemplateContext(entry.templateContext);
        const sanitizedResults = rawResults.map((item) => {
          const typePrefix = resolveTypePrefix([
            item.type,
            item.kind,
            item.sourceCategory,
            extractEnginePrefix(item.engineId || item.label || '')
          ]);
          const result = {
            ...item,
            imageUrl: normalizeShowcaseAssetUrl(item.imageUrl),
            logFile: item.logFile ? normalizeShowcaseAssetUrl(item.logFile) : item.logFile,
            sourceCategory: typePrefix,
            type: typePrefix,
            typePrefixes: Array.isArray(item.typePrefixes)
              ? item.typePrefixes.map((prefix) => normalizeTypeToken(prefix)).filter(Boolean)
              : (typePrefix ? [typePrefix] : [])
          };
          const contextual = normalizeTemplateContext(item.templateContext, entryTemplateContext);
          if (contextual) {
            result.templateContext = cloneTemplateContext(contextual);
          } else if (entryTemplateContext) {
            result.templateContext = cloneTemplateContext(entryTemplateContext);
          }
          return result;
        });
        const sourcePrefixSet = new Set();
        if (Array.isArray(entry.sourceCategories) && entry.sourceCategories.length) {
          entry.sourceCategories.forEach((src) => {
            const normalized = normalizeTypeToken(src);
            if (normalized) sourcePrefixSet.add(normalized);
          });
        }
        sanitizedResults.forEach((result) => {
          if (result.type) sourcePrefixSet.add(result.type);
          if (Array.isArray(result.typePrefixes)) {
            result.typePrefixes.forEach((prefix) => {
              const normalized = normalizeTypeToken(prefix);
              if (normalized) sourcePrefixSet.add(normalized);
            });
          }
        });
        const sourceCategories = Array.from(sourcePrefixSet);
        const inferredCategory = inferCategoryFromTokens([
          rawCategory,
          ...sourceCategories
        ], rawCategory);
        const category = inferredCategory || DEFAULT_ACTIVE_CATEGORY;
        ensureCategoryCollections(category);
        return {
          id: typeof entry.id === 'string' ? entry.id : `run-${category}-${Date.now()}`,
          prompt: entry.prompt || '',
          createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
          category,
          sourceCategories,
          results: sanitizedResults,
          templateContext: entryTemplateContext ? cloneTemplateContext(entryTemplateContext) : null
        };
      }).filter(Boolean)
    : [];

  const sorted = mapped.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  state.history = MAX_HISTORY_ENTRIES === Number.POSITIVE_INFINITY
    ? sorted
    : sorted.slice(0, MAX_HISTORY_ENTRIES);
  state.historyVisibleCount = HISTORY_DEFAULT_VISIBLE_COUNT;

  SUPPORTED_CATEGORIES.forEach((cat) => {
    ensureCategoryCollections(cat);
    const first = state.history.find((entry) => entry.category === cat);
    state.resultsByCategory[cat] = first ? first.results.map((item) => ({ ...item })) : [];
  });

  if (state.history.length) {
    const latest = state.history[0];
    state.historyActiveId = latest.id;
    state.activeCategory = latest.category;
    ensureCategoryCollections(latest.category);
    state.resultsByCategory[latest.category] = latest.results.map((item) => ({ ...item }));
    ensureCategoryCollections(ALL_CATEGORY_ID);
    state.activeEngineCategory = ALL_CATEGORY_ID;
    state.historyManualSelection = false;
  } else {
    state.historyActiveId = null;
    state.activeCategory = DEFAULT_ACTIVE_CATEGORY;
    state.historyFilters.category = 'all';
    state.historyFilters.prefix = 'all';
    state.historyVisibleCount = HISTORY_DEFAULT_VISIBLE_COUNT;
    SUPPORTED_CATEGORIES.forEach((cat) => {
      state.resultsByCategory[cat] = [];
    });
    ensureCategoryCollections(ALL_CATEGORY_ID);
    state.activeEngineCategory = ALL_CATEGORY_ID;
    state.historyManualSelection = false;
  }
}

async function loadHistoryFromStorage() {
  let entries = null;
  let fallbackVersion = 1;
  let filters = null;
  const loadLocalHistory = () => {
    const parsed = preferenceStorage.readJson(HISTORY_STORAGE_KEY, {
      label: 'history local load failed',
      parseLabel: 'history local cache parse failed'
    });
    if (Array.isArray(parsed)) {
      return { version: 1, entries: parsed, filters: null };
    }
    if (parsed && Array.isArray(parsed.entries)) {
      return {
        version: Number.isFinite(parsed.version) ? parsed.version : 1,
        entries: parsed.entries,
        filters: parsed.filters || null
      };
    }
    return null;
  };

  const localPayload = loadLocalHistory();
  if (localPayload) {
    entries = localPayload.entries;
    fallbackVersion = Number.isFinite(localPayload.version) ? localPayload.version : fallbackVersion;
    filters = sanitizeHistoryFilters(localPayload.filters);
  }

  if (!entries) {
    try {
      const response = await fetchJson(HISTORY_API_ENDPOINT);
      if (response && Array.isArray(response.entries)) {
        entries = response.entries;
        fallbackVersion = Number.isFinite(response.version) ? response.version : fallbackVersion;
        filters = sanitizeHistoryFilters(response.filters);
        preferenceStorage.writeJson(HISTORY_STORAGE_KEY, {
          version: fallbackVersion,
          entries,
          filters
        }, {
          label: 'history cache update failed'
        });
      }
    } catch (err) {
      console.warn('[Showcase] history fetch failed', err);
    }
  }

  if (!entries) {
    try {
      const res = await fetch('/data/showcase/history.json', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.entries)) {
          entries = json.entries;
          fallbackVersion = Number.isFinite(json.version) ? json.version : fallbackVersion;
          filters = sanitizeHistoryFilters(json.filters);
          preferenceStorage.writeJson(HISTORY_STORAGE_KEY, {
            version: fallbackVersion,
            entries,
            filters
          }, {
            label: 'history fallback cache failed'
          });
        }
      }
    } catch (staticErr) {
      console.warn('[Showcase] history static fallback load failed', staticErr);
    }
  }

  ingestHistoryEntries(entries || []);
  const normalizedFilters = createDefaultHistoryFilters();
  state.historyFilters.category = normalizedFilters.category;
  state.historyFilters.prefix = normalizedFilters.prefix;
}

function flattenCurrentRunResults() {
  const aggregated = [];
  const snapshot = createTemplateContextSnapshot(state.currentRunTemplateContext || state.activeTemplateContext);
  state.currentRunResults.forEach((items) => {
    items.forEach((item) => {
      const record = { ...item };
      if (!record.templateContext && snapshot) {
        record.templateContext = cloneTemplateContext(snapshot);
      }
      aggregated.push(record);
    });
  });
  return aggregated;
}

function deriveHistorySourceCategories(results) {
  const tokens = new Set();
  results.forEach((item) => {
    const primary = normalizeTypeToken(item.type);
    if (primary) tokens.add(primary);
    const source = normalizeTypeToken(item.sourceCategory);
    if (source) tokens.add(source);
    if (Array.isArray(item.typePrefixes)) {
      item.typePrefixes.forEach((prefix) => {
        const normalized = normalizeTypeToken(prefix);
        if (normalized) tokens.add(normalized);
      });
    }
    const derived = normalizeTypeToken(extractEnginePrefix(item.engineId || item.label || ''));
    if (derived) tokens.add(derived);
  });
  return Array.from(tokens);
}

function ensureHistoryEntryForCurrentRun({ prompt, category, jobId } = {}) {
  let entry = state.currentHistoryEntryId
    ? state.history.find((item) => item.id === state.currentHistoryEntryId)
    : null;
  const normalizedCategory = normalizeCategory(category || entry?.category || DEFAULT_ACTIVE_CATEGORY);
  if (!entry) {
    entry = {
      id: `run-${normalizedCategory}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: prompt || '',
      createdAt: Date.now(),
      category: normalizedCategory,
      sourceCategories: [],
      results: [],
      jobId: jobId || '',
      templateContext: cloneTemplateContext(state.currentRunTemplateContext || state.activeTemplateContext)
    };
    state.currentHistoryEntryId = entry.id;
    state.history = [entry, ...state.history].slice(0, MAX_HISTORY_ENTRIES);
  } else {
    entry.jobId = jobId || entry.jobId || '';
    if (prompt) entry.prompt = prompt;
    entry.category = normalizedCategory;
  }
  if (!entry.templateContext) {
    entry.templateContext = cloneTemplateContext(state.currentRunTemplateContext || state.activeTemplateContext);
  }
  if (!state.historyManualSelection || state.historyActiveId === entry.id) {
    state.historyActiveId = entry.id;
  }
  return entry;
}

function syncHistoryEntryFromCurrentResults(entry, { prompt, category } = {}) {
  if (!entry) return;
  const aggregated = flattenCurrentRunResults();
  const contextSnapshot = entry.templateContext
    ? cloneTemplateContext(entry.templateContext)
    : cloneTemplateContext(state.currentRunTemplateContext || state.activeTemplateContext);
  entry.results = aggregated.map((item) => {
    const result = { ...item };
    if (!result.templateContext && contextSnapshot) {
      result.templateContext = cloneTemplateContext(contextSnapshot);
    }
    return result;
  });
  if (!entry.templateContext && contextSnapshot) {
    entry.templateContext = cloneTemplateContext(contextSnapshot);
  }
  const normalizedCategory = normalizeCategory(category || entry.category || DEFAULT_ACTIVE_CATEGORY);
  entry.category = normalizedCategory;
  if (typeof prompt === 'string' && prompt) {
    entry.prompt = prompt;
  }
  entry.sourceCategories = deriveHistorySourceCategories(entry.results);
  entry.createdAt = entry.createdAt || Date.now();
}

function getActiveHistoryEntry() {
  if (!state.historyActiveId) return null;
  const entry = state.history.find((item) => item.id === state.historyActiveId);
  return entry || null;
}

function setHistoryActiveId(entryId, options = {}) {
  const { syncEngine = true, rerenderResults = true, userInitiated = false } = options;
  const entry = state.history.find((item) => item.id === entryId);
  if (!entry) return null;
  if (userInitiated) {
    const isCurrentRunEntry = Boolean(state.currentHistoryEntryId)
      && entry.id === state.currentHistoryEntryId;
    state.historyManualSelection = !isCurrentRunEntry;
  } else {
    state.historyManualSelection = false;
  }
  state.historyActiveId = entry.id;
  state.activeCategory = entry.category;
  ensureCategoryCollections(entry.category);
  state.resultsByCategory[entry.category] = entry.results.map((item) => ({ ...item }));
  if (syncEngine && state.activeEngineCategory !== entry.category) {
    setActiveEngineCategory(entry.category, { skipHistorySync: true });
  }
  if (rerenderResults) {
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) renderResults(resultsContainer);
  }
  return entry;
}

function removeHistoryEntry(entryId) {
  const index = state.history.findIndex((entry) => entry.id === entryId);
  if (index === -1) return;
  const [removed] = state.history.splice(index, 1);
  const removedCategory = removed?.category;
  if (state.historyActiveId === entryId) {
    const fallbackSameCategory = state.history.find((entry) => entry.category === removedCategory);
    const fallback = fallbackSameCategory || state.history[0] || null;
    if (fallback) {
      setHistoryActiveId(fallback.id, { rerenderResults: false, syncEngine: false });
    } else {
      state.historyActiveId = null;
      if (removedCategory) {
        state.resultsByCategory[removedCategory] = [];
      }
    }
  } else if (removedCategory) {
    const next = state.history.find((entry) => entry.category === removedCategory);
    state.resultsByCategory[removedCategory] = next ? next.results.map((item) => ({ ...item })) : [];
  }
  saveHistoryToStorage();
  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) renderResults(resultsContainer);
}

function renderHistory() {
  const body = document.getElementById('kc-history');
  const countLabel = document.getElementById('kc-history-count');
  const tabsContainer = document.getElementById('kc-history-tabs');
  const footer = document.getElementById('kc-history-footer');
  const controls = tabsContainer?.parentElement;

  const selectedType = state.historyFilters.prefix;
  const currentCategory = state.historyFilters.category || 'all';
  const derivedCategory = (currentCategory !== 'all' && selectedType !== 'all' && selectedType !== 'other')
    ? TYPE_PREFIX_TO_CATEGORY.get(selectedType) || currentCategory
    : null;

  if (countLabel) {
    countLabel.textContent = '';
    countLabel.style.display = 'none';
  }
  if (footer) {
    footer.style.display = 'none';
  }

  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    tabsContainer.className = 'kc-history-filterbar';
    if (controls && controls.classList.contains('kc-panel__controls')) {
      controls.style.display = 'flex';
    }

    const createToggleTabs = (options, activeValue, onSelect, themeFallback, ariaLabel, config = {}) => {
      const {
        sizeClass = 'kc-badge--micro',
        tabsClass = '',
        applyThemeAlways = false,
        applyOnHover = false
      } = config;
      const wrap = document.createElement('div');
      wrap.className = 'kc-history-filter-tabs';
      if (tabsClass) wrap.classList.add(tabsClass);
      wrap.setAttribute('role', 'group');
      if (ariaLabel) {
        wrap.setAttribute('aria-label', ariaLabel);
      }
      options.forEach((option) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `kc-history-filter-tab kc-badge ${sizeClass}`;
        btn.textContent = option.label;
        const fallbackCategory = typeof themeFallback === 'function'
          ? themeFallback(option)
          : themeFallback;
        const isActive = activeValue === option.id;
        clearBadgeTheme(btn);
        if (isActive || applyThemeAlways) {
          applyBadgeTheme(btn, option.id, { fallbackCategory });
        }
        if (!isActive && !applyThemeAlways && applyOnHover) {
          btn.addEventListener('mouseenter', () => {
            applyBadgeTheme(btn, option.id, { fallbackCategory });
          });
          btn.addEventListener('mouseleave', () => {
            if (!btn.classList.contains('is-active')) {
              clearBadgeTheme(btn);
            }
          });
        }
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        btn.addEventListener('click', () => {
          if (btn.classList.contains('is-active')) return;
          onSelect(option.id);
        });
        wrap.appendChild(btn);
      });
      return wrap;
    };

    const categoryOptions = [
      { id: 'all', label: 'All' },
      ...CATEGORY_DEFINITIONS.map((def) => ({ id: def.id, label: def.label }))
    ];

    const activeCategoryForUi = derivedCategory || state.historyFilters.category || 'all';

    const wrapGroup = (node, extraClass = '') => {
      const group = document.createElement('div');
      group.className = 'kc-history-filterbar__group';
      if (extraClass) {
        group.classList.add(extraClass);
      }
      group.append(node);
      return group;
    };

    const categoryTabs = createToggleTabs(categoryOptions, activeCategoryForUi, (value) => {
      if (derivedCategory && value !== derivedCategory) {
        state.historyFilters.prefix = 'all';
      }
      if (state.historyFilters.category === value) return;
      state.historyFilters.category = value;
      state.historyFilters.prefix = 'all';
      state.historyVisibleCount = HISTORY_DEFAULT_VISIBLE_COUNT;
      renderHistory();
    }, (option) => option.id, 'カテゴリフィルタ', {
      tabsClass: 'kc-history-filter-tabs--category',
      applyThemeAlways: false,
      sizeClass: 'kc-badge--tiny',
      applyOnHover: true
    });

    const activeCategoryForTypes = currentCategory === 'all'
      ? 'all'
      : (derivedCategory || currentCategory);
    const typeOptions = getTypeFilterOptions(activeCategoryForTypes);
    if (!typeOptions.some((option) => option.id === state.historyFilters.prefix)) {
      state.historyFilters.prefix = 'all';
    }
    const typeThemeFallback = (option) => {
      if (option.id === 'all') return 'all';
      if (option.id === 'other') return 'other';
      return TYPE_PREFIX_TO_CATEGORY.get(option.id) || activeCategoryForTypes;
    };
    const prefixTabs = createToggleTabs(typeOptions, state.historyFilters.prefix, (value) => {
      if (state.historyFilters.prefix === value) return;
      state.historyFilters.prefix = value;
      const latestCategory = state.historyFilters.category || 'all';
      if (value !== 'all' && value !== 'other') {
        if (latestCategory !== 'all') {
          const inferredCategory = TYPE_PREFIX_TO_CATEGORY.get(value) || latestCategory;
          state.historyFilters.category = inferredCategory;
        }
      } else if (value === 'all') {
        if (!state.historyFilters.category) {
          state.historyFilters.category = 'all';
        }
      }
      state.historyVisibleCount = HISTORY_DEFAULT_VISIBLE_COUNT;
      renderHistory();
    }, typeThemeFallback, 'タイプフィルタ', {
      tabsClass: 'kc-history-filter-tabs--type',
      applyThemeAlways: false,
      sizeClass: 'kc-badge--micro',
      applyOnHover: true
    });

    tabsContainer.append(
      wrapGroup(categoryTabs, 'kc-history-filterbar__group--category'),
      wrapGroup(prefixTabs, 'kc-history-filterbar__group--type')
    );
  }

  if (!body) {
    return;
  }
  body.innerHTML = '';

  if (!state.history.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-history-empty';
    empty.textContent = '生成履歴はまだありません';
    body.append(empty);
    return;
  }

  const normalizedPrefixFilter = state.historyFilters.prefix === 'all'
    ? 'all'
    : state.historyFilters.prefix.toLowerCase();
  const normalizedCategoryFilter = (() => {
    if (normalizedPrefixFilter !== 'all' && normalizedPrefixFilter !== 'other') {
      return (TYPE_PREFIX_TO_CATEGORY.get(normalizedPrefixFilter) || DEFAULT_ACTIVE_CATEGORY).toLowerCase();
    }
    return (state.historyFilters.category || 'all').toLowerCase();
  })();
  const allTypeSet = new Set(ALL_TYPE_FILTERS);

  const filteredEntries = state.history.filter((entry) => {
    const entryCategory = inferCategoryFromTokens([
      entry.category,
      ...(Array.isArray(entry.sourceCategories) ? entry.sourceCategories : []),
      ...(Array.isArray(entry.results) ? entry.results.map((res) => res.type || res.sourceCategory || res.category) : [])
    ], entry.category).toLowerCase();
    const passesCategory = normalizedCategoryFilter === 'all'
      || entryCategory === normalizedCategoryFilter;
    if (!passesCategory) return false;
    if (normalizedPrefixFilter === 'all') return true;
    const sources = Array.isArray(entry.sourceCategories) ? entry.sourceCategories : [];
    if (normalizedPrefixFilter !== 'other') {
      return sources.some((src) => src === normalizedPrefixFilter);
    }
    if (normalizedPrefixFilter === 'other') {
      if (!sources.length) return true;
      const hasKnown = sources.some((src) => allTypeSet.has(src));
      return !hasKnown;
    }
    return true;
  });

  if (!filteredEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-history-empty';
    empty.textContent = '条件に一致する履歴がありません';
    body.append(empty);
    return;
  }

  if (!filteredEntries.some((entry) => entry.id === state.historyActiveId)) {
    const fallback = filteredEntries[0];
    if (fallback) {
      setHistoryActiveId(fallback.id, { rerenderResults: false, syncEngine: false });
    }
  }

  const totalEntries = filteredEntries.length;
  let desiredVisible = Number.isFinite(state.historyVisibleCount) && state.historyVisibleCount > 0
    ? state.historyVisibleCount
    : HISTORY_DEFAULT_VISIBLE_COUNT;
  desiredVisible = Math.min(totalEntries, Math.max(1, desiredVisible || HISTORY_DEFAULT_VISIBLE_COUNT));
  const activeIndex = filteredEntries.findIndex((entry) => entry.id === state.historyActiveId);
  if (activeIndex >= 0 && activeIndex >= desiredVisible) {
    const batchesNeeded = Math.ceil((activeIndex + 1) / HISTORY_VISIBLE_INCREMENT);
    desiredVisible = Math.min(totalEntries, Math.max(desiredVisible, batchesNeeded * HISTORY_VISIBLE_INCREMENT));
  }
  state.historyVisibleCount = desiredVisible || Math.min(totalEntries, HISTORY_DEFAULT_VISIBLE_COUNT);
  const visibleEntries = filteredEntries.slice(0, state.historyVisibleCount);

  const canLoadMore = visibleEntries.length < totalEntries;

  if (countLabel) {
    countLabel.textContent = '';
    countLabel.style.display = 'none';
  }
  if (footer) {
    footer.style.display = 'none';
    const existingMore = footer.querySelector('#kc-history-loadmore');
    if (existingMore) {
      existingMore.remove();
    }
  }

  const list = document.createElement('div');
  list.className = 'kc-history-list';

  visibleEntries.forEach((entry) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'kc-history-card';
    if (entry.id === state.historyActiveId) {
      card.classList.add('is-active');
      card.setAttribute('aria-pressed', 'true');
    } else {
      card.setAttribute('aria-pressed', 'false');
    }

    const templateContext = resolveEntryTemplateContext(entry);
    if (!entry.templateContext && templateContext) {
      entry.templateContext = cloneTemplateContext(templateContext);
    }
    if (templateContext && Array.isArray(entry.results)) {
      entry.results.forEach((result) => {
        if (result && !result.templateContext) {
          result.templateContext = cloneTemplateContext(templateContext, result.templateContext);
        }
      });
    }

    const header = document.createElement('div');
    header.className = 'kc-history-card__header';
    const badgeRow = document.createElement('div');
    badgeRow.className = 'kc-history-card__badge-row';
    const displayCategory = inferCategoryFromTokens([
      entry.category,
      ...(Array.isArray(entry.sourceCategories) ? entry.sourceCategories : []),
      ...(Array.isArray(entry.results) ? entry.results.map((res) => res.type || res.sourceCategory || res.category) : [])
    ], entry.category);
    const categoryTag = document.createElement('span');
    categoryTag.className = 'kc-history-card__category kc-badge kc-badge--micro';
    categoryTag.textContent = categoryLabel(displayCategory);
    applyBadgeTheme(categoryTag, displayCategory, { fallbackCategory: displayCategory });
    badgeRow.append(categoryTag);

    const sourceCategories = Array.isArray(entry.sourceCategories)
      ? entry.sourceCategories.filter((src) => typeof src === 'string' && src.trim())
      : [];
    const primaryTypeToken = (() => {
      if (templateContext?.type) {
        return normalizeTypeToken(templateContext.type);
      }
      if (sourceCategories.length) {
        return normalizeTypeToken(sourceCategories[0]);
      }
      return '';
    })();
    const renderedPrimaryType = primaryTypeToken ? primaryTypeToken.toUpperCase() : '';
    if (renderedPrimaryType) {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'kc-history-card__type-primary kc-badge kc-badge--micro';
      typeBadge.textContent = renderedPrimaryType;
      applyBadgeTheme(typeBadge, primaryTypeToken, { fallbackCategory: displayCategory });
      badgeRow.append(typeBadge);
    }
    if (templateContext?.name) {
      const nameEl = document.createElement('div');
      nameEl.className = 'kc-history-card__template-name';
      nameEl.textContent = templateContext.name;
      nameEl.title = templateContext.name;
      badgeRow.append(nameEl);
    }

    header.append(badgeRow);

    const remainingCategories = sourceCategories.filter((src) => normalizeTypeToken(src) !== primaryTypeToken);
    if (remainingCategories.length) {
      const typesTag = document.createElement('div');
      typesTag.className = 'kc-history-card__types';
      remainingCategories.forEach((src) => {
        const badge = document.createElement('span');
        badge.className = 'kc-history-card__type kc-badge kc-badge--micro';
        const normalized = String(src).trim();
        badge.textContent = normalized.toUpperCase();
        applyBadgeTheme(badge, normalized, { fallbackCategory: displayCategory });
        typesTag.append(badge);
      });
      header.append(typesTag);
    }

    const thumbsWrap = document.createElement('div');
    thumbsWrap.className = 'kc-history-card__thumbs';

    const rawResults = Array.isArray(entry.results) ? entry.results : [];
    const historyPartition = splitResultsByFailure(rawResults);
    const hasHiddenFailures = historyPartition.hidden > 0 && !state.showFailures;
    const resultList = historyPartition.visible.length
      ? historyPartition.visible
      : (rawResults.length
        ? [{ __hiddenFailurePlaceholder: true }]
        : [{ imageUrl: '', label: entry.prompt }]);

    resultList.forEach((res) => {
      const cell = document.createElement('div');
      cell.className = 'kc-history-card__thumb';
      if (res.__hiddenFailurePlaceholder) {
        const placeholder = document.createElement('div');
        placeholder.className = 'kc-history-card__placeholder kc-history-card__placeholder--notice';
        placeholder.textContent = 'Failure結果は非表示';
        cell.appendChild(placeholder);
      } else if (res.imageUrl) {
        const savedFileMeta = res.savedFile || {};
        const pathCandidate = res.fileName
          || savedFileMeta.fileName
          || savedFileMeta.filename
          || '';
        const mediaType = resolveMediaEntryType({
          filterType: res.filterType || res.type || res.sourceCategory || '',
          type: res.type || '',
          url: res.imageUrl,
          path: pathCandidate
        });
        if (mediaType === 'video') {
          const video = document.createElement('video');
          video.muted = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.autoplay = false;
          video.className = 'kc-history-card__video';
          applyAssetSrcWithFallback(video, res.imageUrl, { type: 'video' });
          applyLoopSettingToMedia(video);
          bindShowcaseMediaLifecycle(video, {
            src: res.imageUrl,
            mediaType: 'video',
            context: 'history-card'
          });
          attachHoverPlayback(video, { resetOnLeave: true, extraTargets: [cell] });
          cell.appendChild(video);
        } else if (mediaType === 'sound') {
          cell.classList.add('is-sound');
          const audio = document.createElement('audio');
          audio.controls = false;
          audio.preload = 'metadata';
          audio.className = 'kc-history-card__audio';
          audio.setAttribute('aria-hidden', 'true');
          audio.tabIndex = -1;
          applyAssetSrcWithFallback(audio, res.imageUrl, { type: 'audio' });
          applyLoopSettingToMedia(audio);
          bindShowcaseMediaLifecycle(audio, {
            src: res.imageUrl,
            mediaType: 'audio',
            context: 'history-card'
          });
          attachHoverPlayback(audio, { resetOnLeave: true, extraTargets: [cell] });

          const placeholder = document.createElement('div');
          placeholder.className = 'kc-history-card__placeholder kc-history-card__placeholder--sound';
          placeholder.textContent = 'SOUND';

          cell.append(audio, placeholder);
        } else if (mediaType === '3d') {
          cell.classList.add('is-3d');
          const thumbnailUrl = resolveHistory3dThumbnail(entry, res);
          if (thumbnailUrl) {
            const img = document.createElement('img');
            img.src = thumbnailUrl;
            img.alt = entry.prompt || entry.id || '3D result';
            cell.appendChild(img);
          } else {
            const { extension } = getResultFilterMeta(res);
            const placeholder = document.createElement('div');
            placeholder.className = 'kc-history-card__placeholder kc-history-card__placeholder--3d';
            placeholder.textContent = (extension ? extension.toUpperCase() : '3D');
            cell.appendChild(placeholder);
          }
        } else {
          const img = document.createElement('img');
          applyAssetSrcWithFallback(img, res.imageUrl);
          img.alt = entry.prompt || entry.id;
          cell.appendChild(img);
        }
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'kc-history-card__placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        cell.appendChild(placeholder);
      }
      thumbsWrap.appendChild(cell);
    });

    const textBlock = document.createElement('div');
    textBlock.className = 'kc-history-card__text';
    const memoText = (templateContext?.memo || '').trim();
    if (memoText) {
      const memoEl = document.createElement('div');
      memoEl.className = 'kc-history-card__memo';
      memoEl.textContent = memoText;
      textBlock.append(memoEl);
    }
    const promptText = (entry.prompt || '').trim();
    if (promptText) {
      const promptEl = document.createElement('div');
      promptEl.className = 'kc-history-card__prompt';
      if (memoText) {
        promptEl.classList.add('has-memo');
      }
      promptEl.textContent = promptText;
      textBlock.append(promptEl);
    }

    let failureNotice = null;
    if (hasHiddenFailures) {
      failureNotice = document.createElement('div');
      failureNotice.className = 'kc-history-card__notice';
      failureNotice.textContent = `Failure結果 ${historyPartition.hidden}件を非表示`;
    }

    const actions = document.createElement('div');
    actions.className = 'kc-history-card__actions';
    const hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'kc-history-card__icon';
    hideBtn.title = '履歴を削除';
    hideBtn.setAttribute('aria-label', '履歴を削除');
    hideBtn.textContent = '×';
    hideBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!window.confirm('この履歴を削除しますか？')) return;
      removeHistoryEntry(entry.id);
      renderHistory();
    });
    actions.append(hideBtn);

    card.append(header, thumbsWrap);
    if (failureNotice) {
      card.append(failureNotice);
    }
    if (textBlock.childElementCount > 0) {
      card.append(textBlock);
    }
    card.append(actions);
    card.addEventListener('click', () => {
      setHistoryActiveId(entry.id, { syncEngine: false, userInitiated: true });
      renderHistory();
    });
    list.append(card);
  });

  body.append(list);

  const inlineFooter = document.createElement('div');
  inlineFooter.className = 'kc-history-inlinefooter';
  const inlineCount = document.createElement('span');
  inlineCount.className = 'kc-history-inlinefooter__count';
  inlineCount.textContent = `表示中：${visibleEntries.length}/全${totalEntries}件`;
  list.append(inlineFooter);

  inlineFooter.append(inlineCount);

  if (canLoadMore) {
    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.type = 'button';
    loadMoreBtn.className = 'kc-button kc-button--ghost kc-history-inlinefooter__loadmore';
    const nextCount = Math.min(totalEntries, state.historyVisibleCount + HISTORY_VISIBLE_INCREMENT);
    loadMoreBtn.innerHTML = 'さらに30件<br>読み込む';
    loadMoreBtn.setAttribute('aria-label', `履歴をさらに30件読み込む (${visibleEntries.length}件から${nextCount}件まで表示)`);
    loadMoreBtn.addEventListener('click', () => {
      const previousScrollTop = body ? body.scrollTop : 0;
      const updated = Math.min(totalEntries, state.historyVisibleCount + HISTORY_VISIBLE_INCREMENT);
      if (updated !== state.historyVisibleCount) {
        state.historyVisibleCount = updated;
        renderHistory();
        requestAnimationFrame(() => {
          if (body) {
            body.scrollTop = previousScrollTop;
          }
        });
      }
    });
    inlineFooter.append(loadMoreBtn);
  }

  const activeEntry = getActiveHistoryEntry();
  if (activeEntry) {
    const resultsContainer = document.getElementById('kc-results');
    if (resultsContainer) renderResults(resultsContainer);
  }
  if (footer && state.history.length === 0) {
    footer.style.display = 'none';
  }
  updateBatchControlVisuals();
  scheduleShowcaseLayoutSync();
}

function renderParameterFields(engineMeta, paramsContainer) {
  paramsContainer.innerHTML = '';
  const submitParams = engineMeta?.tools?.submit?.parameters;
  if (!submitParams || !submitParams.properties) {
    paramsContainer.textContent = '調整可能なパラメータはありません';
    return;
  }

  const inputStore = ensureEngineInputs(engineMeta);
  ensureParameterDefaults(submitParams, inputStore);
  const engineCategory = normalizeCategory(engineMeta?.category || '');
  const isSoundEngine = engineCategory === 'sound';
  const soundTextKeys = new Set(getSoundTextParamKeys(engineMeta));
  const promptKey = getPromptKey(engineMeta);
  let soundTextFieldPresent = false;
  const requiredKeys = Array.isArray(submitParams.required)
    ? new Set(submitParams.required.map((item) => String(item)))
    : new Set();
  const manualRequired = ENGINE_PARAMETER_REQUIRED_HINTS[engineMeta.id];
  if (Array.isArray(manualRequired)) {
    manualRequired.forEach((key) => {
      if (key || key === 0) {
        requiredKeys.add(String(key));
      }
    });
  }

  Object.entries(submitParams.properties).forEach(([key, schema]) => {
    const isPromptField = Boolean(promptKey) && key === promptKey;

    const field = document.createElement('div');
    field.className = 'kc-param-field';

    const label = document.createElement('label');
    label.className = 'kc-label';
    const headerWrap = document.createElement('span');
    headerWrap.className = 'kc-param-label__header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'kc-param-label__name';
    nameSpan.textContent = key;
    const badges = [];
    const isRequiredField = requiredKeys.has(key);
    const isSoundTextField = !isPromptField && isSoundEngine && soundTextKeys.has(key);
    if (isRequiredField) {
      field.classList.add('kc-param-field--required');
      label.classList.add('kc-label--required');
      nameSpan.classList.add('kc-param-label__name--required');
    }
    if (isSoundTextField) {
      const badge = document.createElement('span');
      badge.className = 'kc-param-label__badge kc-param-label__badge--sound';
      badge.textContent = '音声テキスト';
      badges.push(badge);
    }
    headerWrap.appendChild(nameSpan);

    const descText = resolveParameterDescription(schema);
    let descSpan = null;
    if (descText) {
      descSpan = document.createElement('span');
      descSpan.className = 'kc-param-label__desc';
      descSpan.textContent = `— ${descText}`;
    }

    const fieldId = `kc-param-${engineMeta.id}-${key}`;

    let options = extractEnumOptions(schema, key);
    const optionHint = ENGINE_PARAMETER_OPTION_HINTS[engineMeta.id]
      ? ENGINE_PARAMETER_OPTION_HINTS[engineMeta.id][key]
      : null;
    const manualOptions = getManualParameterOptions(engineMeta, key, schema);
    const replaceSchemaOptions = optionHint && typeof optionHint === 'object' && optionHint.replace === true;
    if (replaceSchemaOptions) {
      options = manualOptions.slice();
    } else if (manualOptions.length) {
      options = mergeManualParameterOptions(options, manualOptions, schema);
    }
    const suppressSet = ENGINE_PARAMETER_OPTION_SUPPRESS[engineMeta.id];
    if (suppressSet && suppressSet.has(key)) {
      options = [];
    }
    const hasEnum = options.length > 0;
    const types = schemaTypes(schema);
    const isBoolean = types.length === 1 && types[0] === 'boolean';
    const isNumeric = types.includes('number') || types.includes('integer');
    const isInteger = types.includes('integer');

    if ((inputStore[key] === undefined || inputStore[key] === null) && !isPromptField) {
      const derivedDefault = deriveParameterDefault(engineMeta, key, schema, options);
      if (derivedDefault !== undefined) {
        inputStore[key] = derivedDefault;
      }
    }

    let control;
    let inputHandler = null;
    if (isPromptField) {
      control = document.createElement('textarea');
      control.rows = 3;
      control.classList.add('kc-param-textarea');
      control.dataset.minHeight = String(PROMPT_MIN_HEIGHT);
      control.dataset.maxHeight = String(PROMPT_MAX_HEIGHT);
      const value = inputStore?.[key];
      const initial = value !== undefined ? value : (schema?.default ?? '');
      const formattedInitial = formatParameterValueForInput(initial);
      control.value = formattedInitial;
      control.placeholder = PROMPT_PLACEHOLDER;
      control.spellcheck = true;
      attachPromptResizeHandlers(control);
      requestAnimationFrame(() => {
        adjustPromptFieldHeight(control, { force: true });
      });
      control.addEventListener('input', () => {
        inputStore[key] = coerceParameterValue(schema, control.value);
        adjustPromptFieldHeight(control);
        updateRunButtonState();
      });
      control.addEventListener('blur', () => {
        inputStore[key] = coerceParameterValue(schema, control.value);
      });
    } else if (isBoolean) {
      control = document.createElement('input');
      control.type = 'checkbox';
      const initial = inputStore?.[key];
      control.checked = initial !== undefined ? Boolean(initial) : Boolean(schema.default ?? false);
      control.addEventListener('change', () => {
        inputStore[key] = control.checked;
        updateRunButtonState();
      });
    } else if (isNumeric) {
      control = document.createElement('input');
      control.type = 'number';
      control.step = isInteger ? '1' : 'any';
      if (schema.minimum !== undefined) control.min = schema.minimum;
      if (schema.maximum !== undefined) control.max = schema.maximum;
      const value = inputStore?.[key] ?? schema.default;
      if (value !== undefined && value !== null) {
        control.value = value;
      } else {
        control.value = '';
      }
      inputHandler = () => {
        const parsed = control.value === '' ? undefined : Number(control.value);
        inputStore[key] = Number.isNaN(parsed) ? undefined : parsed;
      };
    } else {
      control = document.createElement('input');
      control.type = 'text';
      const value = inputStore?.[key];
      const initial = value !== undefined ? value : (schema.default ?? '');
      const formattedInitial = formatParameterValueForInput(initial);
      control.value = formattedInitial;
      if (isSoundTextField) {
        control.placeholder = SOUND_TEXT_PLACEHOLDER;
        if (!state.soundText || !state.soundText.trim()) {
          state.soundText = formattedInitial || '';
          updateActiveTemplateOverrides();
        }
        soundTextFieldPresent = true;
      }
      inputHandler = () => {
        inputStore[key] = coerceParameterValue(schema, control.value);
        if (isSoundTextField) {
          state.soundText = control.value || '';
          updateActiveTemplateOverrides();
          syncSoundTextField({ preferExisting: false });
        }
      };
    }

    control.id = fieldId;
    control.dataset.paramKey = key;
    control.classList.add('kc-param-input');
    if (isRequiredField) {
      control.setAttribute('aria-required', 'true');
    }

    const appendStandardLabel = () => {
      badges.forEach((badge) => headerWrap.appendChild(badge));
      const fragments = [headerWrap];
      if (descSpan) fragments.push(descSpan);
      label.append(...fragments);
      label.htmlFor = fieldId;
    };

    if (isBoolean) {
      const checkboxWrap = document.createElement('span');
      checkboxWrap.className = 'kc-param-checkbox-wrap';
      checkboxWrap.append(control);
      const textWrap = document.createElement('span');
      textWrap.className = 'kc-param-label__text';
      const headerClone = headerWrap.cloneNode(false);
      badges.forEach((badge) => {
        if (badge) headerClone.appendChild(badge.cloneNode(true));
      });
      headerClone.appendChild(nameSpan);
      textWrap.append(headerClone);
      if (descSpan) {
        textWrap.append(descSpan);
      }
      label.classList.add('kc-label--checkbox');
      label.htmlFor = '';
      label.append(checkboxWrap, textWrap);
      field.classList.add('kc-param-field--boolean');
      field.append(label);
    } else if (hasEnum) {
      appendStandardLabel();
      field.classList.add('kc-param-field--with-select');
      const combo = document.createElement('div');
      combo.className = 'kc-param-combo';

      const select = document.createElement('select');
      select.className = 'kc-param-select';
      select.dataset.paramKey = key;

      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = 'プリセットを選択';
      select.append(placeholderOption);

      options.forEach((option, index) => {
        const opt = document.createElement('option');
        opt.value = String(index);
        opt.textContent = option.label;
        select.append(opt);
      });

      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = 'カスタム入力';
      select.append(customOption);

      const currentValue = inputStore?.[key];
      const matchedIndex = options.findIndex((option) => isSameParameterValue(option.value, currentValue));
      if (matchedIndex !== -1) {
        select.value = String(matchedIndex);
        control.value = formatParameterValueForInput(options[matchedIndex].value);
      } else if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
        select.value = 'custom';
        control.value = formatParameterValueForInput(currentValue);
      } else {
        select.value = '';
        control.value = '';
      }

      select.addEventListener('change', () => {
        const selected = select.value;
        if (selected === 'custom') {
          control.focus();
          return;
        }
        if (selected === '') {
          delete inputStore[key];
          control.value = '';
          if (inputHandler) inputHandler();
          updateRunButtonState();
          return;
        }
        const option = options[Number.parseInt(selected, 10)];
        if (!option) return;
        const typed = normalizeOptionValue(schema, option.value);
        inputStore[key] = typed;
        control.value = formatParameterValueForInput(typed);
        if (inputHandler) {
          inputHandler();
        }
        updateRunButtonState();
      });

      const handleManualInput = () => {
        if (inputHandler) inputHandler();
        select.value = control.value === '' ? '' : 'custom';
      };

      control.addEventListener('input', handleManualInput);

      combo.append(select, control);
      field.append(label, combo);
    } else {
      appendStandardLabel();
      if (inputHandler) {
        control.addEventListener('input', inputHandler);
      }
      field.append(label, control);
    }
    paramsContainer.append(field);
  });

  if (isSoundEngine && soundTextFieldPresent) {
    syncSoundTextField({ preferExisting: false });
  }
}

function renderEngineCards(categoryId, container, options = {}) {
  const { displayList = null, totalList = null } = options;
  container.innerHTML = '';
  const baseList = Array.isArray(totalList)
    ? totalList
    : (state.enginesByCategory.get(categoryId) || []);
  const list = Array.isArray(displayList) ? displayList : baseList;
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    const keyword = state.engineSearchKeyword.trim();
    empty.textContent = keyword && keyword.length && baseList.length
      ? '条件に一致するMCPが見つかりません'
      : '利用可能なツールが見つかりません';
    container.append(empty);
    return;
  }

  list.forEach((engineMeta) => {
    const selected = state.selected.has(engineMeta.id);
    const card = document.createElement('div');
    card.className = 'kc-engine-card';
    if (selected) card.classList.add('kc-engine-card--active');
    applyBadgeTheme(card, [
      engineMeta.category,
      engineMeta.sourceCategory,
      determineEngineTypeKey(engineMeta)
    ], { fallbackCategory: categoryId });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    const engineLabel = engineMeta.displayLabel || engineMeta.label || deriveEngineLabel(engineMeta.id);
    card.setAttribute('aria-label', `${engineLabel} を選択`);

    const header = document.createElement('div');
    header.className = 'kc-engine-card__header';

    const title = document.createElement('div');
    title.className = 'kc-engine-card__title';
    title.textContent = engineLabel;

    const controls = document.createElement('div');
    controls.className = 'kc-engine-card__controls';

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'kc-button-mini';
    detailBtn.innerHTML = '⚙';
    detailBtn.title = '詳細設定';
    detailBtn.setAttribute('aria-label', `${engineLabel} の詳細設定`);
    detailBtn.setAttribute('aria-haspopup', 'dialog');
    detailBtn.setAttribute('aria-expanded', 'false');

    const showParams = () => {
      cancelParamsPopoverClose();
      openParamsPopover(engineMeta, detailBtn, { renderParameterFields });
    };

    const hideParams = (evt) => {
      const activePopover = getActiveParamsPopover();
      if (!activePopover || activePopover.anchor !== detailBtn) return;
      if (evt && evt.relatedTarget && activePopover.popover?.contains(evt.relatedTarget)) {
        return;
      }
      if (isParamsPopoverEngaged()) {
        cancelParamsPopoverClose();
        return;
      }
      scheduleParamsPopoverClose();
    };

    detailBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      showParams();
    });
    detailBtn.addEventListener('mouseenter', (evt) => {
      evt.stopPropagation();
      showParams();
    });
    detailBtn.addEventListener('focus', showParams);
    detailBtn.addEventListener('mouseleave', hideParams);
    detailBtn.addEventListener('blur', hideParams);
    detailBtn.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        showParams();
      }
    });

    controls.append(detailBtn);
    header.append(title, controls);

    card.append(header);

    const toggleSelection = () => {
      closeParamsPopover();
      if (state.selected.has(engineMeta.id)) {
        state.selected.delete(engineMeta.id);
      } else {
        ensureEngineInputs(engineMeta);
        state.selected.set(engineMeta.id, {
          id: engineMeta.id,
          label: engineLabel,
          category: engineMeta.category,
          requiresMedia: Boolean(engineMeta.requiresMedia),
          requiredMediaTypes: Array.isArray(engineMeta.requiredMediaTypes)
            ? engineMeta.requiredMediaTypes.slice()
            : [],
          requiresPrompt: engineRequiresPrompt(engineMeta),
          requiresSoundText: engineRequiresSoundText(engineMeta),
          promptKey: engineMeta.promptKey || getPromptKey(engineMeta),
          soundTextKeys: Array.isArray(engineMeta.soundTextKeys)
            ? engineMeta.soundTextKeys.slice()
            : [],
          requiredSoundTextKeys: Array.isArray(engineMeta.requiredSoundTextKeys)
            ? engineMeta.requiredSoundTextKeys.slice()
            : [],
          docSummaryEn: engineMeta.docSummaryEn || '',
          docSummaryJa: engineMeta.docSummaryJa || ''
        });
        applySelectedMediaToEngineInputs();
      }
      renderCategories();
      updateRunButtonState();
    };

    card.addEventListener('click', toggleSelection);
    card.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        toggleSelection();
      }
    });

    container.append(card);
  });
}



function renderCategories() {
  const container = document.getElementById('kc-engines');
  if (!container) return;
  renderSelectionSummary();
  renderEngineSubTabs();
  renderEngineTabs();
  container.innerHTML = '';

  const categoryId = state.activeEngineCategory;
  ensureCategoryCollections(categoryId);
  const activeSubTab = state.categoryTabs[categoryId] || 'engine';
  const isEngineView = activeSubTab === 'engine';
  const isMediaView = activeSubTab === 'media';

  const contentHost = document.createElement('div');
  contentHost.className = 'kc-engine-content';
  container.append(contentHost);

  const toolbar = document.querySelector('.kc-engine-toolbar');
  if (toolbar) {
    toolbar.style.display = isEngineView ? 'flex' : 'none';
    toolbar.hidden = !isEngineView;
  }

  const toolbarSearchHost = document.getElementById('kc-engine-toolbar-search');
  const toolbarSearchSlot = document.getElementById('kc-engine-toolbar-search-slot');
  if (toolbarSearchSlot) {
    toolbarSearchSlot.innerHTML = '';
  }
  if (toolbarSearchHost) {
    if (isEngineView) {
      if (toolbarSearchSlot) {
        const searchControls = createEngineSearchControls();
        toolbarSearchSlot.append(searchControls);
      }
      toolbarSearchHost.removeAttribute('hidden');
    } else {
      toolbarSearchHost.setAttribute('hidden', '');
    }
  }

  if (!state.categories.length) {
    renderEngineStats({
      isLoading: true,
      engines: [],
      categoryId,
      visible: isEngineView
    });
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    empty.textContent = '利用可能なツールが見つかりません';
    contentHost.append(empty);
    scheduleShowcaseLayoutSync();
    return;
  }

  const viewingAll = isAllCategory(categoryId);
  let engines = [];
  let isLoading = false;

  if (viewingAll) {
    const aggregated = state.enginesByCategory.get(ALL_CATEGORY_ID);
    if (Array.isArray(aggregated)) {
      engines = aggregated;
    }
    isLoading = !Array.isArray(aggregated)
      && (state.enginesLoading.size > 0 || state.engineIndex.size === 0);
  } else {
    const hasEntry = state.enginesByCategory.has(categoryId);
    const payload = hasEntry ? state.enginesByCategory.get(categoryId) : null;
    engines = Array.isArray(payload) ? payload : [];
    isLoading = state.enginesLoading.has(categoryId) || payload === null || !hasEntry;
  }

  const mainTabsEl = document.getElementById('kc-engine-tabs');
  if (mainTabsEl) {
    if (isEngineView) {
      mainTabsEl.classList.remove('kc-panel-tabs--hidden');
      mainTabsEl.style.display = state.categories.length > 1 ? 'inline-flex' : 'none';
      mainTabsEl.removeAttribute('hidden');
    } else {
      mainTabsEl.classList.add('kc-panel-tabs--hidden');
      mainTabsEl.style.display = 'none';
      mainTabsEl.setAttribute('hidden', '');
    }
  }

  const statsEngines = viewingAll
    ? (Array.isArray(state.enginesByCategory.get(ALL_CATEGORY_ID))
      ? state.enginesByCategory.get(ALL_CATEGORY_ID)
      : engines)
    : engines;

  const statsBaseList = Array.isArray(statsEngines) ? statsEngines : [];
  const displayBaseList = Array.isArray(engines) ? engines : [];
  const keyword = isEngineView ? state.engineSearchKeyword : '';
  const normalizedCategoryId = normalizeCategory(categoryId);
  const activeTypeFilters = getEngineTypeFilterSet(normalizedCategoryId);
  const hasActiveTypeFilters = isEngineView && activeTypeFilters.size > 0;
  const allowedTypesForFilter = new Set(knownTypesForCategory(normalizedCategoryId));
  const applyTypeFilterToList = (list) => {
    if (!Array.isArray(list)) return [];
    if (!hasActiveTypeFilters) {
      return list;
    }
    return list.filter((engine) => {
      const key = determineEngineTypeKey(engine, allowedTypesForFilter);
      const normalizedKey = normalizeEngineTypeFilterValue(key) || 'other';
      return activeTypeFilters.has(normalizedKey);
    });
  };

  const statsFiltered = filterEnginesByKeyword(statsBaseList, keyword);
  const statsVisibleList = isLoading ? [] : applyTypeFilterToList(statsFiltered);

  let displaySearchFiltered = [];
  if (!isLoading) {
    displaySearchFiltered = filterEnginesByKeyword(displayBaseList, keyword).filter((engine) => {
      if (!isMediaView) return true;
      return Boolean(engine && engine.requiresMedia);
    });
  }
  const displayFiltered = isLoading ? [] : applyTypeFilterToList(displaySearchFiltered);

  renderEngineStats({
    isLoading,
    engines: statsBaseList,
    filteredEngines: statsFiltered,
    visibleEngines: statsVisibleList,
    categoryId,
    searchKeyword: keyword,
    visible: isEngineView
  });

  if (isLoading) {
    const loading = document.createElement('div');
    loading.className = 'kc-engines__empty';
    loading.textContent = '読み込み中...';
    contentHost.append(loading);
    scheduleShowcaseLayoutSync();
    return;
  }

  if (!isEngineView) {
    renderSelectionSummary();
    renderMediaLibrary(contentHost);
    scheduleShowcaseLayoutSync();
    return;
  }

  const listRoot = document.createElement('div');
  listRoot.className = 'kc-engine-list';
  contentHost.append(listRoot);

  if (!displayBaseList.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    empty.textContent = '利用可能なツールが見つかりません';
    listRoot.append(empty);
    scheduleShowcaseLayoutSync();
    return;
  }

  if (!displayFiltered.length) {
    const empty = document.createElement('div');
    empty.className = 'kc-engines__empty';
    const hasKeyword = Boolean(keyword && keyword.trim());
    const typeFilterActive = hasActiveTypeFilters;
    const hasResultsBeforeTypeFilter = displaySearchFiltered.length > 0;
    let message = '利用可能なツールが見つかりません';
    if (typeFilterActive && hasResultsBeforeTypeFilter) {
      message = '選択したタイプに一致するMCPが見つかりません';
    } else if (hasKeyword) {
      message = '条件に一致するMCPが見つかりません';
    }
    empty.textContent = message;
    listRoot.append(empty);
    scheduleShowcaseLayoutSync();
    return;
  }

  renderEngineCards(categoryId, listRoot, { displayList: displayFiltered, totalList: displayBaseList });
  scheduleShowcaseLayoutSync();
}

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log10(size) / 3), units.length - 1);
  const value = size / (10 ** (exponent * 3));
  return `${value.toFixed(value >= 100 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function formatMcpTimestamp(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return formatter.format(new Date(ms));
}

function buildImageUrl(savedFile) {
  if (savedFile?.webPath) {
    const web = savedFile.webPath.startsWith('/') ? savedFile.webPath : `/${savedFile.webPath}`;
    return normalizeShowcaseAssetUrl(web);
  }
  if (savedFile?.absolute && state.scanPath && savedFile.absolute.startsWith(state.scanPath)) {
    const relative = savedFile.absolute.slice(state.scanPath.length);
    if (!relative) return '';
    const web = `/${relative.replace(/\\/g, '/')}`;
    return normalizeShowcaseAssetUrl(web);
  }
  return normalizeShowcaseAssetUrl(savedFile?.absolute || '');
}

function getActivePromptForCategory(category) {
  const normalized = normalizeCategory(category);
  const activeEntry = getActiveHistoryEntry();
  if (activeEntry && activeEntry.category === normalized) {
    return activeEntry.prompt || state.prompt || '';
  }
  const fallback = state.history.find((entry) => entry.category === normalized);
  return fallback?.prompt || state.prompt || '';
}

function renderResults(container) {
  closeResultsModal();
  closeTemplateMenu();
  const wasPromptPopoverOpen = Boolean(state.resultsPromptExpanded);
  closePromptPopover({ resetState: false });
  container.innerHTML = '';
  const results = getCurrentResults();
  syncFailureToggle();
  syncInputToggle();
  syncParameterToggle();
  const categoryBadge = document.getElementById('kc-results-category');
  const typeBadge = document.getElementById('kc-results-type');
  const activeEntry = getActiveHistoryEntry();
  const activeCategoryId = normalizeCategory(activeEntry?.category || state.activeCategory);
  if (categoryBadge) {
    categoryBadge.textContent = categoryLabel(activeCategoryId);
    applyBadgeTheme(categoryBadge, activeCategoryId, { fallbackCategory: activeCategoryId });
  }
  const templateNameEl = document.getElementById('kc-results-template-name');
  const promptLabel = document.getElementById('kc-results-prompt');
  const promptPanel = document.getElementById('kc-results-prompt-panel');
  const promptMemoEl = document.getElementById('kc-results-prompt-memo');
  const promptText = document.getElementById('kc-results-prompt-text');
  const promptHost = document.getElementById('kc-results-prompt-host');
  const filterRow = document.getElementById('kc-results-filter-row');
  const filterWrap = document.getElementById('kc-results-file-filter-wrap');
  const expandBtn = document.getElementById('kc-results-expand');
  if (typeBadge) {
    clearBadgeTheme(typeBadge);
  }
  if (expandBtn) {
    const disabled = !results.length && !(state.isRunning && state.activeJobSnapshot);
    expandBtn.disabled = disabled;
    expandBtn.setAttribute('aria-disabled', String(disabled));
  }

  const templateContext = resolveEntryTemplateContext(activeEntry)
    || cloneTemplateContext(state.currentRunTemplateContext || state.activeTemplateContext);
  const templateName = templateContext?.name || '';
  const templateMemo = (templateContext?.memo || '').trim();
  if (templateNameEl) {
    if (templateName) {
      templateNameEl.textContent = templateName;
      templateNameEl.hidden = false;
    } else {
      templateNameEl.textContent = '';
      templateNameEl.hidden = true;
    }
  }

  const normalizedCategory = normalizeCategory(activeCategoryId);
  const isAllCategoryView = normalizedCategory === ALL_CATEGORY_ID;
  const displayOrderMap = createDisplayOrderMap(normalizedCategory);
  let resultsForRender = Array.isArray(results) ? results.slice() : [];
  let pendingCount = 0;

  const jobSnapshot = state.isRunning ? state.activeJobSnapshot : null;
  const activeJobId = jobSnapshot?.id || state.currentJobId || '';
  const statusMap = new Map();
  if (jobSnapshot && Array.isArray(jobSnapshot.engines)) {
    jobSnapshot.engines.forEach((engine) => {
      statusMap.set(engine.id, engine);
    });
  }

  const engineOrderSource = (state.currentJobEngines && state.currentJobEngines.length)
    ? state.currentJobEngines
    : (jobSnapshot?.engines || []);

  if (engineOrderSource.length) {
    const resultMap = new Map(resultsForRender.map((entry) => [entry.engineId, entry]));
    const combined = [];
    const usedIds = new Set();

    engineOrderSource.forEach((engine) => {
      if (!engine || !engine.id) return;
      const engineCategory = normalizeCategory(engine.category || normalizedCategory);
      if (!isAllCategoryView && engineCategory !== normalizedCategory) {
        return;
      }
      const existing = resultMap.get(engine.id);
      if (existing) {
        if (!Number.isFinite(existing.displayOrder)) {
          existing.displayOrder = resolveEngineDisplayOrder(engine.id, engineCategory);
        }
        const metaStatus = statusMap.get(engine.id);
        if (metaStatus?.cancelRequested && !isJobTerminal(metaStatus.status) && existing.__pending) {
          existing.status = 'cancelling';
        }
        combined.push(existing);
        usedIds.add(engine.id);
        return;
      }
      const metaStatus = statusMap.get(engine.id);
      const effectiveStatus = metaStatus && metaStatus.cancelRequested && !isJobTerminal(metaStatus.status)
        ? 'cancelling'
        : (metaStatus?.status || 'running');
      combined.push({
        engineId: engine.id,
        label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
        category: engineCategory,
        type: normalizeTypeToken(engine.category) || engine.category || '',
        status: effectiveStatus,
        displayOrder: resolveEngineDisplayOrder(engine.id, engineCategory),
        __pending: true
      });
      pendingCount += 1;
    });

    resultsForRender.forEach((entry) => {
      const entryCategory = normalizeCategory(entry.category || normalizedCategory);
      if (!isAllCategoryView && entryCategory !== normalizedCategory) {
        return;
      }
      if (usedIds.has(entry.engineId)) {
        return;
      }
      if (!Number.isFinite(entry.displayOrder)) {
        entry.displayOrder = resolveEngineDisplayOrder(entry.engineId, entryCategory);
      }
      combined.push(entry);
    });

    if (combined.length) {
      resultsForRender = combined;
      sortEntriesInPlace(resultsForRender, normalizedCategory, displayOrderMap);
    }
  } else if (resultsForRender.length > 1) {
    sortEntriesInPlace(resultsForRender, normalizedCategory, displayOrderMap);
  }

  if (!resultsForRender.length && state.isRunning) {
    const fallbackSource = engineOrderSource.length
      ? engineOrderSource
      : Array.from(state.selected.values() || []);
    const seenIds = new Set();
    const pendingEntries = [];
    fallbackSource.forEach((engine) => {
      if (!engine || !engine.id || seenIds.has(engine.id)) return;
      const engineCategory = normalizeCategory(engine.category || normalizedCategory);
      if (!isAllCategoryView && engineCategory !== normalizedCategory) return;
      const metaStatus = statusMap.get(engine.id);
      const effectiveStatus = metaStatus && metaStatus.cancelRequested && !isJobTerminal(metaStatus.status)
        ? 'cancelling'
        : (metaStatus?.status || 'running');
      pendingEntries.push({
        engineId: engine.id,
        label: engine.displayLabel || engine.label || deriveEngineLabel(engine.id),
        category: engineCategory,
        type: normalizeTypeToken(engine.category) || engine.category || '',
        status: effectiveStatus,
        displayOrder: resolveEngineDisplayOrder(engine.id, engineCategory),
        __pending: true
      });
      seenIds.add(engine.id);
    });
    if (pendingEntries.length) {
      resultsForRender = pendingEntries;
      pendingCount = pendingEntries.length;
      sortEntriesInPlace(resultsForRender, normalizedCategory, displayOrderMap);
    }
  }

  const allResultsForRender = resultsForRender;
  const filterSummary = summarizeResultsByFileAttributes(allResultsForRender);
  updateResultsFileFilterControl(filterSummary);

  const activeFileFilter = state.resultsFileFilter || 'all';
  const filterActive = activeFileFilter !== 'all';
  const filteredResultsForPartition = applyResultsFileFilter(allResultsForRender, activeFileFilter);

  const partition = splitResultsByFailure(filteredResultsForPartition);
  let visibleResults = partition.visible;
  const hasHiddenFailures = partition.hidden > 0;
  const filterRemovedAllVisible = filterActive
    && allResultsForRender.length > 0
    && filteredResultsForPartition.length === 0;

  if (!visibleResults.length) {
    const message = filterRemovedAllVisible
      ? '選択したファイル種別に一致する生成結果がありません'
      : (hasHiddenFailures
        ? 'Failure結果は非表示になっています'
        : '選択したカテゴリの生成結果がありません');
    const messageNode = document.createElement('div');
    messageNode.className = 'kc-results__message';
    messageNode.textContent = message;
    container.append(messageNode);
    if (typeBadge) {
      typeBadge.textContent = '';
      typeBadge.style.display = 'none';
      typeBadge.classList.remove('is-pending');
      clearBadgeTheme(typeBadge);
    }
    if (promptLabel) {
      promptLabel.textContent = '';
    }
    if (expandBtn) {
      expandBtn.disabled = true;
      expandBtn.setAttribute('aria-disabled', 'true');
    }
    updateBatchControlVisuals();
    return;
  }

  resultsForRender = visibleResults;

  const primaryTypeToken = (() => {
    if (!resultsForRender.length) return '';
    const tokens = collectResultTypes(resultsForRender[0]);
    return tokens.length ? tokens[0].toUpperCase() : '';
  })();
  const fallbackTypeToken = (() => {
    if (!normalizedCategory || normalizedCategory === ALL_CATEGORY_ID) return '';
    return normalizedCategory.toUpperCase();
  })();
  const templateTypeToken = templateContext?.type
    ? normalizeTypeToken(templateContext.type)?.toUpperCase()
    : '';
  const computedPrimaryType = templateTypeToken || primaryTypeToken;
  const baseTypeLabel = pendingCount > 0
    ? (fallbackTypeToken || computedPrimaryType)
    : (computedPrimaryType || fallbackTypeToken);
  const typeThemeTokens = [];
  if (templateTypeToken) {
    typeThemeTokens.push(templateTypeToken);
  } else if (primaryTypeToken) {
    typeThemeTokens.push(primaryTypeToken);
  }
  if (normalizedCategory && normalizedCategory !== ALL_CATEGORY_ID) {
    typeThemeTokens.push(normalizedCategory);
  }
  const categoryBadgeLabel = (categoryBadge?.textContent || '').trim().toLowerCase();
  const shouldHideTypeBadge = (pendingCount > 0 && state.isRunning)
    || !baseTypeLabel
    || (baseTypeLabel && categoryBadgeLabel && baseTypeLabel.toLowerCase() === categoryBadgeLabel);

  if (typeBadge) {
    if (!shouldHideTypeBadge && baseTypeLabel) {
      typeBadge.textContent = baseTypeLabel;
      typeBadge.style.display = 'inline-flex';
      typeBadge.classList.toggle('is-pending', pendingCount > 0);
      applyBadgeTheme(typeBadge, typeThemeTokens.length ? typeThemeTokens : baseTypeLabel, {
        fallbackCategory: activeCategoryId
      });
    } else {
      typeBadge.textContent = '';
      typeBadge.style.display = 'none';
      typeBadge.classList.remove('is-pending');
      clearBadgeTheme(typeBadge);
    }
  }

  let runningBadge = document.getElementById('kc-results-running');
  const ensureRunningBadgeElement = () => {
    if (runningBadge && runningBadge instanceof HTMLElement) {
      return runningBadge;
    }
    if (!typeBadge || !typeBadge.parentElement) return null;
    runningBadge = document.createElement('span');
    runningBadge.id = 'kc-results-running';
    runningBadge.className = 'kc-badge kc-badge--status';
    runningBadge.style.display = 'none';
    typeBadge.parentElement.appendChild(runningBadge);
    return runningBadge;
  };

  if (pendingCount > 0 && state.isRunning) {
    const badge = ensureRunningBadgeElement();
    if (badge) {
      badge.textContent = 'RUNNING';
      badge.style.display = 'inline-flex';
      badge.classList.add('is-pending');
    }
  } else if (runningBadge) {
    runningBadge.textContent = '';
    runningBadge.style.display = 'none';
    runningBadge.classList.remove('is-pending');
  }

  const resultLightboxEntries = createLightboxEntriesFromSources(resultsForRender, { preferImageUrl: true });

  resultsForRender.forEach((entry, index) => {
    const card = document.createElement('div');
    const isPending = Boolean(entry.__pending);
    card.className = 'kc-result-card';
    if (isPending) {
      card.classList.add('is-pending');
    }

    const imageWrap = document.createElement('div');
    imageWrap.className = 'kc-result-card__image';
    const normalizedLabel = formatEngineLabel(entry);
    const engineMeta = statusMap.get(entry.engineId);
    const engineStatus = engineMeta?.status || entry.status || '';
    const engineCancelRequested = Boolean(engineMeta?.cancelRequested);
    if (engineCancelRequested && !isJobTerminal(engineStatus)) {
      entry.status = 'cancelling';
    }
    if (!isPending && entry.imageUrl) {
      const mediaType = resolveMediaEntryType({
        filterType: entry.filterType || entry.type || '',
        type: entry.type || '',
        url: entry.imageUrl,
        path: entry.fileName || ''
      });
      let previewEl;
      if (mediaType === 'video') {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.autoplay = false;
        video.className = 'kc-result-card__video';
        applyAssetSrcWithFallback(video, entry.imageUrl, { type: 'video' });
        applyLoopSettingToMedia(video);
        bindShowcaseMediaLifecycle(video, {
          src: entry.imageUrl,
          mediaType: 'video',
          context: 'results-card'
        });
        attachHoverPlayback(video, { resetOnLeave: true });
        previewEl = video;
      } else if (mediaType === 'sound') {
        imageWrap.classList.add('is-sound');
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'metadata';
        audio.className = 'kc-result-card__audio';
        applyAssetSrcWithFallback(audio, entry.imageUrl, { type: 'audio' });
        applyLoopSettingToMedia(audio);
        bindShowcaseMediaLifecycle(audio, {
          src: entry.imageUrl,
          mediaType: 'audio',
          context: 'results-card'
        });
        attachHoverPlayback(audio, { resetOnLeave: true, extraTargets: [card, imageWrap] });
        previewEl = audio;
      } else if (mediaType === '3d') {
        if (isPreviewable3dEntry({ ...entry, url: entry.imageUrl })) {
          mount3dPreview(imageWrap, {
            src: entry.imageUrl,
            alt: normalizedLabel,
            variant: 'card'
          });
        } else {
          render3dDownloadMessage(imageWrap, entry.imageUrl, 'card');
        }
        previewEl = null;
      } else {
        const img = document.createElement('img');
        applyAssetSrcWithFallback(img, entry.imageUrl);
        img.alt = normalizedLabel;
        previewEl = img;
      }
      if (previewEl) {
        imageWrap.appendChild(previewEl);
      }
      imageWrap.addEventListener('click', () => {
        openMediaLightbox(resultLightboxEntries, index);
      });
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = isPending
        ? 'kc-result-card__placeholder kc-result-card__placeholder--pending'
        : 'kc-result-card__placeholder';
      if (isPending) {
        placeholder.textContent = translateEngineStatus({ status: entry.status });
      } else {
        placeholder.textContent = entry.error ? 'Failure' : 'No Preview';
      }
      imageWrap.appendChild(placeholder);
    }

    const meta = document.createElement('div');
    meta.className = 'kc-result-card__meta';
    const engineLine = document.createElement('div');
    engineLine.className = 'kc-result-engine';
    engineLine.textContent = normalizedLabel || '-';

    const fileLine = document.createElement('div');
    fileLine.className = 'kc-result-file';
    meta.append(engineLine);
    if (!isPending && entry.fileName) {
      const displayIndex = Number.isFinite(entry.savedFileIndex) ? Number(entry.savedFileIndex) : index;
      const displayCount = Number.isFinite(entry.savedFilesCount) ? Number(entry.savedFilesCount) : resultsForRender.length;
      const positionSuffix = displayCount > 1
        ? ` (${displayIndex + 1}/${displayCount})`
        : '';
      fileLine.textContent = `${entry.fileName}${positionSuffix}`;
      meta.append(fileLine);
    }

    if (state.showInputs !== false && Array.isArray(entry.inputMedia) && entry.inputMedia.length) {
      const normalizedInputs = normalizeAssignmentSlotLabels(entry.inputMedia);
      if (normalizedInputs !== entry.inputMedia) {
        entry.inputMedia = normalizedInputs;
      }
      const inputsSection = document.createElement('div');
      inputsSection.className = 'kc-result-card__inputs';

      const inputsTitle = document.createElement('span');
      inputsTitle.className = 'kc-result-card__inputs-title';
      inputsTitle.textContent = 'INPUT';
      inputsSection.append(inputsTitle);

      const inputsTrack = document.createElement('div');
      inputsTrack.className = 'kc-result-card__inputs-track';

      const totalInputs = entry.inputMedia.length;
      const lightboxEntries = [];
      const lightboxIndexByAssignment = new Map();

      entry.inputMedia.forEach((assignment, inputIndex) => {
        if (!assignment || !assignment.media) return;
        const media = assignment.media || {};
        const normalizedSlotType = normalizeMediaGroupType(
          assignment.slotType || assignment.type || media.filterType || media.type || ''
        );
        const normalizedAssignmentLabel = normalizeSlotLabel(assignment.slotLabel, {
          type: normalizedSlotType,
          key: assignment.paramKey || '',
          index: inputIndex
        });
        const displayLabel = formatSlotLabelForDisplay(
          normalizedAssignmentLabel,
          normalizedSlotType,
          inputIndex,
          totalInputs
        );

        const hasPreviewEntry = hasMediaUrl(media);
        const resolvedType = normalizeMediaGroupType(media.filterType || normalizedSlotType || '');
        if (hasPreviewEntry) {
          const previewLabel = displayLabel || media.name || media.path || 'INPUT';
          const extendedName = media.name && media.name !== previewLabel
            ? `${previewLabel} • ${media.name}`
            : previewLabel;
          lightboxIndexByAssignment.set(inputIndex, lightboxEntries.length);
          lightboxEntries.push({
            ...media,
            filterType: resolvedType,
            name: extendedName
          });
        }

        const item = document.createElement('div');
        item.className = 'kc-result-input';
        if (hasPreviewEntry) {
          item.setAttribute('role', 'button');
          item.tabIndex = 0;
        }

        const label = document.createElement('span');
        label.className = 'kc-result-input__label';
        label.textContent = displayLabel;
        item.append(label);

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'kc-result-input__thumb';
        let thumbData = null;
        if (hasPreviewEntry) {
          thumbData = createResultInputThumb(media, {
            label: displayLabel,
            type: resolvedType
          });
        }
        if (thumbData && thumbData.element) {
          if (thumbData.modifier) {
            thumbWrap.classList.add(`kc-result-input__thumb--${thumbData.modifier}`);
          }
          if (!thumbData.isPlaceholder) {
            thumbWrap.classList.add('kc-result-input__thumb--has-preview');
          }
          thumbWrap.append(thumbData.element);
        } else {
          const placeholder = document.createElement('span');
          placeholder.className = 'kc-result-input__placeholder';
          const placeholderLabel = (media.ext || resolvedType || normalizedSlotType || '?').toUpperCase();
          placeholder.textContent = placeholderLabel;
          thumbWrap.append(placeholder);
        }
        if (media.path || media.url) {
          const titleParts = [];
          if (displayLabel) titleParts.push(displayLabel);
          if (media.name && media.name !== displayLabel) titleParts.push(media.name);
          if (media.path && media.path !== media.name) titleParts.push(media.path);
          if (media.url && media.url !== media.path) titleParts.push(media.url);
          if (titleParts.length) {
            item.title = titleParts.join('\n');
          }
        }

        if (hasPreviewEntry) {
          const openPreview = (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            const lightboxIndex = lightboxIndexByAssignment.get(inputIndex);
            if (lightboxIndex === undefined) return;
            if (!lightboxEntries.length) return;
            openMediaLightbox(lightboxEntries, lightboxIndex);
          };

          item.addEventListener('click', openPreview);
          item.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter' || evt.key === ' ') {
              openPreview(evt);
            }
          });
        }

        item.append(thumbWrap);
        inputsTrack.append(item);
      });

      inputsSection.append(inputsTrack);
      meta.append(inputsSection);
    }

    if (state.showParameters !== false && Array.isArray(entry.inputParameters) && entry.inputParameters.length) {
      const paramsButton = document.createElement('button');
      paramsButton.type = 'button';
      paramsButton.className = 'kc-result-card__param-btn';
      paramsButton.setAttribute('aria-expanded', 'false');
      paramsButton.innerHTML = '<span aria-hidden="true">⚙️</span><span>パラメータ</span>';

      const paramsPanel = document.createElement('div');
      paramsPanel.className = 'kc-result-card__params';
      paramsPanel.hidden = true;

      entry.inputParameters.forEach((param) => {
        if (!param || !param.key) return;
        const row = document.createElement('div');
        row.className = 'kc-result-card__param-row';
        const keyLabel = document.createElement('span');
        keyLabel.className = 'kc-result-card__param-key';
        keyLabel.textContent = param.key;
        const valueLabel = document.createElement('span');
        valueLabel.className = 'kc-result-card__param-value';
        valueLabel.textContent = param.value || '';
        row.append(keyLabel, valueLabel);
        paramsPanel.append(row);
      });

      paramsButton.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        const isOpen = paramsPanel.hidden === false;
        paramsPanel.hidden = isOpen;
        paramsButton.setAttribute('aria-expanded', String(!isOpen));
        paramsButton.classList.toggle('is-open', !isOpen);
      });

      meta.append(paramsButton, paramsPanel);
    }

    if (isPending) {
      const statusBadge = document.createElement('div');
      statusBadge.className = 'kc-badge kc-result-card__status is-pending';
      statusBadge.textContent = translateEngineStatus({ status: entry.status });
      meta.append(statusBadge);
    }

    if (entry.error) {
      const err = document.createElement('div');
      err.className = 'kc-result-error';
      err.textContent = entry.error;
      meta.append(err);
    }

    const engineIsTerminal = isJobTerminal(engineStatus);
    const canCancelIndividually = Boolean(
      state.isRunning
      && activeJobId
      && engineMeta
      && !engineCancelRequested
      && !engineIsTerminal
    );
    if (canCancelIndividually) {
      const actions = document.createElement('div');
      actions.className = 'kc-result-card__actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'kc-result-card__cancel-btn';
      cancelBtn.textContent = '個別キャンセル';
      cancelBtn.addEventListener('click', (evt) => {
        evt.preventDefault();
        evt.stopPropagation();
        cancelBtn.disabled = true;
        cancelBtn.textContent = 'キャンセル中...';
        requestCancelEngine(activeJobId, entry.engineId);
      });
      actions.append(cancelBtn);
      meta.append(actions);
    } else if (engineCancelRequested && !engineIsTerminal) {
      const actions = document.createElement('div');
      actions.className = 'kc-result-card__actions';
      const label = document.createElement('span');
      label.className = 'kc-result-card__cancel-label';
      label.textContent = 'キャンセル処理中...';
      actions.append(label);
      meta.append(actions);
    }

    card.append(imageWrap, meta);
    container.append(card);
  });

  if (expandBtn) {
    const disabled = !resultsForRender.length && !(state.isRunning && state.activeJobSnapshot);
    expandBtn.disabled = disabled;
    expandBtn.setAttribute('aria-disabled', String(disabled));
  }

  if (promptLabel) {
    const activePrompt = (activeEntry?.prompt || '').trim()
      || getActivePromptForCategory(activeCategoryId)
      || (state.prompt || '').trim()
      || '';

    promptLabel.innerHTML = '';
    const hasPromptContent = Boolean(activePrompt || templateMemo);
    promptLabel.classList.toggle('has-content', hasPromptContent);
    if (promptHost) {
      promptHost.hidden = !hasPromptContent;
      promptHost.setAttribute('aria-hidden', hasPromptContent ? 'false' : 'true');
      promptHost.classList.toggle('has-content', hasPromptContent);
    }
    if (promptPanel) {
      promptPanel.classList.toggle('has-content', hasPromptContent);
      if (!hasPromptContent || !state.resultsPromptExpanded) {
        promptPanel.hidden = true;
      }
    }
    if (promptMemoEl) {
      if (templateMemo) {
        promptMemoEl.textContent = templateMemo;
        promptMemoEl.hidden = false;
      } else {
        promptMemoEl.textContent = '';
        promptMemoEl.hidden = true;
      }
    }
    if (promptText) {
      promptText.textContent = activePrompt;
    }

    if (hasPromptContent) {
      const promptButton = document.createElement('button');
      promptButton.type = 'button';
      promptButton.id = 'kc-results-prompt-button';
      promptButton.className = 'kc-results-prompt__toggle';
      promptButton.innerHTML = '<span aria-hidden="true">📝</span><span>prompt</span>';
      promptButton.setAttribute('aria-controls', 'kc-results-prompt-panel');
      promptButton.setAttribute('aria-expanded', state.resultsPromptExpanded ? 'true' : 'false');

      if (state.resultsPromptExpanded) {
        promptButton.classList.add('is-open');
      }

      promptButton.addEventListener('click', (evt) => {
        evt.preventDefault();
        if (state.resultsPromptExpanded) {
          closePromptPopover();
        } else {
          openPromptPopover(promptButton, {
            promptText: activePrompt,
            memoText: templateMemo,
            templateName
          });
        }
      });

      promptLabel.append(promptButton);

      if (wasPromptPopoverOpen) {
        requestAnimationFrame(() => {
          if (document.contains(promptButton)) {
            openPromptPopover(promptButton, {
              promptText: activePrompt,
              memoText: templateMemo,
              templateName
            });
          }
        });
      }
    } else {
      state.resultsPromptExpanded = false;
    }

    if (filterRow) {
      const hasFilterControl = filterWrap && filterWrap.hidden === false;
      const shouldShowRow = hasFilterControl || hasPromptContent;
      filterRow.hidden = !shouldShowRow;
      filterRow.setAttribute('aria-hidden', shouldShowRow ? 'false' : 'true');
    }
  } else {
    closePromptPopover();
    if (filterRow && filterWrap) {
      const hasFilterControl = filterWrap.hidden === false;
      filterRow.hidden = !hasFilterControl;
      filterRow.setAttribute('aria-hidden', hasFilterControl ? 'false' : 'true');
    }
  }

  updateBatchControlVisuals();
  scheduleShowcaseLayoutSync();
}

function resolvePromptKey(meta, entry = null) {
  if (meta) {
    const key = getPromptKey(meta);
    if (key) return key;
  }
  if (entry && typeof entry.promptKey === 'string' && entry.promptKey) {
    return entry.promptKey;
  }
  return 'prompt';
}

function getEnginePromptValue(meta, entry = null) {
  if (!meta && !entry) return '';
  const promptKey = resolvePromptKey(meta, entry);
  if (!promptKey) return '';
  const target = meta && meta.id ? meta : (entry && entry.id ? { id: entry.id } : null);
  if (!target || !target.id) return '';
  const store = ensureEngineInputs(target);
  const value = store?.[promptKey];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

function getSelectionPromptStatus() {
  const result = {
    requiresPrompt: false,
    missingEngines: []
  };
  if (!(state.selected instanceof Map) || state.selected.size === 0) {
    return result;
  }
  state.selected.forEach((entry, id) => {
    const meta = getEngineMeta(id) || entry;
    if (!meta) return;
    const requires = engineRequiresPrompt(meta) || Boolean(entry?.requiresPrompt);
    if (!requires) return;
    result.requiresPrompt = true;
    const promptValue = getEnginePromptValue(meta, entry);
    if (!promptValue) {
      result.missingEngines.push({ id, meta });
    }
  });
  return result;
}

function updateRunButtonState() {
  const runButton = document.getElementById('kc-run');
  if (!runButton) return;
  const hasSelection = state.selected.size > 0;
  const promptStatus = getSelectionPromptStatus();
  const promptRequired = hasSelection && promptStatus.requiresPrompt;
  const hasGlobalPrompt = Boolean((state.prompt || '').trim());
  const needsMedia = Array.from(state.selected.values()).some((engine) => engine.requiresMedia);
  const selectedMedia = getSelectedMediaList();
  const requiredTypes = new Set();
  Array.from(state.selected.values()).forEach((engine) => {
    if (Array.isArray(engine.requiredMediaTypes)) {
      engine.requiredMediaTypes.forEach((type) => {
        const normalized = normalizeMediaGroupType(type);
        if (normalized && normalized !== 'other') {
          requiredTypes.add(normalized);
        }
      });
    }
    const meta = getEngineMeta(engine.id);
    if (meta && Array.isArray(meta.requiredMediaTypes)) {
      meta.requiredMediaTypes.forEach((type) => {
        const normalized = normalizeMediaGroupType(type);
        if (normalized && normalized !== 'other') {
          requiredTypes.add(normalized);
        }
      });
    }
  });

  const groupedMedia = groupMediaEntriesByType(selectedMedia);
  const hasRequiredMediaTypes = Array.from(requiredTypes).every((type) => {
    const list = groupedMedia.get(type);
    return Array.isArray(list) && list.length > 0;
  });

  const hasMedia = (() => {
    if (requiredTypes.size) {
      return hasRequiredMediaTypes;
    }
    if (needsMedia) {
      return selectedMedia.length > 0;
    }
    return true;
  })();
  const soundSelections = getSelectedSoundEngines();
  const needsSoundText = soundSelections.some(({ meta, entry }) => engineRequiresSoundText(meta, entry));
  const hasSoundText = !needsSoundText || Boolean((state.soundText || '').trim());
  const promptSatisfied = !promptRequired
    || hasGlobalPrompt
    || (promptStatus.missingEngines && promptStatus.missingEngines.length === 0);
  if (state.isRunning) {
    if (state.currentJobId) {
      runButton.disabled = false;
      runButton.textContent = 'キャンセル';
    } else {
      runButton.disabled = true;
      runButton.textContent = '実行中...';
    }
    return;
  }
  const disabled = !hasSelection || !promptSatisfied || !hasMedia || !hasSoundText;
  runButton.disabled = disabled;
  runButton.textContent = '生成を開始';
}

function cleanupSelections() {
  const validIds = new Set(state.engineIndex.keys());
  const preservedSelected = new Map();
  state.selected.forEach((value, key) => {
    if (validIds.has(key)) {
      const meta = state.engineIndex.get(key);
      const displayLabel = meta?.displayLabel || meta?.label || deriveEngineLabel(meta?.id || value?.label || key);
      preservedSelected.set(key, {
        ...value,
        label: displayLabel,
        requiresMedia: Boolean(meta?.requiresMedia),
        requiredMediaTypes: Array.isArray(meta?.requiredMediaTypes)
          ? meta.requiredMediaTypes.slice()
          : (Array.isArray(value?.requiredMediaTypes) ? value.requiredMediaTypes.slice() : []),
        requiresPrompt: engineRequiresPrompt(meta) || Boolean(value?.requiresPrompt),
        requiresSoundText: engineRequiresSoundText(meta, value) || Boolean(value?.requiresSoundText),
        promptKey: meta?.promptKey || value?.promptKey || getPromptKey(meta),
        soundTextKeys: Array.isArray(meta?.soundTextKeys)
          ? meta.soundTextKeys.slice()
          : (Array.isArray(value?.soundTextKeys) ? value.soundTextKeys.slice() : []),
        requiredSoundTextKeys: Array.isArray(meta?.requiredSoundTextKeys)
          ? meta.requiredSoundTextKeys.slice()
          : (Array.isArray(value?.requiredSoundTextKeys) ? value.requiredSoundTextKeys.slice() : []),
        docSummaryEn: meta?.docSummaryEn || value?.docSummaryEn || '',
        docSummaryJa: meta?.docSummaryJa || value?.docSummaryJa || ''
      });
    }
  });
  state.selected = preservedSelected;

  const preservedInputs = new Map();
  state.inputs.forEach((value, key) => {
    if (validIds.has(key)) {
      preservedInputs.set(key, value);
    }
  });
  state.inputs = preservedInputs;
  applySelectedMediaToEngineInputs();
}

function clearAllSelections({ clearInputs = false } = {}) {
  if (state.selected instanceof Map) {
    state.selected.clear();
  } else {
    state.selected = new Map();
  }
  if (clearInputs) {
    state.inputs = new Map();
  }
  renderCategories();
  updateRunButtonState();
}

function removeLastSelectedEngine() {
  if (!(state.selected instanceof Map) || state.selected.size === 0) return false;
  const keys = Array.from(state.selected.keys());
  const lastKey = keys[keys.length - 1];
  if (!lastKey) return false;
  state.selected.delete(lastKey);
  if (state.inputs && state.inputs instanceof Map && state.inputs.has(lastKey)) {
    state.inputs.delete(lastKey);
  }
  renderCategories();
  updateRunButtonState();
  return true;
}

function removeLastSelectedMedia() {
  const list = getSelectedMediaList();
  if (!list.length) return false;
  const next = list.slice(0, -1);
  setSelectedMediaList(next);
  renderCategories();
  updateRunButtonState();
  return true;
}


configureMediaUiHandlers({
  renderSelectionSummary,
  updateRunButtonState,
  renderCategories,
  fetchJson,
  applyBadgeTheme
});



async function loadEnginesForCategory(categoryId) {
  if (!categoryId) return;
  if (state.enginesByCategory.has(categoryId) && state.enginesByCategory.get(categoryId) !== null) {
    return;
  }
  await loadCatalog();
}

async function loadCatalog() {
  const container = document.getElementById('kc-engines');
  if (!container) return;
  container.textContent = '読み込み中...';
  startEngineLoadingOverlay('MCP一覧を更新中...');
  state.enginesLoading.clear();
  SUPPORTED_CATEGORIES.forEach((id) => {
    state.enginesLoading.add(id);
    state.enginesByCategory.set(id, null);
  });
  if (state.categories.length) {
    renderCategories();
  }
  try {
    const response = await fetchJson(`${API_BASE}/tools`);
    const allServers = Array.isArray(response?.data?.servers)
      ? response.data.servers
      : [];

    const enginesByCategory = new Map();
    SUPPORTED_CATEGORIES.forEach((id) => {
      enginesByCategory.set(id, []);
    });

    const engineIndex = new Map();

    allServers.forEach((meta) => {
      if (!meta || !meta.id) return;
      let assignedCategory = categorizeServerMeta(meta);
      const metaCategory = (meta.category || '').toLowerCase();
      const typeFromCategory = PREFIX_TO_CATEGORY.has(metaCategory) ? metaCategory : '';
      const rawType = typeFromCategory || extractEnginePrefix(meta.id) || extractEnginePrefix(meta.label);
      const displayLabel = deriveEngineLabel(meta.id) || deriveEngineLabel(meta.label || '');
      const parameterAnalysis = analyzeEngineParameters(meta);
      const requiredMediaTypes = Array.from(parameterAnalysis.requiredMediaTypes || []);
      const requiresMediaByParams = requiredMediaTypes.length > 0;
      const hasAnyMediaParam = Object.values(parameterAnalysis.mediaParams || {})
        .some((list) => Array.isArray(list) && list.length);
      const soundTextKeys = Array.isArray(parameterAnalysis.soundTextKeys)
        ? parameterAnalysis.soundTextKeys
        : [];
      const requiredSoundTextKeys = Array.isArray(parameterAnalysis.requiredSoundTextKeys)
        ? parameterAnalysis.requiredSoundTextKeys
        : [];
      const requiresSoundText = parameterAnalysis.requiresSoundText
        || meta.requiresSoundText === true
        || requiredSoundTextKeys.length > 0;
      const enriched = {
        ...meta,
        category: assignedCategory,
        sourceCategory: rawType,
        label: displayLabel,
        displayLabel,
        mediaParams: parameterAnalysis.mediaParams,
        soundTextKeys,
        requiredSoundTextKeys,
        requiresSoundText,
        soundTextKey: soundTextKeys[0],
        promptKey: parameterAnalysis.promptKey || getPromptKey(meta),
        requiredMediaTypes,
        requiresMedia: Boolean(meta?.requiresMedia)
          || requiresMediaByParams
          || (!hasAnyMediaParam && requiresMediaForPrefix(rawType))
      };
      const docMeta = getDocMetadata(meta.id);
      if (docMeta) {
        if (docMeta.descriptionEn) {
          enriched.docSummaryEn = docMeta.descriptionEn;
        }
        if (docMeta.descriptionJa) {
          enriched.docSummaryJa = docMeta.descriptionJa;
        }
      } else if (typeof meta.description === 'string' && meta.description.trim()) {
        enriched.docSummaryEn = meta.description.trim();
      }
      if (parameterAnalysis.requiresPrompt || meta.requiresPrompt === true) {
        enriched.requiresPrompt = true;
      }
      if (!enginesByCategory.has(assignedCategory)) {
        assignedCategory = DEFAULT_ACTIVE_CATEGORY;
        enriched.category = assignedCategory;
      }
      enginesByCategory.get(assignedCategory).push(enriched);
      engineIndex.set(enriched.id, enriched);
    });

    enginesByCategory.forEach((list) => {
      list.sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id));
    });

    state.enginesByCategory = enginesByCategory;
    state.engineIndex = engineIndex;
    const aggregatedAll = Array.from(engineIndex.values()).sort((a, b) => {
      const left = a.displayLabel || a.label || a.id;
      const right = b.displayLabel || b.label || b.id;
      return (left || '').localeCompare(right || '');
    });
    state.enginesByCategory.set(ALL_CATEGORY_ID, aggregatedAll);
    state.enginesLoading.clear();

    const categoriesForUi = CATEGORY_DEFINITIONS.map((def) => ({ id: def.id, label: def.label }));

    state.categories = categoriesForUi;
    state.categories.forEach((category) => ensureCategoryCollections(category.id));

    ensureCategoryCollections(ALL_CATEGORY_ID);
    if (!state.engineCategoryInitialized) {
      state.activeEngineCategory = ALL_CATEGORY_ID;
      state.engineCategoryInitialized = true;
    }

    if (!isAllCategory(state.activeEngineCategory)
      && !state.categories.some((category) => category.id === state.activeEngineCategory)) {
      const fallback = state.categories.find((category) => category.id === DEFAULT_ACTIVE_CATEGORY)
        || state.categories[0];
      state.activeEngineCategory = fallback.id;
      state.activeCategory = fallback.id;
    }

    cleanupSelections();
    renderEngineTabs();
    renderEngineSubTabs();
    renderCategories();
    updateRunButtonState();
    if (state.categoryTabs[state.activeEngineCategory] === 'media'
      && state.media.items.length === 0
      && !state.media.isLoading) {
      loadMediaLibrary({ fetchJson, onStateChange: renderCategories })
        .catch((err) => console.error('[Showcase] initial media load failed', err));
    }
    renderHistory();
  } catch (err) {
    console.error('[Showcase] load catalog failed', err);
    container.textContent = `エンジン情報の取得に失敗しました: ${err.message}`;
  } finally {
    stopEngineLoadingOverlay();
  }
}

async function detectBackendOrigin() {
  if (state.backendOrigin) return;
  if (typeof window !== 'undefined') {
    const forced = typeof window.__kcBackendOrigin === 'string' ? window.__kcBackendOrigin.trim() : '';
    if (forced) {
      state.backendOrigin = forced;
      return;
    }
  }
  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  const ports = new Set();
  if (window.location.port) ports.add(window.location.port);
  ports.add('7777');
  ports.add('3001');
  ports.add('8888');

  const origins = new Set();
  ports.forEach((port) => {
    const suffix = port ? `:${port}` : '';
    origins.add(`${protocol}//${hostname}${suffix}`);
  });
  origins.add(`${protocol}//${hostname}`);
  origins.add('http://localhost:7777');
  origins.add('http://127.0.0.1:7777');

  let lastError = null;
  for (const origin of origins) {
    try {
      const res = await fetch(`${origin}/api/config`, { mode: 'cors' });
      if (!res.ok) {
        lastError = new Error(`config status ${res.status}`);
        continue;
      }
      const json = await res.json();
      state.backendOrigin = origin;
      if (json.scanPath) {
        state.scanPath = json.scanPath.endsWith('/') ? json.scanPath : `${json.scanPath}/`;
      }
      return;
    } catch (err) {
      lastError = err;
    }
  }
  state.backendOrigin = 'http://localhost:7777';
  console.warn('[Showcase] backend detection fallback applied', lastError);
}

async function loadConfig() {
  try {
    const json = await fetchJson('/api/config');
    if (json.scanPath) {
      state.scanPath = json.scanPath.endsWith('/') ? json.scanPath : `${json.scanPath}/`;
    }
  } catch (err) {
    console.warn('[Showcase] /api/config load failed', err);
  }
}

async function runGeneration() {
  if (state.isRunning && state.currentJobId) {
    requestCancelJob(state.currentJobId);
    return;
  }
  const selectedEngines = Array.from(state.selected.values());
  if (!selectedEngines.length) return;

  state.currentRunTemplateContext = createTemplateContextSnapshot();

  closeParamsPopover();
  closeTemplateMenu();
  closeResultsModal();
  closeLightbox();
  closePromptModal();
  setPromptGeneratorPanelVisible(false);
  stopAllJobPollers();
  state.currentRunResults = new Map();
  state.completedEngineKeys = new Set();
  state.currentHistoryEntryId = '';
  state.historyActiveId = null;
  state.historyManualSelection = false;
  state.currentJobEngines = [];
  state.activeJobSnapshot = null;
  SUPPORTED_CATEGORIES.forEach((category) => {
    ensureCategoryCollections(category);
    state.resultsByCategory[category] = [];
  });

  state.currentJobEngines = selectedEngines.map((selected) => ({
    id: selected.id,
    label: selected.label || '',
    displayLabel: selected.displayLabel || '',
    category: selected.category || DEFAULT_ACTIVE_CATEGORY
  }));

  state.engineDisplayOrder = new Map();
  selectedEngines.forEach((selected, index) => {
    if (!selected || !selected.id) return;
    const normalizedCategory = normalizeCategory(selected.category || DEFAULT_ACTIVE_CATEGORY);
    state.engineDisplayOrder.set(selected.id, {
      order: index,
      category: normalizedCategory
    });
  });

  const primaryCategory = normalizeCategory(selectedEngines[0]?.category || DEFAULT_ACTIVE_CATEGORY);
  state.activeCategory = primaryCategory;
  ensureCategoryCollections(primaryCategory);

  state.isRunning = true;
  setReloadBlock(true);
  updateRunButtonState();

  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) {
    renderResults(resultsContainer);
  }

  const selectedMediaList = getSelectedMediaList();
  const slotDefinitions = computeMediaSlotDefinitions(selectedEngines);
  const groupedMedia = groupMediaEntriesByType(selectedMediaList);

  try {
    const enginesPayload = selectedEngines.map((selected) => {
      const engineMeta = getEngineMeta(selected.id) || { id: selected.id, category: selected.category };
      const store = ensureEngineInputs(engineMeta);
      const input = { ...store };
      if (Object.prototype.hasOwnProperty.call(input, '__autoMediaAssignments')) {
        delete input.__autoMediaAssignments;
      }
      const payload = {
        id: selected.id,
        label: selected.label,
        category: selected.category,
        input
      };
      if (selectedMediaList.length) {
        payload.media = selectedMediaList
          .map((entry, idx) => {
            const sanitized = sanitizeMediaEntryForPayload(entry, entry.filterType || entry.type || '');
            if (!sanitized) return null;
            return {
              ...sanitized,
              order: idx
            };
          })
          .filter(Boolean);
      }
      const mediaAssignments = buildMediaAssignmentsForEngine(engineMeta, slotDefinitions, groupedMedia);
      if (mediaAssignments.length) {
        payload.mediaAssignments = mediaAssignments;
      }
      return payload;
    });

    const response = await fetchJson(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: state.prompt,
        filePrefix: state.filePrefix,
        engines: enginesPayload
      })
    });

    const job = response?.job;
    const jobId = response?.jobId || job?.id;
    if (!job || !jobId) {
      throw new Error('ジョブIDを取得できませんでした');
    }

    state.currentJobId = jobId;
    state.jobs.set(jobId, job);
    state.activeJobSnapshot = job;
    state.currentJobEngines = job.engines.map((engine) => ({
      id: engine.id,
      label: engine.label || '',
      displayLabel: engine.displayLabel || engine.label || '',
      category: engine.category || DEFAULT_ACTIVE_CATEGORY
    }));

    if (resultsContainer) {
      renderResults(resultsContainer);
    }

    const statusLabel = document.getElementById('kc-results-status');
    if (statusLabel) {
      statusLabel.textContent = translateJobStatus(job.status);
    }

    const initialCategory = (() => {
      if (Array.isArray(job.engines) && job.engines.length) {
        const withCategory = job.engines.find((engine) => engine && engine.category);
        if (withCategory?.category) {
          return normalizeCategory(withCategory.category);
        }
      }
      if (state.activeCategory) {
        return normalizeCategory(state.activeCategory);
      }
      return DEFAULT_ACTIVE_CATEGORY;
    })();

    const historyEntry = ensureHistoryEntryForCurrentRun({
      prompt: state.prompt,
      category: initialCategory,
      jobId
    });
    syncHistoryEntryFromCurrentResults(historyEntry, {
      prompt: state.prompt,
      category: initialCategory
    });
    saveHistoryToStorage();
    renderHistory();

    handleJobUpdate(job);
    if (!isJobTerminal(job.status)) {
      startJobPolling(jobId, { immediate: false });
    } else {
      finalizeCurrentJob(job);
    }
  } catch (err) {
    console.error('[Showcase] run failed', err);
    state.isRunning = false;
    setReloadBlock(false, { release: false });
    state.activeJobSnapshot = null;
    state.currentJobEngines = [];
    state.engineDisplayOrder = new Map();
    state.currentRunTemplateContext = null;
    if (resultsContainer) {
      const errorMessage = document.createElement('div');
      errorMessage.className = 'kc-results-error-message';
      errorMessage.textContent = `エラーが発生しました: ${err.message}`;
      resultsContainer.append(errorMessage);
    }
    const statusLabel = document.getElementById('kc-results-status');
    if (statusLabel) {
      statusLabel.textContent = '生成に失敗しました';
    }
    closePromptPopover();
    renderCategories();
    updateRunButtonState();
  }
}

function attachEvents() {
  const promptInput = document.getElementById('kc-prompt');
  const filePrefixInput = document.getElementById('kc-file-prefix');
  const soundTextInput = document.getElementById('kc-sound-text');
  const runButton = document.getElementById('kc-run');
  const templateButton = document.getElementById('kc-template');
  const templateResetButton = document.getElementById('kc-template-reset');
  const mcpConfigButton = document.getElementById('kc-mcp-config-button');
  const expandButton = document.getElementById('kc-results-expand');
  const resultsRewindButton = document.getElementById('kc-results-rewind');
  const resultsToggleButton = document.getElementById('kc-results-toggleplay');
  const resultsForwardButton = document.getElementById('kc-results-forward');
  const resultsLoopButton = document.getElementById('kc-results-loop');
  const resultsFileFilterSelect = document.getElementById('kc-results-file-filter');
  const inputToggleButton = document.getElementById('kc-results-input-toggle');
  const paramsToggleButton = document.getElementById('kc-results-params-toggle');
  const failureToggleButton = document.getElementById('kc-results-failure-toggle');
  const promptGeneratorSection = document.getElementById('kc-prompt-generator');
  const promptGenerateButton = document.getElementById('kc-prompt-generate');
  const promptGeneratorToggle = document.getElementById('kc-prompt-generator-toggle');
  const promptGeneratorCategorySelect = document.getElementById('kc-prompt-generator-category');
  const promptGeneratorTypeSelect = document.getElementById('kc-prompt-generator-type');
  const promptGeneratorVariantSelect = document.getElementById('kc-prompt-generator-variants');
  const promptGeneratorGuidanceInputEn = document.getElementById('kc-prompt-generator-guidance-en');
  const promptGeneratorGuidanceInputJa = document.getElementById('kc-prompt-generator-guidance-ja');
  const promptGeneratorLyricsToggle = document.getElementById('kc-prompt-generator-lyrics-toggle');
  const promptGeneratorLyricsStructureField = document.getElementById('kc-prompt-generator-lyrics-structure');
  const promptGeneratorLyricsLanguageSelect = document.getElementById('kc-prompt-generator-lyrics-language');
  const promptGeneratorLyricsCharInput = document.getElementById('kc-prompt-generator-lyrics-chars');
  const promptGeneratorLyricsKeywordsInput = document.getElementById('kc-prompt-generator-lyrics-keywords');
  const promptGeneratorLyricsSectionsToggle = document.getElementById('kc-prompt-generator-lyrics-sections');
  const promptGeneratorSoundTextToggle = document.getElementById('kc-prompt-generator-soundtext-toggle');
  const promptGeneratorSoundTextLanguageSelect = document.getElementById('kc-prompt-generator-soundtext-language');
  const promptGeneratorSoundTextCharInput = document.getElementById('kc-prompt-generator-soundtext-chars');
  const promptGeneratorSoundTextKeywordsInput = document.getElementById('kc-prompt-generator-soundtext-keywords');
  const promptGeneratorSoundTextNotesField = document.getElementById('kc-prompt-generator-soundtext-notes');
  const promptRow = document.querySelector('.kc-prompt-row');
  const promptMainColumn = promptRow?.querySelector('.kc-prompt-main');
  const promptSideColumn = promptRow?.querySelector('.kc-prompt-side');
  const promptActionsBar = promptRow?.querySelector('.kc-prompt-actions');

  if (promptRow instanceof HTMLElement && promptMainColumn instanceof HTMLElement && promptSideColumn instanceof HTMLElement && promptActionsBar instanceof HTMLElement) {
    let lastStackedState = null;
    const updatePromptActionsLayout = () => {
      if (!(promptRow.isConnected && promptMainColumn.isConnected && promptSideColumn.isConnected && promptActionsBar.isConnected)) {
        return;
      }
      const mainRect = promptMainColumn.getBoundingClientRect();
      const sideRect = promptSideColumn.getBoundingClientRect();
      if (!mainRect || !sideRect) return;
      const isStacked = Number.isFinite(mainRect.bottom) && Number.isFinite(sideRect.top)
        ? (sideRect.top - mainRect.bottom) > 6
        : false;
      if (lastStackedState === isStacked) return;
      lastStackedState = isStacked;
      promptActionsBar.classList.toggle('kc-prompt-actions--stacked', isStacked);
    };
    updatePromptActionsLayout();
    if (typeof ResizeObserver === 'function') {
      const promptActionsObserver = new ResizeObserver(() => {
        updatePromptActionsLayout();
      });
      promptActionsObserver.observe(promptRow);
      promptActionsObserver.observe(promptMainColumn);
      promptActionsObserver.observe(promptSideColumn);
      promptActionsObserver.observe(promptActionsBar);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updatePromptActionsLayout, { passive: true });
    }
  }

  if (filePrefixInput) {
    const handlePrefixChange = () => {
      setFilePrefix(filePrefixInput.value);
    };
    filePrefixInput.addEventListener('input', handlePrefixChange);
    filePrefixInput.addEventListener('blur', handlePrefixChange);
    syncFilePrefixField();
  }

  if (promptInput) {
    promptInput.placeholder = PROMPT_PLACEHOLDER;
    promptInput.removeAttribute('readonly');
    promptInput.readOnly = false;
    promptInput.disabled = false;
    const handleInput = () => {
      state.prompt = promptInput.value;
      updateActiveTemplateOverrides();
      adjustPromptFieldHeight(promptInput);
      updateRunButtonState();
      updatePromptGeneratorControls();
    };

    promptInput.addEventListener('input', handleInput);
    promptInput.addEventListener('blur', () => {
      state.prompt = promptInput.value;
      updateActiveTemplateOverrides();
      adjustPromptFieldHeight(promptInput);
      updatePromptGeneratorControls();
    });

    attachPromptResizeHandlers(promptInput);
    adjustPromptFieldHeight(promptInput, { force: true });
  }
  if (soundTextInput) {
    soundTextInput.placeholder = SOUND_TEXT_PLACEHOLDER;
    const handleSoundTextChange = () => {
      state.soundText = soundTextInput.value;
      applySoundTextToInputs(state.soundText);
      updateActiveTemplateOverrides();
      updateRunButtonState();
    };
    soundTextInput.addEventListener('input', handleSoundTextChange);
    soundTextInput.addEventListener('blur', handleSoundTextChange);
    attachPromptResizeHandlers(soundTextInput);
    const soundWrapper = document.getElementById('kc-sound-text-field');
    if (soundWrapper && !soundWrapper.hidden) {
      adjustPromptFieldHeight(soundTextInput, { force: true });
    } else {
      soundTextInput.style.height = '';
    }
  }
  if (runButton) {
    runButton.addEventListener('click', runGeneration);
  }
  if (templateButton) {
    templateButton.setAttribute('aria-haspopup', 'dialog');
    templateButton.setAttribute('aria-expanded', 'false');
    templateButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      cancelTemplateMenuClose();
      openTemplateMenu(templateButton);
    });
  }
  if (templateResetButton) {
    templateResetButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      if (templateResetButton.disabled) return;
      const confirmed = window.confirm('プロンプトと接頭辞を含む表示をリセットします。よろしいですか？');
      if (!confirmed) return;
      resetTemplateState();
    });
  }
  if (mcpConfigButton) {
    mcpConfigButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      openMcpConfigModal().catch((err) => {
        console.error('[Showcase] MCP config modal open failed', err);
      });
    });
    syncMcpConfigButton();
  }
  if (promptGeneratorToggle) {
    promptGeneratorToggle.setAttribute('aria-controls', 'kc-prompt-generator');
    promptGeneratorToggle.setAttribute('aria-haspopup', 'dialog');
    promptGeneratorToggle.setAttribute('aria-expanded', 'false');
    promptGeneratorToggle.setAttribute('aria-label', 'プロンプトジェネレーターの表示切り替え');
    promptGeneratorToggle.title = 'プロンプトジェネレーターを開閉';
    promptGeneratorToggle.addEventListener('click', (evt) => {
      evt.preventDefault();
      togglePromptGeneratorPanel(promptGeneratorToggle);
      updatePromptGeneratorControls();
    });
  }
  if (expandButton) {
    expandButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      openResultsGallery();
    });
  }
  if (resultsFileFilterSelect) {
    resultsFileFilterSelect.addEventListener('change', () => {
      const value = resultsFileFilterSelect.value || 'all';
      state.resultsFileFilter = value;
      preferenceStorage.writeString(RESULTS_FILE_FILTER_STORAGE_KEY, value, {
        label: 'failed to persist results file filter'
      });
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
    });
  }
  if (inputToggleButton) {
    inputToggleButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      state.showInputs = !state.showInputs;
      preferenceStorage.writeBoolean(INPUT_VISIBILITY_STORAGE_KEY, state.showInputs, {
        label: 'failed to persist input visibility preference'
      });
      syncInputToggle();
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
      renderHistory();
    });
    syncInputToggle();
  }
  if (paramsToggleButton) {
    paramsToggleButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      state.showParameters = !state.showParameters;
      preferenceStorage.writeBoolean(PARAM_VISIBILITY_STORAGE_KEY, state.showParameters, {
        label: 'failed to persist parameter visibility preference'
      });
      syncParameterToggle();
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
      renderHistory();
    });
    syncParameterToggle();
  }
  if (failureToggleButton) {
    failureToggleButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      state.showFailures = !state.showFailures;
      preferenceStorage.writeBoolean(FAILURE_VISIBILITY_STORAGE_KEY, state.showFailures, {
        label: 'failed to persist failure visibility preference'
      });
      syncFailureToggle();
      closeResultsModal();
      const resultsContainer = document.getElementById('kc-results');
      if (resultsContainer) {
        renderResults(resultsContainer);
      }
      renderHistory();
    });
    syncFailureToggle();
  }
  if (promptGenerateButton) {
    promptGenerateButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      triggerPromptGeneration();
    });
  }
  if (promptGeneratorCategorySelect) {
    promptGeneratorCategorySelect.addEventListener('change', () => {
      setPromptGeneratorCategory(promptGeneratorCategorySelect.value, { fromUser: true });
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorTypeSelect) {
    promptGeneratorTypeSelect.addEventListener('change', () => {
      setPromptGeneratorType(promptGeneratorTypeSelect.value, { fromUser: true });
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorVariantSelect) {
    promptGeneratorVariantSelect.addEventListener('change', () => {
      setPromptGeneratorVariantCount(promptGeneratorVariantSelect.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorGuidanceInputEn) {
    promptGeneratorGuidanceInputEn.addEventListener('input', () => {
      setPromptGeneratorGuidance(promptGeneratorGuidanceInputEn.value, { fromUser: true, persist: true });
    });
    promptGeneratorGuidanceInputEn.addEventListener('blur', () => {
      setPromptGeneratorGuidance(promptGeneratorGuidanceInputEn.value, { fromUser: true, persist: true });
    });
  }
  if (promptGeneratorGuidanceInputJa) {
    promptGeneratorGuidanceInputJa.addEventListener('input', () => {
      setPromptGeneratorGuidanceTranslation(promptGeneratorGuidanceInputJa.value, { fromUser: true, persist: true });
    });
    promptGeneratorGuidanceInputJa.addEventListener('blur', () => {
      setPromptGeneratorGuidanceTranslation(promptGeneratorGuidanceInputJa.value, { fromUser: true, persist: true });
    });
  }
  if (promptGeneratorLyricsToggle) {
    promptGeneratorLyricsToggle.addEventListener('change', () => {
      setPromptGeneratorLyricsEnabled(promptGeneratorLyricsToggle.checked);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorLyricsStructureField) {
    const syncStructure = () => {
      setPromptGeneratorLyricsStructure(promptGeneratorLyricsStructureField.value);
      updatePromptGeneratorControls();
    };
    promptGeneratorLyricsStructureField.addEventListener('input', syncStructure);
    promptGeneratorLyricsStructureField.addEventListener('blur', syncStructure);
  }
  if (promptGeneratorLyricsLanguageSelect) {
    promptGeneratorLyricsLanguageSelect.addEventListener('change', () => {
      setPromptGeneratorLyricsLanguage(promptGeneratorLyricsLanguageSelect.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorLyricsCharInput) {
    const syncChars = () => {
      setPromptGeneratorLyricsCharTarget(promptGeneratorLyricsCharInput.value);
      updatePromptGeneratorControls();
    };
    promptGeneratorLyricsCharInput.addEventListener('input', syncChars);
    promptGeneratorLyricsCharInput.addEventListener('blur', syncChars);
  }
  if (promptGeneratorLyricsKeywordsInput) {
    const syncKeywords = () => {
      setPromptGeneratorLyricsKeywords(promptGeneratorLyricsKeywordsInput.value);
    };
    promptGeneratorLyricsKeywordsInput.addEventListener('input', syncKeywords);
    promptGeneratorLyricsKeywordsInput.addEventListener('blur', () => {
      setPromptGeneratorLyricsKeywords(promptGeneratorLyricsKeywordsInput.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorLyricsSectionsToggle) {
    promptGeneratorLyricsSectionsToggle.addEventListener('change', () => {
      setPromptGeneratorLyricsIncludeSections(promptGeneratorLyricsSectionsToggle.checked);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextToggle) {
    promptGeneratorSoundTextToggle.addEventListener('change', () => {
      setPromptGeneratorSoundTextEnabled(promptGeneratorSoundTextToggle.checked);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextLanguageSelect) {
    promptGeneratorSoundTextLanguageSelect.addEventListener('change', () => {
      setPromptGeneratorSoundTextLanguage(promptGeneratorSoundTextLanguageSelect.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextCharInput) {
    const syncCharTarget = () => {
      setPromptGeneratorSoundTextCharTarget(promptGeneratorSoundTextCharInput.value);
      updatePromptGeneratorControls();
    };
    promptGeneratorSoundTextCharInput.addEventListener('input', syncCharTarget);
    promptGeneratorSoundTextCharInput.addEventListener('blur', syncCharTarget);
  }
  if (promptGeneratorSoundTextKeywordsInput) {
    const syncVoiceKeywords = () => {
      setPromptGeneratorSoundTextKeywords(promptGeneratorSoundTextKeywordsInput.value);
    };
    promptGeneratorSoundTextKeywordsInput.addEventListener('input', syncVoiceKeywords);
    promptGeneratorSoundTextKeywordsInput.addEventListener('blur', () => {
      setPromptGeneratorSoundTextKeywords(promptGeneratorSoundTextKeywordsInput.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSoundTextNotesField) {
    const syncVoiceNotes = () => {
      setPromptGeneratorSoundTextNotes(promptGeneratorSoundTextNotesField.value);
    };
    promptGeneratorSoundTextNotesField.addEventListener('input', syncVoiceNotes);
    promptGeneratorSoundTextNotesField.addEventListener('blur', () => {
      setPromptGeneratorSoundTextNotes(promptGeneratorSoundTextNotesField.value);
      updatePromptGeneratorControls();
    });
  }
  if (promptGeneratorSection) {
    promptGeneratorSection.addEventListener('click', handlePromptGeneratorClick);
  }
  renderPromptGeneratorResults();
  updatePromptGeneratorControls();
  syncPromptGeneratorPanelVisibility();
  syncPromptGeneratorSelectors({ refreshOptions: true });
  syncPromptGeneratorGuidanceField();
  registerBatchControlGroup({
    rewindBtn: resultsRewindButton,
    toggleBtn: resultsToggleButton,
    forwardBtn: resultsForwardButton,
    loopBtn: resultsLoopButton
  });

  syncPromptPreview();
  syncSoundTextField();
  updateRunButtonState();
}

async function init() {
  const root = document.getElementById('kamui-code-showcase-root');
  if (!root) {
    console.warn('[Showcase] root element not found');
    return;
  }
  root.innerHTML = showcaseTemplate();
  configureMediaLightboxHooks({
    beforeOpen: () => {
      closeResultsModal();
      closeTemplateMenu();
      closePromptModal();
    }
  });
  try {
    const storedPrefix = preferenceStorage.readString(FILE_PREFIX_STORAGE_KEY, {
      label: 'failed to restore file prefix'
    });
    if (typeof storedPrefix === 'string') {
      state.filePrefix = storedPrefix;
    }
    state.showFailures = preferenceStorage.readBoolean(FAILURE_VISIBILITY_STORAGE_KEY, {
      defaultValue: state.showFailures,
      label: 'failed to restore failure visibility preference'
    });
    state.showInputs = preferenceStorage.readBoolean(INPUT_VISIBILITY_STORAGE_KEY, {
      defaultValue: state.showInputs,
      label: 'failed to restore input visibility preference'
    });
    state.showParameters = preferenceStorage.readBoolean(PARAM_VISIBILITY_STORAGE_KEY, {
      defaultValue: state.showParameters,
      label: 'failed to restore parameter visibility preference'
    });
    const storedResultsFilter = preferenceStorage.readString(RESULTS_FILE_FILTER_STORAGE_KEY, {
      label: 'failed to restore results file filter'
    });
    if (typeof storedResultsFilter === 'string' && storedResultsFilter) {
      state.resultsFileFilter = storedResultsFilter;
    }
  } catch (err) {
    console.warn('[Showcase] failed to restore persisted preferences', err);
  }
  await loadTemplateCatalog();
  try {
    await detectBackendOrigin();
  } catch (err) {
    console.warn('[Showcase] backend detection failed', err);
  }
  await loadDocMetadata();
    await loadTemplatePreferences();
    rebuildTemplates();
    attachEvents();
    syncFilePrefixField();
    syncTemplatePreviewUi();
    await loadHistoryFromStorage();
  renderHistory();
  const resultsContainer = document.getElementById('kc-results');
  if (resultsContainer) {
    renderResults(resultsContainer);
  }
  try {
    if (!state.backendOrigin) {
      await detectBackendOrigin();
    }
    await loadConfig();
    await updateMcpConfigSummary({ silent: true });
    await loadCatalog();
  } catch (err) {
    console.error('[Showcase] initialization failed', err);
    const enginesContainer = document.getElementById('kc-engines');
    if (enginesContainer) {
      enginesContainer.textContent = `バックエンドに接続できません: ${err.message}`;
    }
  }
  scheduleShowcaseLayoutSync();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init().catch((err) => {
        console.error('[Showcase] initialization error', err);
      });
    }, { once: true });
  } else {
    init().catch((err) => {
      console.error('[Showcase] initialization error', err);
    });
  }
}
