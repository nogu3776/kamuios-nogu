import {
  ALL_CATEGORY_ID,
  ALL_CATEGORY_LABEL,
  CATEGORY_LABELS,
  DEFAULT_ACTIVE_CATEGORY,
  ENGINE_PARAMETER_REQUIRED_HINTS,
  MEDIA_FILTER_PRIORITY,
  MEDIA_HINT_LOOKUP,
  MEDIA_INPUT_ALLOWED_TYPES,
  MEDIA_PARAM_BADGE_EXCLUDE_TOKENS,
  MEDIA_PARAM_CONFIG_TOKENS,
  MEDIA_PARAM_EXCLUDE_TOKENS,
  MEDIA_PARAM_ID_TOKENS,
  MEDIA_PARAM_INDICATOR_TOKENS,
  MEDIA_PARAM_KEYWORDS,
  MEDIA_PARAM_LOCATOR_TOKENS,
  MEDIA_PARAM_SIZE_TOKENS,
  MEDIA_PARAM_STRONG_TOKENS,
  MEDIA_SLOT_END_TOKENS,
  MEDIA_SLOT_START_TOKENS,
  MEDIA_TYPE_DISPLAY,
  PREFIXES_REQUIRING_MEDIA,
  PREVIEWABLE_3D_EXTENSIONS,
  PROMPT_KEY_EXCLUDE_TOKENS,
  SOUND_TEXT_PARAM_KEYS,
  SUPPORTED_CATEGORIES,
  TYPE_PREFIX_TO_CATEGORY,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  THREED_EXTENSIONS,
  VIDEO_EXTENSIONS
} from './constants.js';

export function isSupportedCategory(category) {
  return SUPPORTED_CATEGORIES.includes(category);
}

export function categoryLabel(category) {
  if (!category && category !== 0) return '';
  if (String(category).toLowerCase() === ALL_CATEGORY_ID) return ALL_CATEGORY_LABEL;
  return CATEGORY_LABELS[category] || category || '';
}

export function normalizeCategory(category) {
  if (!category) return DEFAULT_ACTIVE_CATEGORY;
  const lower = String(category).toLowerCase();
  if (lower === ALL_CATEGORY_ID) return ALL_CATEGORY_ID;
  if (lower === 'text') return 'image';
  if (lower === 'img' || lower === 'images') return 'image';
  if (isSupportedCategory(lower)) return lower;
  if (['audio', 'speech', 'music'].includes(lower)) return 'sound';
  if (lower === 'misc' || lower === 'other') return 'other';
  return 'other';
}

export function normalizeTypeToken(token) {
  if (token === undefined || token === null) return '';
  const lower = String(token).trim().toLowerCase();
  if (!lower) return '';
  if (TYPE_PREFIX_TO_CATEGORY.has(lower)) return lower;
  return '';
}

export function resolveTypePrefix(tokens, fallback = '') {
  for (const token of tokens) {
    const normalized = normalizeTypeToken(token);
    if (normalized) {
      return normalized;
    }
  }
  const fallbackNormalized = normalizeTypeToken(fallback);
  return fallbackNormalized || '';
}

export function requiresMediaForPrefix(prefix) {
  if (!prefix) return false;
  return PREFIXES_REQUIRING_MEDIA.has(String(prefix).toLowerCase());
}

export function extractEnginePrefix(value) {
  if (!value) return '';
  const match = String(value).toLowerCase().match(/^([a-z0-9]+)-/);
  return match ? match[1] : '';
}

export function normalizeMediaGroupType(rawType) {
  if (!rawType && rawType !== 0) return 'other';
  const value = String(rawType).trim().toLowerCase();
  if (!value) return 'other';
  if (value === 'audio') return 'sound';
  if (MEDIA_TYPE_DISPLAY[value]) return value;
  return 'other';
}

export function tokenizeKey(key) {
  if (!key && key !== 0) return [];
  return String(key)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

export function inferMediaTypeFromParameter(key, schema = {}) {
  if (!key) return '';
  const tokens = tokenizeKey(key);
  if (!tokens.length) return '';

  const tokenSet = new Set(tokens);
  if (tokens.some((token) => MEDIA_PARAM_SIZE_TOKENS.has(token))) {
    return '';
  }
  const hasExcludedToken = tokens.some((token) => MEDIA_PARAM_EXCLUDE_TOKENS.has(token));
  const hasIndicatorToken = tokens.some((token) => MEDIA_PARAM_INDICATOR_TOKENS.has(token));
  const hasIdOnly = tokens.some((token) => MEDIA_PARAM_ID_TOKENS.has(token)) && !hasIndicatorToken;

  if (hasIdOnly) {
    return '';
  }

  if ((tokenSet.has('prompt') || tokenSet.has('prompts') || tokenSet.has('caption') || tokenSet.has('captions')
    || tokenSet.has('language') || tokenSet.has('languages') || tokenSet.has('output') || tokenSet.has('outputs'))
    && !hasIndicatorToken) {
    return '';
  }

  const cleanedTokens = tokens.filter((token) => !MEDIA_PARAM_EXCLUDE_TOKENS.has(token));
  const cleanedSet = new Set(cleanedTokens);

  const directMatch = (type) => {
    const keywords = MEDIA_PARAM_KEYWORDS[type];
    if (!keywords) return false;
    return cleanedTokens.some((token) => keywords.has(token));
  };

  const matchesSound = directMatch('sound');
  const matchesVideo = directMatch('video');
  const matchesImage = directMatch('image');
  const hasConfigToken = tokens.some((token) => MEDIA_PARAM_CONFIG_TOKENS.has(token));
  const hasLocatorToken = tokens.some((token) => MEDIA_PARAM_LOCATOR_TOKENS.has(token));

  const has3dGeometryTokens = cleanedSet.has('3d') || cleanedSet.has('mesh') || cleanedSet.has('meshes');
  const hasModelGeometryTokens = cleanedSet.has('model') || cleanedSet.has('models') || cleanedSet.has('geometry');
  let inferred = '';
  let inferredByGeometry = false;
  if (matchesSound) {
    const hasSoundIndicator = tokenSet.has('audio') || tokenSet.has('sound') || tokenSet.has('music')
      || tokenSet.has('track') || tokenSet.has('tracks') || tokenSet.has('clip') || tokenSet.has('clips')
      || tokenSet.has('sample') || tokenSet.has('samples') || tokenSet.has('url') || tokenSet.has('file');
    inferred = hasSoundIndicator ? 'sound' : '';
  } else if (matchesVideo) {
    inferred = 'video';
  } else if (matchesImage) {
    inferred = 'image';
  } else if (has3dGeometryTokens || (hasModelGeometryTokens && hasIndicatorToken)) {
    inferred = '3d';
    inferredByGeometry = true;
  }

  const descriptorText = [
    String(schema.title || ''),
    String(schema.description || ''),
    String(schema.contentMediaType || ''),
    String(schema.format || '')
  ]
    .map((chunk) => chunk.toLowerCase())
    .join(' ');

  const pickFromDescriptor = (value) => {
    if (!value) return '';
    if (value.includes('video/')) return 'video';
    if (value.includes('image/')) return 'image';
    if (value.includes('audio/') || value.includes('sound/')) return 'sound';
    if (value.includes('model') || value.includes('mesh') || value.includes('3d')) return '3d';
    return '';
  };

  const contentType = String(schema.contentMediaType || schema.mediaType || '').toLowerCase();
  const format = String(schema.format || '').toLowerCase();

  const descriptorCandidate = pickFromDescriptor(contentType)
    || (format.includes('video') ? 'video' : '')
    || (format.includes('image') ? 'image' : '')
    || ((format.includes('audio') || format.includes('sound')) ? 'sound' : '')
    || ((format.includes('model') || format.includes('mesh') || format.includes('3d')) ? '3d' : '');

  const descriptorHasAssetCore = /(url|uri|href|path|upload|source|clip|clips|track|tracks|asset|base64|data|payload|attachment)/.test(descriptorText);
  const descriptorMentionsFile = descriptorText.includes('file');
  const descriptorImpliesUpload = /(upload|provide|supply|input)/.test(descriptorText);
  const descriptorHasAssetToken = descriptorHasAssetCore || (descriptorMentionsFile && descriptorImpliesUpload);
  const schemaImpliesLocator = Boolean(format && (format.includes('uri') || format.includes('url')));
  const schemaImplies3dAsset = Boolean(contentType && /(model|mesh|3d)/.test(contentType));
  const descriptorSupportsAsset = descriptorHasAssetToken || schemaImpliesLocator || schemaImplies3dAsset;

  if (!inferred) {
    inferred = descriptorCandidate;
  }

  if (inferred === 'sound' && !hasIndicatorToken) {
    const hasSoundDescriptor = /audio|sound|music|track/.test(descriptorText) || format.includes('audio') || format.includes('sound');
    const hasSoundToken = tokenSet.has('audio') || tokenSet.has('sound') || tokenSet.has('music')
      || tokenSet.has('track') || tokenSet.has('tracks') || tokenSet.has('clip') || tokenSet.has('clips');
    if (!hasSoundDescriptor && !hasSoundToken) {
      inferred = '';
    }
  }

  if (inferred && !hasIndicatorToken) {
    const strongTokens = MEDIA_PARAM_STRONG_TOKENS[inferred] || new Set();
    const hasStrongToken = cleanedTokens.some((token) => strongTokens.has(token));
    const descriptorImpliesAsset = descriptorSupportsAsset || descriptorCandidate === inferred;
    if (!hasStrongToken && !descriptorImpliesAsset) {
      inferred = '';
    }
  }

  if (inferred && hasExcludedToken && !hasIndicatorToken && (tokenSet.has('prompt') || tokenSet.has('caption'))) {
    inferred = '';
  }

  if (!inferred && hasIndicatorToken) {
    const matchByDescription = (type) => {
      const keywords = MEDIA_PARAM_KEYWORDS[type];
      if (!keywords) return false;
      return Array.from(keywords).some((keyword) => descriptorText.includes(keyword));
    };
    if (matchByDescription('video')) {
      inferred = 'video';
    } else if (matchByDescription('image')) {
      inferred = 'image';
    } else if (matchByDescription('sound')) {
      inferred = 'sound';
    } else if ((descriptorText.includes('model') || descriptorText.includes('mesh') || descriptorText.includes('3d'))
      && (hasLocatorToken || descriptorSupportsAsset || !hasConfigToken)) {
      inferred = '3d';
      inferredByGeometry = true;
    }
  }

  if (inferredByGeometry) {
    const hasAssetEvidence = hasLocatorToken || descriptorSupportsAsset || descriptorCandidate === '3d';
    if (!hasAssetEvidence || (hasConfigToken && !descriptorSupportsAsset && descriptorCandidate !== '3d')) {
      inferred = '';
    }
  }

  if (!inferred) return '';
  if (!MEDIA_INPUT_ALLOWED_TYPES.has(inferred)) return 'other';
  return inferred;
}

export function detectPromptKeyFromProperties(properties) {
  if (!properties || typeof properties !== 'object') return '';
  if (Object.prototype.hasOwnProperty.call(properties, 'prompt')) {
    return 'prompt';
  }

  const keys = Object.keys(properties);
  for (const key of keys) {
    if (!key && key !== 0) continue;
    if (String(key).toLowerCase() === 'prompt') {
      return key;
    }
  }

  let bestCandidate = '';
  let bestScore = Number.POSITIVE_INFINITY;
  keys.forEach((key) => {
    if (!key && key !== 0) return;
    const tokens = tokenizeKey(key);
    if (!tokens.includes('prompt')) return;
    if (tokens.some((token) => PROMPT_KEY_EXCLUDE_TOKENS.has(token))) return;
    const score = tokens.length;
    if (score < bestScore) {
      bestCandidate = key;
      bestScore = score;
    }
  });

  return bestCandidate;
}

export function analyzeEngineParameters(meta) {
  const result = {
    mediaParams: {
      image: [],
      video: [],
      sound: [],
      other: []
    },
    soundTextKeys: [],
    requiredSoundTextKeys: [],
    requiredMediaTypes: new Set(),
    promptKey: '',
    requiresPrompt: false,
    requiresSoundText: false
  };

  const submitParams = meta?.tools?.submit?.parameters;
  const props = submitParams?.properties || {};
  const requiredKeys = Array.isArray(submitParams?.required)
    ? new Set(submitParams.required.map((key) => String(key)))
    : new Set();

  const manualRequired = ENGINE_PARAMETER_REQUIRED_HINTS[meta?.id];
  if (Array.isArray(manualRequired)) {
    manualRequired.forEach((key) => {
      if (key || key === 0) {
        requiredKeys.add(String(key));
      }
    });
  }

  const soundKeys = new Set();
  const requiredSoundKeys = new Set();
  if (Array.isArray(meta?.soundTextKeys)) {
    meta.soundTextKeys.forEach((key) => {
      if (key || key === 0) {
        soundKeys.add(key);
      }
    });
  }
  if (Array.isArray(meta?.requiredSoundTextKeys)) {
    meta.requiredSoundTextKeys.forEach((key) => {
      if (key || key === 0) {
        soundKeys.add(key);
        requiredSoundKeys.add(key);
      }
    });
  }
  const promptKey = detectPromptKeyFromProperties(props);
  if (promptKey) {
    result.promptKey = promptKey;
    const lowerPromptKey = promptKey.toLowerCase();
    if (Array.isArray(submitParams?.required)) {
      const requires = submitParams.required.some(
        (key) => String(key).toLowerCase() === lowerPromptKey
      );
      if (requires) {
        result.requiresPrompt = true;
      }
    }
    if (!result.requiresPrompt && Array.isArray(manualRequired)) {
      const matchesManual = manualRequired.some(
        (key) => String(key).toLowerCase() === lowerPromptKey
      );
      if (matchesManual) {
        result.requiresPrompt = true;
      }
    }
    if (!result.requiresPrompt) {
      const promptSchema = props?.[promptKey];
      if (promptSchema && typeof promptSchema === 'object') {
        if (typeof promptSchema.minLength === 'number' && promptSchema.minLength > 0) {
          result.requiresPrompt = true;
        } else if (typeof promptSchema.minItems === 'number' && promptSchema.minItems > 0) {
          result.requiresPrompt = true;
        } else if (promptSchema.required === true) {
          result.requiresPrompt = true;
        }
      }
    }
  }

  Object.entries(props).forEach(([key, schema]) => {
    if (promptKey && key === promptKey) {
      return;
    }
    const normalizedKey = String(key).toLowerCase();
    if (SOUND_TEXT_PARAM_KEYS.has(normalizedKey)) {
      soundKeys.add(key);
      const schemaObject = schema && typeof schema === 'object' ? schema : null;
      let isRequired = requiredKeys.has(key);
      if (!isRequired && schemaObject) {
        if (schemaObject.required === true) {
          isRequired = true;
        } else if (typeof schemaObject.minLength === 'number' && schemaObject.minLength > 0) {
          isRequired = true;
        } else if (typeof schemaObject.minItems === 'number' && schemaObject.minItems > 0) {
          isRequired = true;
        }
      }
      if (isRequired) {
        requiredSoundKeys.add(key);
      }
      return;
    }

    const inferredType = inferMediaTypeFromParameter(key, schema);
    if (inferredType) {
      const typeKey = normalizeMediaGroupType(inferredType);
      if (!result.mediaParams[typeKey]) {
        result.mediaParams[typeKey] = [];
      }
      const info = {
        key,
        required: requiredKeys.has(key)
      };
      result.mediaParams[typeKey].push(info);
      if (info.required) {
        result.requiredMediaTypes.add(typeKey);
      }
      return;
    }

    const fallbackTokens = tokenizeKey(key);
    if (fallbackTokens.includes('file') && fallbackTokens.includes('url')) {
      result.mediaParams.other.push({ key, required: requiredKeys.has(key) });
    }
  });

  result.soundTextKeys = Array.from(soundKeys);
  result.requiredSoundTextKeys = Array.from(requiredSoundKeys);
  if (requiredSoundKeys.size > 0 || meta?.requiresSoundText === true) {
    result.requiresSoundText = true;
  }
  return result;
}

export function getPromptKey(meta) {
  if (!meta) return '';
  if (typeof meta.promptKey === 'string' && meta.promptKey) {
    return meta.promptKey;
  }
  const props = meta?.tools?.submit?.parameters?.properties;
  const detected = detectPromptKeyFromProperties(props);
  if (detected && typeof meta === 'object') {
    meta.promptKey = detected;
  }
  return detected || '';
}

export function engineRequiresPrompt(meta) {
  if (!meta) return false;
  if (meta.requiresPrompt === true) {
    return true;
  }
  const submitParams = meta?.tools?.submit?.parameters;
  if (!submitParams) {
    return Boolean(meta?.requiresPrompt);
  }
  const promptKey = getPromptKey(meta);
  if (!promptKey) {
    return Boolean(meta?.requiresPrompt);
  }
  const lowerPromptKey = String(promptKey).toLowerCase();
  const manualRequired = ENGINE_PARAMETER_REQUIRED_HINTS[meta?.id];
  if (Array.isArray(submitParams.required)) {
    const requires = submitParams.required.some((key) => String(key).toLowerCase() === lowerPromptKey);
    if (requires) {
      meta.requiresPrompt = true;
      return true;
    }
  }
  if (Array.isArray(manualRequired)) {
    const matchesManual = manualRequired.some((key) => String(key).toLowerCase() === lowerPromptKey);
    if (matchesManual) {
      meta.requiresPrompt = true;
      return true;
    }
  }
  const schema = submitParams.properties?.[promptKey];
  if (schema && typeof schema === 'object') {
    if (typeof schema.minLength === 'number' && schema.minLength > 0) {
      meta.requiresPrompt = true;
      return true;
    }
    if (typeof schema.minItems === 'number' && schema.minItems > 0) {
      meta.requiresPrompt = true;
      return true;
    }
    if (schema.required === true) {
      meta.requiresPrompt = true;
      return true;
    }
  }
  return Boolean(meta?.requiresPrompt);
}

export function engineRequiresSoundText(meta, entry = null) {
  const fallback = entry && typeof entry === 'object' ? entry : {};
  const source = meta || fallback;
  if (!source) return false;
  if (source.requiresSoundText === true || fallback.requiresSoundText === true) {
    return true;
  }
  if (source.requiresSoundText === false || fallback.requiresSoundText === false) {
    return false;
  }

  const requiredSoundKeys = new Set();
  if (Array.isArray(source.requiredSoundTextKeys)) {
    source.requiredSoundTextKeys.forEach((key) => {
      if (key || key === 0) {
        requiredSoundKeys.add(String(key).toLowerCase());
      }
    });
  }
  if (Array.isArray(fallback.requiredSoundTextKeys)) {
    fallback.requiredSoundTextKeys.forEach((key) => {
      if (key || key === 0) {
        requiredSoundKeys.add(String(key).toLowerCase());
      }
    });
  }
  if (requiredSoundKeys.size > 0) {
    return true;
  }

  const collectSoundKeys = () => {
    const keys = new Set();
    const enqueue = (key) => {
      if (key || key === 0) {
        keys.add(String(key));
      }
    };
    if (Array.isArray(source.soundTextKeys)) {
      source.soundTextKeys.forEach(enqueue);
    }
    if (Array.isArray(fallback.soundTextKeys)) {
      fallback.soundTextKeys.forEach(enqueue);
    }
    if (source.soundTextKey) enqueue(source.soundTextKey);
    if (fallback.soundTextKey) enqueue(fallback.soundTextKey);
    return Array.from(keys);
  };

  const soundKeys = collectSoundKeys();
  if (!soundKeys.length) {
    return false;
  }

  const submitParams = source?.tools?.submit?.parameters
    || fallback?.tools?.submit?.parameters
    || null;
  const requiredSet = new Set();
  if (Array.isArray(submitParams?.required)) {
    submitParams.required.forEach((key) => {
      if (key || key === 0) {
        requiredSet.add(String(key).toLowerCase());
      }
    });
  }
  if (soundKeys.some((key) => requiredSet.has(String(key).toLowerCase()))) {
    return true;
  }

  const properties = submitParams?.properties;
  if (!properties || typeof properties !== 'object') {
    return false;
  }

  const findSchemaForKey = (propKey) => {
    if (Object.prototype.hasOwnProperty.call(properties, propKey)) {
      return properties[propKey];
    }
    const lower = String(propKey).toLowerCase();
    const entries = Object.entries(properties);
    for (const [candidate, schema] of entries) {
      if (String(candidate).toLowerCase() === lower) {
        return schema;
      }
    }
    return null;
  };

  for (const key of soundKeys) {
    const schema = findSchemaForKey(key);
    if (!schema || typeof schema !== 'object') {
      continue;
    }
    if (schema.required === true) {
      return true;
    }
    if (typeof schema.minLength === 'number' && schema.minLength > 0) {
      return true;
    }
    if (typeof schema.minItems === 'number' && schema.minItems > 0) {
      return true;
    }
  }

  return false;
}

export function normalizeTemplateEntry(entry, fallbackCategory = DEFAULT_ACTIVE_CATEGORY) {
  if (!entry) return null;
  const clone = { ...entry };
  const typeCandidates = [clone.type, clone.sourceCategory, clone.category];
  let normalizedType = '';
  for (const candidate of typeCandidates) {
    const normalized = normalizeTypeToken(candidate);
    if (normalized) {
      normalizedType = normalized;
      break;
    }
  }
  const categoryCandidate = clone.category || normalizedType || fallbackCategory;
  const normalizedCategory = normalizeCategory(categoryCandidate);
  clone.category = normalizedCategory;
  clone.type = normalizedType;
  if (typeof clone.filePrefix === 'string') {
    clone.filePrefix = clone.filePrefix.trim();
  } else {
    clone.filePrefix = '';
  }
  if (typeof clone.memo === 'string') {
    clone.memo = clone.memo.trim();
  } else {
    clone.memo = '';
  }
  if (typeof clone.soundText === 'string') {
    clone.soundText = clone.soundText.trim();
  } else {
    clone.soundText = '';
  }
  return clone;
}

function resolveCategoryCandidate(...candidates) {
  for (const candidate of candidates) {
    if (!candidate && candidate !== 0) continue;
    const normalized = normalizeCategory(candidate);
    if (normalized && normalized !== 'other') {
      return normalized;
    }
  }
  return 'other';
}

export function inferCategoryFromTokens(tokens, fallback = 'other') {
  const evaluated = new Set();
  tokens.forEach((token) => {
    if (!token && token !== 0) return;
    const lower = String(token).toLowerCase();
    if (!lower) return;
    evaluated.add(lower);
    if (TYPE_PREFIX_TO_CATEGORY.has(lower)) {
      evaluated.add(TYPE_PREFIX_TO_CATEGORY.get(lower));
    }
  });

  const fromPrefixes = Array.from(evaluated).find((candidate) => TYPE_PREFIX_TO_CATEGORY.has(candidate));
  if (fromPrefixes) {
    return TYPE_PREFIX_TO_CATEGORY.get(fromPrefixes);
  }

  const resolved = resolveCategoryCandidate(...evaluated);
  if (resolved && resolved !== 'other') {
    return resolved;
  }

  const normalizedFallback = normalizeCategory(fallback);
  return normalizedFallback === 'other' ? DEFAULT_ACTIVE_CATEGORY : normalizedFallback;
}

function hasStartAssignment(tokens) {
  if (!tokens || !tokens.length) return false;
  return tokens.some((token) => MEDIA_SLOT_START_TOKENS.includes(token));
}

export function fallbackSlotLabel(type, key, index = 0) {
  const baseLabel = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
  const tokens = tokenizeKey(key);
  const hasStartToken = hasStartAssignment(tokens);
  const hasEndToken = tokens.some((token) => MEDIA_SLOT_END_TOKENS.includes(token));
  const isVisualMedia = type === 'image' || type === 'video';
  if (isVisualMedia) {
    const startLabel = 'START';
    const endLabel = 'END';
    if (hasEndToken) return endLabel;
    if (hasStartToken) return startLabel;
  }
  if (index > 0) {
    return `${baseLabel} #${index + 1}`;
  }
  return baseLabel;
}

export function normalizeSlotLabel(rawLabel, { type = '', key = '', index = 0 } = {}) {
  const trimmed = typeof rawLabel === 'string' ? rawLabel.trim() : '';
  if (!trimmed) {
    return fallbackSlotLabel(type, key, index);
  }
  const upper = trimmed.toUpperCase();
  const tokens = tokenizeKey(key);
  const hasStartToken = hasStartAssignment(tokens);
  const hasEndToken = tokens.some((token) => MEDIA_SLOT_END_TOKENS.includes(token));
  if (upper === 'START' && tokens.length && !hasStartToken) {
    return fallbackSlotLabel(type, key, index);
  }
  if (upper === 'END' && tokens.length && !hasEndToken) {
    return fallbackSlotLabel(type, key, index);
  }
  return trimmed;
}

export function formatSlotLabelForDisplay(rawLabel, slotType = '', index = 0, total = 0) {
  const normalized = typeof rawLabel === 'string' ? rawLabel.trim() : '';
  const slotUpper = normalized.toUpperCase();
  if (slotUpper === 'START_IMAGE' || slotUpper === 'START_VIDEO' || slotUpper === 'START') {
    return 'START';
  }
  if (slotUpper === 'END_IMAGE' || slotUpper === 'END_VIDEO' || slotUpper === 'END') {
    return 'END';
  }
  if (!normalized && slotType) {
    return slotType.toUpperCase();
  }
  if (!normalized && !slotType) {
    return 'INPUT';
  }
  return normalized || (slotType ? slotType.toUpperCase() : 'INPUT');
}

function isDirectionalLabel(label, target) {
  if (!label && label !== 0) return false;
  const upper = String(label).trim().toUpperCase();
  if (!upper) return false;
  if (target === 'start') {
    return upper === 'START' || upper === 'START_IMAGE' || upper === 'START_VIDEO';
  }
  if (target === 'end') {
    return upper === 'END' || upper === 'END_IMAGE' || upper === 'END_VIDEO';
  }
  return false;
}

function resolveBaseSlotLabel(type, index = 0) {
  const base = MEDIA_TYPE_DISPLAY[type]?.label || type.toUpperCase();
  if (index > 0) {
    return `${base} #${index + 1}`;
  }
  return base;
}

export function normalizeAssignmentSlotLabels(assignments = []) {
  if (!Array.isArray(assignments) || !assignments.length) {
    return Array.isArray(assignments) ? assignments : [];
  }
  const normalizedList = assignments.map((assignment) => {
    if (!assignment || typeof assignment !== 'object') return assignment;
    return { ...assignment };
  });

  const byType = new Map();
  normalizedList.forEach((assignment, idx) => {
    if (!assignment || typeof assignment !== 'object') return;
    const normalizedType = normalizeMediaGroupType(
      assignment.slotType || assignment.type || (assignment.media && assignment.media.filterType) || ''
    );
    if (!byType.has(normalizedType)) {
      byType.set(normalizedType, []);
    }
    byType.get(normalizedType).push({ assignment, index: idx });
  });

  byType.forEach((entries, type) => {
    if (!entries.length) return;
    if (type !== 'image' && type !== 'video') return;
    const total = entries.length;
    const hasStartLabel = entries.some(({ assignment }) => isDirectionalLabel(assignment?.slotLabel, 'start'));
    const hasEndLabel = entries.some(({ assignment }) => isDirectionalLabel(assignment?.slotLabel, 'end'));
    const allowDirectional = total >= 2 && hasStartLabel && hasEndLabel;

    entries.forEach(({ assignment }, orderIdx) => {
      if (!assignment || typeof assignment !== 'object') return;
      const rawLabel = typeof assignment.slotLabel === 'string' ? assignment.slotLabel.trim() : '';
      const upper = rawLabel.toUpperCase();
      const tokens = tokenizeKey(assignment.paramKey || assignment.slotId || '');
      const hasStartToken = tokens.some((token) => MEDIA_SLOT_START_TOKENS.includes(token));
      const hasEndToken = tokens.some((token) => MEDIA_SLOT_END_TOKENS.includes(token));

      if (allowDirectional) {
        if (upper === 'START' || (hasStartToken && !hasEndToken)) {
          assignment.slotLabel = 'START';
          return;
        }
        if (upper === 'END' || hasEndToken) {
          assignment.slotLabel = 'END';
          return;
        }
        if (!rawLabel) {
          assignment.slotLabel = resolveBaseSlotLabel(type, orderIdx);
        }
        return;
      }

      if (upper === 'START' || upper === 'END' || !rawLabel) {
        assignment.slotLabel = resolveBaseSlotLabel(type, orderIdx);
      }
    });
  });

  return normalizedList;
}

export function detectPreviewable3dExtension(entry) {
  if (!entry) return '';
  const candidates = [];
  if (typeof entry === 'string') {
    candidates.push(entry);
  } else if (typeof entry === 'object') {
    if (entry.fileName) candidates.push(entry.fileName);
    if (entry.filename) candidates.push(entry.filename);
    if (entry.path) candidates.push(entry.path);
    if (entry.url) candidates.push(entry.url);
    if (entry.imageUrl) candidates.push(entry.imageUrl);
    if (entry.webPath) candidates.push(entry.webPath);
  }
  for (const candidate of candidates) {
    const ext = extractFileExtension(candidate);
    if (ext && PREVIEWABLE_3D_EXTENSIONS.has(ext)) {
      return ext;
    }
  }
  return '';
}

export function isPreviewable3dEntry(entry) {
  if (!entry) return false;
  if (entry.filterType && entry.filterType !== '3d') {
    if (entry.filterType === 'other') {
      return Boolean(detectPreviewable3dExtension(entry));
    }
    return false;
  }
  return Boolean(detectPreviewable3dExtension(entry));
}

export function sanitizeMediaEntryForPayload(entry, defaultType = '') {
  if (!entry) return null;
  const resolvedName = entry.name || extractFilename(entry.path || entry.url || '');
  const filterType = normalizeMediaGroupType(entry.filterType || entry.type || defaultType);
  const sanitized = {
    path: entry.path || '',
    url: entry.url || '',
    name: resolvedName,
    thumbUrl: entry.thumbUrl || '',
    filterType,
    mime: entry.mime || '',
    ext: entry.ext || ''
  };

  if (entry.engineId) sanitized.engineId = entry.engineId;
  if (entry.requestId) sanitized.requestId = entry.requestId;
  if (entry.filePrefix) sanitized.filePrefix = entry.filePrefix;
  if (entry.absolute) sanitized.absolute = entry.absolute;
  if (entry.relative) sanitized.relative = entry.relative;
  if (entry.webPath) sanitized.webPath = entry.webPath;
  if (entry.timestamp) sanitized.timestamp = entry.timestamp;
  if (Array.isArray(entry.typePrefixes)) sanitized.typePrefixes = entry.typePrefixes.slice();
  if (entry.sourceCategory) sanitized.sourceCategory = entry.sourceCategory;
  if (entry.slotId) sanitized.slotId = entry.slotId;

  const resolvedVideoId = entry.videoId
    || entry.soraVideoId
    || (entry.sora && entry.sora.videoId)
    || (entry.savedFile && entry.savedFile.videoId)
    || '';
  if (resolvedVideoId) {
    sanitized.videoId = resolvedVideoId;
  }

  if (entry.sora && typeof entry.sora === 'object') {
    sanitized.sora = { ...entry.sora };
  } else if (resolvedVideoId) {
    sanitized.sora = { videoId: resolvedVideoId };
  }

  if (entry.metadata && typeof entry.metadata === 'object') {
    sanitized.metadata = { ...entry.metadata };
  }

  return sanitized;
}

export function extractFilename(input) {
  if (!input) return '';
  const parts = String(input).split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(input);
}

export function extractFileExtension(input) {
  const name = extractFilename(input);
  const match = name.toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

export function groupMediaEntriesByType(mediaList) {
  const groups = new Map();
  mediaList.forEach((entry) => {
    const type = normalizeMediaGroupType(entry?.filterType || entry?.mediaType || entry?.type);
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type).push(entry);
  });
  return groups;
}

export function tokenizeMediaValue(value) {
  if (!value && value !== 0) return [];
  return String(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

export function deriveMediaFilterTags(source) {
  const tokens = new Set();
  const enqueue = (payload) => {
    if (!payload && payload !== 0) return;
    tokenizeMediaValue(payload).forEach((token) => tokens.add(token));
  };

  if (Array.isArray(source?.filterTags)) {
    source.filterTags.forEach(enqueue);
  }
  enqueue(source?.filterType);
  enqueue(source?.category);
  enqueue(source?.kind);
  enqueue(source?.type);
  enqueue(source?.mediaType);
  enqueue(source?.mime);
  enqueue(source?.ext);
  enqueue(source?.name);
  enqueue(source?.path);
  if (Array.isArray(source?.tags)) {
    source.tags.forEach(enqueue);
  }
  if (Array.isArray(source?.labels)) {
    source.labels.forEach(enqueue);
  }

  const tags = new Set();
  tokens.forEach((token) => {
    const mapped = MEDIA_HINT_LOOKUP.get(token);
    if (mapped) {
      tags.add(mapped);
    }
    if (AUDIO_EXTENSIONS.has(token)) tags.add('sound');
    if (VIDEO_EXTENSIONS.has(token)) tags.add('video');
    if (THREED_EXTENSIONS.has(token)) tags.add('3d');
    if (IMAGE_EXTENSIONS.has(token)) tags.add('image');
  });

  return Array.from(tags);
}

export function selectPrimaryMediaFilter(tags) {
  if (!tags || !tags.length) return 'other';
  for (const candidate of MEDIA_FILTER_PRIORITY) {
    if (tags.includes(candidate)) return candidate;
  }
  return tags[0];
}

const STATIC_ASSET_PREFIXES = ['/showcase/', '/_showcase/', '/images/', '/videos/', '/storyboard_images/', '/storyboard_videos/'];

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\\]\\\\]/g, (match) => `\\${match}`);

export function normalizeShowcaseAssetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  let working = url.trim().replace(/\\/g, '/');
  if (!working) return working;

  if (working.includes('/public/showcase/')) {
    working = working.replace('/public/showcase/', '/showcase/');
  }
  if (working.includes('public/showcase/')) {
    working = working.replace('public/showcase/', 'showcase/');
  }
  if (working.includes('/public/images/')) {
    working = working.replace('/public/images/', '/images/');
  }
  if (working.includes('public/images/')) {
    working = working.replace('public/images/', 'images/');
  }

  for (const prefix of STATIC_ASSET_PREFIXES) {
    const pattern = new RegExp(`\\/?${escapeForRegex(prefix)}[^\\s?#]+`);
    const match = working.match(pattern);
    if (match) {
      const suffix = match[0].startsWith('/') ? match[0] : `/${match[0]}`;
      if (suffix.startsWith('/_showcase/')) {
        return suffix.replace('/_showcase/', '/showcase/');
      }
      return suffix;
    }
  }
  return working;
}

export function collectAssetUrlCandidates(url) {
  const candidates = [];
  const seen = new Set();
  const add = (candidate) => {
    const normalized = typeof candidate === 'string' ? candidate.trim() : '';
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  if (typeof url === 'string') {
    add(url);
  }

  const normalized = normalizeShowcaseAssetUrl(url);
  add(normalized);

  let canonical = normalized;
  if (normalized && normalized.startsWith('/_showcase/')) {
    const remapped = normalized.replace('/_showcase/', '/showcase/');
    add(remapped);
    canonical = remapped;
  }

  STATIC_ASSET_PREFIXES.forEach((prefix) => {
    const normalizedPrefix = prefix.startsWith('/_showcase/') ? '/showcase/' : prefix;
    if (canonical && canonical.startsWith(normalizedPrefix) && !canonical.startsWith('/static/')) {
      add(`/static${canonical}`);
    }
  });

  return candidates;
}

export function applyAssetSrcWithFallback(element, src, { type = 'image', loadEvent } = {}) {
  if (!element) return;
  const candidates = collectAssetUrlCandidates(src);
  if (!candidates.length) return;
  let index = 0;
  const targetEvent = loadEvent || (type === 'image' ? 'load' : 'loadeddata');

  const handleLoad = () => {
    element.removeEventListener('error', handleError);
  };

  const applyCandidate = () => {
    const candidate = candidates[index];
    if (!candidate) return;
    if (type === 'video' || type === 'audio') {
      element.src = candidate;
      if (typeof element.load === 'function') {
        element.load();
      }
    } else {
      element.src = candidate;
    }
  };

  const handleError = () => {
    index += 1;
    if (index < candidates.length) {
      applyCandidate();
    } else {
      element.removeEventListener('error', handleError);
    }
  };

  element.addEventListener('error', handleError);
  element.addEventListener(targetEvent, handleLoad, { once: true });

  applyCandidate();
}
