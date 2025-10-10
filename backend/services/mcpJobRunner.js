const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const { getServerMeta } = require('./mcpRegistry');
const { ensureWithinScanPath, runPythonUpload } = require('./mediaUpload');
const { cropToTargetSize, normalizeSizeKey: normalizeSoraSizeKey } = require('./soraImageProcessor');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PROTOCOL_VERSION = process.env.KAMUI_CODE_PROTOCOL_VERSION || '2025-06-18';
const AUTH_TOKEN = process.env.KAMUI_CODE_AUTH_TOKEN || '';
const DEFAULT_POLL_INTERVAL_MS = Number.parseInt(process.env.MCP_POLL_INTERVAL_MS || '4000', 10);
const VIDEO_POLL_INTERVAL_MS = Number.parseInt(process.env.MCP_VIDEO_POLL_INTERVAL_MS || '20000', 10);
const MAX_WAIT_MS = Number.parseInt(process.env.MCP_MAX_WAIT_MS || '3600000', 10);
const CANCEL_GRACE_MS = Number.parseInt(process.env.MCP_CANCEL_GRACE_MS || '5000', 10);
const LOG_STRING_LIMIT = Number.parseInt(process.env.MCP_LOG_STRING_LIMIT || '4000', 10);
const LOG_ARRAY_LIMIT = Number.parseInt(process.env.MCP_LOG_ARRAY_LIMIT || '50', 10);

const SCAN_PATH = process.env.SCAN_PATH ? path.resolve(process.env.SCAN_PATH) : null;

const DEFAULT_SHOWCASE_DIRS = ['showcase', '_showcase'];

function resolveShowcaseSubdir() {
  if (process.env.MCP_SHOWCASE_SUBDIR) {
    return process.env.MCP_SHOWCASE_SUBDIR;
  }
  for (const candidate of DEFAULT_SHOWCASE_DIRS) {
    const absolute = path.join(PROJECT_ROOT, 'static', candidate);
    if (fs.existsSync(absolute)) {
      return candidate;
    }
  }
  return DEFAULT_SHOWCASE_DIRS[0];
}

const SHOWCASE_SUBDIR = resolveShowcaseSubdir();
const STATIC_IMAGES_ROOT = path.join(PROJECT_ROOT, 'static', SHOWCASE_SUBDIR);
const DEFAULT_OUTPUT_ROOT = SCAN_PATH ? path.join(SCAN_PATH, SHOWCASE_SUBDIR) : STATIC_IMAGES_ROOT;

const SUCCESS_STATUS_SET = new Set(['COMPLETED', 'SUCCEEDED', 'SUCCESS']);
const FAILURE_STATUS_SET = new Set(['FAILED', 'ERROR', 'NOT_FOUND']);
const CANCELLED_STATUS_SET = new Set(['CANCELLED', 'CANCELED']);

function computeOutputRoot() {
  const rawRoot = process.env.MCP_SHOWCASE_OUTPUT_DIR
    ? path.resolve(process.env.MCP_SHOWCASE_OUTPUT_DIR)
    : DEFAULT_OUTPUT_ROOT;

  const candidateRoots = [DEFAULT_OUTPUT_ROOT, STATIC_IMAGES_ROOT];
  for (const root of candidateRoots) {
    const relative = path.relative(root, rawRoot);
    if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return root;
    }
  }
  return rawRoot;
}

const OUTPUT_ROOT = computeOutputRoot();
const LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'showcase');
const LEGACY_LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'mcp-showcase');
const VERSION_STATE_PATH = path.join(LOG_DIR, 'version-cache.json');
const LEGACY_VERSION_STATE_PATH = path.join(LEGACY_LOG_DIR, 'version-cache.json');
const STATIC_DATA_SHOWCASE_DIR = path.join(PROJECT_ROOT, 'static', 'data', 'showcase');
const SORA_INDEX_PATH = path.join(STATIC_DATA_SHOWCASE_DIR, 'sora-index.json');

const DEFAULT_VIDEO_POLL_CATEGORIES = ['t2v', 'i2v', 'v2v', 'r2v', 's2v', 'a2v', 'video'];
const VIDEO_POLL_CATEGORIES = (() => {
  const raw = process.env.MCP_VIDEO_POLL_CATEGORIES;
  if (!raw) {
    return new Set(DEFAULT_VIDEO_POLL_CATEGORIES);
  }
  return new Set(
    raw
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
})();

const SORA_SERVER_IDS = new Set(['t2v-kamui-openai-sora']);
const DEFAULT_SORA_SIZE = '1280x720';
const SORA_MODEL_OPTIONS = new Set(['sora-2', 'sora-2-pro']);
const SORA_PRO_MODEL = 'sora-2-pro';
const SORA_PRO_ONLY_SIZES = new Set(['1792x1024', '1024x1792']);
const SORA_VIDEO_ID_PATTERN = /^video_[a-z0-9]+$/i;

let versionStateLoaded = false;
let versionState = {};

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) {
    headers.Authorization = AUTH_TOKEN.startsWith('Bearer ')
      ? AUTH_TOKEN
      : `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

async function ensureDir(dir) {
  await fsPromises.mkdir(dir, { recursive: true });
}

function normalizePosixPath(input) {
  if (!input && input !== 0) return '';
  return String(input)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
}

async function readJsonFileSafe(filePath) {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

async function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  await fsPromises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fsPromises.rename(tempPath, filePath);
}

async function updateSoraVideoIndex(savedFiles = [], soraContext = {}) {
  const videoIdRaw = soraContext && typeof soraContext.videoId === 'string'
    ? soraContext.videoId.trim()
    : '';
  if (!videoIdRaw || !SORA_VIDEO_ID_PATTERN.test(videoIdRaw)) {
    return;
  }

  if (!Array.isArray(savedFiles) || !savedFiles.length) {
    return;
  }

  const entries = savedFiles
    .map((file) => {
      if (!file || typeof file !== 'object') return null;
      const candidates = [
        file.relativePosix,
        file.relative ? file.relative.split(path.sep).join('/') : '',
        file.webPath
      ];
      const matched = candidates.find((candidate) => candidate && candidate.trim());
      const normalizedPath = normalizePosixPath(matched || '');
      if (!normalizedPath) return null;
      if (file.filterType && file.filterType !== 'video') {
        return null;
      }
      const metadata = {
        videoId: videoIdRaw,
        model: soraContext.model || file.model || null,
        targetSize: soraContext.size || file.targetSize || null,
        timestamp: file.timestamp || soraContext.timestamp || null,
        updatedAt: new Date().toISOString()
      };
      return { path: normalizedPath, metadata };
    })
    .filter(Boolean);

  if (!entries.length) {
    return;
  }

  const index = await readJsonFileSafe(SORA_INDEX_PATH);
  entries.forEach(({ path: relativePath, metadata }) => {
    index[relativePath] = {
      videoId: metadata.videoId,
      model: metadata.model || undefined,
      targetSize: metadata.targetSize || undefined,
      timestamp: metadata.timestamp || undefined,
      updatedAt: metadata.updatedAt
    };
  });

  await writeJsonAtomic(SORA_INDEX_PATH, index);
}

async function loadVersionState() {
  if (versionStateLoaded) return versionState;
  try {
    const raw = await fsPromises.readFile(VERSION_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      versionState = parsed;
      versionStateLoaded = true;
      return versionState;
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('[MCP Showcase] failed to read version state', err.message);
    }
  }

  if (LEGACY_VERSION_STATE_PATH !== VERSION_STATE_PATH) {
    try {
      const rawLegacy = await fsPromises.readFile(LEGACY_VERSION_STATE_PATH, 'utf8');
      const parsedLegacy = JSON.parse(rawLegacy);
      if (parsedLegacy && typeof parsedLegacy === 'object') {
        versionState = parsedLegacy;
        versionStateLoaded = true;
        try {
          await ensureDir(path.dirname(VERSION_STATE_PATH));
          await fsPromises.writeFile(VERSION_STATE_PATH, JSON.stringify(versionState, null, 2), 'utf8');
        } catch (writeErr) {
          console.warn('[MCP Showcase] failed to migrate version state', writeErr.message);
        }
        return versionState;
      }
    } catch (legacyErr) {
      if (legacyErr && legacyErr.code !== 'ENOENT') {
        console.warn('[MCP Showcase] failed to read legacy version state', legacyErr.message);
      }
    }
  }

  versionState = {};
  versionStateLoaded = true;
  return versionState;
}

async function saveVersionState() {
  if (!versionStateLoaded) return;
  await ensureDir(path.dirname(VERSION_STATE_PATH));
  await fsPromises.writeFile(VERSION_STATE_PATH, JSON.stringify(versionState, null, 2), 'utf8');
}

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

function toFilenameSegment(value, { fallback = 'item', maxLength = 80 } = {}) {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const limited = Array.from(trimmed).slice(0, maxLength).join('');
  const sanitized = limited
    .replace(INVALID_FILENAME_CHARS, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^-+|-+$/g, '')
    .replace(/^_+|_+$/g, '');
  return sanitized || fallback;
}

function promptSegment(prompt) {
  const base = toFilenameSegment(prompt, { fallback: 'prompt', maxLength: 32 });
  return base.toLowerCase().replace(/_+/g, '-');
}

function engineSegment(serverId) {
  const base = toFilenameSegment(serverId, { fallback: 'engine', maxLength: 80 }).toLowerCase();
  let normalized = base.replace(/_+/g, '-');
  normalized = normalized.replace(/-kamui-/g, '-');
  normalized = normalized.replace(/-kamui$/g, '');
  normalized = normalized.replace(/^kamui-/, '');
  normalized = normalized.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'engine';
}

function buildFilePrefix(prefix, prompt) {
  const primary = toFilenameSegment(prefix, { fallback: '', maxLength: 80 }).toLowerCase().replace(/_+/g, '-');
  if (primary) return primary;
  const fallback = promptSegment(prompt);
  return fallback || 'run';
}

function formatTimestampSegment(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
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
    const formatted = formatter.format(date); // e.g. 2025/09/25 22:31:04
    return `${formatted.replace(/\//g, '-') } JST`;
  } catch (err) {
    return `${date.toISOString()} (fallback)`;
  }
}

async function reserveOutputPath(baseName, ext, outputDir) {
  const state = await loadVersionState();
  const key = `${path.resolve(outputDir)}::${baseName}`;
  let version = Number.isFinite(state[key]) ? Number(state[key]) + 1 : 0;

  const normalizedExt = ext && ext.startsWith('.') ? ext : `.${ext || 'png'}`;
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const suffix = version === 0 ? '' : `_${String(version).padStart(2, '0')}`;
    const candidate = `${baseName}${suffix}${normalizedExt}`;
    const absolutePath = path.join(outputDir, candidate);
    try {
      await ensureDir(path.dirname(absolutePath));
      const handle = await fsPromises.open(absolutePath, 'wx');
      await handle.close();
      state[key] = version;
      await saveVersionState();
      return { filename: candidate, absolutePath, version };
    } catch (err) {
      if (err && (err.code === 'EEXIST' || err.code === 'EISDIR')) {
        version += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to reserve unique filename for showcase output');
}

async function downloadFile(url, destinationPath) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to download asset (${res.status}): ${text}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  await ensureDir(path.dirname(destinationPath));
  await fsPromises.writeFile(destinationPath, Buffer.from(arrayBuffer));
}

function parseJsonFragment(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  const candidate = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch (_) {
    return null;
  }
}

function collectContentFragments(rawResult) {
  const texts = [];
  const jsons = [];
  const seenObjects = new Set();
  const seenJson = new Set();

  const enqueue = (value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => enqueue(entry));
      return;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      texts.push(String(value));
      return;
    }
    if (typeof value !== 'object') {
      return;
    }
    if (seenObjects.has(value)) {
      return;
    }
    seenObjects.add(value);

    if (typeof value.text === 'string') {
      texts.push(value.text);
    } else if (Array.isArray(value.text)) {
      value.text.forEach((entry) => enqueue(entry));
    }

    if (typeof value.value === 'string') {
      texts.push(value.value);
    } else if (Array.isArray(value.value)) {
      value.value.forEach((entry) => enqueue(entry));
    }

    if (typeof value.note === 'string') {
      texts.push(value.note);
    }

    if (value.json && typeof value.json === 'object') {
      if (Array.isArray(value.json)) {
        value.json.forEach((entry) => {
          if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            if (!seenJson.has(entry)) {
              seenJson.add(entry);
              jsons.push(entry);
            }
          }
          enqueue(entry);
        });
      } else if (!seenJson.has(value.json)) {
        seenJson.add(value.json);
        jsons.push(value.json);
      }
    }

    if (Array.isArray(value.content)) {
      value.content.forEach((entry) => enqueue(entry));
    }
    if (Array.isArray(value.messages)) {
      value.messages.forEach((entry) => enqueue(entry));
    }
    if (Array.isArray(value.values)) {
      value.values.forEach((entry) => enqueue(entry));
    }
    if (Array.isArray(value.outputs)) {
      value.outputs.forEach((entry) => enqueue(entry));
    }
    if (Array.isArray(value.parts)) {
      value.parts.forEach((entry) => enqueue(entry));
    }
    if (Array.isArray(value.items)) {
      value.items.forEach((entry) => enqueue(entry));
    }
    if (value.partial !== undefined) {
      enqueue(value.partial);
    }
    if (value.message !== undefined) {
      enqueue(value.message);
    }
    if (value.data !== undefined) {
      if (value.data && typeof value.data === 'object' && !Array.isArray(value.data) && !seenJson.has(value.data)) {
        seenJson.add(value.data);
        jsons.push(value.data);
      }
      enqueue(value.data);
    }
    if (value.output !== undefined) {
      enqueue(value.output);
    }
  };

  const rootContent = rawResult?.result?.content !== undefined
    ? rawResult.result.content
    : rawResult?.content;
  enqueue(rootContent);

  if (typeof rawResult?.text === 'string') {
    texts.push(rawResult.text);
  }
  if (typeof rawResult?.result?.text === 'string') {
    texts.push(rawResult.result.text);
  }

  return { texts, jsons };
}

function resolvePromptAliasKeys(toolMeta) {
  if (!toolMeta || !toolMeta.parameters || typeof toolMeta.parameters !== 'object') {
    return [];
  }
  const { parameters } = toolMeta;
  const props = parameters.properties && typeof parameters.properties === 'object'
    ? parameters.properties
    : {};
  const keys = Object.keys(props);
  if (!keys.length) {
    return [];
  }

  const requiredSet = new Set(
    Array.isArray(parameters.required)
      ? parameters.required.map((entry) => String(entry))
      : []
  );

  const scored = keys.map((key) => {
    const schemaEntry = props[key];
    const lower = key.toLowerCase();
    if (lower === 'prompt') {
      return null;
    }
    const types = schemaTypes(schemaEntry);
    if (!types.includes('string')) {
      return null;
    }

    let score = 0;
    if (requiredSet.has(key) || requiredSet.has(lower)) score += 4;
    if (lower === 'text_prompt' || lower === 'prompt_text') score += 4;
    if (lower.includes('prompt')) score += 3;
    if (lower.includes('text')) score += 2;
    if (lower.includes('description') || lower.includes('caption')) score += 1;
    if (score <= 0) {
      return null;
    }
    return { key, score };
  }).filter(Boolean);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.key.localeCompare(b.key);
  });

  return scored.map((entry) => entry.key);
}

function resolveRequestIdParameter(toolMeta, fallback = 'request_id') {
  if (!toolMeta || !toolMeta.parameters || typeof toolMeta.parameters !== 'object') {
    return fallback;
  }
  const { parameters } = toolMeta;
  const props = parameters.properties && typeof parameters.properties === 'object'
    ? parameters.properties
    : {};
  const keys = Object.keys(props);
  if (!keys.length) {
    return fallback;
  }

  const requiredSet = new Set(
    Array.isArray(parameters.required)
      ? parameters.required.map((entry) => String(entry))
      : []
  );

  const findExact = (candidate) => {
    const match = keys.find((key) => key.toLowerCase() === candidate);
    return match || '';
  };

  const preferredExact = ['request_id', 'prediction_id', 'job_id', 'id'];
  for (const candidate of preferredExact) {
    const match = findExact(candidate);
    if (match) return match;
  }

  const scored = keys.map((key) => {
    const normalized = key.toLowerCase();
    let score = 0;
    if (requiredSet.has(key) || requiredSet.has(normalized)) score += 5;
    if (normalized.includes('request')) score += 4;
    if (normalized.includes('prediction')) score += 3;
    if (normalized.includes('job')) score += 2;
    if (normalized.includes('id')) score += 2;
    if (normalized.endsWith('_id')) score += 1;
    return { key, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.key.localeCompare(b.key);
  });

  if (scored[0] && scored[0].score > 0) {
    return scored[0].key;
  }

  return keys[0] || fallback;
}

function extractJson(callResult) {
  if (!callResult) return null;
  const raw = callResult.raw;
  const fragments = collectContentFragments(raw);
  if (fragments.jsons.length) {
    return fragments.jsons[0];
  }
  for (const text of fragments.texts) {
    const parsedFromText = parseJsonFragment(text);
    if (parsedFromText) {
      return parsedFromText;
    }
  }
  if (callResult.jsonContent && callResult.jsonContent.length) {
    return callResult.jsonContent[0];
  }
  const parsed = parseJsonFragment(callResult.text);
  if (parsed) return parsed;
  return null;
}

function extractResultErrorMessage(resultCall, resultJson) {
  if (!resultCall) return '';

  if (resultJson && typeof resultJson === 'object') {
    if (Array.isArray(resultJson.detail) && resultJson.detail.length) {
      const detailMessages = resultJson.detail
        .map((entry) => {
          if (!entry) return '';
          if (typeof entry === 'string') return entry.trim();
          if (typeof entry.msg === 'string') return entry.msg.trim();
          if (typeof entry.message === 'string') return entry.message.trim();
          if (typeof entry.error === 'string') return entry.error.trim();
          return '';
        })
        .filter(Boolean);
      if (detailMessages.length) {
        return `APIエラー: ${detailMessages.join(' / ')}`;
      }
      return 'APIエラーが発生しました';
    }
    if (typeof resultJson.error === 'string' && resultJson.error.trim()) {
      return resultJson.error.trim();
    }
    if (resultJson.error && typeof resultJson.error.message === 'string') {
      return resultJson.error.message.trim();
    }
    if (resultJson.success === false) {
      if (typeof resultJson.message === 'string' && resultJson.message.trim()) {
        return resultJson.message.trim();
      }
      return 'APIがエラー応答を返しました (success=false)';
    }
    if (typeof resultJson.status === 'string') {
      const statusLower = resultJson.status.toLowerCase();
      if (statusLower === 'failed' || statusLower === 'error') {
        if (typeof resultJson.message === 'string' && resultJson.message.trim()) {
          return resultJson.message.trim();
        }
        return `APIステータスが${resultJson.status}を返しました`;
      }
    }
  }

  const content = Array.isArray(resultCall.raw?.result?.content) ? resultCall.raw.result.content : [];
  for (const item of content) {
    if (!item) continue;
    if (typeof item.error === 'string' && item.error.trim()) {
      return item.error.trim();
    }
    if (item.error && typeof item.error.message === 'string') {
      return item.error.message.trim();
    }
    if (typeof item.text === 'string') {
      const trimmed = item.text.trim();
      if (/^api request failed/i.test(trimmed)) {
        return trimmed;
      }
    }
  }

  if (typeof resultCall.text === 'string') {
    const trimmed = resultCall.text.trim();
    if (/^api request failed/i.test(trimmed)) {
      return trimmed;
    }
  }

  return '';
}

function extractRequestId(callResult) {
  if (!callResult) return '';
  const raw = callResult.raw;
  if (raw?.result?.request_id && typeof raw.result.request_id === 'string') {
    return raw.result.request_id;
  }
  if (raw?.result?.video_id && typeof raw.result.video_id === 'string') {
    return raw.result.video_id;
  }
  if (raw?.result?.id && typeof raw.result.id === 'string') {
    return raw.result.id;
  }
  const fragments = collectContentFragments(raw);
  for (const json of fragments.jsons) {
    if (typeof json.video_id === 'string') return json.video_id;
    if (typeof json.request_id === 'string') return json.request_id;
    if (typeof json.requestId === 'string') return json.requestId;
    if (typeof json.id === 'string') return json.id;
  }
  for (const text of fragments.texts) {
    const parsed = parseJsonFragment(text);
    if (parsed) {
      if (typeof parsed.video_id === 'string') return parsed.video_id;
      if (typeof parsed.request_id === 'string') return parsed.request_id;
      if (typeof parsed.requestId === 'string') return parsed.requestId;
      if (typeof parsed.id === 'string') return parsed.id;
    }
    const cleaned = text.replace(/[*`_]/g, '');
    const match = cleaned.match(/request[_\s-]?id\s*:?\s*([0-9a-fA-F-]{6,})/i);
    if (match) return match[1];
    const videoMatch = cleaned.match(/video[_\s-]?id\s*:?\s*([0-9a-fA-F_:-]{6,})/i);
    if (videoMatch) return videoMatch[1];
  }
  if (typeof raw?.result?.data === 'object') {
    const entries = Object.values(raw.result.data);
    for (const value of entries) {
      if (value && typeof value === 'object') {
        if (typeof value.request_id === 'string') return value.request_id;
        if (typeof value.requestId === 'string') return value.requestId;
        if (typeof value.id === 'string') return value.id;
      }
    }
  }
  if (callResult.text) {
    const match = callResult.text.match(/request[_\s-]?id\s*:?\s*([0-9a-fA-F-]{6,})/i);
    if (match) return match[1];
  }
  return '';
}

function extractStatus(callResult) {
  if (!callResult) return '';
  const raw = callResult.raw;
  if (typeof raw?.result?.status === 'string') {
    return raw.result.status.toUpperCase();
  }
  const fragments = collectContentFragments(raw);
  for (const json of fragments.jsons) {
    if (typeof json.status === 'string') {
      return json.status.toUpperCase();
    }
  }
  for (const text of fragments.texts) {
    const parsed = parseJsonFragment(text);
    if (parsed && typeof parsed.status === 'string') {
      return parsed.status.toUpperCase();
    }
    const cleaned = text.replace(/[*`_]/g, '');
    const match = cleaned.match(/status\s*:?\s*([A-Za-z_]+)/i);
    if (match) return match[1].toUpperCase();
  }
  if (callResult.text) {
    const cleaned = callResult.text.replace(/[*`_]/g, '');
    const match = cleaned.match(/status\s*:?\s*([A-Za-z_]+)/i);
    if (match) return match[1].toUpperCase();
  }
  return '';
}

function collectTextFromContent(rawResult) {
  const fragments = collectContentFragments(rawResult);
  return {
    text: fragments.texts.join('\n').trim(),
    jsonContent: fragments.jsons
  };
}

function isSoraServerId(serverId) {
  if (!serverId) return false;
  return SORA_SERVER_IDS.has(String(serverId).trim());
}

function normalizeSoraModel(value, options = {}) {
  const { fallback = 'sora-2', sizeHint = '' } = options || {};
  if (!value && value !== 0) {
    if (sizeHint && SORA_PRO_ONLY_SIZES.has(String(sizeHint).trim().toLowerCase())) {
      return SORA_PRO_MODEL;
    }
    return fallback;
  }
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) {
    if (sizeHint && SORA_PRO_ONLY_SIZES.has(String(sizeHint).trim().toLowerCase())) {
      return SORA_PRO_MODEL;
    }
    return fallback;
  }
  if (SORA_MODEL_OPTIONS.has(trimmed)) {
    return trimmed;
  }
  const collapsed = trimmed.replace(/[_\s-]+/g, '');
  if (collapsed === 'sora2pro' || collapsed === 'sora2p') {
    return SORA_PRO_MODEL;
  }
  if (collapsed === 'sora2') {
    return 'sora-2';
  }
  if (collapsed === 'pro') {
    return SORA_PRO_MODEL;
  }
  if (sizeHint && SORA_PRO_ONLY_SIZES.has(String(sizeHint).trim().toLowerCase())) {
    return SORA_PRO_MODEL;
  }
  return fallback;
}

function extractSoraVideoIdFromMediaEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  const candidates = [
    entry.videoId,
    entry.soraVideoId,
    entry?.sora?.videoId,
    entry?.savedFile?.videoId,
    entry?.metadata?.videoId,
    entry?.metadata?.video_id,
    entry?.metadata?.soraVideoId,
    entry?.metadata?.sora_video_id,
    entry?.metadata?.sora?.videoId
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed && SORA_VIDEO_ID_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return '';
}

function ensurePosixPath(relativePath) {
  if (!relativePath) return null;
  return relativePath.split(path.sep).join('/');
}

function resolvePollIntervalMs(meta) {
  if (!meta || !meta.category) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  const category = String(meta.category).toLowerCase();
  if (VIDEO_POLL_CATEGORIES.has(category)) {
    return VIDEO_POLL_INTERVAL_MS;
  }
  return DEFAULT_POLL_INTERVAL_MS;
}

async function createSession(serverUrl) {
  const headers = authHeaders();
  const body = {
    jsonrpc: '2.0',
    id: 'showcase-init',
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'kamui-code-showcase-runner',
        version: '0.1.0'
      }
    }
  };

  const res = await fetch(serverUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`initialize failed (${res.status}): ${text}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`initialize JSON parse error: ${err.message}`);
  }
  if (!json.result) {
    throw new Error('initialize response missing result field');
  }
  const sessionId = res.headers.get('mcp-session-id');
  if (!sessionId) {
    throw new Error('MCP session id not provided by server');
  }
  const sessionHeaders = authHeaders();
  sessionHeaders['Mcp-Session-Id'] = sessionId;
  sessionHeaders['MCP-Protocol-Version'] = PROTOCOL_VERSION;
  return {
    serverUrl,
    headers: sessionHeaders,
    sessionId,
    init: json.result
  };
}

async function callTool(session, toolName, args = {}) {
  const body = {
    jsonrpc: '2.0',
    id: `showcase-${toolName}`,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };
  const res = await fetch(session.serverUrl, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`tool call failed (${res.status}) ${toolName}: ${text}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`tool call JSON parse error for ${toolName}: ${err.message}`);
  }
  if (json.error) {
    throw new Error(`tool call error for ${toolName}: ${JSON.stringify(json.error)}`);
  }
  const { text: combinedText, jsonContent } = collectTextFromContent(json.result);
  return {
    raw: json,
    text: combinedText,
    jsonContent
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function guessExtensionFromUrl(url) {
  if (!url || typeof url !== 'string') return '.png';
  const normalized = url.trim();
  const directMatch = normalized.match(/\.([a-zA-Z0-9]{2,10})(?:[?#]|$)/);
  if (directMatch) {
    const ext = directMatch[1].toLowerCase();
    if (KNOWN_EXTENSIONS.has(ext)) {
      return KNOWN_EXTENSIONS.get(ext);
    }
    return `.${ext}`;
  }

  try {
    const parsed = new URL(normalized);
    const filenameParam = parsed.searchParams.get('filename')
      || parsed.searchParams.get('file')
      || parsed.searchParams.get('key');
    if (filenameParam) {
      const lowered = filenameParam.toLowerCase();
      const nameMatch = lowered.match(/\.([a-z0-9]{2,10})$/);
      if (nameMatch) {
        const ext = nameMatch[1];
        if (KNOWN_EXTENSIONS.has(ext)) {
          return KNOWN_EXTENSIONS.get(ext);
        }
        return `.${ext}`;
      }
    }
  } catch (err) {
    // ignore malformed URLs, fall back to default extension
  }

  return '.png';
}

function buildSavedFileRecord(absolutePath, meta = {}) {
  const relative = SCAN_PATH ? path.relative(SCAN_PATH, absolutePath) : null;
  const relativePosix = relative ? relative.split(path.sep).join('/') : null;
  const basename = path.basename(absolutePath);
  const ext = path.extname(basename).replace(/^\./, '').toLowerCase();
  const mediaType = inferMediaTypeFromExtension(ext);
  const baseRecord = {
    absolute: absolutePath,
    relative: relative || null,
    webPath: relativePosix || null,
    fileName: basename,
    extension: ext,
    mediaType,
    filterType: mediaType
  };
  const merged = {
    ...baseRecord,
    ...meta
  };
  if (!merged.mediaType) {
    merged.mediaType = mediaType;
  }
  if (!merged.filterType) {
    merged.filterType = merged.mediaType;
  }
  return merged;
}

async function persistRunLog({ serverId, prompt, filePrefix, requestId, status, durationMs, savedFiles, logs, completedAt }) {
  try {
    await ensureDir(LOG_DIR);
    const timestamp = new Date().toISOString();
    const day = timestamp.slice(0, 10);
    const logPath = path.join(LOG_DIR, `${day}.log`);

    const lines = [];
    lines.push('---');
    lines.push(`timestamp: ${timestamp}`);
    lines.push(`timestampJst: ${formatTimestampJst(new Date(timestamp))}`);
    lines.push(`serverId: ${serverId}`);
    lines.push(`prompt: ${prompt || ''}`);
    lines.push(`filePrefix: ${filePrefix || ''}`);
    lines.push(`requestId: ${requestId || ''}`);
    lines.push(`status: ${status || ''}`);
    lines.push(`durationMs: ${Number.isFinite(durationMs) ? durationMs : ''}`);
    lines.push(`completedAt: ${completedAt || ''}`);
    lines.push('savedFiles:');
    (Array.isArray(savedFiles) ? savedFiles : []).forEach((file) => {
      if (!file) return;
      lines.push(`  - ${file.absolute || file.webPath || file.relative || ''}`);
    });
    lines.push('logs:');
    (Array.isArray(logs) ? logs : []).forEach((entry) => {
      lines.push(`  - ${String(entry)}`);
    });
    lines.push('');

    await fsPromises.appendFile(logPath, lines.join('\n'), 'utf8');
    return logPath;
  } catch (err) {
    console.error('[MCP Showcase] failed to persist run log', err);
    return null;
  }
}

function collectImageUrls(resultJson) {
  if (!resultJson || (typeof resultJson !== 'object' && typeof resultJson !== 'string')) return [];
  const urls = new Set();
  const visited = new Set();

  const appendUrl = (value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (/^https?:\/\//i.test(trimmed)) {
      urls.add(trimmed);
    }
  };

  const visit = (target, depth = 0) => {
    if (!target || depth > 6) return;
    if (typeof target === 'string') {
      appendUrl(target);
      return;
    }
    if (Array.isArray(target)) {
      target.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof target !== 'object') return;
    if (visited.has(target)) return;
    visited.add(target);

    if (typeof target.url === 'string') appendUrl(target.url);
    if (typeof target.href === 'string') appendUrl(target.href);
    if (typeof target.video_url === 'string') appendUrl(target.video_url);
    if (typeof target.output_url === 'string') appendUrl(target.output_url);
    if (typeof target.download_url === 'string') appendUrl(target.download_url);
    if (typeof target.file_url === 'string') appendUrl(target.file_url);
    if (typeof target.path === 'string') appendUrl(target.path);

    ['image', 'video', 'audio', 'result', 'output'].forEach((key) => {
      if (target[key] !== undefined) {
        visit(target[key], depth + 1);
      }
    });

    ['images', 'videos', 'audios', 'files', 'fileUrls', 'urls', 'outputs', 'results', 'media', 'items', 'data']
      .forEach((key) => {
        if (target[key] !== undefined) {
          visit(target[key], depth + 1);
        }
      });
  };

  visit(resultJson);

  return Array.from(urls);
}

const KNOWN_EXTENSIONS = new Map([
  ['png', '.png'],
  ['jpg', '.jpg'],
  ['jpeg', '.jpg'],
  ['webp', '.webp'],
  ['gif', '.gif'],
  ['bmp', '.bmp'],
  ['tiff', '.tiff'],
  ['tif', '.tiff'],
  ['mp4', '.mp4'],
  ['mov', '.mov'],
  ['webm', '.webm'],
  ['mkv', '.mkv'],
  ['avi', '.avi'],
  ['m4v', '.m4v'],
  ['wmv', '.wmv'],
  ['mp3', '.mp3'],
  ['wav', '.wav'],
  ['ogg', '.ogg'],
  ['m4a', '.m4a'],
  ['aac', '.aac'],
  ['flac', '.flac'],
  ['opus', '.opus'],
  ['json', '.json'],
  ['glb', '.glb'],
  ['gltf', '.gltf'],
  ['obj', '.obj'],
  ['fbx', '.fbx'],
  ['stl', '.stl'],
  ['ply', '.ply'],
  ['usdz', '.usdz'],
  ['usd', '.usd'],
  ['3ds', '.3ds'],
  ['dae', '.dae'],
  ['iges', '.iges'],
  ['igs', '.igs'],
  ['step', '.step'],
  ['stp', '.stp'],
  ['zip', '.zip']
]);

const THREE_D_EXTENSIONS = new Set([
  'glb',
  'gltf',
  'obj',
  'fbx',
  'stl',
  'ply',
  'usdz',
  'usd',
  '3ds',
  'dae',
  'igs',
  'iges',
  'stp',
  'step',
  'vrm'
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'wmv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus']);

function inferMediaTypeFromExtension(rawExt) {
  if (!rawExt) return 'image';
  const ext = String(rawExt).replace(/^\./, '').toLowerCase();
  if (!ext) return 'image';
  if (THREE_D_EXTENSIONS.has(ext)) return '3d';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'sound';
  if (ext === 'json') return 'other';
  if (ext === 'zip') return 'other';
  const known = KNOWN_EXTENSIONS.get(ext);
  if (known && ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff'].includes(known)) {
    return 'image';
  }
  return 'image';
}

function extractUrlsFromCallResult(callResult) {
  const urls = new Set();
  if (!callResult) return [];
  const collect = (value) => {
    const nested = collectImageUrls(value);
    nested.forEach((url) => urls.add(url));
  };

  const content = Array.isArray(callResult.raw?.result?.content)
    ? callResult.raw.result.content
    : [];
  content.forEach((item) => {
    if (typeof item?.text === 'string') {
      const matches = item.text.match(/https?:\/\/[^\s"'<>]+/g);
      if (matches) {
        matches.forEach((url) => urls.add(url));
      }
      collect(item.text);
    }
    if (item?.json) {
      collect(item.json);
    }
    if (typeof item?.url === 'string') {
      urls.add(item.url);
    }
    if (typeof item?.href === 'string') {
      urls.add(item.href);
    }
    if (Array.isArray(item?.urls)) {
      item.urls.forEach((url) => urls.add(url));
    }
    if (item?.data) {
      collect(item.data);
    }
  });

  collect(callResult.raw?.result);
  collect(callResult.raw?.data);
  if (callResult.raw && typeof callResult.raw === 'object') {
    collect(callResult.raw);
  }
  if (Array.isArray(callResult.jsonContent)) {
    callResult.jsonContent.forEach((entry) => collect(entry));
  }

  if (typeof callResult.text === 'string') {
    const matches = callResult.text.match(/https?:\/\/[^\s"'<>]+/g);
    if (matches) {
      matches.forEach((url) => urls.add(url));
    }
  }

  return Array.from(urls);
}

const MEDIA_ARRAY_KEY_CANDIDATES = new Set([
  'imageurls',
  'imageurllist',
  'imageurlarray',
  'inputimages',
  'referenceimages',
  'sourceimages',
  'videourls',
  'videofiles',
  'audiourls',
  'audiofiles',
  'soundclips',
  'trackurls',
  'modelurls',
  'modeloutputs',
  'meshurls',
  'meshes',
  'models',
  'geometryfiles'
]);

const MEDIA_SINGLE_KEY_CANDIDATES = new Set([
  'imageurl',
  'image',
  'inputimage',
  'referenceimage',
  'sourceimage',
  'initimage',
  'baseimage',
  'videourl',
  'video',
  'audiourl',
  'audio',
  'soundclip',
  'trackurl',
  'modelurl',
  'meshurl',
  'model',
  'mesh',
  'geometry'
]);

const MEDIA_PROMPT_LIKE_TOKENS = new Set([
  'prompt',
  'prompts',
  'text',
  'caption',
  'captions',
  'description',
  'descriptions',
  'instruction',
  'instructions',
  'story',
  'stories',
  'script',
  'scripts',
  'dialog',
  'dialogue',
  'dialogues',
  'subtitle',
  'subtitles',
  'transcript',
  'transcripts',
  'lyric',
  'lyrics',
  'narration',
  'narrations'
]);

function normalizeKey(key) {
  return String(key || '').toLowerCase();
}

function normalizeKeyCompact(key) {
  return normalizeKey(key).replace(/[^a-z0-9]/g, '');
}

function tokenizeKeySegments(key) {
  if (!key && key !== 0) return [];
  return String(key)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function normalizeMediaTypeHint(value) {
  if (!value && value !== 0) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return '';
  const ext = raw.startsWith('.') ? raw.slice(1) : raw;
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'heic', 'tif', 'tiff'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].includes(ext)) {
    return 'sound';
  }
  if (THREE_D_EXTENSIONS.has(ext)) {
    return '3d';
  }
  if (raw.includes('/')) {
    if (raw.includes('audio')) return 'sound';
    if (raw.includes('video')) return 'video';
    if (raw.includes('image')) return 'image';
    if (raw.includes('model') || raw.includes('mesh') || raw.includes('3d')) return '3d';
  }
  if (raw.includes('audio') || raw.includes('sound') || raw.includes('music')
    || raw.includes('voice') || raw.includes('speech') || raw.includes('track')
    || raw.includes('sfx') || raw.includes('clip')) {
    return 'sound';
  }
  if (raw.includes('video') || raw.includes('movie') || raw.includes('animation')
    || raw.includes('mp4') || raw.includes('mov') || raw.includes('clip')) {
    return 'video';
  }
  if (raw.includes('model') || raw.includes('mesh') || raw.includes('3d')
    || raw.includes('geometry') || raw.includes('obj') || raw.includes('fbx')
    || raw.includes('glb') || raw.includes('gltf') || raw.includes('usdz') || raw.includes('ply')) {
    return '3d';
  }
  if (raw.includes('image') || raw.includes('img') || raw.includes('photo')
    || raw.includes('picture') || raw.includes('frame') || raw.includes('thumbnail')
    || raw.includes('reference') || raw.includes('source') || raw.includes('init')) {
    return 'image';
  }
  return '';
}

function inferMediaTypeFromKey(key) {
  if (!key && key !== 0) return '';
  const tokens = String(key)
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
  if (!tokens.length) return '';

  const hasSound = tokens.some((token) => ['audio', 'audios', 'sound', 'sounds', 'music', 'musics', 'voice', 'voices', 'speech', 'track', 'tracks', 'clip', 'clips'].includes(token));
  if (hasSound) return 'sound';

  const hasVideo = tokens.some((token) => ['video', 'videos', 'movie', 'movies', 'animation', 'animations', 'motion', 'motions', 'clip', 'clips'].includes(token));
  if (hasVideo) return 'video';

  const has3d = tokens.some((token) => ['3d', 'mesh', 'meshes', 'model', 'models', 'geometry', 'obj', 'fbx', 'glb', 'usdz'].includes(token));
  if (has3d) return '3d';

  const hasImage = tokens.some((token) => ['image', 'images', 'img', 'imgs', 'picture', 'pictures', 'photo', 'photos', 'frame', 'frames', 'thumbnail', 'thumbnails', 'reference', 'references', 'source', 'sources', 'inputimage', 'inputimages', 'init', 'base'].includes(token));
  if (hasImage) return 'image';

  return '';
}

function inferMediaTypeFromSchema(schema) {
  if (!schema || typeof schema !== 'object') return '';
  const candidates = [
    schema.contentMediaType,
    schema.mediaType,
    schema.format,
    schema.title,
    schema.description
  ];
  for (const candidate of candidates) {
    const normalized = normalizeMediaTypeHint(candidate);
    if (normalized) return normalized;
  }
  if (schema.items && typeof schema.items === 'object') {
    const nested = inferMediaTypeFromSchema(schema.items);
    if (nested) return nested;
  }
  if (Array.isArray(schema.enum)) {
    for (const value of schema.enum) {
      const normalized = normalizeMediaTypeHint(value);
      if (normalized) return normalized;
    }
  }
  return '';
}

function mediaTypePriority(type) {
  switch (type) {
    case 'sound':
      return 0;
    case 'video':
      return 1;
    case 'image':
      return 2;
    case '3d':
      return 3;
    default:
      return 4;
  }
}

function fallbackKeyForType(type) {
  if (type === 'sound') return 'audio_url';
  if (type === 'video') return 'video_url';
  if (type === '3d') return 'model_url';
  return 'image_url';
}

function fallbackArrayKeyForType(type) {
  if (type === 'sound') return 'audio_urls';
  if (type === 'video') return 'video_urls';
  if (type === '3d') return 'model_urls';
  return 'image_urls';
}

function isRemoteUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed);
}

function isUrlLikeKey(key) {
  if (!key) return false;
  const normalized = normalizeKey(key);
  return normalized.includes('url') || normalized.includes('uri');
}

function sanitizeUrlLikeFields(target) {
  if (!target || typeof target !== 'object') return;
  Object.keys(target).forEach((key) => {
    const value = target[key];
    if (typeof value === 'string') {
      if (isUrlLikeKey(key) && value && !isRemoteUrl(value)) {
        delete target[key];
      }
      return;
    }
    if (Array.isArray(value)) {
      if (!isUrlLikeKey(key)) return;
      const sanitized = value.filter((entry) => typeof entry === 'string' && isRemoteUrl(entry));
      if (sanitized.length) {
        target[key] = sanitized;
      } else {
        delete target[key];
      }
    }
  });
}

function formatArgsForLog(args) {
  const seen = new WeakSet();
  const MAX_STRING_LENGTH = Math.min(LOG_STRING_LIMIT, 1024);
  const MAX_ARRAY_ITEMS = Math.min(LOG_ARRAY_LIMIT, 64);
  try {
    return JSON.stringify(args, (key, value) => {
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        return `${value.slice(0, MAX_STRING_LENGTH)}… (${value.length} chars)`;
      }
      if (Array.isArray(value) && value.length > MAX_ARRAY_ITEMS) {
        const head = value.slice(0, MAX_ARRAY_ITEMS);
        return [...head, `… (${value.length - MAX_ARRAY_ITEMS} more)`];
      }
      return value;
    });
  } catch (err) {
    return `[unserializable submit args: ${err.message}]`;
  }
}

function formatJsonForLog(payload, { stringLimit = LOG_STRING_LIMIT, arrayLimit = LOG_ARRAY_LIMIT } = {}) {
  if (payload === undefined) return 'undefined';
  if (payload === null) return 'null';
  if (typeof payload === 'string') {
    return payload.length > stringLimit ? `${payload.slice(0, stringLimit)}… (${payload.length} chars)` : payload;
  }
  try {
    const seen = new WeakSet();
    return JSON.stringify(payload, (key, value) => {
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      if (typeof value === 'string' && value.length > stringLimit) {
        return `${value.slice(0, stringLimit)}… (${value.length} chars)`;
      }
      if (Array.isArray(value) && value.length > arrayLimit) {
        const head = value.slice(0, arrayLimit);
        return [...head, `… (${value.length - arrayLimit} more)`];
      }
      return value;
    }, 2);
  } catch (err) {
    return `[unserializable: ${err.message}]`;
  }
}

function schemaTypes(schema) {
  const types = new Set();
  const visit = (node) => {
    if (!node) return;
    const rawType = node.type;
    if (Array.isArray(rawType)) {
      rawType.forEach((type) => types.add(type));
    } else if (typeof rawType === 'string') {
      types.add(rawType);
    }
    if (Array.isArray(node.anyOf)) {
      node.anyOf.forEach(visit);
    }
    if (Array.isArray(node.oneOf)) {
      node.oneOf.forEach(visit);
    }
    if (Array.isArray(node.allOf)) {
      node.allOf.forEach(visit);
    }
  };
  visit(schema);
  return Array.from(types);
}

function isArrayMediaField(key, schema) {
  if (!key || !schema) return false;
  const types = schemaTypes(schema);
  if (!types.includes('array')) return false;
  const normalized = normalizeKeyCompact(key);
  if (MEDIA_ARRAY_KEY_CANDIDATES.has(normalized)) return true;
  if (inferMediaTypeFromKey(key)) return true;
  if (inferMediaTypeFromSchema(schema)) return true;
  return false;
}

function isSingleMediaField(key, schema) {
  if (!key || !schema) return false;
  const types = schemaTypes(schema);
  if (!types.includes('string')) return false;
  const normalized = normalizeKeyCompact(key);
  if (MEDIA_SINGLE_KEY_CANDIDATES.has(normalized)) return true;
  if (inferMediaTypeFromKey(key)) return true;
  if (inferMediaTypeFromSchema(schema)) return true;
  return false;
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function normalizeMediaPlaceholderValue(value) {
  if (!value || typeof value !== 'string') return '';
  let normalized = value.trim();
  if (!normalized) return '';
  normalized = normalized.replace(/\\/g, '/');
  normalized = normalized.replace(/^\.\/+/, '');
  return normalized;
}

function createMediaPlaceholderMatcher(uploads) {
  if (!Array.isArray(uploads) || uploads.length === 0) {
    return (value) => isEmptyValue(value);
  }

  const candidates = new Set();
  const addCandidate = (raw) => {
    const normalized = normalizeMediaPlaceholderValue(raw);
    if (!normalized) return;
    candidates.add(normalized);
    const withoutLeading = normalized.replace(/^\/+/, '');
    if (withoutLeading && withoutLeading !== normalized) {
      candidates.add(withoutLeading);
    }
    const withLeading = normalized.startsWith('/') ? normalized : `/${normalized}`;
    if (withLeading && withLeading !== normalized) {
      candidates.add(withLeading);
    }
  };

  uploads.forEach((entry) => {
    if (!entry) return;
    if (entry.absolutePath) addCandidate(entry.absolutePath);
    const original = entry.original && typeof entry.original === 'object' ? entry.original : null;
    if (!original) return;
    addCandidate(original.path);
    addCandidate(original.url);
    addCandidate(original.thumbUrl);
    addCandidate(original.absolute);
    addCandidate(original.absolutePath);
  });

  if (!candidates.size) {
    return (value) => isEmptyValue(value);
  }

  const matchesCandidate = (raw) => {
    if (!raw) return true;
    const normalized = normalizeMediaPlaceholderValue(raw);
    if (!normalized) return true;
    if (candidates.has(normalized)) return true;
    const withoutLeading = normalized.replace(/^\/+/, '');
    if (withoutLeading && candidates.has(withoutLeading)) return true;
    const withLeading = normalized.startsWith('/') ? normalized : `/${normalized}`;
    if (withLeading && candidates.has(withLeading)) return true;
    return false;
  };

  const matcher = (value) => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) {
      if (!value.length) return true;
      return value.every((item) => matcher(item));
    }
    if (typeof value === 'string') {
      return matchesCandidate(value);
    }
    return false;
  };

  return matcher;
}

function shouldSkipMediaAutoAssignment({ keyType = '', tokens = [], schemaEntry = null }) {
  if (keyType) return false;
  if (!Array.isArray(tokens) || !tokens.length) return false;
  const hasPromptLikeToken = tokens.some((token) => MEDIA_PROMPT_LIKE_TOKENS.has(token));
  if (!hasPromptLikeToken) {
    return false;
  }

  if (schemaEntry && typeof schemaEntry === 'object') {
    const mediaHint = normalizeMediaTypeHint(
      schemaEntry.contentMediaType
      || schemaEntry.mediaType
      || schemaEntry.format
    );
    if (mediaHint && mediaHint !== 'other') {
      return false;
    }
    const descriptor = [schemaEntry.title, schemaEntry.description]
      .map((value) => (value ? String(value).toLowerCase() : ''))
      .join(' ');
    if (descriptor && /(image|video|audio|sound|frame|thumbnail|reference|sprite)/.test(descriptor)) {
      return false;
    }
  }

  return true;
}

function inferMediaEntryType(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const candidates = [];
  const direct = [entry.type, entry.mediaType, entry.filterType, entry.category, entry.name, entry.mime, entry.ext];
  direct.forEach((value) => {
    const normalized = normalizeMediaTypeHint(value);
    if (normalized) candidates.push(normalized);
  });
  if (Array.isArray(entry.filterTags)) {
    entry.filterTags.forEach((tag) => {
      const normalized = normalizeMediaTypeHint(tag);
      if (normalized) candidates.push(normalized);
    });
  }
  if (!candidates.length && entry.path) {
    const ext = path.extname(entry.path);
    const normalized = normalizeMediaTypeHint(ext);
    if (normalized) candidates.push(normalized);
  }
  return candidates.length ? candidates[0] : '';
}

async function prepareMediaUploads(mediaEntries, cache) {
  if (!Array.isArray(mediaEntries) || !mediaEntries.length) {
    return { urls: [], uploads: [], logs: [] };
  }
  const urls = [];
  const uploads = [];
  const logs = [];
  for (const entry of mediaEntries) {
    if (!entry || !entry.path) {
      continue;
    }
    const absolutePath = ensureWithinScanPath(entry.path);
    const cacheKey = absolutePath;
    const detectedType = inferMediaEntryType(entry);
    let cached = cache && cache.get(cacheKey);
    if (!cached) {
      // eslint-disable-next-line no-await-in-loop
      const upload = await runPythonUpload(absolutePath);
      cached = {
        url: upload.url,
        absolutePath,
        type: detectedType
      };
      if (cache) cache.set(cacheKey, cached);
    } else if (!cached.type && detectedType) {
      cached = { ...cached, type: detectedType };
      if (cache) cache.set(cacheKey, cached);
    }
    const finalType = cached.type || detectedType;
    urls.push(cached.url);
    uploads.push({
      url: cached.url,
      type: finalType,
      absolutePath,
      original: { ...entry }
    });
    const typeLabel = finalType ? ` [${finalType}]` : '';
    logs.push(`Uploaded media ${path.basename(absolutePath)}${typeLabel} -> ${cached.url}`);
  }
  return { urls, uploads, logs };
}

function assignMediaParameters({
  submitArgs,
  schema,
  uploads
}) {
  const props = schema?.properties || {};
  const keys = Object.keys(props);
  const assigned = new Set();
  if (!Array.isArray(uploads) || !uploads.length || !keys.length) {
    return assigned;
  }

  const normalizedUploads = uploads
    .map((entry, index) => {
      if (!entry) return null;
      const url = typeof entry.url === 'string' ? entry.url.trim() : '';
      if (!url) return null;
      const typeHint = normalizeMediaTypeHint(entry.type)
        || normalizeMediaTypeHint(entry.mediaType)
        || (entry.original ? inferMediaEntryType(entry.original) : '');
      return {
        url,
        type: typeHint,
        index,
        original: entry.original || null
      };
    })
    .filter(Boolean);

  if (!normalizedUploads.length) {
    return assigned;
  }

  const canOverwriteValue = createMediaPlaceholderMatcher(normalizedUploads);
  const usedIndices = new Set();

  const requiredKeys = new Set(
    Array.isArray(schema?.required)
      ? schema.required.map((key) => String(key))
      : []
  );

  const getRemainingCount = () => normalizedUploads.reduce((acc, entry) => (
    usedIndices.has(entry.index) ? acc : acc + 1
  ), 0);

  const takeUpload = (preferredTypes = [], options = {}) => {
    const { allowFallback = true } = options;
    const normalizedPrefs = preferredTypes
      .map((type) => normalizeMediaTypeHint(type))
      .filter(Boolean);
    if (normalizedPrefs.length) {
      for (const pref of normalizedPrefs) {
        for (const entry of normalizedUploads) {
          if (usedIndices.has(entry.index)) continue;
          if (entry.type && entry.type === pref) {
            usedIndices.add(entry.index);
            return entry;
          }
        }
      }
    }
    if (!allowFallback) {
      return null;
    }
    for (const entry of normalizedUploads) {
      if (usedIndices.has(entry.index)) continue;
      usedIndices.add(entry.index);
      return entry;
    }
    return null;
  };

  const keyEntries = keys.map((key) => {
    const schemaEntry = props[key];
    const types = schemaTypes(schemaEntry);
    if (!types.includes('array') && !types.includes('string')) {
      return null;
    }
    const tokens = tokenizeKeySegments(key);
    const keyType = inferMediaTypeFromKey(key);
    if (shouldSkipMediaAutoAssignment({ keyType, tokens, schemaEntry })) {
      return null;
    }
    const hints = [];
    if (keyType) hints.push(keyType);
    const schemaType = inferMediaTypeFromSchema(schemaEntry);
    if (schemaType && !hints.includes(schemaType)) hints.push(schemaType);
    return {
      key,
      schemaEntry,
      types,
      hints,
      required: requiredKeys.has(key),
      isArray: types.includes('array'),
      priority: mediaTypePriority(hints[0] || ''),
      maxItems: Number.isFinite(schemaEntry?.maxItems) ? schemaEntry.maxItems : Infinity,
      minItems: Number.isFinite(schemaEntry?.minItems) ? schemaEntry.minItems : 0
    };
  }).filter(Boolean);

  if (!keyEntries.length) {
    return assigned;
  }

  keyEntries.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.isArray !== b.isArray) return a.isArray ? -1 : 1;
    return 0;
  });

  keyEntries.forEach((entry) => {
    if (assigned.has(entry.key)) return;
    if (!canOverwriteValue(submitArgs[entry.key])) return;

    if (entry.isArray) {
      if (!entry.hints.length) return;
      const remainingCapacity = Math.min(entry.maxItems, getRemainingCount());
      if (remainingCapacity <= 0) return;
      const primary = [];
      while (primary.length < remainingCapacity) {
        const upload = takeUpload(entry.hints, { allowFallback: false });
        if (!upload) break;
        primary.push(upload);
      }

      const minItems = Math.min(entry.minItems, remainingCapacity);
      if (primary.length < minItems) {
        while (primary.length < minItems) {
          const fallbackUpload = takeUpload(entry.hints, { allowFallback: true });
          if (!fallbackUpload) break;
          primary.push(fallbackUpload);
        }
      }

      if (primary.length) {
        submitArgs[entry.key] = primary.map((upload) => upload.url);
        assigned.add(entry.key);
      }
      return;
    }

    if (entry.types.includes('string')) {
      if (!entry.hints.length) return;
      const allowFallback = entry.required;
      const upload = takeUpload(entry.hints, { allowFallback });
      if (upload) {
        submitArgs[entry.key] = upload.url;
        assigned.add(entry.key);
      }
    }
  });

  if (!assigned.size) {
    const firstUpload = normalizedUploads[0];
    if (firstUpload) {
      if (normalizedUploads.length > 1) {
        const arrayKey = fallbackArrayKeyForType(firstUpload.type);
        if (arrayKey && canOverwriteValue(submitArgs[arrayKey])) {
          submitArgs[arrayKey] = normalizedUploads.map((entry) => entry.url);
          assigned.add(arrayKey);
        }
      }
      if (!assigned.size) {
        const singleKey = fallbackKeyForType(firstUpload.type);
        if (singleKey && canOverwriteValue(submitArgs[singleKey])) {
          submitArgs[singleKey] = firstUpload.url;
          assigned.add(singleKey);
        }
      }
    }
  }

  return assigned;
}

async function preprocessSoraMedia({
  mediaEntries,
  submitArgs,
  filePrefixSegment,
  cancellationSignal,
  prompt,
  mediaCache
}) {
  if (!Array.isArray(mediaEntries) || !mediaEntries.length) {
    return { media: mediaEntries, context: null, logs: [] };
  }

  const contextLogs = [];
  const sizeKey = normalizeSoraSizeKey(submitArgs?.size || DEFAULT_SORA_SIZE);
  const model = normalizeSoraModel(submitArgs?.model, { sizeHint: sizeKey });

  submitArgs.size = sizeKey;
  submitArgs.model = model;
  delete submitArgs.sora_quality_mode;
  delete submitArgs.soraQualityMode;
  delete submitArgs.qualityMode;
  delete submitArgs.quality_mode;

  const imageEntryIndex = mediaEntries.findIndex((entry) => inferMediaEntryType(entry) === 'image');
  if (imageEntryIndex === -1) {
    contextLogs.push('Sora preprocessing skipped: no image media found');
    return { media: mediaEntries, context: null, logs: contextLogs };
  }

  const entry = mediaEntries[imageEntryIndex];
  const sourcePath = entry?.absolute
    || entry?.absolutePath
    || (entry?.path ? ensureWithinScanPath(entry.path) : null);
  if (!sourcePath) {
    throw new Error('Sora preprocessing failed: source image path could not be resolved');
  }

  const normalizedPrefix = filePrefixSegment || 'sora';
  const soraContext = {
    size: sizeKey,
    model,
    source: {
      absolutePath: sourcePath,
      relativePath: SCAN_PATH ? path.relative(SCAN_PATH, sourcePath) : null,
      relativePathPosix: SCAN_PATH ? ensurePosixPath(path.relative(SCAN_PATH, sourcePath)) : null
    }
  };

  const workingPath = sourcePath;

  if (SORA_PRO_ONLY_SIZES.has(sizeKey)) {
    contextLogs.push(`High-resolution preparation for ${sizeKey} using ${model}`);
  }

  const prepared = await cropToTargetSize({
    inputPath: workingPath,
    sizeKey,
    model,
    scanPath: SCAN_PATH,
    filePrefix: normalizedPrefix
  });

  soraContext.processed = {
    absolutePath: prepared.absolutePath,
    relativePath: prepared.relativePath,
    relativePathPosix: prepared.relativePathPosix,
    width: prepared.width,
    height: prepared.height
  };

  contextLogs.push(`Sora reference prepared at ${prepared.absolutePath}`);

  const updatedEntry = {
    ...entry,
    path: prepared.relativePathPosix || entry.path,
    absolute: prepared.absolutePath,
    absolutePath: prepared.absolutePath,
    relative: prepared.relativePath || entry.relative,
    webPath: prepared.relativePathPosix || entry.webPath,
    filterType: 'image',
    mediaType: 'image',
    __soraPrepared: true
  };

  const nextMedia = mediaEntries.map((item, idx) => (idx === imageEntryIndex ? updatedEntry : item));

  return {
    media: nextMedia,
    context: soraContext,
    logs: contextLogs
  };
}

async function runMcpJob({
  serverId,
  input = {},
  prompt = '',
  label = '',
  filePrefix = '',
  media = [],
  mediaCache = null,
  cancellationSignal = null,
  timeoutMs = MAX_WAIT_MS
}) {
  if (!serverId) {
    throw new Error('serverId is required');
  }

  const meta = await getServerMeta(serverId);
  const pollIntervalMs = resolvePollIntervalMs(meta);
  if (!meta.tools.submit || !meta.tools.status || !meta.tools.result) {
    throw new Error(`Server ${serverId} does not expose submit/status/result tools`);
  }

  const requestKeyMap = {
    status: resolveRequestIdParameter(meta.tools.status),
    result: resolveRequestIdParameter(meta.tools.result),
    cancel: resolveRequestIdParameter(meta.tools.cancel)
  };

  const logs = [];
  logs.push(`[meta] request id keys (status=${requestKeyMap.status || 'request_id'}, result=${requestKeyMap.result || 'request_id'}${meta.tools.cancel ? `, cancel=${requestKeyMap.cancel || 'request_id'}` : ''})`);
  const startAt = Date.now();
  const filePrefixSegment = buildFilePrefix(filePrefix, prompt);
  let session;
  let requestId = '';
  let statusHistory = [];
  let status = 'UNKNOWN';
  let savedFiles = [];
  let timestampSegment = '';
  let resultJson = null;
  let logFile = null;
  let completedAtIso = '';
  let durationMs = 0;
  let cancelState = null;
  let soraContext = null;

  try {
    const submitArgs = { ...input };
    if (prompt) {
      const hasPromptKey = Object.prototype.hasOwnProperty.call(submitArgs, 'prompt');
      if (!hasPromptKey || isEmptyValue(submitArgs.prompt)) {
        submitArgs.prompt = prompt;
      }
      const promptAliases = resolvePromptAliasKeys(meta.tools.submit);
      if (promptAliases.length) {
        promptAliases.forEach((alias) => {
          if (isEmptyValue(submitArgs[alias])) {
            submitArgs[alias] = prompt;
          }
        });
      }
    }

    let effectiveMedia = Array.isArray(media) ? media.map((entry) => (entry && typeof entry === 'object' ? { ...entry } : entry)) : [];
    const soraRemixInfo = {
      videoId: '',
      isValid: false,
      hadCandidate: false
    };
    let normalizedSoraModel = 'sora-2';
    let normalizedSoraSizeKey = DEFAULT_SORA_SIZE;

    if (isSoraServerId(serverId)) {
      const rawSize = submitArgs?.size || DEFAULT_SORA_SIZE;
      normalizedSoraSizeKey = normalizeSoraSizeKey(rawSize || DEFAULT_SORA_SIZE);
      normalizedSoraModel = normalizeSoraModel(submitArgs?.model, { sizeHint: normalizedSoraSizeKey });
      if (SORA_PRO_ONLY_SIZES.has(normalizedSoraSizeKey) && normalizedSoraModel !== SORA_PRO_MODEL) {
        logs.push(`[sora] auto-upgraded model to ${SORA_PRO_MODEL} for size ${normalizedSoraSizeKey}`);
        normalizedSoraModel = SORA_PRO_MODEL;
      }
      submitArgs.model = normalizedSoraModel;
      submitArgs.size = normalizedSoraSizeKey;
      delete submitArgs.sora_quality_mode;
      delete submitArgs.soraQualityMode;
      delete submitArgs.qualityMode;
      delete submitArgs.quality_mode;
    }

    if (isSoraServerId(serverId)) {
      let remixCandidate = [
        submitArgs.remix_video_id,
        submitArgs.video_id,
        submitArgs.remixVideoId
      ].find((value) => typeof value === 'string' && value.trim());
      let derivedRemixVideoId = '';

      if (!remixCandidate) {
        for (const entry of effectiveMedia) {
          if (inferMediaEntryType(entry) !== 'video') {
            continue;
          }
          const candidateId = extractSoraVideoIdFromMediaEntry(entry);
          if (candidateId) {
            derivedRemixVideoId = candidateId;
            remixCandidate = candidateId;
            submitArgs.remix_video_id = candidateId;
            break;
          }
        }
      }

      if (remixCandidate) {
        soraRemixInfo.hadCandidate = true;
        const normalizedId = remixCandidate.trim();
        if (SORA_VIDEO_ID_PATTERN.test(normalizedId)) {
          soraRemixInfo.videoId = normalizedId;
          soraRemixInfo.isValid = true;
          submitArgs.remix_video_id = normalizedId;
          delete submitArgs.video_id;
          delete submitArgs.input_reference;
          delete submitArgs.inputReference;
          delete submitArgs.input_reference_url;
          delete submitArgs.inputReferenceUrl;
          effectiveMedia = [];
          if (derivedRemixVideoId) {
            logs.push(`[sora] remix video id derived from media payload: ${normalizedId}`);
          }
        } else {
          delete submitArgs.remix_video_id;
          delete submitArgs.video_id;
        }
      }
    }

    if (isSoraServerId(serverId) && effectiveMedia.length) {
      const preprocessResult = await preprocessSoraMedia({
        mediaEntries: effectiveMedia,
        submitArgs,
        filePrefixSegment,
        cancellationSignal,
        prompt,
        mediaCache
      });
      effectiveMedia = preprocessResult.media;
      if (preprocessResult.context) {
        soraContext = preprocessResult.context;
      }
      if (Array.isArray(preprocessResult.logs)) {
        preprocessResult.logs.forEach((entry) => logs.push(`[sora] ${entry}`));
      }
    }

    if (isSoraServerId(serverId)) {
      const initialMode = soraRemixInfo.isValid
        ? 'remix'
        : (effectiveMedia.length ? 'i2v' : 't2v');
      if (!soraContext) {
        soraContext = {
          mode: initialMode,
          model: normalizedSoraModel,
          size: normalizedSoraSizeKey
        };
      } else {
        if (!soraContext.mode) {
          soraContext.mode = initialMode;
        }
        if (!soraContext.model) {
          soraContext.model = normalizedSoraModel;
        }
        if (!soraContext.size) {
          soraContext.size = normalizedSoraSizeKey;
        }
      }
    }

    if (effectiveMedia.length) {
      const cache = mediaCache instanceof Map ? mediaCache : new Map();
      try {
        const { uploads, logs: mediaLogs } = await prepareMediaUploads(effectiveMedia, cache);
        mediaLogs.forEach((entry) => logs.push(`[media] ${entry}`));
        if (uploads.length) {
          const assigned = assignMediaParameters({
            submitArgs,
            schema: meta.tools.submit?.parameters,
            uploads
          });
          if (assigned.size) {
            logs.push(`[media] assigned parameters: ${Array.from(assigned).join(', ')}`);
          } else {
            logs.push('[media] warning: media uploaded but no parameters matched auto-assignment');
          }
          if (soraContext) {
            const primaryUpload = uploads[0];
            if (primaryUpload) {
              soraContext.inputReferenceUrl = primaryUpload.url;
              soraContext.upload = {
                url: primaryUpload.url,
                type: primaryUpload.type || '',
                index: Number.isFinite(primaryUpload.index) ? Number(primaryUpload.index) : 0
              };
              if (!submitArgs.input_reference || isEmptyValue(submitArgs.input_reference)) {
                submitArgs.input_reference = primaryUpload.url;
              }
            }
          }
        } else {
          logs.push('[media] warning: no media URLs produced after upload');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logs.push(`[media] error: ${message}`);
        throw new Error(`Media preparation failed: ${message}`);
      }
    }

    session = await createSession(meta.url);
    logs.push(`Session established: ${session.sessionId}`);

    let submitToolName = meta.tools.submit?.name || '';
    if (!submitToolName) {
      throw new Error(`Server ${serverId} does not provide a submit tool`);
    }

    let effectiveSubmitArgs = submitArgs;

    if (isSoraServerId(serverId) && soraRemixInfo.isValid) {
      const remixVideoId = soraRemixInfo.videoId;
      if (remixVideoId) {
        const remixToolEntry = Array.isArray(meta.tools.all)
          ? meta.tools.all.find((tool) => (
            tool
            && typeof tool.name === 'string'
            && tool.name.toLowerCase().includes('sora')
            && tool.name.toLowerCase().includes('remix')
          ))
          : null;

        const remixArgs = {
          prompt: (submitArgs.prompt && String(submitArgs.prompt).trim()) || prompt || '',
          video_id: remixVideoId
        };

        if (remixToolEntry && remixToolEntry.name) {
          submitToolName = remixToolEntry.name;
          effectiveSubmitArgs = remixArgs;
        } else {
          effectiveSubmitArgs = remixArgs;
        }

        if (!soraContext) {
          soraContext = {
            mode: 'remix',
            remixVideoId
          };
        } else {
          soraContext.mode = 'remix';
          if (!soraContext.remixVideoId) {
            soraContext.remixVideoId = remixVideoId;
          }
        }
      }
    } else if (isSoraServerId(serverId) && soraRemixInfo.hadCandidate && !soraRemixInfo.isValid) {
      logs.push('[sora] ignoring remix request: invalid video_id detected');
    }

    sanitizeUrlLikeFields(effectiveSubmitArgs);

    logs.push(`[submit.tool] ${submitToolName}`);
    logs.push(`[submit.request] ${formatArgsForLog(effectiveSubmitArgs)}`);

    const submitResult = await callTool(session, submitToolName, effectiveSubmitArgs);
    logs.push(`[submit] ${submitResult.text || '[no text]'}`);
    logs.push(`[submit.raw] ${formatJsonForLog(submitResult.raw)}`);

    requestId = extractRequestId(submitResult);
    if (!requestId) {
      logs.push('[error] submit response missing request id');
      console.error('[MCP Showcase] submit response missing request id', {
        serverId,
        submitRaw: submitResult.raw,
        content: submitResult.raw?.result?.content
      });
      throw new Error('Failed to obtain request ID from submit response');
    }
    if (soraContext) {
      soraContext.videoId = requestId;
    }

    const cancelToolMeta = meta.tools.cancel && meta.tools.cancel.name ? meta.tools.cancel : null;
    cancelState = {
      requested: false,
      reason: '',
      invoked: false,
      errors: [],
      deadlineAt: 0
    };

    const evaluateCancellationSignal = () => {
      if (typeof cancellationSignal !== 'function') return false;
      try {
        return Boolean(cancellationSignal());
      } catch (err) {
        logs.push(`[cancel] cancellation signal error: ${err.message || err}`);
        return false;
      }
    };

    const requestCancellation = async (reason = 'user') => {
      if (!cancelState.requested) {
        cancelState.requested = true;
        cancelState.reason = reason;
        logs.push(`[cancel] cancellation requested (${reason})`);
        cancelState.deadlineAt = Date.now() + CANCEL_GRACE_MS;
      } else if (!cancelState.reason) {
        cancelState.reason = reason;
      }
      if (!cancelState.deadlineAt) {
        cancelState.deadlineAt = Date.now() + CANCEL_GRACE_MS;
      }
      if (cancelState.invoked || !requestId) {
        return;
      }
      if (cancelToolMeta) {
        cancelState.invoked = true;
        try {
          const cancelArgs = { [requestKeyMap.cancel || 'request_id']: requestId };
          logs.push(`[cancel.request] ${formatArgsForLog(cancelArgs)}`);
          const cancelResult = await callTool(session, cancelToolMeta.name, cancelArgs);
          logs.push(`[cancel] cancel tool invoked (${cancelToolMeta.name}) -> ${cancelResult.text || '[no text]'}`);
          logs.push(`[cancel.raw] ${formatJsonForLog(cancelResult.raw)}`);
        } catch (err) {
          cancelState.errors.push(err);
          logs.push(`[cancel] cancel tool error (${cancelToolMeta.name}): ${err.message || err}`);
        }
      } else {
        cancelState.invoked = true;
        const err = new Error('cancel tool unavailable');
        cancelState.errors.push(err);
        logs.push('[cancel] cancellation requested but server does not expose a cancel tool');
      }
    };

    statusHistory = [];
    status = 'UNKNOWN';
    const pollStartedAt = Date.now();
    const normalizedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : MAX_WAIT_MS;
    const effectiveTimeoutMs = Math.max(normalizedTimeoutMs, pollIntervalMs * 2);
    const pollDeadline = pollStartedAt + effectiveTimeoutMs;
    const getCancelDeadline = () => (cancelState.deadlineAt || (pollDeadline + CANCEL_GRACE_MS));

    while (true) {
      const now = Date.now();

      if (!cancelState.requested && evaluateCancellationSignal()) {
        // eslint-disable-next-line no-await-in-loop
        await requestCancellation('user');
      }

      if (!cancelState.requested && now >= pollDeadline) {
        // eslint-disable-next-line no-await-in-loop
        await requestCancellation('timeout');
      }

      if (cancelState.requested && now >= getCancelDeadline()) {
        logs.push('[cancel] cancellation grace window expired; stopping status polling');
        break;
      }

      const statusKey = requestKeyMap.status || 'request_id';
      const statusArgs = { [statusKey]: requestId };
      logs.push(`[status.request] ${formatArgsForLog(statusArgs)}`);
      // eslint-disable-next-line no-await-in-loop
      const statusResult = await callTool(session, meta.tools.status.name, statusArgs);
      const statusText = statusResult.text || '[empty status]';
      statusHistory.push(statusText);
      logs.push(`[status] ${statusText}`);
      logs.push(`[status.raw] ${formatJsonForLog(statusResult.raw)}`);
      console.debug('[MCP Showcase] status poll', {
        serverId,
        statusText,
        raw: statusResult.raw,
        content: statusResult.raw?.result?.content
      });
      const parsedStatus = extractStatus(statusResult);
      if (parsedStatus) status = parsedStatus;
      if (SUCCESS_STATUS_SET.has(status)
        || FAILURE_STATUS_SET.has(status)
        || CANCELLED_STATUS_SET.has(status)) {
        break;
      }

      const afterPollNow = Date.now();
      if (!cancelState.requested && afterPollNow >= pollDeadline) {
        // eslint-disable-next-line no-await-in-loop
        await requestCancellation('timeout');
      }
      if (cancelState.requested && afterPollNow >= getCancelDeadline()) {
        logs.push('[cancel] cancellation grace window expired after poll; stopping status polling');
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(pollIntervalMs);
    }

    if (cancelState.requested) {
      const err = new Error(cancelState.reason === 'timeout'
        ? `Job timed out after ${effectiveTimeoutMs}ms (status=${status})`
        : 'Job cancelled by user');
      err.code = cancelState.reason === 'timeout' ? 'MCP_JOB_TIMEOUT' : 'MCP_JOB_CANCELLED';
      err.status = status;
      err.requestId = requestId;
      err.statusHistory = statusHistory;
      err.logs = logs;
      throw err;
    }

    if (FAILURE_STATUS_SET.has(status)) {
      console.error('[MCP Showcase] job did not complete', {
        serverId,
        status,
        statusHistory
      });
      const err = new Error(`Job did not complete successfully (status=${status})`);
      err.code = 'MCP_JOB_FAILED';
      err.status = status;
      err.requestId = requestId;
      err.statusHistory = statusHistory;
      err.logs = logs;
      throw err;
    }

    if (!SUCCESS_STATUS_SET.has(status)) {
      console.error('[MCP Showcase] job did not complete', {
        serverId,
        status,
        statusHistory
      });
      const err = new Error(`Job did not complete successfully (status=${status})`);
      err.status = status;
      err.requestId = requestId;
      err.statusHistory = statusHistory;
      err.logs = logs;
      throw err;
    }

    const resultKey = requestKeyMap.result || 'request_id';
    const resultArgs = { [resultKey]: requestId };
    logs.push(`[result.request] ${formatArgsForLog(resultArgs)}`);
    const resultCall = await callTool(session, meta.tools.result.name, resultArgs);
    logs.push(`[result] ${resultCall.text || '[no text]'}`);
    logs.push(`[result.raw] ${formatJsonForLog(resultCall.raw)}`);

    resultJson = extractJson(resultCall);
    if (soraContext && resultJson && typeof resultJson === 'object') {
      if (typeof resultJson.video_id === 'string') {
        soraContext.videoId = resultJson.video_id;
      }
      if (typeof resultJson.remix_video_id === 'string' && !soraContext.remixVideoId) {
        soraContext.remixVideoId = resultJson.remix_video_id;
      }
      if (resultJson.assets && typeof resultJson.assets === 'object') {
        soraContext.assets = resultJson.assets;
      }
      if (!soraContext.thumbnailUrl && typeof resultJson.thumbnail_url === 'string') {
        soraContext.thumbnailUrl = resultJson.thumbnail_url;
      }
    }
    const resultErrorMessage = extractResultErrorMessage(resultCall, resultJson);
    if (resultErrorMessage) {
      const error = new Error(resultErrorMessage);
      error.code = 'MCP_RESULT_ERROR';
      error.requestId = requestId;
      error.result = resultJson;
      error.statusHistory = statusHistory;
      throw error;
    }

    let urls = resultJson ? collectImageUrls(resultJson) : [];
    if (!urls.length) {
      const fallbackUrls = extractUrlsFromCallResult(resultCall);
      if (fallbackUrls.length) {
        urls = fallbackUrls;
        if (!resultJson) {
          resultJson = { images: fallbackUrls.map((url) => ({ url })) };
        }
      } else {
        console.error('[MCP Showcase] result JSON parse failed', {
          serverId,
          requestId,
          raw: resultCall.raw,
          content: resultCall.raw?.result?.content,
          text: resultCall.text
        });
        throw new Error('Failed to parse result JSON from result tool response');
      }
    }

    const engineKey = engineSegment(serverId);
    timestampSegment = formatTimestampSegment();
    const baseName = `${filePrefixSegment}_${timestampSegment}_${engineKey}`;
    const outputDir = OUTPUT_ROOT;

    savedFiles = [];
    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      const ext = guessExtensionFromUrl(url);
      const indexSuffix = urls.length > 1 ? `_${String(i + 1).padStart(2, '0')}` : '';
      const composedBase = `${baseName}${indexSuffix}`;
      // eslint-disable-next-line no-await-in-loop
      const { filename, absolutePath } = await reserveOutputPath(composedBase, ext, outputDir);
      try {
        // eslint-disable-next-line no-await-in-loop
        await downloadFile(url, absolutePath);
        const savedRecord = buildSavedFileRecord(absolutePath, {
          prefix: filePrefixSegment,
          engine: engineKey,
          timestamp: timestampSegment,
          index: i + 1,
          total: urls.length,
          requestId,
          ...(soraContext && soraContext.videoId ? { videoId: soraContext.videoId } : {}),
          ...(soraContext && soraContext.model ? { model: soraContext.model } : {}),
          ...(soraContext && soraContext.size ? { targetSize: soraContext.size } : {})
        });
        savedFiles.push(savedRecord);
        logs.push(`Saved file -> ${filename}`);
      } catch (err) {
        await fsPromises.unlink(absolutePath).catch(() => {});
        throw err;
      }
    }

    durationMs = Date.now() - startAt;
    completedAtIso = new Date().toISOString();
    logFile = await persistRunLog({
      serverId,
      prompt,
      filePrefix: filePrefixSegment,
      requestId,
      status,
      durationMs,
      savedFiles,
      logs,
      completedAt: completedAtIso
    });

    if (soraContext && soraContext.videoId && savedFiles.length) {
      try {
        await updateSoraVideoIndex(savedFiles, {
          ...soraContext,
          timestamp: completedAtIso
        });
      } catch (err) {
        console.warn('[MCP Showcase] failed to update Sora index', err);
      }
    }

    return {
      success: true,
      serverId,
      label: label || meta.description || serverId,
      prompt,
      filePrefix: filePrefixSegment,
      timestamp: timestampSegment,
      completedAt: completedAtIso,
      requestId,
      status,
      savedFiles,
      logs,
      logFile,
      durationMs,
      resultJson,
      statusHistory,
      sora: soraContext || null,
      meta: {
        submitTool: meta.tools.submit,
        statusTool: meta.tools.status,
        resultTool: meta.tools.result
      }
    };
  } catch (err) {
    durationMs = Date.now() - startAt;
    if (!completedAtIso) {
      completedAtIso = new Date().toISOString();
    }
    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : '';
    const fallbackStatus = normalizedStatus && normalizedStatus !== 'UNKNOWN' ? normalizedStatus : 'FAILED';
    const rawErrorStatus = err && typeof err.status === 'string' ? err.status : '';
    const normalizedErrorStatus = rawErrorStatus ? rawErrorStatus.toUpperCase() : '';
    const effectiveErrorStatus = normalizedErrorStatus && normalizedErrorStatus !== 'UNKNOWN'
      ? normalizedErrorStatus
      : '';
    let finalStatus = 'FAILED';
    if (effectiveErrorStatus) {
      finalStatus = effectiveErrorStatus;
    } else if (SUCCESS_STATUS_SET.has(fallbackStatus)
      || FAILURE_STATUS_SET.has(fallbackStatus)
      || CANCELLED_STATUS_SET.has(fallbackStatus)) {
      finalStatus = fallbackStatus;
    } else if (cancelState && cancelState.requested) {
      finalStatus = 'CANCELLED';
    }
    const errorRequestId = err && err.requestId ? err.requestId : requestId;

    if (err && err.message) {
      logs.push(`[error] ${err.message}`);
    }
    if (err && err.stack) {
      logs.push(`[error.stack] ${err.stack}`);
    }

    try {
      logFile = await persistRunLog({
        serverId,
        prompt,
        filePrefix: filePrefixSegment,
        requestId: errorRequestId,
        status: finalStatus,
        durationMs,
        savedFiles,
        logs,
        completedAt: completedAtIso
      });
    } catch (persistErr) {
      console.error('[MCP Showcase] failed to persist run log (error path)', persistErr);
    }

    if (err && typeof err === 'object') {
      if (!err.requestId && errorRequestId) {
        err.requestId = errorRequestId;
      }
      if (!err.status && finalStatus) {
        err.status = finalStatus;
      }
      if (!err.logs) {
        err.logs = logs;
      }
      if (!err.statusHistory && statusHistory.length) {
        err.statusHistory = statusHistory;
      }
      if (!err.logFile && logFile) {
        err.logFile = logFile;
      }
      if (soraContext && !err.soraContext) {
        err.soraContext = soraContext;
      }
    }

    throw err;
  }
}

module.exports = {
  runMcpJob,
  OUTPUT_ROOT,
  LOG_DIR
};
