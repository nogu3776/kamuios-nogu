const fs = require('fs');
const path = require('path');
const config = require('./config');

// ユーティリティ関数

function ensureDirectorySync(targetDir) {
    if (!targetDir) return;
    try {
        fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
        if (err && err.code !== 'EEXIST') {
            throw err;
        }
    }
}

function toSafeString(value, { maxLength = 4000, fallback = '' } = {}) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (!Number.isFinite(maxLength)) return trimmed;
    return trimmed.slice(0, maxLength);
}

function toSafeId(value, fallback) {
    const base = toSafeString(value, { maxLength: 160, fallback: '' });
    if (base) return base;
    return fallback || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toSafeNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeTypeList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => toSafeString(item, { maxLength: 120 }));
}

function normalizeStoredCategoryValue(value, fallback = 'image') {
    const sanitized = toSafeString(value, { maxLength: 120, fallback });
    const lower = sanitized.toLowerCase();
    if (!lower) return fallback;
    if (lower === 'text' || lower === 'img' || lower === 'images') {
        return 'image';
    }
    return lower;
}

function normalizeStoredTypeValue(value) {
    const sanitized = toSafeString(value, { maxLength: 120, fallback: '' });
    return sanitized.toLowerCase();
}

// ファイルIO関数

function readJsonFileSafe(filePath, fallback = {}) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return fallback;
        return parsed;
    } catch (err) {
        if (err && err.code !== 'ENOENT') {
            console.warn('[Showcase] JSON read error', filePath, err.message);
        }
        return fallback;
    }
}

function writeJsonFileSafe(filePath, data) {
    ensureDirectorySync(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Sanitize関数

function sanitizeSavedFile(input) {
    if (!input || typeof input !== 'object') return null;
    const sanitized = {};
    const stringFields = ['absolute', 'relative', 'webPath', 'filename', 'fileName', 'extension', 'prefix', 'engine', 'timestamp', 'requestId'];
    stringFields.forEach((field) => {
        if (typeof input[field] === 'string') {
            sanitized[field] = toSafeString(input[field], { maxLength: 4000 });
        }
    });
    if (Number.isFinite(input.size)) {
        sanitized.size = Number(input.size);
    }
    if (Number.isFinite(input.index)) {
        sanitized.index = Number(input.index);
    }
    if (Number.isFinite(input.total)) {
        sanitized.total = Number(input.total);
    }
    return Object.keys(sanitized).length ? sanitized : null;
}

function sanitizeHistoryResult(result) {
    if (!result || typeof result !== 'object') return null;
    const sanitized = {};
    const stringFields = [
        'engineId',
        'engineLabel',
        'label',
        'imageUrl',
        'logFile',
        'category',
        'sourceCategory',
        'type',
        'requestId',
        'error',
        'status',
        'webPath',
        'absolutePath',
        'thumbnailUrl',
        'previewUrl',
        'fileName',
        'filePrefix',
        'timestamp'
    ];
    stringFields.forEach((field) => {
        if (typeof result[field] === 'string') {
            sanitized[field] = toSafeString(result[field], { maxLength: 4000 });
        }
    });
    if (Number.isFinite(result.durationMs)) {
        sanitized.durationMs = Number(result.durationMs);
    }
    if (Number.isFinite(result.savedFileIndex)) {
        sanitized.savedFileIndex = Number(result.savedFileIndex);
    }
    if (Number.isFinite(result.savedFilesCount)) {
        sanitized.savedFilesCount = Number(result.savedFilesCount);
    }
    if (Array.isArray(result.typePrefixes)) {
        sanitized.typePrefixes = sanitizeTypeList(result.typePrefixes);
    }
    if (Array.isArray(result.logs)) {
        const collectedLogs = result.logs
            .map((entry) => (typeof entry === 'string' ? toSafeString(entry, { maxLength: 4000 }) : null))
            .filter(Boolean);
        if (collectedLogs.length) sanitized.logs = collectedLogs;
    }
    if (Array.isArray(result.statusHistory)) {
        const collectedStatus = result.statusHistory
            .map((entry) => (typeof entry === 'string' ? toSafeString(entry, { maxLength: 4000 }) : null))
            .filter(Boolean);
        if (collectedStatus.length) sanitized.statusHistory = collectedStatus;
    }
    if (result.savedFile) {
        const saved = sanitizeSavedFile(result.savedFile);
        if (saved) sanitized.savedFile = saved;
    }
    if (Array.isArray(result.savedFiles)) {
        const savedFiles = result.savedFiles
            .map(sanitizeSavedFile)
            .filter(Boolean);
        if (savedFiles.length) sanitized.savedFiles = savedFiles;
    }
    if (Array.isArray(result.tags)) {
        sanitized.tags = sanitizeTypeList(result.tags);
    }
    return Object.keys(sanitized).length ? sanitized : {};
}

function sanitizeHistoryFilters(filters) {
    const defaults = { category: 'all', prefix: 'all' };
    if (!filters || typeof filters !== 'object') {
        return defaults;
    }
    let category = normalizeStoredCategoryValue(filters.category, 'all');
    if (category !== 'all' && !config.SHOWCASE_SUPPORTED_CATEGORIES.has(category)) {
        category = 'all';
    }
    let prefix = normalizeStoredTypeValue(filters.prefix);
    if (!prefix) {
        prefix = 'all';
    } else if (prefix !== 'all' && prefix !== 'other' && !config.SHOWCASE_TYPE_PREFIXES.has(prefix)) {
        prefix = 'all';
    }
    return { category, prefix };
}

function sanitizeHistoryPayload(payload) {
    const version = Number.isFinite(payload?.version) ? Number(payload.version) : 1;
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    const sanitizedEntries = entries
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const category = normalizeStoredCategoryValue(entry.category, 'image');
            const sanitized = {
                id: toSafeId(entry.id, `run-${category}-${Date.now()}`),
                prompt: toSafeString(entry.prompt, { maxLength: 8000, fallback: '' }),
                createdAt: toSafeNumber(entry.createdAt, Date.now()),
                category,
                sourceCategories: sanitizeTypeList(entry.sourceCategories)
            };
            if (Array.isArray(entry.results)) {
                sanitized.results = entry.results
                    .map(sanitizeHistoryResult)
                    .filter((item) => item && typeof item === 'object');
            } else {
                sanitized.results = [];
            }
            return sanitized;
        })
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const filters = sanitizeHistoryFilters(payload?.filters);
    return { version, entries: sanitizedEntries, filters };
}

function sanitizeTemplatePreferences(payload) {
    const version = Number.isFinite(payload?.version) ? Number(payload.version) : 3;
    const hidden = sanitizeTypeList(payload?.hidden).map((item) => toSafeString(item, { maxLength: 160 }));
    const custom = Array.isArray(payload?.custom)
        ? payload.custom
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                return {
                    id: toSafeId(entry.id, `tpl-${Date.now()}`),
                    name: toSafeString(entry.name, { maxLength: 240, fallback: 'Custom Template' }),
                    prompt: toSafeString(entry.prompt, { maxLength: 8000, fallback: '' }),
                    category: normalizeStoredCategoryValue(entry.category, 'image'),
                    type: normalizeStoredTypeValue(entry.type),
                    filePrefix: toSafeString(entry.filePrefix, { maxLength: 240, fallback: '' }),
                    memo: toSafeString(entry.memo, { maxLength: 2000, fallback: '' })
                };
            })
            .filter(Boolean)
        : [];
    return { version, hidden, custom };
}

// 履歴管理

function loadShowcaseHistory() {
    const data = readJsonFileSafe(config.SHOWCASE_HISTORY_FILE, { version: 1, entries: [] });
    return sanitizeHistoryPayload(data);
}

function saveShowcaseHistory(payload) {
    const sanitized = sanitizeHistoryPayload(payload);
    writeJsonFileSafe(config.SHOWCASE_HISTORY_FILE, sanitized);
    return sanitized;
}

// テンプレート管理

function loadTemplatePreferences() {
    const data = readJsonFileSafe(config.SHOWCASE_TEMPLATES_JSON, { version: 1, base: [], custom: [], hidden: [] });
    return sanitizeTemplatePreferences(data);
}

function saveTemplatePreferences(payload) {
    const sanitized = sanitizeTemplatePreferences(payload);
    writeJsonFileSafe(config.SHOWCASE_TEMPLATES_JSON, sanitized);
    return sanitized;
}

// 初期化

function initialize() {
    try {
        if (!fs.existsSync(config.SHOWCASE_DATA_DIR)) {
            fs.mkdirSync(config.SHOWCASE_DATA_DIR, { recursive: true });
            console.log('[Showcase] Created data directory:', config.SHOWCASE_DATA_DIR);
        }

        // templates.json の初期化（初回のみ）
        if (!fs.existsSync(config.SHOWCASE_TEMPLATES_JSON)) {
            if (fs.existsSync(config.SHOWCASE_TEMPLATES_YAML)) {
                const yaml = require('js-yaml');
                const yamlContent = yaml.load(fs.readFileSync(config.SHOWCASE_TEMPLATES_YAML, 'utf8'));
                const initialTemplates = {
                    version: 1,
                    base: Array.isArray(yamlContent?.templates) ? yamlContent.templates : [],
                    custom: [],
                    hidden: []
                };
                fs.writeFileSync(config.SHOWCASE_TEMPLATES_JSON, JSON.stringify(initialTemplates, null, 2), 'utf8');
                console.log('[Showcase] Initialized templates.json from templates.yaml');
            } else {
                const emptyTemplates = { version: 1, base: [], custom: [], hidden: [] };
                fs.writeFileSync(config.SHOWCASE_TEMPLATES_JSON, JSON.stringify(emptyTemplates, null, 2), 'utf8');
                console.log('[Showcase] Created empty templates.json');
            }
        }

        // history.json の初期化（初回のみ）
        if (!fs.existsSync(config.SHOWCASE_HISTORY_FILE)) {
            const emptyHistory = { version: 1, entries: [] };
            fs.writeFileSync(config.SHOWCASE_HISTORY_FILE, JSON.stringify(emptyHistory, null, 2), 'utf8');
            console.log('[Showcase] Created empty history.json');
        }
    } catch (err) {
        console.error('[Showcase] Failed to initialize data:', err.message);
    }
}

module.exports = {
    loadShowcaseHistory,
    saveShowcaseHistory,
    loadTemplatePreferences,
    saveTemplatePreferences,
    initialize
};
