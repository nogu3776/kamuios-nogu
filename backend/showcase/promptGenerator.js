const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const fsPromises = fs.promises;

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PROMPT_LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'showcase', 'prompt-generator');
const PROMPT_LOG_STRING_LIMIT = Number.parseInt(process.env.GEMINI_PROMPT_LOG_STRING_LIMIT || '6000', 10);
const BASE_MODEL_ID = 'models/gemini-flash-latest';
const MAX_OUTPUT_TOKENS_CAP = 65536;
const DEFAULT_MAX_OUTPUT_TOKENS = (() => {
  const parsed = Number(process.env.GEMINI_PROMPT_MAX_OUTPUT_TOKENS);
  if (!Number.isFinite(parsed)) return MAX_OUTPUT_TOKENS_CAP;
  return Math.max(256, Math.min(MAX_OUTPUT_TOKENS_CAP, Math.trunc(parsed)));
})();

function deriveDefaultModelId(rawValue) {
  if (!rawValue) return BASE_MODEL_ID;
  const trimmed = String(rawValue).trim();
  if (!trimmed) return BASE_MODEL_ID;
  const normalized = trimmed.startsWith('models/') ? trimmed : `models/${trimmed.replace(/^models\//, '')}`;
  return normalized;
}

const DEFAULT_MODEL = deriveDefaultModelId(process.env.GEMINI_PROMPT_MODEL);
const VARIANT_COUNT_MAX = 8;
const DEFAULT_VARIANT_COUNT = Number.isFinite(Number(process.env.GEMINI_PROMPT_VARIANT_COUNT))
  ? Math.max(1, Math.min(VARIANT_COUNT_MAX, Number(process.env.GEMINI_PROMPT_VARIANT_COUNT)))
  : 3;
const DEFAULT_TEMPERATURE = Number.isFinite(Number(process.env.GEMINI_PROMPT_TEMPERATURE))
  ? Math.max(0, Math.min(1.5, Number(process.env.GEMINI_PROMPT_TEMPERATURE)))
  : 0.9;
const DEFAULT_TOP_P = Number.isFinite(Number(process.env.GEMINI_PROMPT_TOP_P))
  ? Math.max(0, Math.min(1, Number(process.env.GEMINI_PROMPT_TOP_P)))
  : 0.9;
const LYRICS_CHAR_MIN = 60;
const LYRICS_CHAR_MAX = 1600;
const LEGACY_LYRICS_STRUCTURE_GUIDANCE = {
  verse_chorus: 'Use a Verse / Chorus structure and alternate verses with choruses.',
  verse_chorus_bridge: 'Use a Verse / Chorus / Bridge structure including a bridge near the finale.',
  verse_chorus_outro: 'Use a Verse / Chorus structure that concludes with a distinct Outro section.',
  verse_chorus_bridge_outro: 'Use a Verse / Chorus / Bridge sequence and finish with a concise Outro.',
  verse_only: 'Focus on continuous verses without choruses.'
};
const PROPER_NOUN_AVOIDANCE_GUIDANCE_EN = 'Rephrase or omit any company names, personal names, copyrighted characters, or franchise titles from the base prompt; describe stylistic traits generically instead of repeating proper nouns.';
const PROPER_NOUN_AVOIDANCE_HINT_JA = '固有名詞（企業名・個人名・作品名・キャラクター名など）はプロンプト／歌詞／音声テキスト／タグ／テンプレートでも使用せず、必要に応じて一般的な表現に言い換える';


function toSafeString(input, { maxLength = 4000 } = {}) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!Number.isFinite(maxLength) || trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

function ensureDir(dir) {
  return fsPromises.mkdir(dir, { recursive: true }).catch(() => {});
}

function formatTimestampJst(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const formatted = formatter.format(date);
    return `${formatted.replace(/\//g, '-') } JST`;
  } catch (err) {
    return `${date.toISOString()} (fallback)`;
  }
}

function toLogString(input, { limit = PROMPT_LOG_STRING_LIMIT } = {}) {
  if (input === undefined || input === null) return '';
  let text;
  if (typeof input === 'string') {
    text = input;
  } else {
    try {
      text = JSON.stringify(input, null, 2);
    } catch (err) {
      text = String(input);
    }
  }
  if (!Number.isFinite(limit) || limit <= 0 || text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}… (+${text.length - limit} chars truncated)`;
}

function appendMultiline(lines, label, value) {
  const text = toLogString(value);
  if (!text) {
    lines.push(`${label}:`);
    lines.push('  [empty]');
    return;
  }
  lines.push(`${label}:`);
  text.split(/\r?\n/).forEach((line) => {
    lines.push(`  ${line}`);
  });
}

async function appendPromptLog({
  status,
  request,
  response,
  error,
  suggestions,
  durationMs,
  finishReasons = [],
  fragment = ''
}) {
  try {
    await ensureDir(PROMPT_LOG_DIR);
    const now = new Date();
    const timestamp = now.toISOString();
    const day = timestamp.slice(0, 10);
    const logPath = path.join(PROMPT_LOG_DIR, `${day}.log`);

    const lines = [];
    lines.push('---');
    lines.push(`timestamp: ${timestamp}`);
    lines.push(`timestampJst: ${formatTimestampJst(now)}`);
    lines.push(`status: ${status || ''}`);
    if (Number.isFinite(durationMs)) {
      lines.push(`durationMs: ${durationMs}`);
    }
    appendMultiline(lines, 'request', request || {});
    if (response !== undefined) {
      appendMultiline(lines, 'response', response);
    }
    if (Array.isArray(suggestions)) {
      appendMultiline(lines, 'suggestions', suggestions);
    }
    if (Array.isArray(finishReasons) && finishReasons.length > 0) {
      appendMultiline(lines, 'finishReasons', finishReasons);
    }
    if (fragment) {
      appendMultiline(lines, 'lastJsonFragment', fragment);
    }
    if (error) {
      appendMultiline(lines, 'error', {
        message: error.message || String(error),
        stack: error.stack || ''
      });
    }
    lines.push('');

    await fsPromises.appendFile(logPath, lines.join('\n'), 'utf8');
  } catch (err) {
    console.error('[PromptGenerator] failed to append log', err);
  }
}

function normalizeModelId(model) {
  const candidate = deriveDefaultModelId(model);
  return toSafeString(candidate, { maxLength: 200 }) || BASE_MODEL_ID;
}

function normalizeMode(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (normalized === 'expand' || normalized === 'explore') return 'expand';
  if (normalized === 'enhance' || normalized === 'refine' || normalized === 'improve') {
    return 'enhance';
  }
  return 'enhance';
}

function buildSystemPrompt() {
  return [
    'You are an expert prompt engineer for generative AI systems.',
    'Return a valid JSON string that matches the schema: { "suggestions": [ { "label": "", "prompt": "", "translation": "", "description": "", "tags": [], "template": { "name": "", "category": "", "type": "", "filePrefix": "", "soundText": "", "memo": "", "tags": [] } } ] }.',
    'Rules:',
    '- suggestions length must equal the requested variantCount (fill with best effort).',
    '- label: concise Japanese title (<=12 characters).',
    '- prompt: detailed English prompt (<=1200 characters) suitable for direct generation.',
    '- translation: faithful Japanese translation of the prompt (<=1200 characters).',
    '- description: optional Japanese note (<=60 characters).',
    '- tags: up to 4 short English keywords (array of strings).',
    '- template: optional object to prefill template fields; omit keys you cannot infer. name should be Japanese, category/type should reference generator modalities (e.g. image, video, sound, other), filePrefix should be filesystem-friendly lowercase-with-dashes, soundText is short Japanese narration, memo is Japanese guidance (populate memo with the Japanese translation when helpful). template.tags mirrors tags array but may include Japanese keywords.',
    '- When lyrics are requested in the user prompt/context, include a "lyrics" object for each suggestion with at minimum { "text": "" } (<=4000 characters). Preserve line breaks, avoid numbering unless specifically asked, and you may add optional fields such as "language", "structure", "includeSectionLabels", "charTarget", "sections" (array of section names) to reflect constraints.',
    '- Never include company names, personal names, copyrighted characters, franchise titles, or other proper nouns; rewrite such references into generic descriptors even if the base prompt mentions them.',
    '- Apply the no-proper-noun rule to every field: prompt, translation, description, tags, template values, lyrics, soundText, and any additional outputs.',
    'Return JSON only; no prose, Markdown fences, or comments.'
  ].join('\n');
}

function sanitizeVariantCount(input) {
  const numeric = Number(input);
  const requested = Number.isFinite(numeric) ? numeric : DEFAULT_VARIANT_COUNT;
  return Math.max(1, Math.min(Math.trunc(requested), VARIANT_COUNT_MAX));
}

function sanitizeLyricsCharTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const truncated = Math.trunc(numeric);
  if (!Number.isFinite(truncated)) return null;
  const clamped = Math.max(LYRICS_CHAR_MIN, Math.min(LYRICS_CHAR_MAX, truncated));
  return clamped;
}

function sanitizeVoiceCharTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const truncated = Math.trunc(numeric);
  if (!Number.isFinite(truncated)) return null;
  const clamped = Math.max(40, Math.min(800, truncated));
  return clamped;
}

function mapLyricsLengthToCharTarget(lengthPref) {
  if (!lengthPref || typeof lengthPref !== 'string') return null;
  const normalized = lengthPref.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'short') return 160;
  if (normalized === 'extended' || normalized === 'long') return 380;
  if (normalized === 'standard' || normalized === 'medium' || normalized === 'regular') return 260;
  return null;
}

function deriveLyricsCharTarget({ charTarget, lengthPref, lineCount }) {
  const direct = sanitizeLyricsCharTarget(charTarget);
  if (Number.isFinite(direct)) return direct;
  const mapped = mapLyricsLengthToCharTarget(lengthPref);
  if (Number.isFinite(mapped)) {
    return sanitizeLyricsCharTarget(mapped);
  }
  if (Number.isFinite(lineCount)) {
    const estimated = Math.max(lineCount, 1) * 36;
    return sanitizeLyricsCharTarget(estimated);
  }
  return null;
}

function sanitizePromptContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const result = {};
  const activeCategory = toSafeString(raw.activeCategory, { maxLength: 40 });
  if (activeCategory) {
    result.activeCategory = activeCategory;
  }
  const activeCategoryLabel = toSafeString(raw.activeCategoryLabel, { maxLength: 60 });
  if (activeCategoryLabel) {
    result.activeCategoryLabel = activeCategoryLabel;
  }
  if (Number.isFinite(raw.engineCount)) {
    const count = Math.max(0, Math.min(64, Math.trunc(raw.engineCount)));
    result.engineCount = count;
  }
  const engineTypes = Array.isArray(raw.engineTypes)
    ? raw.engineTypes
        .map((value) => toSafeString(value, { maxLength: 20 }).toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (engineTypes.length) {
    result.engineTypes = engineTypes;
  }
  const engineCategories = Array.isArray(raw.engineCategories)
    ? raw.engineCategories
        .map((value) => toSafeString(value, { maxLength: 40 }).toLowerCase())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  if (engineCategories.length) {
    result.engineCategories = engineCategories;
  }
  if (raw.requiresMedia === true) {
    result.requiresMedia = true;
  }
  if (raw.requiresPrompt === true) {
    result.requiresPrompt = true;
  }
  if (raw.requiresSoundText === true) {
    result.requiresSoundText = true;
  }
  const requiredMediaTypes = Array.isArray(raw.requiredMediaTypes)
    ? raw.requiredMediaTypes
        .map((value) => toSafeString(value, { maxLength: 20 }).toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (requiredMediaTypes.length) {
    result.requiredMediaTypes = requiredMediaTypes;
  }
  const engines = Array.isArray(raw.engines)
    ? raw.engines
        .map((engine) => {
          if (!engine || typeof engine !== 'object') return null;
          const sanitized = {};
          const id = toSafeString(engine.id, { maxLength: 120 });
          if (id) {
            sanitized.id = id;
          }
          const label = toSafeString(engine.label, { maxLength: 120 });
          if (label) {
            sanitized.label = label;
          }
          const type = toSafeString(engine.type, { maxLength: 20 }).toLowerCase();
          if (type) {
            sanitized.type = type;
          }
          const category = toSafeString(engine.category, { maxLength: 40 }).toLowerCase();
          if (category) {
            sanitized.category = category;
          }
          if (engine.requiresMedia === true) {
            sanitized.requiresMedia = true;
          }
          if (Array.isArray(engine.requiredMediaTypes)) {
            const mediaTypes = engine.requiredMediaTypes
              .map((value) => toSafeString(value, { maxLength: 20 }).toLowerCase())
              .filter(Boolean)
              .slice(0, 8);
            if (mediaTypes.length) {
              sanitized.requiredMediaTypes = mediaTypes;
            }
          }
          const promptKey = toSafeString(engine.promptKey, { maxLength: 60 });
          if (promptKey) {
            sanitized.promptKey = promptKey;
          }
          if (Array.isArray(engine.soundTextKeys)) {
            const soundKeys = engine.soundTextKeys
              .map((value) => toSafeString(value, { maxLength: 60 }))
              .filter(Boolean)
              .slice(0, 6);
            if (soundKeys.length) {
              sanitized.soundTextKeys = soundKeys;
            }
          }
          return Object.keys(sanitized).length ? sanitized : null;
        })
        .filter(Boolean)
        .slice(0, 8)
    : [];
  if (engines.length) {
    result.engines = engines;
  }
  const selectedCategory = toSafeString(raw.selectedCategory, { maxLength: 40 });
  if (selectedCategory) {
    result.selectedCategory = selectedCategory.toLowerCase();
  }
  const selectedType = toSafeString(raw.selectedType, { maxLength: 40 });
  if (selectedType) {
    result.selectedType = selectedType.toLowerCase();
  }
  const primaryEngineLabel = toSafeString(raw.primaryEngineLabel, { maxLength: 160 });
  if (primaryEngineLabel) {
    result.primaryEngineLabel = primaryEngineLabel;
  }
  const primaryEngineId = toSafeString(raw.primaryEngineId, { maxLength: 160 });
  if (primaryEngineId) {
    result.primaryEngineId = primaryEngineId;
  }
  const customGuidance = toSafeString(raw.guidance, { maxLength: 2000 });
  if (customGuidance) {
    result.guidance = customGuidance;
  }
  const customGuidanceTranslation = toSafeString(raw.guidanceTranslation, { maxLength: 2000 });
  if (customGuidanceTranslation) {
    result.guidanceTranslation = customGuidanceTranslation;
  }
  if (raw.mode) {
    result.mode = normalizeMode(raw.mode);
  }
  if (Number.isFinite(raw.requestedVariantCount)) {
    result.requestedVariantCount = sanitizeVariantCount(raw.requestedVariantCount);
  }
  if (raw.lyrics && typeof raw.lyrics === 'object') {
    const lyricsRaw = raw.lyrics;
    const enabled = lyricsRaw.enabled === true;
    if (enabled) {
      const lyrics = { enabled: true };
      const structure = toSafeString(lyricsRaw.structure, { maxLength: 240 }).trim();
      if (structure) {
        lyrics.structure = structure;
      }
      if (Array.isArray(lyricsRaw.sections)) {
        const sections = lyricsRaw.sections
          .map((section) => toSafeString(section, { maxLength: 60 }))
          .map((section) => (section || '').replace(/[\[\]]/g, '').trim())
          .filter(Boolean)
          .slice(0, 12);
        if (sections.length) {
          lyrics.sections = sections;
        }
      }
      const format = toSafeString(lyricsRaw.format || lyricsRaw.sectionFormat, { maxLength: 20 }).toLowerCase();
      if (format) {
        lyrics.format = format;
      }
      const lengthPref = toSafeString(lyricsRaw.length, { maxLength: 20 }).toLowerCase();
      if (lengthPref) {
        lyrics.length = lengthPref;
      }
      const language = toSafeString(lyricsRaw.language, { maxLength: 12 }).toLowerCase();
      if (language) {
        lyrics.language = language;
      }
      if (lyricsRaw.includeSectionLabels === false) {
        lyrics.includeSectionLabels = false;
      } else if (lyricsRaw.includeSectionLabels === true) {
        lyrics.includeSectionLabels = true;
      }
      let lineCount = null;
      if (Number.isFinite(lyricsRaw.lineCount)) {
        lineCount = Math.max(1, Math.min(128, Math.trunc(lyricsRaw.lineCount)));
        lyrics.lineCount = lineCount;
      }
      if (Array.isArray(lyricsRaw.keywords)) {
        const keywords = lyricsRaw.keywords
          .map((keyword) => toSafeString(keyword, { maxLength: 40 }))
          .filter(Boolean)
          .slice(0, 12);
        if (keywords.length) {
          lyrics.keywords = keywords;
        }
      }
      const keywordsText = toSafeString(lyricsRaw.keywordsText, { maxLength: 240 });
      if (keywordsText) {
        lyrics.keywordsText = keywordsText;
      }
      const rawCharCandidate = lyricsRaw.charTarget ?? lyricsRaw.characterTarget ?? null;
      const derivedCharTarget = deriveLyricsCharTarget({
        charTarget: rawCharCandidate,
        lengthPref,
        lineCount
      });
      if (Number.isFinite(derivedCharTarget)) {
        lyrics.charTarget = derivedCharTarget;
      }
      result.lyrics = lyrics;
    }
  }
  if (raw.voiceScript && typeof raw.voiceScript === 'object') {
    const voiceRaw = raw.voiceScript;
    if (voiceRaw.enabled === true) {
      const voice = { enabled: true };
      const language = toSafeString(voiceRaw.language, { maxLength: 12 }).toLowerCase();
      if (language) {
        voice.language = language;
      }
      const charTarget = sanitizeVoiceCharTarget(voiceRaw.charTarget ?? voiceRaw.characterTarget);
      if (Number.isFinite(charTarget)) {
        voice.charTarget = charTarget;
      }
      if (Array.isArray(voiceRaw.keywords)) {
        const keywords = voiceRaw.keywords
          .map((keyword) => toSafeString(keyword, { maxLength: 40 }))
          .filter(Boolean)
          .slice(0, 12);
        if (keywords.length) {
          voice.keywords = keywords;
        }
      }
      const keywordsText = toSafeString(voiceRaw.keywordsText, { maxLength: 200 });
      if (keywordsText) {
        voice.keywordsText = keywordsText;
      }
      const notes = toSafeString(voiceRaw.notes ?? voiceRaw.memo ?? '', { maxLength: 360 });
      if (notes) {
        voice.notes = notes;
      }
      result.voiceScript = voice;
    }
  }
  return Object.keys(result).length ? result : null;
}

function buildUserPrompt({ mode, prompt, theme, variantCount, context = null }) {
  const base = toSafeString(prompt, { maxLength: 2000 });
  const themeText = toSafeString(theme, { maxLength: 400 });
  const sanitizedContext = sanitizePromptContext(context);
  const requestedCount = Number.isFinite(Number(variantCount))
    ? Number(variantCount)
    : (sanitizedContext?.requestedVariantCount ?? DEFAULT_VARIANT_COUNT);
  const count = sanitizeVariantCount(requestedCount);
  const normalizedMode = normalizeMode(mode);
  const modalityType = sanitizedContext?.selectedType || '';
  const modalityCategory = sanitizedContext?.selectedCategory || '';
  const voiceSettings = sanitizedContext?.voiceScript;
  const baseGuidance = normalizedMode === 'expand'
    ? '多様なジャンル・アートスタイル・用途に広げる。各案は明確に差別化する。'
    : '元の意図を保ちつつ、視覚要素・質感・構図・ライティングなど具体的に強化する。';
  const guidanceParts = [baseGuidance];
  guidanceParts.push(PROPER_NOUN_AVOIDANCE_GUIDANCE_EN);
  if (modalityType) {
    guidanceParts.push(`Primary generator type: ${modalityType}`);
  }
  if (modalityCategory) {
    guidanceParts.push(`Primary category: ${modalityCategory}`);
  }
  if (sanitizedContext?.primaryEngineLabel) {
    guidanceParts.push(`Reference engine: ${sanitizedContext.primaryEngineLabel}`);
  }
  if (sanitizedContext?.guidance) {
    guidanceParts.push(`User guidance: ${sanitizedContext.guidance}`);
  }

  const lyricsSettings = sanitizedContext?.lyrics;
  let lyricsRequestPayload = null;
  if (lyricsSettings?.enabled) {
    const lyricsGuidanceParts = ['Also craft accompanying song lyrics that reinforce the audio concept.'];
    lyricsGuidanceParts.push('Avoid proper nouns in the lyrics; express references generically.');
    const sanitizedSections = Array.isArray(lyricsSettings.sections)
      ? lyricsSettings.sections
          .map((section) => (typeof section === 'string' ? section.trim() : ''))
          .filter(Boolean)
          .slice(0, 12)
      : [];
    if (sanitizedSections.length) {
      lyricsGuidanceParts.push(`Structure the lyrics with these sections in order: ${sanitizedSections.join(' → ')}.`);
    } else if (lyricsSettings.structure) {
      const normalizedStructureKey = lyricsSettings.structure.trim().toLowerCase();
      const legacyHint = LEGACY_LYRICS_STRUCTURE_GUIDANCE[normalizedStructureKey];
      if (legacyHint) {
        lyricsGuidanceParts.push(legacyHint);
      } else {
        const summary = lyricsSettings.structure
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join(' / ');
        if (summary) {
          lyricsGuidanceParts.push(`Use these lyric section notes (in order): ${summary}.`);
        }
      }
    }
    const charTargetValue = sanitizeLyricsCharTarget(lyricsSettings.charTarget);
    if (Number.isFinite(charTargetValue)) {
      lyricsGuidanceParts.push(`Aim for roughly ${charTargetValue} characters in total (section headers optional).`);
    } else if (lyricsSettings.length) {
      if (lyricsSettings.length === 'short') {
        lyricsGuidanceParts.push('Keep the lyrics concise (around 6-8 lines).');
      } else if (lyricsSettings.length === 'extended') {
        lyricsGuidanceParts.push('Allow a longer narrative (around 20 lines or more).');
      } else {
        lyricsGuidanceParts.push('Aim for a medium-length song (roughly 12-16 lines).');
      }
    }
    const lineCountValue = Number.isFinite(lyricsSettings.lineCount)
      ? Math.max(1, Math.min(128, Math.trunc(lyricsSettings.lineCount)))
      : null;
    if (!Number.isFinite(charTargetValue) && Number.isFinite(lineCountValue)) {
      lyricsGuidanceParts.push(`Target roughly ${lineCountValue} total lines.`);
    }
    if (lyricsSettings.includeSectionLabels === false) {
      lyricsGuidanceParts.push('Do not include section headers like [Verse] or [Chorus]; output plain lyric lines.');
    } else {
      lyricsGuidanceParts.push('Include section headers such as [Verse], [Chorus], [Bridge] when appropriate.');
    }
    if (lyricsSettings.language === 'ja') {
      lyricsGuidanceParts.push('Write the lyrics in Japanese.');
    } else if (lyricsSettings.language === 'en') {
      lyricsGuidanceParts.push('Write the lyrics in English.');
    }
    if (Array.isArray(lyricsSettings.keywords) && lyricsSettings.keywords.length) {
      lyricsGuidanceParts.push(`Incorporate the following motifs: ${lyricsSettings.keywords.join(', ')}.`);
    }
    guidanceParts.push(lyricsGuidanceParts.join(' '));

    const payloadStructure = typeof lyricsSettings.structure === 'string'
      && lyricsSettings.structure.trim()
      ? lyricsSettings.structure.trim()
      : null;
    lyricsRequestPayload = {
      enabled: true,
      structure: payloadStructure,
      format: lyricsSettings.format || null,
      language: lyricsSettings.language || null,
      includeSectionLabels: lyricsSettings.includeSectionLabels !== false,
      charTarget: Number.isFinite(charTargetValue) ? charTargetValue : null,
      lineCount: Number.isFinite(lineCountValue) ? lineCountValue : null,
      keywords: Array.isArray(lyricsSettings.keywords) ? lyricsSettings.keywords : null,
      sections: sanitizedSections.length ? sanitizedSections : null
    };
    Object.keys(lyricsRequestPayload).forEach((key) => {
      if (lyricsRequestPayload[key] === null || lyricsRequestPayload[key] === undefined) {
        delete lyricsRequestPayload[key];
      }
    });
  }

  const payload = {
    task: normalizedMode === 'expand' ? 'horizontal_exploration' : 'prompt_enhancement',
    variantCount: count,
    basePrompt: base,
    theme: themeText || null,
    guidance: guidanceParts.join('\n'),
    outputPreferences: {
      promptLanguage: 'english',
      labelLanguage: 'japanese'
    },
    outputHints: [
      'promptフィールドには生成にそのまま使用できる文章を入れる',
      'labelは10文字以内で内容を端的に示す',
      'descriptionは任意だが、狙い所や工夫点があれば50文字以内で補足する',
      'translationにはpromptの自然な日本語訳を入れる'
    ]
  };
  payload.outputHints.push(PROPER_NOUN_AVOIDANCE_HINT_JA);

  if (sanitizedContext) {
    payload.context = sanitizedContext;
  }
  if (modalityCategory || modalityType) {
    payload.modalityProfile = {
      category: modalityCategory || null,
      type: modalityType || null,
      requiresMedia: sanitizedContext?.requiresMedia || false,
      requiredMediaTypes: sanitizedContext?.requiredMediaTypes || [],
      requiresPrompt: sanitizedContext?.requiresPrompt || false,
      requiresSoundText: sanitizedContext?.requiresSoundText || false
    };
  }
  if (sanitizedContext?.primaryEngineLabel || sanitizedContext?.primaryEngineId) {
    payload.primaryEngine = {
      id: sanitizedContext?.primaryEngineId || null,
      label: sanitizedContext?.primaryEngineLabel || null
    };
  }
  if (sanitizedContext?.guidance) {
    payload.additionalGuidance = sanitizedContext.guidance;
  }
  if (lyricsRequestPayload) {
    payload.lyricsRequest = lyricsRequestPayload;
    payload.outputHints.push('When lyricsRequest.enabled is true, include lyrics.text (and optional metadata such as structure, language, includeSectionLabels, charTarget, sections) in each suggestion, keeping the output in valid JSON.');
    payload.outputHints.push('歌詞生成でも固有名詞は禁止し、一般的な描写に置き換える');
  }
  if (voiceSettings?.enabled) {
    const voiceGuidanceParts = ['Additionally craft a companion spoken narration script aligned with the audio outcome.'];
    voiceGuidanceParts.push('Avoid proper nouns in the narration; describe subjects generically.');
    const sanitizedLanguage = toSafeString(voiceSettings.language, { maxLength: 12 }).toLowerCase();
    if (sanitizedLanguage === 'ja') {
      voiceGuidanceParts.push('Write the narration in Japanese.');
    } else if (sanitizedLanguage === 'en') {
      voiceGuidanceParts.push('Write the narration in English.');
    }
    const sanitizedVoiceCharTarget = sanitizeVoiceCharTarget(voiceSettings.charTarget);
    if (Number.isFinite(sanitizedVoiceCharTarget)) {
      voiceGuidanceParts.push(`Keep the narration around ${sanitizedVoiceCharTarget} characters.`);
    }
    if (Array.isArray(voiceSettings.keywords) && voiceSettings.keywords.length) {
      voiceGuidanceParts.push(`Incorporate these motifs: ${voiceSettings.keywords.join(', ')}.`);
    }
    if (voiceSettings.keywordsText && !voiceSettings.keywords?.length) {
      voiceGuidanceParts.push(`Use these narrative keywords: ${voiceSettings.keywordsText}.`);
    }
    if (voiceSettings.notes) {
      voiceGuidanceParts.push(`Tone and scenario notes: ${voiceSettings.notes}`);
    }
    guidanceParts.push(voiceGuidanceParts.join(' '));

    const payloadVoice = {
      enabled: true,
      language: sanitizedLanguage || null,
      charTarget: Number.isFinite(sanitizedVoiceCharTarget) ? sanitizedVoiceCharTarget : null,
      keywords: Array.isArray(voiceSettings.keywords) ? voiceSettings.keywords : null,
      keywordsText: voiceSettings.keywordsText || null,
      notes: voiceSettings.notes || null
    };
    Object.keys(payloadVoice).forEach((key) => {
      if (payloadVoice[key] === null || payloadVoice[key] === undefined || payloadVoice[key] === '') {
        delete payloadVoice[key];
      }
    });
    payload.voiceScriptRequest = payloadVoice;
    payload.outputHints.push('When voiceScriptRequest.enabled is true, include soundText (and optional metadata such as language, charTarget, keywords, notes) in each suggestion, ensuring the response remains valid JSON.');
    payload.outputHints.push('音声テキスト／ナレーションでも固有名詞は禁止し、一般的な表現を用いる');
  }

  return JSON.stringify(payload, null, 2);
}

function extractCandidateText(parts) {
  if (!Array.isArray(parts) || !parts.length) return '';
  const collected = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    if (typeof part.text === 'string') {
      collected.push(part.text);
      continue;
    }
    if (part.functionCall && part.functionCall.args) {
      if (typeof part.functionCall.args === 'string') {
        collected.push(part.functionCall.args);
      } else {
        try {
          collected.push(JSON.stringify(part.functionCall.args, null, 2));
        } catch (_) {
          // ignore
        }
      }
      continue;
    }
    if (part.executableCode && typeof part.executableCode.code === 'string') {
      collected.push(part.executableCode.code);
      continue;
    }
  }
  return collected.join('\n').trim();
}

function extractJsonFragment(text) {
  if (!text) return null;
  let trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    trimmed = fenceMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }
  return null;
}

function parseSuggestionsFromResponse(responseBody) {
  const candidates = Array.isArray(responseBody?.candidates)
    ? responseBody.candidates
    : [];
  if (!candidates.length) {
    return {
      suggestions: [],
      hadJson: false,
      error: null,
      fragment: '',
      rawText: ''
    };
  }

  let lastState = {
    suggestions: [],
    hadJson: false,
    error: null,
    fragment: '',
    rawText: ''
  };

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    const rawText = extractCandidateText(parts);
    if (!rawText) continue;
    const jsonFragment = extractJsonFragment(rawText);
    if (!jsonFragment) continue;

    lastState = {
      suggestions: [],
      hadJson: true,
      error: null,
      fragment: jsonFragment,
      rawText
    };

    try {
      const parsed = JSON.parse(jsonFragment);
      if (Array.isArray(parsed)) {
        return {
          suggestions: parsed,
          hadJson: true,
          error: null,
          fragment: jsonFragment,
          rawText
        };
      }
      if (Array.isArray(parsed?.suggestions)) {
        return {
          suggestions: parsed.suggestions,
          hadJson: true,
          error: null,
          fragment: jsonFragment,
          rawText
        };
      }
      // JSONは有効だが配列が空の場合
      return {
        suggestions: [],
        hadJson: true,
        error: null,
        fragment: jsonFragment,
        rawText
      };
    } catch (err) {
      lastState = {
        suggestions: [],
        hadJson: true,
        error: err,
        fragment: jsonFragment,
        rawText
      };
      // 次の候補で成功する可能性を探る
    }
  }

  return lastState;
}

function normalizeTemplateSuggestion(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const template = {};
  const name = toSafeString(entry.name, { maxLength: 60 });
  if (name) {
    template.name = name;
  }
  const category = toSafeString(entry.category, { maxLength: 40 });
  if (category) {
    template.category = category;
  }
  const type = toSafeString(entry.type, { maxLength: 40 });
  if (type) {
    template.type = type;
  }
  const filePrefix = toSafeString(entry.filePrefix, { maxLength: 80 });
  if (filePrefix) {
    template.filePrefix = filePrefix;
  }
  const soundText = toSafeString(entry.soundText, { maxLength: 400 });
  if (soundText) {
    template.soundText = soundText;
  }
  const memo = toSafeString(entry.memo, { maxLength: 240 });
  if (memo) {
    template.memo = memo;
  }
  if (Array.isArray(entry.tags)) {
    const tags = entry.tags
      .map((tag) => toSafeString(tag, { maxLength: 24 }))
      .filter(Boolean)
      .slice(0, 4);
    if (tags.length) {
      template.tags = tags;
    }
  }
  return Object.keys(template).length ? template : null;
}

function normalizeLyricsSuggestion(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = toSafeString(entry, { maxLength: 4000 });
    return text ? { text } : null;
  }
  if (typeof entry !== 'object') return null;
  const textCandidate = entry.text || entry.body || (Array.isArray(entry.lines) ? entry.lines.join('\n') : '');
  const text = toSafeString(textCandidate, { maxLength: 4000 });
  if (!text) return null;
  const result = { text };
  const structure = toSafeString(entry.structure, { maxLength: 40 });
  if (structure) {
    result.structure = structure;
  }
  const language = toSafeString(entry.language, { maxLength: 20 });
  if (language) {
    result.language = language;
  }
  const charTarget = sanitizeLyricsCharTarget(entry.charTarget ?? entry.characterTarget);
  if (Number.isFinite(charTarget)) {
    result.charTarget = charTarget;
  }
  const length = toSafeString(entry.length, { maxLength: 20 });
  if (length) {
    result.length = length;
  }
  if (entry.includeSectionLabels === false) {
    result.includeSectionLabels = false;
  } else if (entry.includeSectionLabels === true) {
    result.includeSectionLabels = true;
  }
  if (Array.isArray(entry.sections)) {
    const sections = entry.sections
      .map((section) => toSafeString(section, { maxLength: 60 }))
      .filter(Boolean)
      .slice(0, 12);
    if (sections.length) {
      result.sections = sections;
    }
  }
  const summary = toSafeString(entry.summary, { maxLength: 200 });
  if (summary) {
    result.summary = summary;
  }
  return result;
}

function normalizeVoiceScriptSuggestion(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const text = toSafeString(entry, { maxLength: 800 });
    return text ? { text } : null;
  }
  if (typeof entry !== 'object') return null;
  const textCandidate = entry.text || entry.body || entry.script || entry.content || '';
  const text = toSafeString(textCandidate, { maxLength: 800 });
  if (!text) return null;
  const result = { text };
  const language = toSafeString(entry.language, { maxLength: 12 }).toLowerCase();
  if (language) {
    result.language = language;
  }
  const charTarget = sanitizeVoiceCharTarget(entry.charTarget ?? entry.characterTarget);
  if (Number.isFinite(charTarget)) {
    result.charTarget = charTarget;
  }
  if (Array.isArray(entry.keywords)) {
    const keywords = entry.keywords
      .map((keyword) => toSafeString(keyword, { maxLength: 40 }))
      .filter(Boolean)
      .slice(0, 12);
    if (keywords.length) {
      result.keywords = keywords;
    }
  }
  const keywordsText = toSafeString(entry.keywordsText, { maxLength: 200 });
  if (keywordsText) {
    result.keywordsText = keywordsText;
  }
  const notes = toSafeString(entry.notes ?? entry.memo ?? '', { maxLength: 360 });
  if (notes) {
    result.notes = notes;
  }
  return result;
}

function normalizeSuggestion(entry, index = 0) {
  if (!entry || typeof entry !== 'object') return null;
  const prompt = toSafeString(entry.prompt, { maxLength: 2400 });
  const label = toSafeString(entry.label || entry.title || `案${index + 1}`, { maxLength: 40 }) || `案${index + 1}`;
  const description = toSafeString(entry.description || entry.notes || entry.summary || '', { maxLength: 200 });
  if (!prompt) return null;
  const result = { label, prompt, description };
  const translation = toSafeString(
    entry.translation
      || entry.translationJa
      || entry.translation_ja
      || entry.promptJa
      || entry.prompt_ja
      || entry.japanese
      || '',
    { maxLength: 2400 }
  );
  if (translation) {
    result.translation = translation;
  }
  if (Array.isArray(entry.tags)) {
    const tags = entry.tags
      .map((tag) => toSafeString(tag, { maxLength: 24 }))
      .filter(Boolean)
      .slice(0, 4);
    if (tags.length) {
      result.tags = tags;
    }
  }
  const template = normalizeTemplateSuggestion(entry.template);
  if (template && !template.memo && translation) {
    template.memo = translation;
  }
  if (template) {
    result.template = template;
  }
  const lyricsEntry = entry.lyrics
    || entry.lyricsText
    || entry.songLyrics
    || (entry.meta && entry.meta.lyrics);
  const lyrics = normalizeLyricsSuggestion(lyricsEntry);
  if (lyrics) {
    result.lyrics = lyrics;
  }
  const voiceScriptEntry = entry.voiceScript
    || entry.voice_text
    || entry.voiceScriptText
    || (entry.meta && entry.meta.voiceScript)
    || (entry.meta && entry.meta.soundText);
  const voiceScript = normalizeVoiceScriptSuggestion(voiceScriptEntry);
  if (voiceScript) {
    result.voiceScript = voiceScript;
    if (voiceScript.text) {
      result.soundText = voiceScript.text;
    }
  } else {
    const directSoundText = toSafeString(entry.soundText, { maxLength: 800 });
    if (directSoundText) {
      result.soundText = directSoundText;
    }
    if (!result.soundText && template && typeof template.soundText === 'string') {
      const templateSoundText = toSafeString(template.soundText, { maxLength: 800 });
      if (templateSoundText) {
        result.soundText = templateSoundText;
      }
    }
  }
  return result;
}

function requestGemini({ key, model, systemPrompt, userPrompt, temperature, topP, variantCount }) {
  return new Promise((resolve, reject) => {
    const targetModel = normalizeModelId(model);
    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent`);
    url.searchParams.set('key', key);

    const payload = JSON.stringify({
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: Number.isFinite(temperature) ? temperature : DEFAULT_TEMPERATURE,
        topP: Number.isFinite(topP) ? topP : DEFAULT_TOP_P,
        candidateCount: 1,
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json'
      }
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Gemini API error ${res.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`Gemini API response parse error: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function generatePromptSuggestions({ prompt, mode, theme = '', variantCount = DEFAULT_VARIANT_COUNT, context = null }) {
  const apiKey = toSafeString(process.env.GEMINI_API_KEY, { maxLength: 256 });
  if (!apiKey) {
    const error = new Error('Gemini APIキーが設定されていません (GEMINI_API_KEY)');
    error.code = 'GEMINI_API_KEY_MISSING';
    throw error;
  }
  const normalizedPrompt = toSafeString(prompt, { maxLength: 2000 });
  if (!normalizedPrompt) {
    const error = new Error('プロンプトが空です');
    error.code = 'EMPTY_PROMPT';
    throw error;
  }
  const normalizedMode = normalizeMode(mode);
  const normalizedTheme = toSafeString(theme, { maxLength: 400 });
  const effectiveVariantCount = sanitizeVariantCount(variantCount);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    mode: normalizedMode,
    prompt: normalizedPrompt,
    theme: normalizedTheme,
    variantCount: effectiveVariantCount,
    context
  });
  const resolvedModel = normalizeModelId(DEFAULT_MODEL);
  const startedAt = Date.now();
  const requestRecord = {
    prompt: normalizedPrompt,
    mode: normalizedMode,
    theme: normalizedTheme || null,
    variantCount: effectiveVariantCount,
    requestedVariantCount: Number.isFinite(Number(variantCount)) ? Number(variantCount) : null,
    systemPrompt,
    userPrompt,
    model: resolvedModel,
    temperature: DEFAULT_TEMPERATURE,
    topP: DEFAULT_TOP_P,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    context: sanitizePromptContext(context)
  };

  let response;
  try {
    response = await requestGemini({
      key: apiKey,
      model: resolvedModel,
      systemPrompt,
      userPrompt,
      temperature: DEFAULT_TEMPERATURE,
      topP: DEFAULT_TOP_P,
      variantCount: effectiveVariantCount
    });
  } catch (err) {
    await appendPromptLog({
      status: 'error',
      request: requestRecord,
      error: err,
      durationMs: Date.now() - startedAt
    });
    throw err;
  }

  const parsed = parseSuggestionsFromResponse(response);
  const normalized = parsed.suggestions
    .map((entry, index) => normalizeSuggestion(entry, index))
    .filter(Boolean);

  const finishReasons = Array.from(new Set(
    (Array.isArray(response?.candidates) ? response.candidates : [])
      .map((candidate) => {
        if (!candidate || typeof candidate.finishReason !== 'string') return null;
        const trimmed = candidate.finishReason.trim();
        return trimmed ? trimmed : null;
      })
      .filter(Boolean)
  ));

  let logStatus = normalized.length ? 'success' : 'empty';
  let userFacingError = null;
  let logError = null;

  if (!normalized.length) {
    if (finishReasons.includes('MAX_TOKENS')) {
      const detail = parsed.error?.message ? ` 詳細: ${parsed.error.message}` : '';
      const err = new Error(`Gemini応答が途中で終了しました (MAX_TOKENS)。variantCountを減らすか再試行してください。${detail}`.trim());
      err.code = 'GEMINI_RESPONSE_TRUNCATED';
      if (parsed.error && parsed.error.stack) {
        err.stack = `${err.stack || err.message}\nCausedBy: ${parsed.error.stack}`;
      }
      logStatus = 'error';
      userFacingError = err;
      logError = err;
    } else if (parsed.error) {
      const detail = parsed.error.message ? ` 詳細: ${parsed.error.message}` : '';
      const err = new Error(`Gemini応答のJSON解析に失敗しました。${detail}`.trim());
      err.code = 'GEMINI_SUGGESTION_PARSE_FAILED';
      if (parsed.error.stack) {
        err.stack = `${err.stack || err.message}\nCausedBy: ${parsed.error.stack}`;
      }
      logStatus = 'error';
      userFacingError = err;
      logError = err;
    }
  }

  const durationMs = Date.now() - startedAt;
  await appendPromptLog({
    status: logStatus,
    request: requestRecord,
    response,
    suggestions: normalized,
    error: logError,
    durationMs,
    finishReasons,
    fragment: parsed.fragment || ''
  });

  if (userFacingError) {
    throw userFacingError;
  }

  return {
    suggestions: normalized,
    meta: {
      mode: normalizedMode,
      model: resolvedModel,
      count: normalized.length,
      variantCount: effectiveVariantCount,
      finishReasons,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS
    }
  };
}

module.exports = {
  generatePromptSuggestions
};
