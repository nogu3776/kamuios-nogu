import {
  ALL_CATEGORY_ID,
  DEFAULT_ACTIVE_CATEGORY,
  DOC_METADATA_ENDPOINT
} from './constants.js';
import {
  normalizeCategory,
  normalizeTypeToken,
  resolveTypePrefix,
  extractEnginePrefix
} from './utils.js';
import { state } from './state.js';
import { cloneParameterDefault, getSchemaDefaultValue } from './parameters.js';

const SORA_ENGINE_ID = 't2v-kamui-openai-sora';
const SORA_DEFAULT_SIZE = '1280x720';
const SORA_DEFAULT_SECONDS = '8';
const SORA_MODEL_OPTIONS = ['sora-2', 'sora-2-pro'];
const SORA_SIZE_OPTIONS = ['1280x720', '720x1280', '1792x1024', '1024x1792'];
const SORA_PRO_ONLY_SIZES = new Set(['1792x1024', '1024x1792']);
const SORA_SECONDS_OPTIONS = ['4', '8', '12'];

const CATEGORY_TYPE_FILTERS = {
  image: ['t2i', 'i2i'],
  video: ['t2v', 'i2v', 'r2v', 's2v', 'a2v', 'v2v'],
  '3d': ['i2i3d'],
  sound: ['v2a', 'v2sfx', 't2a', 't2s', 'tts', 't2m'],
  other: ['t2visual', 'file', 'train', 'misc']
};

export const ALL_TYPE_FILTERS = Array.from(new Set(Object.values(CATEGORY_TYPE_FILTERS).flat())).sort();

function engineDefaults(meta) {
  if (!meta) return {};
  const defaults = {};
  const props = meta?.tools?.submit?.parameters?.properties || {};
  Object.entries(props).forEach(([key, schema]) => {
    const defaultValue = getSchemaDefaultValue(schema);
    if (defaultValue !== undefined) {
      defaults[key] = cloneParameterDefault(defaultValue);
    }
  });
  return defaults;
}

export function ensureEngineInputs(engineMeta) {
  if (!engineMeta || !engineMeta.id) return {};
  if (!state.inputs.has(engineMeta.id)) {
    state.inputs.set(engineMeta.id, engineDefaults(engineMeta));
  }
  const store = state.inputs.get(engineMeta.id);
  if (engineMeta.id === SORA_ENGINE_ID && store) {
    const rawModel = (store.model || '').toString().trim();
    let normalizedModel = SORA_MODEL_OPTIONS.includes(rawModel) ? rawModel : 'sora-2';
    let normalizedSize = String(store.size || '').trim().toLowerCase().replace(/[^0-9x]/g, '');
    if (!SORA_SIZE_OPTIONS.includes(normalizedSize)) {
      normalizedSize = SORA_DEFAULT_SIZE;
    }
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
  }
  return store;
}

export function knownTypesForCategory(category) {
  const normalized = (category || '').toLowerCase();
  if (!normalized || normalized === 'all') {
    return ALL_TYPE_FILTERS;
  }
  return CATEGORY_TYPE_FILTERS[normalized] || ALL_TYPE_FILTERS;
}

export function determineEngineTypeKey(engine, allowedTypes = null) {
  if (!engine) return 'other';
  const token = resolveTypePrefix([
    engine.sourceCategory,
    extractEnginePrefix(engine.id),
    extractEnginePrefix(engine.label),
    engine.category
  ]);
  let key = token ? token.toLowerCase() : 'other';
  if (allowedTypes && allowedTypes.size && key !== 'other' && !allowedTypes.has(key)) {
    key = 'other';
  }
  if (!key) return 'other';
  return key;
}

export function engineMatchesSearch(engine, tokens) {
  if (!tokens || !tokens.length) return true;
  if (!engine || typeof engine !== 'object') return false;
  const baseLabels = [engine.displayLabel, engine.label, engine.id]
    .filter((value) => typeof value === 'string' && value.trim().length)
    .map((value) => value.trim().toLowerCase());
  if (!baseLabels.length) return false;
  return tokens.every((token) => {
    const normalized = token.toLowerCase();
    return baseLabels.some((label) => label.includes(normalized));
  });
}

export function filterEnginesByKeyword(list, keyword) {
  if (!Array.isArray(list) || !list.length) {
    return [];
  }
  const normalized = typeof keyword === 'string' ? keyword.trim().toLowerCase() : '';
  if (!normalized) {
    return list.slice();
  }
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return list.slice();
  }
  return list.filter((engine) => engineMatchesSearch(engine, tokens));
}

export function getEnginesInCategory(categoryId) {
  const normalized = normalizeCategory(categoryId);
  const payload = state.enginesByCategory.get(normalized);
  if (Array.isArray(payload)) {
    return payload;
  }
  if (normalized === ALL_CATEGORY_ID) {
    const aggregated = state.enginesByCategory.get(ALL_CATEGORY_ID);
    return Array.isArray(aggregated) ? aggregated : [];
  }
  return [];
}

export function getSelectedEnginesForCategory(categoryId) {
  const normalized = normalizeCategory(categoryId);
  const entries = [];
  state.selected.forEach((value, id) => {
    const meta = state.engineIndex.get(id) || value || {};
    const rawCategory = meta.category || value?.category;
    const engineCategory = normalizeCategory(rawCategory || DEFAULT_ACTIVE_CATEGORY);
    if (normalized === ALL_CATEGORY_ID || engineCategory === normalized) {
      entries.push({ id, meta });
    }
  });
  return entries;
}

export function clearEnginesInCategory(categoryId) {
  const targets = getSelectedEnginesForCategory(categoryId);
  if (!targets.length) return false;
  targets.forEach(({ id }) => {
    state.selected.delete(id);
  });
  return true;
}

function buildEngineOrderMap(categoryId) {
  const map = new Map();
  const normalized = normalizeCategory(categoryId);
  const primaryList = state.enginesByCategory.get(normalized);
  if (Array.isArray(primaryList)) {
    primaryList.forEach((meta, index) => {
      if (meta?.id && !map.has(meta.id)) {
        map.set(meta.id, index);
      }
    });
  }
  if (normalized !== ALL_CATEGORY_ID) {
    const fallbackList = state.enginesByCategory.get(ALL_CATEGORY_ID);
    if (Array.isArray(fallbackList)) {
      const offset = map.size;
      fallbackList.forEach((meta, index) => {
        if (meta?.id && !map.has(meta.id)) {
          map.set(meta.id, offset + index);
        }
      });
    }
  }
  return map;
}

export function createDisplayOrderMap(categoryId) {
  const normalized = normalizeCategory(categoryId);
  const orderMap = new Map();

  if (state.engineDisplayOrder instanceof Map && state.engineDisplayOrder.size > 0) {
    state.engineDisplayOrder.forEach((meta, engineId) => {
      if (!meta || typeof meta.order !== 'number') return;
      const engineCategory = normalizeCategory(meta.category || normalized);
      if (normalized === ALL_CATEGORY_ID || engineCategory === normalized) {
        if (!orderMap.has(engineId)) {
          orderMap.set(engineId, meta.order);
        }
      }
    });
  }

  const fallbackOrder = buildEngineOrderMap(normalized);
  fallbackOrder.forEach((value, key) => {
    if (!orderMap.has(key)) {
      orderMap.set(key, value);
    }
  });

  return orderMap;
}

export function resolveEngineDisplayOrder(engineId, category) {
  if (!engineId) return Number.MAX_SAFE_INTEGER;
  if (state.engineDisplayOrder instanceof Map && state.engineDisplayOrder.has(engineId)) {
    const meta = state.engineDisplayOrder.get(engineId);
    if (meta && typeof meta.order === 'number') {
      return meta.order;
    }
  }
  const normalized = normalizeCategory(category || DEFAULT_ACTIVE_CATEGORY);
  const fallbackOrder = buildEngineOrderMap(normalized);
  if (fallbackOrder.has(engineId)) {
    return fallbackOrder.get(engineId);
  }
  return Number.MAX_SAFE_INTEGER;
}

export function deriveEngineLabel(source, fallback = '') {
  const build = (value) => {
    if (!value) return '';
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return '';
    const parts = normalized.split('-').filter(Boolean);
    if (!parts.length) return normalized;
    const prefix = parts[0];
    const restParts = parts.slice(1);
    if (restParts[0] === 'kamui') {
      restParts.shift();
    }
    const rest = restParts.join('-');
    return rest ? `${prefix}-${rest}` : prefix;
  };
  return build(source) || build(fallback) || (source || fallback || '').toString().toLowerCase();
}

export function deriveDocumentationUrl(meta) {
  void meta; // ドキュメントURLは公開しないため常に空文字を返す
  return '';
}

export async function loadDocMetadata() {
  try {
    const res = await fetch(DOC_METADATA_ENDPOINT, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const map = new Map();
    if (json && typeof json === 'object') {
      Object.entries(json).forEach(([id, meta]) => {
        if (!id || typeof id !== 'string' || !meta || typeof meta !== 'object') {
          return;
        }
        const descriptionEn = typeof meta.descriptionEn === 'string' ? meta.descriptionEn.trim() : '';
        const descriptionJa = typeof meta.descriptionJa === 'string' ? meta.descriptionJa.trim() : '';
        map.set(id, {
          descriptionEn,
          descriptionJa
        });
      });
    }
    state.docMetadata = map;
  } catch (err) {
    console.warn('[Showcase] doc metadata load failed', err);
    state.docMetadata = new Map();
  }
}

export function getDocMetadata(engineId) {
  if (!engineId) return null;
  return state.docMetadata.get(engineId) || null;
}
