import {
  state,
  getEngineMeta,
  MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT,
  MEDIA_LIBRARY_VISIBLE_INCREMENT
} from './state.js';
import {
  MEDIA_TYPE_DISPLAY,
  MEDIA_SLOT_START_TOKENS,
  MEDIA_SLOT_END_TOKENS,
  MEDIA_SELECTION_TYPE_ORDER,
  MEDIA_INPUT_ALLOWED_TYPES,
  MEDIA_FILTERS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  THREED_EXTENSIONS,
  MODEL_VIEWER_MODULE_URL,
  MODEL_VIEWER_SCRIPT_ATTR
} from './constants.js';
import {
  normalizeMediaGroupType,
  tokenizeKey,
  groupMediaEntriesByType,
  fallbackSlotLabel,
  sanitizeMediaEntryForPayload,
  extractFileExtension,
  extractFilename,
  deriveMediaFilterTags,
  selectPrimaryMediaFilter,
  isPreviewable3dEntry,
  categoryLabel,
  normalizeCategory,
  normalizeTypeToken,
  extractEnginePrefix,
  applyAssetSrcWithFallback
} from './utils.js';

const SHOWCASE_MEDIA_RETRY_LIMIT = 5;
const SHOWCASE_MEDIA_RETRY_BASE_DELAY_MS = 600;
const SHOWCASE_MEDIA_RETRY_MAX_DELAY_MS = 6000;
const MEDIA_CACHE_TTL_MS = 60000;
const SORA_INDEX_ENDPOINT = '/data/showcase/sora-index.json';
const SORA_INDEX_CACHE_TTL_MS = 60000;

let modelViewerLoadPromise = null;
let activeLightbox = null;
let lightboxHooks = {
  beforeOpen: null
};

const mediaUiHandlers = {
  renderSelectionSummary: () => {},
  updateRunButtonState: () => {},
  renderCategories: () => {},
  fetchJson: null,
  applyBadgeTheme: () => {}
};

const mediaSelectionListeners = new Set();

function notifyMediaSelectionListeners(selection) {
  mediaSelectionListeners.forEach((listener) => {
    try {
      listener(selection);
    } catch (err) {
      console.warn('[Showcase] media selection listener failed', err);
    }
  });
}

function normalizeMediaPath(value) {
  if (!value && value !== 0) return '';
  return String(value)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
}

async function refreshSoraIndex({ force = false } = {}) {
  if (typeof fetch !== 'function') {
    return;
  }
  const now = Date.now();
  if (!force && now - state.media.soraIndexLoadedAt < SORA_INDEX_CACHE_TTL_MS) {
    return;
  }
  let nextMap = new Map();
  try {
    const response = await fetch(SORA_INDEX_ENDPOINT, { cache: 'no-cache' });
    if (response.status === 404) {
      state.media.soraIndex = nextMap;
      state.media.soraIndexLoadedAt = now;
      return;
    }
    if (!response.ok) {
      throw new Error(`status=${response.status}`);
    }
    const json = await response.json();
    if (json && typeof json === 'object') {
      nextMap = new Map(
        Object.entries(json)
          .map(([key, metadata]) => {
            const normalizedKey = normalizeMediaPath(key);
            if (!normalizedKey) return null;
            if (!metadata || typeof metadata !== 'object') return null;
            const videoId = typeof metadata.videoId === 'string' ? metadata.videoId.trim() : '';
            if (!videoId) return null;
            const rawModel = typeof metadata.model === 'string' ? metadata.model.trim() : '';
            const rawQuality = typeof metadata.qualityMode === 'string' ? metadata.qualityMode.trim().toLowerCase() : '';
            let resolvedModel = rawModel;
            if (!resolvedModel && rawQuality) {
              if (rawQuality === 'high') {
                resolvedModel = 'sora-2-pro';
              } else if (rawQuality === 'standard') {
                resolvedModel = 'sora-2';
              }
            }
            return [normalizedKey, {
              videoId,
              model: resolvedModel,
              targetSize: typeof metadata.targetSize === 'string' ? metadata.targetSize : '',
              timestamp: typeof metadata.timestamp === 'string' ? metadata.timestamp : '',
              updatedAt: typeof metadata.updatedAt === 'string' ? metadata.updatedAt : ''
            }];
          })
          .filter(Boolean)
      );
    }
    state.media.soraIndex = nextMap;
    state.media.soraIndexLoadedAt = now;
  } catch (err) {
    if (force) {
      console.warn('[Showcase] Sora index refresh failed', err);
      state.media.soraIndex = new Map();
      state.media.soraIndexLoadedAt = now;
    }
  }
}

function getSoraMetadataForPath(pathValue) {
  const map = state.media.soraIndex;
  if (!(map instanceof Map) || !map.size) {
    return null;
  }
  const normalized = normalizeMediaPath(pathValue);
  if (normalized && map.has(normalized)) {
    return map.get(normalized);
  }
  if (normalized && !normalized.startsWith('showcase/')) {
    const withPrefix = `showcase/${normalized}`;
    if (map.has(withPrefix)) {
      return map.get(withPrefix);
    }
  }
  return null;
}

export function configureMediaUiHandlers(handlers = {}) {
  if (!handlers || typeof handlers !== 'object') return;
  if (typeof handlers.renderSelectionSummary === 'function') {
    mediaUiHandlers.renderSelectionSummary = handlers.renderSelectionSummary;
  }
  if (typeof handlers.updateRunButtonState === 'function') {
    mediaUiHandlers.updateRunButtonState = handlers.updateRunButtonState;
  }
  if (typeof handlers.renderCategories === 'function') {
    mediaUiHandlers.renderCategories = handlers.renderCategories;
  }
  if (typeof handlers.fetchJson === 'function') {
    mediaUiHandlers.fetchJson = handlers.fetchJson;
  }
  if (typeof handlers.applyBadgeTheme === 'function') {
    mediaUiHandlers.applyBadgeTheme = handlers.applyBadgeTheme;
  }
}

export function registerMediaSelectionListener(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  mediaSelectionListeners.add(listener);
  return () => {
    mediaSelectionListeners.delete(listener);
  };
}

export function resolveMediaEntryType(entry) {
  const mapExtToType = (raw) => {
    if (!raw && raw !== 0) return '';
    const trimmed = String(raw).trim().toLowerCase();
    if (!trimmed) return '';
    const ext = trimmed.replace(/^\./, '');
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'sound';
    if (THREED_EXTENSIONS.has(ext)) return '3d';
    return '';
  };

  const normalizeCandidate = (raw) => {
    if (!raw && raw !== 0) return '';
    const value = String(raw).trim().toLowerCase();
    if (!value) return '';
    if (MEDIA_INPUT_ALLOWED_TYPES.has(value)) return value;
    if (value === 'audio') return 'sound';
    if (value === 'images') return 'image';
    if (value === 'videos') return 'video';
    if (value.startsWith('image/')) return 'image';
    if (value.startsWith('video/')) return 'video';
    if (value.startsWith('audio/')) return 'sound';
    const fromExt = mapExtToType(value);
    if (fromExt) return fromExt;
    return '';
  };

  const candidates = [
    entry?.filterType,
    entry?.mediaType,
    entry?.type,
    entry?.mime,
    entry?.ext
  ];
  for (const candidate of candidates) {
    const resolved = normalizeCandidate(candidate);
    if (resolved) return resolved;
  }
  if (entry?.path && entry.path.includes('.')) {
    const pathExt = entry.path.split('.').pop();
    const resolved = normalizeCandidate(pathExt);
    if (resolved) return resolved;
  }
  if (entry?.url && entry.url.includes('.')) {
    const urlToken = entry.url.split('?')[0].split('#')[0];
    const urlExt = urlToken.split('.').pop();
    const resolved = normalizeCandidate(urlExt);
    if (resolved) return resolved;
  }
  return 'other';
}

function normalizeMediaSelection() {
  if (Array.isArray(state.media.selected)) {
    return state.media.selected;
  }
  if (state.media.selected && typeof state.media.selected === 'object') {
    state.media.selected = [state.media.selected];
  } else {
    state.media.selected = [];
  }
  return state.media.selected;
}

export function getSelectedMediaList() {
  return normalizeMediaSelection();
}

export function setSelectedMediaList(entries, { notify = true } = {}) {
  state.media.selected = Array.isArray(entries) ? entries.slice() : [];
  if (!state.media.selected.length) {
    state.media.activeSlot = '';
  }
  if (notify) {
    notifyMediaSelectionListeners(state.media.selected.slice());
  }
}

function deriveMediaOrderKey(entry) {
  if (!entry) return '';
  if (entry.path) return String(entry.path);
  if (entry.url) return String(entry.url);
  if (typeof entry === 'string') return entry;
  return '';
}

export function assignMediaOrderLookup(entry, type, order, pathMap, urlMap) {
  const info = {
    order,
    type: normalizeMediaGroupType(type)
  };
  const key = deriveMediaOrderKey(entry);
  if (key) {
    pathMap.set(key, info);
  }
  if (entry?.url) {
    urlMap.set(String(entry.url), info);
  }
  return info;
}

export function getMediaSelectionOrderInfo(entry) {
  if (!entry) return null;
  const pathKey = entry.path ? String(entry.path) : deriveMediaOrderKey(entry);
  const map = state.media.orderByPath;
  if (pathKey && map instanceof Map && map.has(pathKey)) {
    return map.get(pathKey);
  }
  const urlKey = entry.url ? String(entry.url) : '';
  const fallback = state.media.orderByUrl;
  if (urlKey && fallback instanceof Map && fallback.has(urlKey)) {
    return fallback.get(urlKey);
  }
  return null;
}

export function toggleMediaSelection(item) {
  if (!item) return;

  const slotDefinitions = computeMediaSlotDefinitions();
  const targetType = resolveMediaEntryType(item);
  const slotsForType = slotDefinitions.get(targetType) || [];
  const useSlotLayout = shouldUseMediaSlotLayout(targetType, slotsForType);

  if (useSlotLayout) {
    const assignmentsData = getMediaSlotAssignments(slotDefinitions);
    const activeSlotId = state.media.activeSlot;
    const activeSlot = findSlotDefinitionById(slotDefinitions, activeSlotId);
    if (activeSlot && activeSlot.type === targetType) {
      const handled = assignMediaToSlot(activeSlot.slotId, item, {
        slotDefinitions,
        assignmentsData
      });
      if (handled) return;
    }
    const fallbackSlotId = findNextEmptySlotId(
      slotDefinitions,
      assignmentsData.assignments,
      activeSlotId && activeSlot?.type === targetType ? activeSlotId : '',
      targetType
    );
    if (fallbackSlotId) {
      const handled = assignMediaToSlot(fallbackSlotId, item, {
        slotDefinitions,
        assignmentsData
      });
      if (handled) return;
    }
  }

  if (!item.path) return;

  const list = getSelectedMediaList().slice();
  const index = list.findIndex((entry) => entry.path === item.path);
  if (index >= 0) {
    list.splice(index, 1);
  } else {
    const payload = createMediaSelectionPayload(item);
    if (!payload) return;
    list.push(payload);
  }
  setSelectedMediaList(list);
}

export function deriveMediaBindingValue(entry) {
  if (!entry) return '';
  const candidates = [];
  if (entry.path) {
    candidates.push(String(entry.path));
  }
  if (entry.url) {
    const rawUrl = String(entry.url);
    if (typeof window !== 'undefined') {
      try {
        const resolved = new URL(rawUrl, window.location.origin);
        if (resolved.origin === window.location.origin) {
          candidates.push(resolved.pathname + resolved.search);
        } else {
          candidates.push(rawUrl);
        }
      } catch (err) {
        candidates.push(rawUrl);
      }
    } else {
      candidates.push(rawUrl);
    }
  }
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (normalized) return normalized;
  }
  return '';
}

function deriveMediaSlotLabel(type, slot) {
  const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
  const tokens = slot?.tokens instanceof Set ? slot.tokens : new Set();
  const hasToken = (...candidates) => candidates.some((token) => tokens.has(token));
  const totalSlots = typeof slot?.totalSlots === 'number' ? slot.totalSlots : 0;
  const isStartCandidate = Boolean(slot?.isStartCandidate);
  const isEndCandidate = Boolean(slot?.isEndCandidate);
  const hasAnyEndCandidate = Boolean(slot?.hasAnyEndCandidate);
  const hasAnyStartCandidate = Boolean(slot?.hasAnyStartCandidate);
  const slotIndex = typeof slot?.index === 'number' ? slot.index : -1;

  const isVisualMedia = type === 'image' || type === 'video';
  if (isVisualMedia) {
    const startLabel = 'START';
    const endLabel = 'END';
    const hasDirectionalPair = totalSlots >= 2 && hasAnyStartCandidate && hasAnyEndCandidate;
    if (hasDirectionalPair) {
      if (isEndCandidate || hasToken(...MEDIA_SLOT_END_TOKENS)) {
        return endLabel;
      }
      if (isStartCandidate || hasToken(...MEDIA_SLOT_START_TOKENS)) {
        return startLabel;
      }
      if (slotIndex === 0) {
        return startLabel;
      }
      if (slotIndex === totalSlots - 1) {
        return endLabel;
      }
    }
  }

  if (slotIndex > 0) {
    return `${baseLabel} #${slotIndex + 1}`;
  }
  return baseLabel;
}

function shouldDisplayMediaSlot(slot) {
  if (!slot) return true;
  if (slot.required) return true;
  if (slot.isStartCandidate || slot.isEndCandidate) {
    return true;
  }
  if (typeof slot.index === 'number' && slot.index <= 0) {
    return true;
  }
  return false;
}

export function computeMediaSlotDefinitions(selectedEngines = Array.from(state.selected.values())) {
  const definitions = new Map();
  selectedEngines.forEach((engine) => {
    if (!engine || !engine.id) return;
    const meta = getEngineMeta(engine.id);
    if (!meta) return;
    const paramsByType = meta.mediaParams || {};
    const engineRequiresMedia = meta?.requiresMedia === true;
    Object.entries(paramsByType).forEach(([rawType, params]) => {
      if (!Array.isArray(params) || !params.length) return;
      const type = normalizeMediaGroupType(rawType);
      if (!definitions.has(type)) {
        definitions.set(type, []);
      }
      const slots = definitions.get(type);
      params.forEach((param, idx) => {
        if (!param) return;
        const tokensForParam = Array.isArray(param.tokens)
          ? param.tokens.map((token) => String(token || '').toLowerCase()).filter(Boolean)
          : tokenizeKey(param.key);
        const isStartParam = tokensForParam.some((token) => MEDIA_SLOT_START_TOKENS.includes(token));
        const isEndParam = tokensForParam.some((token) => MEDIA_SLOT_END_TOKENS.includes(token));
        const isRequiredParam = Boolean(param.required);
        if (!engineRequiresMedia && !isRequiredParam && !isStartParam && !isEndParam) {
          return;
        }
        if (!slots[idx]) {
          slots[idx] = {
            type,
            index: idx,
            originalIndex: idx,
            keys: new Set(),
            tokens: new Set(),
            required: false
          };
        }
        const slot = slots[idx];
        if (param.key) {
          slot.keys.add(param.key);
          tokensForParam.forEach((token) => slot.tokens.add(token));
        }
        if (isRequiredParam) {
          slot.required = true;
        }
        if (isStartParam) {
          slot.isStartCandidate = true;
        }
        if (isEndParam) {
          slot.isEndCandidate = true;
        }
      });
    });
  });

  definitions.forEach((slots, type) => {
    if (!Array.isArray(slots)) {
      definitions.set(type, []);
      return;
    }
    const filtered = slots.filter(Boolean).map((slot) => {
      const tokens = slot.tokens instanceof Set ? new Set(slot.tokens) : new Set();
      const startCandidate = MEDIA_SLOT_START_TOKENS.some((token) => tokens.has(token));
      const endCandidate = MEDIA_SLOT_END_TOKENS.some((token) => tokens.has(token));
      return {
        ...slot,
        tokens,
        isStartCandidate: startCandidate,
        isEndCandidate: endCandidate,
        originalIndex: typeof slot.originalIndex === 'number' ? slot.originalIndex : slot.index || 0
      };
    });
    const computePriority = (slot) => {
      if (type === 'image' || type === 'video') {
        if (slot.isStartCandidate) {
          return 0;
        }
        if (slot.isEndCandidate) {
          return 2;
        }
      }
      return 1;
    };
    filtered.sort((a, b) => {
      const diff = computePriority(a) - computePriority(b);
      if (diff) return diff;
      return (a.originalIndex || 0) - (b.originalIndex || 0);
    });
    const totalSlots = filtered.length;
    const hasAnyStartCandidate = filtered.some((slot) => slot.isStartCandidate);
    const hasAnyEndCandidate = filtered.some((slot) => slot.isEndCandidate);
    const normalized = filtered.map((slot, idx) => {
      const tokens = slot.tokens instanceof Set ? slot.tokens : new Set();
      const decorated = {
        ...slot,
        type,
        index: idx,
        slotId: `${type}:${idx}`,
        tokens,
        totalSlots,
        hasAnyStartCandidate,
        hasAnyEndCandidate
      };
      const slotVisible = shouldDisplayMediaSlot(decorated);
      return {
        ...decorated,
        label: deriveMediaSlotLabel(type, decorated),
        visible: slotVisible,
        hidden: !slotVisible
      };
    });
    definitions.set(type, normalized);
  });

  return definitions;
}

export function shouldUseMediaSlotLayout(type, slots) {
  if (!Array.isArray(slots) || !slots.length) {
    return false;
  }
  const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
  const hasStartOrEnd = slots.some((slot) => slot?.isStartCandidate || slot?.isEndCandidate);
  if (hasStartOrEnd) {
    return true;
  }

  const hasExplicitDifferentiation = slots.some((slot, idx) => {
    if (!slot) return false;
    const label = typeof slot.label === 'string' ? slot.label.trim() : '';
    if (!label) return false;
    const index = Number.isInteger(slot.index) ? slot.index : idx;
    const defaultLabel = index > 0
      ? `${baseLabel} #${index + 1}`
      : baseLabel;
    if (label === defaultLabel) {
      return false;
    }
    return true;
  });

  if (hasExplicitDifferentiation) {
    return true;
  }

  return false;
}

export function getMediaSlotAssignments(slotDefinitions) {
  const assignments = new Map();
  const extrasByType = new Map();
  const mediaList = getSelectedMediaList();
  const grouped = groupMediaEntriesByType(mediaList);

  slotDefinitions.forEach((slots, type) => {
    const entries = grouped.get(type) || [];
    if (!entries.length) {
      return;
    }

    const usedIndexes = new Set();
    const slotIdSet = new Set(slots.map((slot) => slot?.slotId).filter(Boolean));

    const findEntryForSlot = (slotId) => {
      if (!slotId) return { entry: null, index: -1 };
      for (let idx = 0; idx < entries.length; idx += 1) {
        if (usedIndexes.has(idx)) continue;
        const candidate = entries[idx];
        if (candidate && typeof candidate.slotId === 'string' && candidate.slotId === slotId) {
          return { entry: candidate, index: idx };
        }
      }
      return { entry: null, index: -1 };
    };

    const findFirstUnusedEntry = (slotId) => {
      for (let idx = 0; idx < entries.length; idx += 1) {
        if (usedIndexes.has(idx)) continue;
        const candidate = entries[idx];
        if (!candidate) continue;
        const candidateSlotId = typeof candidate.slotId === 'string' ? candidate.slotId : '';
        if (candidateSlotId && candidateSlotId !== slotId) {
          if (slotIdSet.has(candidateSlotId)) {
            continue;
          }
        }
        return { entry: candidate, index: idx };
      }
      return { entry: null, index: -1 };
    };

    slots.forEach((slot) => {
      const directMatch = findEntryForSlot(slot.slotId);
      const resolved = directMatch.entry ? directMatch : findFirstUnusedEntry(slot.slotId);
      if (resolved.entry) {
        assignments.set(slot.slotId, resolved.entry);
        if (resolved.index >= 0) {
          usedIndexes.add(resolved.index);
        }
      }
    });

    const extras = entries.filter((_, idx) => !usedIndexes.has(idx));
    if (extras.length) {
      extrasByType.set(type, extras);
    }
  });

  grouped.forEach((entries, type) => {
    if (!slotDefinitions.has(type)) {
      extrasByType.set(type, entries.slice());
    }
  });

  return { assignments, extrasByType };
}

function buildSelectedMediaFromSlots(slotDefinitions, assignments, extrasByType = new Map()) {
  const result = [];
  const handledTypes = new Set();

  MEDIA_SELECTION_TYPE_ORDER.forEach((type) => {
    handledTypes.add(type);
    const slots = slotDefinitions.get(type) || [];
    slots.forEach((slot) => {
      const entry = assignments.get(slot.slotId);
      if (!entry) return;
      const normalizedType = normalizeMediaGroupType(entry.filterType || type);
      result.push({
        ...entry,
        filterType: normalizedType,
        slotId: slot.slotId
      });
    });
    const extras = extrasByType.get(type) || [];
    extras.forEach((entry) => {
      result.push({
        ...entry,
        filterType: normalizeMediaGroupType(entry.filterType || type)
      });
    });
  });

  extrasByType.forEach((entries, type) => {
    if (handledTypes.has(type)) return;
    entries.forEach((entry) => {
      result.push({
        ...entry,
        filterType: normalizeMediaGroupType(entry.filterType || type)
      });
    });
  });

  return result;
}

export function findSlotDefinitionById(slotDefinitions, slotId) {
  if (!slotId) return null;
  for (const [type, slots] of slotDefinitions.entries()) {
    const match = slots.find((slot) => slot.slotId === slotId);
    if (match) {
      return match;
    }
  }
  return null;
}

export function findNextEmptySlotId(slotDefinitions, assignments, currentSlotId = '', typeFilter = '') {
  const orderedSlots = [];
  slotDefinitions.forEach((slots, type) => {
    if (typeFilter && type !== typeFilter) {
      return;
    }
    slots.forEach((slot) => {
      if (slot?.visible === false) {
        return;
      }
      orderedSlots.push(slot.slotId);
    });
  });
  if (!orderedSlots.length) return '';
  const startIndex = currentSlotId ? orderedSlots.indexOf(currentSlotId) : -1;
  const orderedSearch = startIndex >= 0
    ? orderedSlots.slice(startIndex + 1).concat(orderedSlots.slice(0, startIndex + 1))
    : orderedSlots;
  const next = orderedSearch.find((slotId) => !assignments.has(slotId));
  return next || '';
}

export function resolveActiveMediaSlot(slotDefinitions, assignments) {
  const orderedSlots = [];
  slotDefinitions.forEach((slots) => {
    slots.forEach((slot) => orderedSlots.push(slot.slotId));
  });
  if (!orderedSlots.length) {
    if (state.media.activeSlot) {
      state.media.activeSlot = '';
    }
    return '';
  }
  let next = state.media.activeSlot && orderedSlots.includes(state.media.activeSlot)
    ? state.media.activeSlot
    : '';
  if (!next) {
    next = orderedSlots.find((slotId) => !assignments.has(slotId)) || orderedSlots[0];
  }
  if (state.media.activeSlot !== next) {
    state.media.activeSlot = next;
  }
  return next;
}

export function createMediaSelectionPayload(item, forcedType = '') {
  if (!item || (!item.path && !item.url)) {
    return null;
  }
  const resolvedType = resolveMediaEntryType(item);
  const enforcedType = forcedType ? normalizeMediaGroupType(forcedType) : '';
  if (enforcedType && enforcedType !== normalizeMediaGroupType(resolvedType)) {
    return null;
  }
  const type = enforcedType || resolvedType;
  if (!type || type === 'other') {
    return null;
  }
  const mediaUrl = item.url || item.absolute || item.webPath || '';
  const thumbUrl = item.thumbUrl || item.thumbnail || (type === 'image' ? mediaUrl : '');
  const path = item.path || mediaUrl;
  if (!path) {
    return null;
  }
  const extension = item.ext || extractFileExtension(path) || extractFileExtension(mediaUrl);
  const payload = {
    path,
    name: item.name || extractFilename(path),
    url: mediaUrl,
    thumbUrl,
    filterType: type,
    mime: item.mime || '',
    ext: extension || ''
  };

  if (item.engineId) payload.engineId = item.engineId;
  if (item.requestId) payload.requestId = item.requestId;
  if (item.filePrefix) payload.filePrefix = item.filePrefix;
  if (item.absolute) payload.absolute = item.absolute;
  if (item.relative) payload.relative = item.relative;
  if (item.webPath) payload.webPath = item.webPath;
  if (item.timestamp) payload.timestamp = item.timestamp;
  if (Array.isArray(item.typePrefixes)) payload.typePrefixes = item.typePrefixes.slice();
  if (item.sourceCategory) payload.sourceCategory = item.sourceCategory;

  const resolvedVideoId = item.videoId
    || item.soraVideoId
    || (item.sora && item.sora.videoId)
    || (item.savedFile && item.savedFile.videoId)
    || '';
  if (resolvedVideoId) {
    payload.videoId = resolvedVideoId;
  }

  if (item.sora && typeof item.sora === 'object') {
    payload.sora = { ...item.sora };
  } else if (resolvedVideoId) {
    payload.sora = { videoId: resolvedVideoId };
  }

  if (payload.sora && typeof payload.sora === 'object') {
    if (!payload.sora.model || typeof payload.sora.model !== 'string') {
      const fallbackQuality = typeof payload.sora.qualityMode === 'string'
        ? payload.sora.qualityMode.trim().toLowerCase()
        : '';
      if (fallbackQuality === 'high') {
        payload.sora.model = 'sora-2-pro';
      } else if (fallbackQuality) {
        payload.sora.model = 'sora-2';
      }
    }
    if (Object.prototype.hasOwnProperty.call(payload.sora, 'qualityMode')) {
      delete payload.sora.qualityMode;
    }
  }

  if (item.metadata && typeof item.metadata === 'object') {
    payload.metadata = { ...item.metadata };
  }

  if (payload.videoId) {
    const map = state.media.soraIndex;
    if (map instanceof Map) {
      const normalizedPath = normalizeMediaPath(payload.path || payload.relative || payload.webPath || '');
      if (normalizedPath) {
        map.set(normalizedPath, {
          videoId: payload.videoId,
          model: payload.sora?.model || '',
          targetSize: payload.sora?.targetSize || '',
          timestamp: payload.timestamp || '',
          updatedAt: new Date().toISOString()
        });
      }
    }
  }

  return payload;
}

export function assignMediaToSlot(slotId, item, options = {}) {
  if (!slotId || !item) return false;
  const slotDefinitions = options.slotDefinitions || computeMediaSlotDefinitions();
  const slot = findSlotDefinitionById(slotDefinitions, slotId);
  if (!slot) return false;
  const { assignments, extrasByType } = options.assignmentsData || getMediaSlotAssignments(slotDefinitions);
  const payload = createMediaSelectionPayload(item, slot.type);
  if (!payload) return false;
  assignments.set(slot.slotId, payload);

  if (extrasByType.has(slot.type)) {
    const filteredExtras = extrasByType.get(slot.type)
      .filter((entry) => entry.path !== payload.path && entry.url !== payload.url);
    extrasByType.set(slot.type, filteredExtras);
  }

  const nextList = buildSelectedMediaFromSlots(slotDefinitions, assignments, extrasByType);
  const nextSlot = findNextEmptySlotId(slotDefinitions, assignments, slot.slotId, slot.type);
  state.media.activeSlot = nextSlot || slot.slotId;
  setSelectedMediaList(nextList);
  return true;
}

export function buildMediaAssignmentsForEngine(meta, slotDefinitions, groupedMedia) {
  const assignments = [];
  if (!meta) return assignments;
  const paramsByType = meta.mediaParams || {};
  Object.entries(paramsByType).forEach(([rawType, params]) => {
    if (!Array.isArray(params) || !params.length) return;
    const type = normalizeMediaGroupType(rawType);
    const entries = groupedMedia.get(type) || [];
    const slots = slotDefinitions.get(type) || [];
    params.forEach((param, index) => {
      if (!param || !param.key) return;
      const mediaEntry = entries[index] || entries[0];
      if (!mediaEntry) return;
      let slot = null;
      if (slots.length) {
        slot = slots.find((slotDef) => slotDef && slotDef.keys instanceof Set && slotDef.keys.has(param.key))
          || slots[index]
          || null;
      }
      const slotId = slot?.slotId || `${type}:${index}`;
      const slotLabel = slot?.label || fallbackSlotLabel(type, param.key, index);
      const slotIndex = Number.isFinite(slot?.index) ? slot.index : index;
      const sanitizedMedia = sanitizeMediaEntryForPayload(mediaEntry, type);
      if (!sanitizedMedia) return;
      assignments.push({
        slotId,
        slotLabel,
        slotIndex,
        type,
        paramKey: param.key,
        required: Boolean(param.required),
        media: sanitizedMedia
      });
    });
  });
  return assignments;
}

function collectShowcaseMedia() {
  if (typeof document === 'undefined') return [];
  const selector = [
    '.kc-result-card__video',
    '.kc-results-modal__video',
    '.kc-lightbox__video',
    '.kc-result-card__audio',
    '.kc-results-modal__audio',
    '.kc-lightbox__audio'
  ].join(',');
  return Array.from(document.querySelectorAll(selector)).filter(
    (node) => node instanceof HTMLMediaElement
  );
}

function getBatchControlsState() {
  if (!state.batchControls) {
    state.batchControls = {
      isPlaying: false,
      loopEnabled: true,
      hoverLock: false,
      groups: []
    };
  }
  return state.batchControls;
}

export function attachHoverPlayback(media, { resetOnLeave = false, extraTargets = [] } = {}) {
  if (!(media instanceof HTMLMediaElement)) return;

  const handleEnter = () => {
    const controlsState = getBatchControlsState();
    if (controlsState?.hoverLock) return;
    if (!media.paused) return;
    const playPromise = media.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  const handleLeave = () => {
    const controlsState = getBatchControlsState();
    if (controlsState?.hoverLock) return;
    try {
      media.pause();
      if (resetOnLeave) {
        media.currentTime = 0;
      }
    } catch (err) {
      console.warn('[Showcase] failed to pause hover media', err);
    }
  };

  const targets = [media];
  if (Array.isArray(extraTargets) && extraTargets.length) {
    extraTargets.forEach((target) => {
      if (target && typeof target.addEventListener === 'function' && !targets.includes(target)) {
        targets.push(target);
      }
    });
  }

  targets.forEach((target) => {
    target.addEventListener('mouseenter', handleEnter);
    target.addEventListener('mouseleave', handleLeave);
    target.addEventListener('focus', handleEnter);
    target.addEventListener('blur', handleLeave);
  });
}

function isMediaElementReady(media) {
  if (!(media instanceof HTMLMediaElement)) return true;
  if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return true;
  if (Number.isFinite(media.duration) && media.duration > 0) return true;
  if (media.buffered && media.buffered.length > 0) return true;
  return false;
}

function buildCacheBustedMediaUrl(src, attempt) {
  if (!src || typeof src !== 'string') return src;
  const stamp = `${Date.now()}-${attempt}`;
  try {
    if (typeof URL === 'function' && typeof window !== 'undefined' && window.location) {
      const url = new URL(src, window.location.origin);
      url.searchParams.set('_cb', stamp);
      if (url.origin === window.location.origin) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
      return url.toString();
    }
  } catch (err) {
    // ignore and fallback to manual concatenation
  }
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}_cb=${stamp}`;
}

export function bindShowcaseMediaLifecycle(
  media,
  { src, mediaType = 'media', context = 'general' } = {}
) {
  if (!(media instanceof HTMLMediaElement)) return;
  if (media.dataset.showcaseMediaLifecycle === 'bound' || media.dataset.showcaseMediaLifecycle === 'ready') {
    return;
  }

  const originalSrc = src || media.getAttribute('src') || media.currentSrc || '';
  if (!originalSrc) return;

  media.dataset.showcaseMediaLifecycle = 'bound';
  media.dataset.showcaseMediaRetryCount = '0';

  let disposed = false;
  let pendingRetry = false;
  let attemptCount = 0;
  const timers = new Set();

  const clearTimers = () => {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
  };

  const registerTimer = (callback, delay) => {
    const id = setTimeout(() => {
      timers.delete(id);
      callback();
    }, delay);
    timers.add(id);
    return id;
  };

  const readyEvents = ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough'];
  const failureEvents = ['error', 'stalled', 'emptied'];

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimers();
    readyEvents.forEach((evt) => media.removeEventListener(evt, handleReady));
    failureEvents.forEach((evt) => media.removeEventListener(evt, handleFailure));
    media.removeEventListener('play', handlePlayCheck);
    media.dataset.showcaseMediaLifecycle = disposed ? 'disposed' : 'ready';
    delete media.dataset.showcaseMediaRetryCount;
  };

  const handleReady = () => {
    if (disposed) return;
    media.dataset.showcaseMediaLifecycle = 'ready';
    delete media.dataset.showcaseMediaRetryCount;
    clearTimers();
    readyEvents.forEach((evt) => media.removeEventListener(evt, handleReady));
    failureEvents.forEach((evt) => media.removeEventListener(evt, handleFailure));
    media.removeEventListener('play', handlePlayCheck);
    disposed = true;
  };

  const scheduleRetry = (reason) => {
    if (disposed || pendingRetry) return;
    if (typeof document !== 'undefined' && !document.contains(media)) {
      cleanup();
      return;
    }
    if (isMediaElementReady(media)) {
      handleReady();
      return;
    }
    if (attemptCount >= SHOWCASE_MEDIA_RETRY_LIMIT) {
      console.warn('[Showcase] media failed to load after retries', {
        src: originalSrc,
        mediaType,
        context,
        reason
      });
      clearTimers();
      failureEvents.forEach((evt) => media.removeEventListener(evt, handleFailure));
      media.removeEventListener('play', handlePlayCheck);
      media.dataset.showcaseMediaLifecycle = 'failed';
      delete media.dataset.showcaseMediaRetryCount;
      return;
    }
    attemptCount += 1;
    media.dataset.showcaseMediaRetryCount = String(attemptCount);
    pendingRetry = true;
    const delay = Math.min(
      SHOWCASE_MEDIA_RETRY_BASE_DELAY_MS * Math.pow(2, attemptCount - 1),
      SHOWCASE_MEDIA_RETRY_MAX_DELAY_MS
    );

    registerTimer(() => {
      pendingRetry = false;
      if (disposed) return;
      if (typeof document !== 'undefined' && !document.contains(media)) {
        cleanup();
        return;
      }

      const nextSrc = buildCacheBustedMediaUrl(originalSrc, attemptCount);
      const wasPlaying = !media.paused;
      const resumeTime = wasPlaying ? media.currentTime : 0;

      try {
        media.pause();
      } catch (err) {
        console.warn('[Showcase] failed to pause media before retry', err);
      }

      try {
        media.src = nextSrc;
        media.load();
      } catch (err) {
        console.warn('[Showcase] failed to reload media', err);
      }

      if (wasPlaying) {
        const resume = () => {
          media.removeEventListener('canplay', resume);
          if (disposed) return;
          try {
            if (resumeTime > 0 && media.seekable && media.seekable.length) {
              const end = media.seekable.end(media.seekable.length - 1);
              media.currentTime = Math.min(resumeTime, end);
            } else if (resumeTime > 0) {
              media.currentTime = resumeTime;
            }
          } catch (err) {
            console.warn('[Showcase] failed to restore playback position', err);
          }
          media.play().catch(() => {});
        };
        media.addEventListener('canplay', resume, { once: true });
      }

      registerTimer(() => {
        if (!disposed && !isMediaElementReady(media)) {
          scheduleRetry('post-retry-check');
        }
      }, Math.max(delay, 1200));
    }, delay);
  };

  const handleFailure = (evt) => {
    scheduleRetry(evt?.type || 'failure');
  };

  const handlePlayCheck = () => {
    if (!isMediaElementReady(media)) {
      scheduleRetry('play');
    }
  };

  readyEvents.forEach((evt) => media.addEventListener(evt, handleReady, { once: true }));
  failureEvents.forEach((evt) => media.addEventListener(evt, handleFailure));
  media.addEventListener('play', handlePlayCheck);

  if (!isMediaElementReady(media)) {
    registerTimer(() => {
      if (!disposed && !isMediaElementReady(media)) {
        scheduleRetry('initial');
      }
    }, 800);
  } else {
    handleReady();
  }
}

export function applyLoopSettingToMedia(media) {
  if (!(media instanceof HTMLMediaElement)) return;
  const controlsState = getBatchControlsState();
  const loopEnabled = Boolean(controlsState.loopEnabled);
  media.loop = loopEnabled;
  if (loopEnabled) {
    media.setAttribute('loop', '');
  } else {
    media.removeAttribute('loop');
  }
}

function handleBatchMediaPlaybackChange() {
  const mediaElements = collectShowcaseMedia();
  const anyPlaying = mediaElements.some((media) => !media.paused && !media.ended);
  const controlsState = getBatchControlsState();
  controlsState.isPlaying = anyPlaying;
  if (!anyPlaying) {
    controlsState.hoverLock = false;
  }
  updateBatchControlVisuals();
}

function ensureBatchMediaBindings() {
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    applyLoopSettingToMedia(media);
    if (media.dataset.batchControlsBound === 'true') return;
    media.dataset.batchControlsBound = 'true';
    media.addEventListener('play', handleBatchMediaPlaybackChange);
    media.addEventListener('pause', handleBatchMediaPlaybackChange);
    media.addEventListener('ended', handleBatchMediaPlaybackChange);
  });
}

function pruneBatchControlGroups() {
  const controlsState = getBatchControlsState();
  controlsState.groups = controlsState.groups.filter((group) => {
    if (!group) return false;
    const nodes = [group.rewindBtn, group.toggleBtn, group.forwardBtn, group.loopBtn];
    return nodes.some((node) => node && document.contains(node));
  });
}

export function updateBatchControlVisuals() {
  ensureBatchMediaBindings();
  pruneBatchControlGroups();
  const controlsState = getBatchControlsState();
  const mediaElements = collectShowcaseMedia();
  const hasMedia = mediaElements.length > 0;
  if (!hasMedia) {
    controlsState.isPlaying = false;
  }

  controlsState.groups.forEach((group) => {
    const {
      rewindBtn,
      toggleBtn,
      forwardBtn,
      loopBtn
    } = group;
    const disable = !hasMedia;

    if (rewindBtn) {
      rewindBtn.disabled = disable;
      rewindBtn.setAttribute('aria-disabled', String(disable));
    }
    if (forwardBtn) {
      forwardBtn.disabled = disable;
      forwardBtn.setAttribute('aria-disabled', String(disable));
    }
    if (toggleBtn) {
      toggleBtn.disabled = disable;
      toggleBtn.setAttribute('aria-disabled', String(disable));
      toggleBtn.textContent = controlsState.isPlaying ? '⏸' : '▶';
      const toggleLabel = controlsState.isPlaying
        ? '全てのメディアを一時停止'
        : '全てのメディアを再生';
      toggleBtn.title = toggleLabel;
      toggleBtn.setAttribute('aria-label', toggleLabel);
      toggleBtn.classList.toggle('is-playing', controlsState.isPlaying && !disable);
      toggleBtn.dataset.state = controlsState.isPlaying ? 'pause' : 'play';
    }
    if (loopBtn) {
      loopBtn.disabled = disable;
      loopBtn.setAttribute('aria-disabled', String(disable));
      if (controlsState.loopEnabled) {
        loopBtn.textContent = '🔁';
        loopBtn.title = 'ループ再生を無効';
        loopBtn.setAttribute('aria-label', 'ループ再生を無効');
      } else {
        loopBtn.textContent = '1×';
        loopBtn.title = 'ループ再生を有効';
        loopBtn.setAttribute('aria-label', 'ループ再生を有効');
      }
    }
  });
}

export function registerBatchControlGroup({ rewindBtn, toggleBtn, forwardBtn, loopBtn }) {
  const buttons = [rewindBtn, toggleBtn, forwardBtn, loopBtn];
  if (buttons.some((btn) => !(btn instanceof HTMLButtonElement))) {
    return;
  }

  const controlsState = getBatchControlsState();
  if (!controlsState.groups.some((group) => group.toggleBtn === toggleBtn)) {
    controlsState.groups.push({ rewindBtn, toggleBtn, forwardBtn, loopBtn });
  }

  if (rewindBtn && !rewindBtn.dataset.batchControlButtonBound) {
    rewindBtn.dataset.batchControlButtonBound = 'true';
    rewindBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      rewindAllShowcaseMedia();
    });
  }
  if (forwardBtn && !forwardBtn.dataset.batchControlButtonBound) {
    forwardBtn.dataset.batchControlButtonBound = 'true';
    forwardBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      skipAllShowcaseMediaToEnd();
    });
  }
  if (toggleBtn && !toggleBtn.dataset.batchControlButtonBound) {
    toggleBtn.dataset.batchControlButtonBound = 'true';
    toggleBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      togglePlayPauseAllShowcaseMedia();
    });
  }
  if (loopBtn && !loopBtn.dataset.batchControlButtonBound) {
    loopBtn.dataset.batchControlButtonBound = 'true';
    loopBtn.addEventListener('click', (evt) => {
      evt.preventDefault();
      toggleLoopModeForShowcaseMedia();
    });
  }

  updateBatchControlVisuals();
}

export function playAllShowcaseMedia({ reset = false } = {}) {
  const controlsState = getBatchControlsState();
  controlsState.hoverLock = true;
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    if (reset) {
      try {
        media.currentTime = 0;
      } catch (err) {
        console.warn('[Showcase] failed to reset media currentTime', err);
      }
    }
    const playPromise = media.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  });
  controlsState.isPlaying = mediaElements.length > 0;
  updateBatchControlVisuals();
}

export function pauseAllShowcaseMedia({ reset = false } = {}) {
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    try {
      media.pause();
      if (reset) {
        media.currentTime = 0;
      }
    } catch (err) {
      console.warn('[Showcase] failed to pause media', err);
    }
  });
  const controlsState = getBatchControlsState();
  controlsState.isPlaying = false;
  controlsState.hoverLock = false;
  updateBatchControlVisuals();
}

export function rewindAllShowcaseMedia() {
  pauseAllShowcaseMedia({ reset: true });
}

export function skipAllShowcaseMediaToEnd() {
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    if (!(media instanceof HTMLMediaElement)) return;
    try {
      if (Number.isFinite(media.duration) && media.duration > 0) {
        media.currentTime = media.duration;
      } else if (media.seekable && media.seekable.length) {
        media.currentTime = media.seekable.end(media.seekable.length - 1);
      }
      media.pause();
    } catch (err) {
      console.warn('[Showcase] failed to seek media', err);
    }
  });
  const controlsState = getBatchControlsState();
  controlsState.isPlaying = false;
  controlsState.hoverLock = false;
  updateBatchControlVisuals();
}

export function togglePlayPauseAllShowcaseMedia() {
  const controlsState = getBatchControlsState();
  if (controlsState.isPlaying) {
    pauseAllShowcaseMedia({ reset: false });
  } else {
    playAllShowcaseMedia({ reset: false });
  }
}

export function toggleLoopModeForShowcaseMedia() {
  const controlsState = getBatchControlsState();
  controlsState.loopEnabled = !controlsState.loopEnabled;
  const mediaElements = collectShowcaseMedia();
  mediaElements.forEach((media) => {
    applyLoopSettingToMedia(media);
  });
  updateBatchControlVisuals();
}

export function configureMediaLightboxHooks(hooks = {}) {
  lightboxHooks = {
    beforeOpen: typeof hooks.beforeOpen === 'function' ? hooks.beforeOpen : null
  };
}

function callLightboxHook(name) {
  const handler = lightboxHooks?.[name];
  if (typeof handler !== 'function') return;
  try {
    handler();
  } catch (err) {
    console.warn('[Showcase] lightbox hook failed', err);
  }
}

function ensureModelViewerReady() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.customElements && window.customElements.get('model-viewer')) {
    return Promise.resolve(true);
  }
  if (modelViewerLoadPromise) {
    return modelViewerLoadPromise;
  }
  const existing = document.querySelector(`script[${MODEL_VIEWER_SCRIPT_ATTR}]`);
  if (existing) {
    modelViewerLoadPromise = new Promise((resolve) => {
      if (existing.dataset.loaded === 'true') {
        resolve(Boolean(window.customElements?.get('model-viewer')));
        return;
      }
      existing.addEventListener('load', () => {
        existing.dataset.loaded = 'true';
        resolve(Boolean(window.customElements?.get('model-viewer')));
      }, { once: true });
      existing.addEventListener('error', () => {
        resolve(false);
      }, { once: true });
    });
    return modelViewerLoadPromise;
  }
  modelViewerLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = MODEL_VIEWER_MODULE_URL;
    script.crossOrigin = 'anonymous';
    script.setAttribute(MODEL_VIEWER_SCRIPT_ATTR, 'true');
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(Boolean(window.customElements?.get('model-viewer')));
    }, { once: true });
    script.addEventListener('error', (err) => {
      console.error('[Showcase] model-viewer script load failed', err);
      resolve(false);
    }, { once: true });
    document.head.appendChild(script);
  });
  return modelViewerLoadPromise;
}

function createModelViewerElement(src, { alt = '3D preview', variant = 'card' } = {}) {
  const viewer = document.createElement('model-viewer');
  viewer.src = src;
  viewer.alt = alt || '3D preview';
  viewer.setAttribute('shadow-intensity', '0.6');
  viewer.setAttribute('camera-controls', '');
  viewer.setAttribute('auto-rotate', '');
  viewer.setAttribute('interaction-prompt', 'none');
  viewer.setAttribute('touch-action', 'none');
  viewer.setAttribute('exposure', '1');
  if (variant === 'card') {
    viewer.className = 'kc-result-card__model';
    viewer.setAttribute('disable-zoom', '');
  } else if (variant === 'lightbox') {
    viewer.className = 'kc-lightbox__model';
    viewer.removeAttribute('disable-zoom');
  } else if (variant === 'history') {
    viewer.className = 'kc-history-card__model';
    viewer.setAttribute('disable-zoom', '');
  } else if (variant === 'input') {
    viewer.className = 'irs-source-card__model';
    viewer.setAttribute('disable-zoom', '');
  } else if (variant === 'modal') {
    viewer.className = 'kc-results-modal__model';
  }
  return viewer;
}

export function render3dDownloadMessage(container, url, variant = 'card') {
  const message = document.createElement('div');
  let className = 'kc-result-card__placeholder';
  if (variant === 'history') {
    className = 'kc-history-card__placeholder';
  } else if (variant === 'lightbox') {
    className = 'kc-lightbox__message';
  } else if (variant === 'modal') {
    className = 'kc-result-card__placeholder';
  } else if (variant === 'input') {
    className = 'irs-source-card__placeholder';
  }
  message.className = `${className} kc-placeholder--3d-download`;
  const line = document.createElement('span');
  line.textContent = '3Dプレビューに未対応のファイルです。';
  const br = document.createElement('br');
  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'ダウンロード';
  link.setAttribute('download', '');
  message.innerHTML = '';
  message.append(line, br, link, document.createTextNode(' してご確認ください。'));
  container.classList.add('is-3d');
  container.classList.remove('kc-3d-host');
  container.innerHTML = '';
  container.append(message);
}

export function mount3dPreview(container, { src, alt, variant = 'card' } = {}) {
  if (!container || !src) return;
  container.classList.add('is-3d', 'kc-3d-host');
  container.innerHTML = '';
  const placeholder = document.createElement('div');
  if (variant === 'history') {
    placeholder.className = 'kc-history-card__placeholder';
  } else if (variant === 'lightbox') {
    placeholder.className = 'kc-lightbox__message';
  } else if (variant === 'modal') {
    placeholder.className = 'kc-result-card__placeholder';
  } else if (variant === 'input') {
    placeholder.className = 'irs-source-card__placeholder';
  } else {
    placeholder.className = 'kc-result-card__placeholder';
  }
  placeholder.textContent = '3Dプレビューを読み込み中...';
  container.append(placeholder);
  ensureModelViewerReady()
    .then((ready) => {
      if (!container.isConnected) return;
      if (!ready) {
        render3dDownloadMessage(container, src, variant);
        return;
      }
      const viewer = createModelViewerElement(src, { alt, variant });
      viewer.classList.add('kc-model-viewer');
      viewer.style.width = '100%';
      viewer.style.height = '100%';
      viewer.style.minWidth = '0';
      viewer.style.minHeight = '0';
      const dismissPoster = () => {
        if (typeof viewer.dismissPoster === 'function') {
          try {
            viewer.dismissPoster();
          } catch (err) {
            // ignore poster dismissal failures
          }
        }
      };
      const markReady = () => {
        viewer.classList.add('is-ready');
        dismissPoster();
      };
      viewer.addEventListener('load', markReady, { once: true });
      viewer.addEventListener('model-visibility', (event) => {
        if (event?.detail?.visible) {
          markReady();
        }
      });
      viewer.addEventListener('error', () => {
        viewer.classList.remove('is-ready');
      });
      container.innerHTML = '';
      container.append(viewer);
      requestAnimationFrame(() => {
        dismissPoster();
      });
    })
    .catch((err) => {
      console.error('[Showcase] model-viewer init error', err);
      if (!container.isConnected) return;
      render3dDownloadMessage(container, src, variant);
    });
}

function encodePath(relativePath) {
  return relativePath.split(/\\|\//).map(encodeURIComponent).join('/');
}

function cacheBust(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

function canonicalizePath(path) {
  if (!path) return '';
  return path.replace(/^\/+/, '').toLowerCase();
}

export function normalizeFileTimestamp(value) {
  if (value === null || value === undefined) return 0;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return Math.round(value);
    if (value > 1e9) return Math.round(value * 1000);
    if (value > 0) return Math.round(value);
    return 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return normalizeFileTimestamp(numeric);
    }
  }
  return 0;
}

function pickNormalizedTimestamp(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = normalizeFileTimestamp(value);
    if (Number.isFinite(normalized) && normalized > 0) {
      return normalized;
    }
  }
  return 0;
}

function getMediaModifiedTime(media) {
  if (!media) return 0;
  return pickNormalizedTimestamp(
    media.modified,
    media.modifiedMs,
    media.modified_ms,
    media.modified_ts,
    media.updated,
    media.updatedAt,
    media.updated_at,
    media.mtime,
    media.mtimeMs,
    media.mtime_ms,
    media.lastModified,
    media.last_modified
  );
}

function getMediaCreatedTime(media) {
  if (!media) return 0;
  const created = pickNormalizedTimestamp(
    media.created,
    media.createdMs,
    media.created_ms,
    media.created_ts,
    media.createdAt,
    media.created_at,
    media.birthtime,
    media.birthTime,
    media.birth_time,
    media.birthtimeMs,
    media.birthtime_ms,
    media.added,
    media.creationTime,
    media.creationTimeMs,
    media.ctime,
    media.ctimeMs,
    media.ctime_ms
  );
  if (created) return created;
  return getMediaModifiedTime(media);
}

export function hasMediaUrl(entry) {
  if (!entry) return false;
  const url = entry.url || entry.absolute || entry.webPath || '';
  return typeof url === 'string' && url.trim().length > 0;
}

function formatMediaCaption(entry, index, total) {
  const parts = [];
  if (Number.isFinite(index) && Number.isFinite(total) && total > 0) {
    parts.push(`${index + 1}/${total}`);
  }
  const displayName = entry?.fileName
    || entry?.name
    || extractFilename(entry?.path)
    || extractFilename(entry?.url)
    || '';
  if (displayName) {
    parts.push(displayName);
  }
  return parts.join('  •  ');
}

function mergeTemplateContext(primary, fallback = null) {
  const sanitize = (ctx) => {
    if (!ctx || typeof ctx !== 'object') return null;
    return {
      name: typeof ctx.name === 'string' ? ctx.name : '',
      memo: typeof ctx.memo === 'string' ? ctx.memo : '',
      prompt: typeof ctx.prompt === 'string' ? ctx.prompt : '',
      type: typeof ctx.type === 'string' ? ctx.type : '',
      category: typeof ctx.category === 'string' ? ctx.category : ''
    };
  };
  const base = sanitize(fallback) || {
    name: '',
    memo: '',
    prompt: '',
    type: '',
    category: ''
  };
  const overlay = sanitize(primary);
  const result = { ...base };
  if (overlay) {
    Object.keys(result).forEach((key) => {
      if (overlay[key]) {
        result[key] = overlay[key];
      }
    });
  }
  if (result.category) {
    result.category = normalizeCategory(result.category);
  }
  if (!result.name && !result.memo && !result.prompt && !result.type && !result.category) {
    return null;
  }
  return result;
}

export function createLightboxEntryFromSource(entry, { preferImageUrl = false } = {}) {
  if (!entry) {
    return {
      url: ''
    };
  }

  const urlCandidates = [];
  if (preferImageUrl && entry.imageUrl) urlCandidates.push(entry.imageUrl);
  if (entry.url) urlCandidates.push(entry.url);
  if (entry.absolute) urlCandidates.push(entry.absolute);
  if (entry.webPath) urlCandidates.push(entry.webPath);
  const url = urlCandidates.find((value) => typeof value === 'string' && value.trim().length > 0) || '';

  const fallbackName = entry.fileName
    || entry.name
    || entry.label
    || extractFilename(entry.path)
    || extractFilename(url)
    || '';

  const base = {
    ...entry,
    url,
    imageUrl: entry.imageUrl || url || entry.absolute || entry.webPath || '',
    fileName: entry.fileName || fallbackName,
    name: entry.name || entry.label || fallbackName,
    path: entry.path || entry.fileName || entry.name || ''
  };

  const resolvedType = resolveMediaEntryType(base);
  if (!base.filterType || base.filterType === 'other') {
    base.filterType = resolvedType;
  }
  if (!base.type || base.type === 'other') {
    base.type = resolvedType;
  }

  return base;
}

export function createLightboxEntriesFromSources(entries, options = {}) {
  if (!Array.isArray(entries)) return [];
  const contextToken = typeof options.lightboxContext === 'string'
    ? options.lightboxContext.trim()
    : '';
  return entries.map((entry) => {
    const created = createLightboxEntryFromSource(entry, options);
    if (created && contextToken) {
      created.lightboxContext = contextToken;
    }
    return created;
  });
}

export function closeLightbox() {
  if (!activeLightbox) return;
  const { overlay, onKey, cleanup } = activeLightbox;
  if (onKey) window.removeEventListener('keydown', onKey);
  if (typeof cleanup === 'function') {
    try {
      cleanup();
    } catch (err) {
      console.warn('[Showcase] lightbox cleanup failed', err);
    }
  }
  overlay.remove();
  document.body.classList.remove('kc-lightbox-open');
  activeLightbox = null;
}

export function openMediaLightbox(entries, startIndex = 0) {
  if (!Array.isArray(entries) || !entries.length) return;
  const snapshots = entries.slice();
  const validIndices = [];
  snapshots.forEach((entry, idx) => {
    if (hasMediaUrl(entry)) {
      validIndices.push(idx);
    }
  });
  if (!validIndices.length) return;

  const indexToPosition = new Map();
  validIndices.forEach((idx, pos) => {
    indexToPosition.set(idx, pos);
  });

  const findNearestIndex = (index) => {
    if (indexToPosition.has(index)) {
      return index;
    }
    for (const candidate of validIndices) {
      if (candidate >= index) return candidate;
    }
    return validIndices[validIndices.length - 1];
  };

  const initialIndex = findNearestIndex(startIndex);
  if (initialIndex === undefined || initialIndex === null) return;

  const contextTokens = new Set();
  snapshots.forEach((entry) => {
    if (entry && typeof entry.lightboxContext === 'string' && entry.lightboxContext.trim()) {
      contextTokens.add(entry.lightboxContext.trim());
    }
  });
  const isInputMediaLightbox = contextTokens.size === 1 && contextTokens.has('input-media');

  const activeHistoryEntry = state.history.find((entry) => entry && entry.id === state.historyActiveId) || null;
  const fallbackTemplate = isInputMediaLightbox
    ? null
    : mergeTemplateContext(
      activeHistoryEntry?.templateContext,
      state.currentRunTemplateContext || state.activeTemplateContext
    );
  let templateContext = isInputMediaLightbox
    ? null
    : mergeTemplateContext(
      snapshots.find((entry) => entry?.templateContext)?.templateContext,
      fallbackTemplate
    );
  if (!templateContext && fallbackTemplate) {
    templateContext = fallbackTemplate;
  }
  const lightboxCategory = isInputMediaLightbox
    ? 'other'
    : normalizeCategory(
      templateContext?.category || activeHistoryEntry?.category || state.activeCategory
    );
  const applyBadgeThemeTo = typeof mediaUiHandlers.applyBadgeTheme === 'function'
    ? mediaUiHandlers.applyBadgeTheme
    : () => {};
  const lightboxPrompt = isInputMediaLightbox
    ? ''
    : (((activeHistoryEntry?.prompt || '').trim())
      || ((templateContext?.prompt || '').trim()));
  const lightboxMemo = isInputMediaLightbox
    ? ''
    : ((templateContext?.memo || '').trim());

  const deriveTypeInfo = (entry) => {
    const seen = new Set();
    const orderedTokens = [];
    const pushToken = (token) => {
      if (token === undefined || token === null) return;
      if (Array.isArray(token)) {
        token.forEach((item) => pushToken(item));
        return;
      }
      const normalized = String(token).trim();
      if (!normalized) return;
      const lower = normalized.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      orderedTokens.push(normalized);
    };

    pushToken(templateContext?.type);
    pushToken(entry?.type);
    pushToken(entry?.typePrefixes);
    pushToken(entry?.sourceCategory);
    pushToken(entry?.sourceCategories);
    pushToken(extractEnginePrefix(entry?.engineId));
    pushToken(extractEnginePrefix(entry?.label));
    pushToken(entry?.mediaType);
    pushToken(entry?.filterType);

    for (const token of orderedTokens) {
      const normalizedType = normalizeTypeToken(token);
      if (normalizedType) {
        return {
          themeToken: normalizedType,
          displayText: token.toUpperCase()
        };
      }
    }

    for (const token of orderedTokens) {
      const normalizedGroup = normalizeMediaGroupType(token);
      if (normalizedGroup && normalizedGroup !== 'other') {
        const display = MEDIA_TYPE_DISPLAY[normalizedGroup]?.label || normalizedGroup.toUpperCase();
        return {
          themeToken: normalizedGroup,
          displayText: display
        };
      }
    }

    const fallbackCandidate = orderedTokens.find((candidate) => candidate.length > 0);
    if (fallbackCandidate) {
      const normalizedType = normalizeTypeToken(fallbackCandidate);
      const normalizedGroup = normalizeMediaGroupType(fallbackCandidate);
      return {
        themeToken: normalizedType || (normalizedGroup !== 'other' ? normalizedGroup : 'other'),
        displayText: fallbackCandidate.toUpperCase()
      };
    }

    return {
      themeToken: 'other',
      displayText: ''
    };
  };

  closeLightbox();
  callLightboxHook('beforeOpen');

  const overlay = document.createElement('div');
  overlay.className = 'kc-lightbox';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'kc-lightbox__nav kc-lightbox__nav--prev';
  prevBtn.innerHTML = '‹';
  prevBtn.setAttribute('aria-label', '前のメディア');

  const nextBtn = document.createElement('button');
  nextBtn.className = 'kc-lightbox__nav kc-lightbox__nav--next';
  nextBtn.innerHTML = '›';
  nextBtn.setAttribute('aria-label', '次のメディア');

  const content = document.createElement('div');
  content.className = 'kc-lightbox__content';
  if (isInputMediaLightbox) {
    content.classList.add('kc-lightbox__content--media-only');
  }

  const header = document.createElement('div');
  header.className = 'kc-lightbox__header';
  let typeBadgeEl = null;

  if (!isInputMediaLightbox) {
    const headerGrid = document.createElement('div');
    headerGrid.className = 'kc-lightbox__header-grid';

    const metaColumn = document.createElement('div');
    metaColumn.className = 'kc-lightbox__meta';
    const badgeRow = document.createElement('div');
    badgeRow.className = 'kc-lightbox__badges';
    const categoryBadgeEl = document.createElement('span');
    categoryBadgeEl.className = 'kc-badge kc-lightbox__badge';
    categoryBadgeEl.textContent = categoryLabel(lightboxCategory);
    applyBadgeThemeTo(categoryBadgeEl, lightboxCategory, { fallbackCategory: lightboxCategory });
    badgeRow.append(categoryBadgeEl);

    typeBadgeEl = document.createElement('span');
    typeBadgeEl.className = 'kc-badge kc-badge--type kc-lightbox__badge';
    typeBadgeEl.hidden = true;
    badgeRow.append(typeBadgeEl);

    metaColumn.append(badgeRow);

    if (templateContext?.name) {
      const templateNameEl = document.createElement('div');
      templateNameEl.className = 'kc-lightbox__template-name';
      templateNameEl.textContent = templateContext.name;
      templateNameEl.title = templateContext.name;
      metaColumn.append(templateNameEl);
    }

    headerGrid.append(metaColumn);

    const promptColumn = document.createElement('div');
    promptColumn.className = 'kc-lightbox__prompt';
    if (lightboxPrompt) {
      promptColumn.textContent = lightboxPrompt;
    } else {
      promptColumn.classList.add('is-empty');
    }
    headerGrid.append(promptColumn);

    const memoColumn = document.createElement('div');
    memoColumn.className = 'kc-lightbox__memo';
    if (lightboxMemo) {
      memoColumn.textContent = lightboxMemo;
    } else {
      memoColumn.classList.add('is-empty');
    }
    headerGrid.append(memoColumn);

    header.append(headerGrid);
  } else {
    header.classList.add('kc-lightbox__header--hidden');
    header.setAttribute('aria-hidden', 'true');
  }

  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'kc-lightbox__frame';

  const aside = document.createElement('div');
  aside.className = 'kc-lightbox__aside';
  aside.setAttribute('aria-hidden', 'true');

  const caption = document.createElement('div');
  caption.className = 'kc-lightbox__caption';

  if (isInputMediaLightbox) {
    aside.hidden = true;
    caption.hidden = false;
  }

  content.append(header, mediaContainer, aside, caption);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'kc-lightbox__close';
  closeBtn.innerHTML = '&times;';

  overlay.append(prevBtn, nextBtn, content, closeBtn);
  document.body.appendChild(overlay);
  document.body.classList.add('kc-lightbox-open');

  const findSibling = (current, direction) => {
    const pos = indexToPosition.get(current);
    if (!Number.isFinite(pos)) return null;
    const nextPos = pos + direction;
    if (nextPos < 0 || nextPos >= validIndices.length) return null;
    return validIndices[nextPos];
  };

  let currentIndex = initialIndex;
  let releaseCurrent = null;

  const updateTypeBadge = (entry) => {
    if (!typeBadgeEl) return;
    const { themeToken, displayText } = deriveTypeInfo(entry);
    if (displayText) {
      typeBadgeEl.hidden = false;
      typeBadgeEl.className = 'kc-badge kc-badge--type kc-lightbox__badge';
      typeBadgeEl.textContent = displayText;
      const shouldApplyTheme = themeToken && themeToken !== 'other';
      applyBadgeThemeTo(
        typeBadgeEl,
        shouldApplyTheme ? themeToken : '',
        { fallbackCategory: shouldApplyTheme ? lightboxCategory : '' }
      );
    } else {
      typeBadgeEl.hidden = true;
      typeBadgeEl.textContent = '';
      typeBadgeEl.className = 'kc-badge kc-badge--type kc-lightbox__badge';
      applyBadgeThemeTo(typeBadgeEl, '', { fallbackCategory: '' });
    }
  };

  const applyCleanup = () => {
    if (typeof releaseCurrent === 'function') {
      try {
        releaseCurrent();
      } catch (err) {
        console.warn('[Showcase] media cleanup failed', err);
      }
    }
    releaseCurrent = null;
  };

  const renderEntry = (entry) => {
    applyCleanup();
    mediaContainer.innerHTML = '';
    mediaContainer.className = 'kc-lightbox__frame';

    const type = resolveMediaEntryType(entry);
    if (type === 'video' && hasMediaUrl(entry)) {
      const video = document.createElement('video');
      video.className = 'kc-lightbox__video';
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      applyAssetSrcWithFallback(video, entry.url, { type: 'video' });
      video.muted = false;
      applyLoopSettingToMedia(video);
      bindShowcaseMediaLifecycle(video, {
        src: entry.url,
        mediaType: 'video',
        context: 'lightbox'
      });
      mediaContainer.innerHTML = '';
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--video';
      mediaContainer.appendChild(video);
      const startPlayback = () => {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      };
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        startPlayback();
      } else {
        video.addEventListener('canplay', startPlayback, { once: true });
      }
      releaseCurrent = () => {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (err) {
          console.warn('[Showcase] video cleanup failed', err);
        }
      };
      updateBatchControlVisuals();
      return;
    }

    if (type === 'sound' && hasMediaUrl(entry)) {
      const audio = document.createElement('audio');
      audio.className = 'kc-lightbox__audio';
      audio.controls = true;
      audio.autoplay = true;
      applyAssetSrcWithFallback(audio, entry.url, { type: 'audio' });
      applyLoopSettingToMedia(audio);
      bindShowcaseMediaLifecycle(audio, {
        src: entry.url,
        mediaType: 'audio',
        context: 'lightbox'
      });
      mediaContainer.innerHTML = '';
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--audio';
      mediaContainer.appendChild(audio);
      audio.play().catch(() => {});
      updateBatchControlVisuals();
      releaseCurrent = () => {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch (err) {
          console.warn('[Showcase] audio cleanup failed', err);
        }
      };
      return;
    }

    if (type === '3d' && hasMediaUrl(entry)) {
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--3d';
      if (isPreviewable3dEntry(entry)) {
        mount3dPreview(mediaContainer, {
          src: entry.url,
          alt: entry.name || extractFilename(entry.path) || '3D preview',
          variant: 'lightbox'
        });
        releaseCurrent = () => {
          mediaContainer.innerHTML = '';
        };
      } else {
        render3dDownloadMessage(mediaContainer, entry.url, 'lightbox');
      }
      return;
    }

    if (type === 'other' && hasMediaUrl(entry)) {
      const message = document.createElement('div');
      message.className = 'kc-lightbox__message';
      const text = document.createElement('span');
      text.textContent = 'このファイル形式のプレビューは未対応です。';
      const br = document.createElement('br');
      const link = document.createElement('a');
      link.href = entry.url;
      link.textContent = 'ダウンロード';
      link.setAttribute('download', '');
      message.append(text, br, link, document.createTextNode(' してご確認ください。'));
      mediaContainer.innerHTML = '';
      mediaContainer.className = 'kc-lightbox__frame kc-lightbox__frame--message';
      mediaContainer.appendChild(message);
      return;
    }

    if (hasMediaUrl(entry)) {
      const frame = document.createElement('div');
      frame.className = 'kc-lightbox__frame';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.className = 'kc-lightbox__image';
      applyAssetSrcWithFallback(img, entry.url);
      img.alt = entry.name || extractFilename(entry.path) || 'preview';
      frame.appendChild(img);
      mediaContainer.innerHTML = '';
      mediaContainer.className = '';
      mediaContainer.appendChild(frame);
      return;
    }

    const placeholder = document.createElement('div');
    placeholder.className = 'kc-lightbox__message';
    placeholder.textContent = 'プレビュー対象のURLが見つかりません';
    mediaContainer.innerHTML = '';
    mediaContainer.className = '';
    mediaContainer.appendChild(placeholder);
  };

  const updateView = (index) => {
    if (!indexToPosition.has(index)) return;
    const entry = snapshots[index];
    if (!entry || !hasMediaUrl(entry)) return;
    currentIndex = index;
    renderEntry(entry);
    updateTypeBadge(entry);
    const position = indexToPosition.get(index) || 0;
    caption.textContent = formatMediaCaption(entry, position, validIndices.length);
    const prevIndex = findSibling(index, -1);
    const nextIndex = findSibling(index, 1);
    prevBtn.disabled = prevIndex === null;
    nextBtn.disabled = nextIndex === null;
  };

  prevBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const prevIndex = findSibling(currentIndex, -1);
    if (prevIndex !== null) {
      updateView(prevIndex);
    }
  });

  nextBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    const nextIndex = findSibling(currentIndex, 1);
    if (nextIndex !== null) {
      updateView(nextIndex);
    }
  });

  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) {
      closeLightbox();
    }
  });

  closeBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    closeLightbox();
  });

  const onKey = (evt) => {
    if (evt.key === 'Escape') {
      closeLightbox();
    } else if (evt.key === 'ArrowLeft') {
      const prevIndex = findSibling(currentIndex, -1);
      if (prevIndex !== null) updateView(prevIndex);
    } else if (evt.key === 'ArrowRight') {
      const nextIndex = findSibling(currentIndex, 1);
      if (nextIndex !== null) updateView(nextIndex);
    }
  };

  window.addEventListener('keydown', onKey);

  updateView(initialIndex);

  activeLightbox = {
    overlay,
    onKey,
    cleanup: applyCleanup
  };
}

export function createResultInputThumb(media, {
  label = '',
  type = 'other'
} = {}) {
  if (!media) return null;
  const resolvedType = normalizeMediaGroupType(type || media.filterType || media.type || media.ext || '');
  const source = media.thumbUrl || media.url || media.absolute || media.webPath || '';
  const safeLabel = label || media.name || media.path || 'INPUT';

  if (resolvedType === 'image' && source) {
    const img = document.createElement('img');
    applyAssetSrcWithFallback(img, source);
    img.alt = safeLabel;
    img.loading = 'lazy';
    return { element: img, modifier: 'image' };
  }

  if (resolvedType === 'video' && source) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.loop = true;
    video.classList.add('kc-result-input__video');
    applyAssetSrcWithFallback(video, source, { type: 'video' });
    video.addEventListener('mouseenter', () => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        video.play().catch(() => {});
      }
    });
    video.addEventListener('mouseleave', () => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (err) {
        /* noop */
      }
    });
    return { element: video, modifier: 'video' };
  }

  if (resolvedType === 'sound') {
    const icon = document.createElement('span');
    icon.className = 'kc-result-input__icon';
    icon.textContent = '♪';
    icon.setAttribute('aria-hidden', 'true');
    return { element: icon, modifier: 'sound' };
  }

  if (resolvedType === '3d') {
    const icon = document.createElement('span');
    icon.className = 'kc-result-input__icon';
    icon.textContent = '3D';
    icon.setAttribute('aria-hidden', 'true');
    return { element: icon, modifier: '3d' };
  }

  if (source) {
    const fallback = document.createElement('span');
    fallback.className = 'kc-result-input__placeholder';
    fallback.textContent = (media.ext || resolvedType || '?').toUpperCase();
    return { element: fallback, modifier: resolvedType || 'other', isPlaceholder: true };
  }

  return null;
}

function collectMedia(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node.files)) {
    node.files.forEach((file) => {
      const filterTags = deriveMediaFilterTags(file);
      const filterType = selectPrimaryMediaFilter(filterTags);
      if (!MEDIA_INPUT_ALLOWED_TYPES.has(filterType)) {
        return;
      }
      const createdMs = normalizeFileTimestamp(
        file.createdMs
        ?? file.createdAt
        ?? file.created
        ?? file.birthtime
        ?? file.birthTime
        ?? file.birth_time
        ?? file.added
        ?? file.ctime
        ?? file.ctimeMs
        ?? file.birthtimeMs
        ?? file.created_ms
        ?? file.created_ts
        ?? file.creationTime
        ?? file.creationTimeMs
      );
      let modifiedMs = normalizeFileTimestamp(
        file.modifiedMs
        ?? file.modified
        ?? file.updated
        ?? file.mtime
        ?? file.mtimeMs
        ?? file.lastModified
        ?? file.last_modified
        ?? file.modified_ms
        ?? file.modified_ts
        ?? file.updatedAt
        ?? file.updated_at
      );
      if (!modifiedMs && createdMs) {
        modifiedMs = createdMs;
      }
      acc.push({
        name: file.name,
        path: file.path,
        ext: file.ext,
        mime: file.mime || file.type || '',
        type: file.type || '',
        mediaType: file.mediaType || '',
        size: file.size,
        created: createdMs,
        modified: modifiedMs,
        canonical: canonicalizePath(file.path),
        filterType,
        filterTags
      });
    });
  }
  if (Array.isArray(node.folders)) {
    node.folders.forEach((folder) => {
      collectMedia(folder.items, acc);
    });
  }
  return acc;
}

function matchesMediaFilter(item, filterId) {
  if (!filterId || filterId === 'all') return true;
  if (!item) return false;
  const normalizedFilter = normalizeMediaGroupType(filterId);
  const itemType = normalizeMediaGroupType(item.filterType);
  if (MEDIA_INPUT_ALLOWED_TYPES.has(normalizedFilter)) {
    return itemType === normalizedFilter;
  }
  let tags = Array.isArray(item.filterTags) ? item.filterTags : null;
  if (!tags || !tags.length) {
    const derived = deriveMediaFilterTags(item);
    if (derived.length) {
      item.filterTags = derived;
      tags = derived;
    } else {
      tags = [];
    }
  }
  if (tags.includes(filterId)) {
    return true;
  }
  if (item.filterType && item.filterType === filterId) {
    return true;
  }
  return false;
}

export function applyMediaFilters() {
  const keyword = state.media.searchKeyword.trim().toLowerCase();
  let list = Array.isArray(state.media.items) ? [...state.media.items] : [];
  if (keyword) {
    list = list.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const path = (item.path || '').toLowerCase();
      return name.includes(keyword) || path.includes(keyword);
    });
  }

  const typeFilter = state.media.typeFilter;
  if (typeFilter && typeFilter !== 'all') {
    list = list.filter((item) => matchesMediaFilter(item, typeFilter));
  }

  switch (state.media.sortMode) {
    case 'newest':
      list.sort((a, b) => {
        const diff = getMediaCreatedTime(b) - getMediaCreatedTime(a);
        if (diff) return diff;
        return (a.path || '').localeCompare(b.path || '');
      });
      break;
    case 'oldest':
      list.sort((a, b) => {
        const diff = getMediaCreatedTime(a) - getMediaCreatedTime(b);
        if (diff) return diff;
        return (a.path || '').localeCompare(b.path || '');
      });
      break;
    case 'name':
    default:
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
  }

  state.media.filtered = list;
}

function clearMissingMediaSelections(validPaths = new Set()) {
  const normalized = new Set([...validPaths].filter(Boolean));
  const list = getSelectedMediaList();
  if (!list.length) return;
  const filtered = list.filter((entry) => normalized.has(entry.path));
  if (filtered.length !== list.length) {
    setSelectedMediaList(filtered);
  }
}

async function defaultFetchJson(url, options) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch is not available');
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed (${response.status})`);
  }
  return response.json();
}

export async function loadMediaLibrary({ force = false, fetchJson: fetcher, onStateChange } = {}) {
  if (!state.backendOrigin) return;
  if (state.media.isLoading) return;
  const now = Date.now();
  if (!force && state.media.items.length && now - state.media.lastLoadedAt < MEDIA_CACHE_TTL_MS) {
    return;
  }
  const fetchJsonFn = typeof fetcher === 'function' ? fetcher : defaultFetchJson;
  state.media.isLoading = true;
  state.media.error = '';
  if (typeof onStateChange === 'function') onStateChange();
  try {
    await refreshSoraIndex({ force });
    const json = await fetchJsonFn('/api/scan');
    const rawImages = collectMedia(json.data || json);
    const uniq = new Map();
    rawImages.forEach((item) => {
      if (!item || !item.path) return;
      if (!uniq.has(item.path)) uniq.set(item.path, item);
    });
    const items = Array.from(uniq.values()).sort((a, b) => {
      const diff = getMediaCreatedTime(b) - getMediaCreatedTime(a);
      if (diff) return diff;
      return (a.path || '').localeCompare(b.path || '');
    });
    state.media.items = items.map((item) => {
      const absoluteUrl = state.backendOrigin ? `${state.backendOrigin}/${encodePath(item.path)}` : '';
      const baseTags = Array.isArray(item.filterTags) ? item.filterTags : deriveMediaFilterTags(item);
      const deduped = Array.from(new Set((baseTags || []).filter(Boolean)));
      let filterType = item.filterType || selectPrimaryMediaFilter(deduped);
      if ((!filterType || filterType === 'other') && deduped.length) {
        filterType = selectPrimaryMediaFilter(deduped);
      }
      if (!filterType) filterType = 'other';
      if (!MEDIA_INPUT_ALLOWED_TYPES.has(filterType)) {
        return null;
      }
      const filterTags = deduped.filter((tag) => tag && tag !== 'other');
      if (filterType !== 'other' && !filterTags.includes(filterType)) {
        filterTags.unshift(filterType);
      }
      const isImage = filterType === 'image';
      const createdTime = getMediaCreatedTime(item);
      const modifiedTime = getMediaModifiedTime(item);
      const result = {
        path: item.path,
        name: extractFilename(item.path) || item.name,
        url: absoluteUrl || '',
        thumbUrl: isImage && absoluteUrl ? cacheBust(absoluteUrl) : '',
        created: createdTime,
        createdMs: createdTime,
        modified: modifiedTime,
        modifiedMs: modifiedTime,
        filterType,
        filterTags,
        mime: item.mime || item.type || '',
        ext: item.ext || '',
        mediaType: item.mediaType || '',
        size: item.size
      };

      const soraMetadata = getSoraMetadataForPath(item.path);
      if (soraMetadata) {
        result.videoId = soraMetadata.videoId;
        result.sora = {
          videoId: soraMetadata.videoId,
          model: soraMetadata.model || 'sora-2',
          targetSize: soraMetadata.targetSize || ''
        };
        const baseMetadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {};
        result.metadata = {
          ...baseMetadata,
          sora: soraMetadata
        };
      }

      return result;
    }).filter(Boolean);
    state.media.lastLoadedAt = Date.now();
    const currentPaths = new Set(state.media.items.map((media) => media.path));
    clearMissingMediaSelections(currentPaths);
    applyMediaFilters();
    state.media.visibleCount = MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT;
  } catch (err) {
    console.error('[Showcase] media load failed', err);
    state.media.error = err.message || 'メディアの取得に失敗しました';
    state.media.filtered = [];
  } finally {
    state.media.isLoading = false;
    if (typeof onStateChange === 'function') onStateChange();
  }
}

export function renderMediaLibrary(container) {
  if (!container) return;

  container.innerHTML = '';

  mediaUiHandlers.renderSelectionSummary();

  const controls = document.createElement('div');
  controls.className = 'kc-media-controls irs-source-controls';

  const filterWrap = document.createElement('div');
  filterWrap.className = 'kc-media-filters';
  const filterLabel = document.createElement('span');
  filterLabel.className = 'kc-media-filter-label';
  filterLabel.textContent = 'INPUT';
  filterWrap.appendChild(filterLabel);

  const filterTrack = document.createElement('div');
  filterTrack.className = 'kc-media-filter-track';
  filterWrap.appendChild(filterTrack);

  MEDIA_FILTERS.forEach((filter) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kc-media-filter kc-panel-tab';
    mediaUiHandlers.applyBadgeTheme(btn, filter.id, { fallbackCategory: filter.id });
    if (state.media.typeFilter === filter.id) {
      btn.classList.add('is-active');
    }
    btn.textContent = filter.label.toUpperCase();
    btn.setAttribute('aria-pressed', state.media.typeFilter === filter.id ? 'true' : 'false');
    btn.setAttribute('aria-label', `${filter.label.toUpperCase()} INPUTメディアを表示`);
    btn.addEventListener('click', () => {
      if (state.media.typeFilter === filter.id) return;
      state.media.typeFilter = filter.id;
      pendingScrollTop = 0;
      state.media.visibleCount = MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT;
      applyMediaFilters();
      renderList();
      controls.querySelectorAll('.kc-media-filter').forEach((node) => {
        const isActive = node === btn;
        node.classList.toggle('is-active', isActive);
        node.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
    filterTrack.appendChild(btn);
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'kc-media-wrapper';

  const scroll = document.createElement('div');
  scroll.className = 'kc-media-scroll';
  wrapper.append(scroll);

  let pendingScrollTop = null;

  const renderList = () => {
    const savedScrollTop = scroll.scrollTop;
    const targetScrollTop = typeof pendingScrollTop === 'number' ? pendingScrollTop : savedScrollTop;

    scroll.innerHTML = '';
    mediaUiHandlers.renderSelectionSummary();

    const restoreScroll = () => {
      requestAnimationFrame(() => {
        scroll.scrollTop = typeof targetScrollTop === 'number'
          ? targetScrollTop
          : savedScrollTop;
      });
      pendingScrollTop = null;
    };

    if (state.media.error) {
      const retry = document.createElement('div');
      retry.className = 'kc-history-empty';
      retry.textContent = `読み込みに失敗しました: ${state.media.error}`;
      scroll.append(retry);
      restoreScroll();
      return;
    }

    if (state.media.isLoading) {
      const loading = document.createElement('div');
      loading.className = 'kc-history-empty';
      loading.textContent = '読み込み中...';
      scroll.append(loading);
      restoreScroll();
      return;
    }

    const hasActiveFilter = state.media.typeFilter !== 'all'
      || Boolean(state.media.searchKeyword.trim());
    const list = state.media.filtered.length
      ? state.media.filtered
      : (hasActiveFilter ? [] : state.media.items);

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'kc-history-empty';
      if (hasActiveFilter) {
        empty.textContent = '条件に一致するメディアが見つかりません';
      } else {
        empty.textContent = 'メディアフォルダにファイルが見つかりませんでした';
      }
      scroll.append(empty);
      restoreScroll();
      return;
    }

    const totalCount = list.length;
    let desiredVisible = Number.isFinite(state.media.visibleCount) && state.media.visibleCount > 0
      ? state.media.visibleCount
      : MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT;
    desiredVisible = Math.min(totalCount, Math.max(1, desiredVisible || MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT));
    state.media.visibleCount = desiredVisible;
    const entries = list.slice(0, state.media.visibleCount);
    const canLoadMore = totalCount > entries.length;
    scroll.classList.toggle('kc-media-scroll--compact', !canLoadMore);

    const grid = document.createElement('div');
    grid.className = 'irs-source-list kc-media-list';

    const previewEntries = createLightboxEntriesFromSources(entries, { lightboxContext: 'input-media' });
    const enableSoundHover = state.media.typeFilter === 'sound';
    const enableVideoAudioHover = state.media.typeFilter === 'video';

    entries.forEach((item, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'irs-source-card';
      const selectionInfo = getMediaSelectionOrderInfo(item);
      if (selectionInfo) {
        card.classList.add('is-active');
      }
      if (item.name) {
        card.title = item.name;
      }

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'irs-source-card__thumb';
      if (item.filterType) {
        thumbWrap.classList.add(`irs-source-card__thumb--${item.filterType}`);
      }

      const createPreviewButton = () => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'irs-source-card__preview';
        btn.title = 'プレビュー';
        btn.textContent = '⤢';
        btn.setAttribute('aria-label', `${item.name} をプレビュー`);
        btn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          if (item.url) {
            openMediaLightbox(previewEntries, index);
          }
        });
        return btn;
      };

      if (item.thumbUrl) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        applyAssetSrcWithFallback(img, item.thumbUrl);
        img.alt = item.name;
        thumbWrap.appendChild(img);
        if (item.url) {
          thumbWrap.appendChild(createPreviewButton());
        }
      } else if ((item.filterType === 'video' || item.filterType === 'sound') && item.url) {
        if (item.filterType === 'video') {
          const video = document.createElement('video');
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.className = 'irs-source-card__video';
          applyAssetSrcWithFallback(video, item.url, { type: 'video' });
          video.addEventListener('loadeddata', () => {
            try {
              video.currentTime = 0;
              video.pause();
            } catch (err) {
              // ignore seek errors
            }
          });
          thumbWrap.appendChild(video);
          const startPreview = () => {
            const playMutedFallback = () => {
              const mutedPlay = video.play();
              if (mutedPlay && typeof mutedPlay.catch === 'function') {
                mutedPlay.catch(() => {});
              }
            };

            if (enableVideoAudioHover) {
              video.muted = false;
              const playPromise = video.play();
              if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                  video.muted = true;
                  playMutedFallback();
                });
              }
              return;
            }
            playMutedFallback();
          };
          const stopPreview = () => {
            try {
              video.pause();
              if (enableVideoAudioHover) {
                video.muted = true;
              }
              video.currentTime = 0;
            } catch (err) {
              // ignore pause errors
            }
          };
          card.addEventListener('mouseenter', startPreview);
          card.addEventListener('mouseleave', stopPreview);
          card.addEventListener('focus', startPreview);
          card.addEventListener('blur', stopPreview);
        } else {
          const icon = document.createElement('div');
          icon.className = 'irs-source-card__placeholder irs-source-card__placeholder--audio';
          icon.textContent = 'SOUND';
          thumbWrap.appendChild(icon);
          if (enableSoundHover) {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.controls = false;
            audio.loop = false;
            audio.className = 'irs-source-card__audio';
            audio.setAttribute('aria-hidden', 'true');
            audio.tabIndex = -1;
            applyAssetSrcWithFallback(audio, item.url, { type: 'audio' });
            thumbWrap.appendChild(audio);
            attachHoverPlayback(audio, { resetOnLeave: true, extraTargets: [card, thumbWrap] });
          }
        }
        thumbWrap.appendChild(createPreviewButton());
      } else if (item.filterType === '3d' && item.url) {
        thumbWrap.classList.add('is-3d');
        const modelHost = document.createElement('div');
        modelHost.className = 'irs-source-card__model-host';
        thumbWrap.appendChild(modelHost);
        mount3dPreview(modelHost, {
          src: item.url,
          alt: item.name,
          variant: 'input'
        });
        thumbWrap.appendChild(createPreviewButton());
        thumbWrap.addEventListener('dblclick', (evt) => {
          if (!item.url) return;
          if (evt.target && evt.target.closest('.irs-source-card__preview')) {
            return;
          }
          const viewer = thumbWrap.querySelector('model-viewer');
          if (!viewer) return;
          if (evt.target === viewer || viewer.contains(evt.target)) {
            evt.preventDefault();
            evt.stopPropagation();
            openMediaLightbox(previewEntries, index);
          }
        });
      } else {
        thumbWrap.classList.add('irs-source-card__thumb--empty');
        const placeholder = document.createElement('div');
        placeholder.className = 'irs-source-card__placeholder';
        placeholder.textContent = (item.filterType || 'other').toUpperCase();
        thumbWrap.appendChild(placeholder);
        if (item.url) {
          thumbWrap.appendChild(createPreviewButton());
        }
      }

      if (selectionInfo) {
        const badge = document.createElement('span');
        badge.className = 'kc-media-selection-order';
        const typeClass = selectionInfo.type ? `kc-media-selection-order--${selectionInfo.type}` : '';
        if (typeClass) badge.classList.add(typeClass);
        badge.textContent = String(selectionInfo.order);
        badge.setAttribute('aria-label', `${(MEDIA_TYPE_DISPLAY[selectionInfo.type]?.label || selectionInfo.type || 'MEDIA')} #${selectionInfo.order}`);
        thumbWrap.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'irs-source-card__meta';
      const name = document.createElement('span');
      name.className = 'irs-source-card__name';
      name.title = item.name;
      name.textContent = item.name;
      meta.appendChild(name);

      const typeChip = document.createElement('span');
      typeChip.className = 'irs-source-card__type';
      typeChip.textContent = (item.filterType || 'other').toUpperCase();
      meta.appendChild(typeChip);

      card.append(thumbWrap, meta);

      card.addEventListener('click', () => {
        pendingScrollTop = scroll.scrollTop;
        toggleMediaSelection(item);
        renderList();
        mediaUiHandlers.updateRunButtonState();
      });

      grid.appendChild(card);
    });

    scroll.append(grid);

    const footer = document.createElement('div');
    footer.className = 'kc-media-footer';
    const countLabel = document.createElement('span');
    countLabel.className = 'kc-media-count';
    countLabel.textContent = `表示中: ${entries.length}件 / 全${totalCount}件`;
    footer.append(countLabel);

    if (canLoadMore) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.type = 'button';
      loadMoreBtn.className = 'kc-button kc-button--ghost kc-media-loadmore';
      const nextCount = Math.min(totalCount, state.media.visibleCount + MEDIA_LIBRARY_VISIBLE_INCREMENT);
      loadMoreBtn.textContent = 'さらに30件読み込む';
      loadMoreBtn.setAttribute('aria-label', `INPUTメディアをさらに30件読み込む (${entries.length}件から${nextCount}件まで表示)`);
      loadMoreBtn.addEventListener('click', () => {
        const updated = Math.min(totalCount, state.media.visibleCount + MEDIA_LIBRARY_VISIBLE_INCREMENT);
        if (updated !== state.media.visibleCount) {
          pendingScrollTop = scroll.scrollTop;
          state.media.visibleCount = updated;
          renderList();
        }
      });
      footer.append(loadMoreBtn);
    }

    scroll.append(footer);

    mediaUiHandlers.renderSelectionSummary();
    restoreScroll();
  };

  const searchWrap = document.createElement('div');
  searchWrap.className = 'irs-search';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'INPUTメディアを検索';
  searchInput.setAttribute('aria-label', 'INPUTメディア検索');
  searchInput.value = state.media.searchKeyword;
  searchInput.addEventListener('input', () => {
    state.media.searchKeyword = searchInput.value;
    pendingScrollTop = 0;
    state.media.visibleCount = MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT;
    applyMediaFilters();
    renderList();
  });
  searchWrap.appendChild(searchInput);

  const sortWrap = document.createElement('div');
  sortWrap.className = 'irs-sort';
  const sortSelect = document.createElement('select');
  sortSelect.id = 'kc-media-sort';
  sortSelect.setAttribute('aria-label', '並び替え');
  sortSelect.innerHTML = `
    <option value="name">名前順</option>
    <option value="newest">新しい順</option>
    <option value="oldest">古い順</option>
  `;
  sortSelect.value = state.media.sortMode;
  sortSelect.addEventListener('change', () => {
    state.media.sortMode = sortSelect.value;
    pendingScrollTop = 0;
    state.media.visibleCount = MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT;
    applyMediaFilters();
    renderList();
  });
  sortWrap.append(sortSelect);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'irs-refresh';
  refreshBtn.title = 'INPUTメディアを再読み込み';
  refreshBtn.textContent = '⟳';
  refreshBtn.addEventListener('click', () => {
    const options = {
      force: true,
      onStateChange: mediaUiHandlers.renderCategories
    };
    if (typeof mediaUiHandlers.fetchJson === 'function') {
      options.fetchJson = mediaUiHandlers.fetchJson;
    }
    pendingScrollTop = 0;
    state.media.visibleCount = MEDIA_LIBRARY_DEFAULT_VISIBLE_COUNT;
    loadMediaLibrary(options)
      .catch((err) => console.error('[Showcase] media refresh failed', err));
  });

  controls.append(filterWrap, searchWrap, sortWrap, refreshBtn);
  container.append(controls, wrapper);

  renderList();
}

export function openMediaPreview(source, maybeIndexOrLabel, maybeType = 'image') {
  if (Array.isArray(source)) {
    const startIndex = Number.isFinite(maybeIndexOrLabel) ? Number(maybeIndexOrLabel) : 0;
    openMediaLightbox(createLightboxEntriesFromSources(source, { preferImageUrl: true }), startIndex);
    return;
  }

  const url = source;
  const label = typeof maybeIndexOrLabel === 'string' ? maybeIndexOrLabel : '';
  const type = typeof maybeType === 'string' ? maybeType : 'image';
  if (!url) return;
  openMediaLightbox([
    createLightboxEntryFromSource({
      url,
      name: label,
      filterType: type,
      type
    })
  ], 0);
}

export function removeSelectedMediaEntry(target, fallbackIndex = -1, identifier = '') {
  const list = getSelectedMediaList();
  if (!list.length) return false;
  const normalizedId = identifier || target?.path || target?.url || '';
  let removed = false;
  const next = [];
  list.forEach((entry, idx) => {
    if (removed) {
      next.push(entry);
      return;
    }
    const samePath = target?.path && entry?.path === target.path;
    const sameUrl = !target?.path && target?.url && entry?.url === target.url;
    const sameIdentifier = normalizedId && (entry?.path === normalizedId || entry?.url === normalizedId);
    if (samePath || sameUrl || sameIdentifier || idx === fallbackIndex) {
      removed = true;
      return;
    }
    next.push(entry);
  });
  if (!removed) return false;
  setSelectedMediaList(next);
  mediaUiHandlers.renderCategories();
  mediaUiHandlers.updateRunButtonState();
  return true;
}

export function clearAllMediaSelections() {
  if (!getSelectedMediaList().length) return false;
  state.media.activeSlot = '';
  setSelectedMediaList([]);
  mediaUiHandlers.renderCategories();
  mediaUiHandlers.updateRunButtonState();
  return true;
}
