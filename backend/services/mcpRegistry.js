const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MCP_DIRECTORY = path.join(PROJECT_ROOT, 'mcp');
const ENV_CONFIG_PATH = process.env.KAMUI_CODE_MCP_CONFIG_PATH;
const DEFAULT_CONFIG_CANDIDATES = [
  ENV_CONFIG_PATH,
  path.join(MCP_DIRECTORY, 'mcp-kamui-code_local.json'),
  path.join(MCP_DIRECTORY, 'mcp-kamui-code.json')
].filter(Boolean);

const DEFAULT_CONFIG_PATH = (() => {
  for (const candidate of DEFAULT_CONFIG_CANDIDATES) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return DEFAULT_CONFIG_CANDIDATES.find(Boolean) || '';
})();

const PROTOCOL_VERSION = process.env.KAMUI_CODE_PROTOCOL_VERSION || '2025-06-18';
const AUTH_TOKEN = process.env.KAMUI_CODE_AUTH_TOKEN || '';
const CACHE_TTL_MS = Number.parseInt(process.env.MCP_META_CACHE_TTL_MS || '600000', 10);
const MCP_BASE_URL = (process.env.MCP_BASE_URL || process.env.KAMUI_CODE_BASE_URL || '').trim();

const configCacheByFile = new Map();
let activeConfigFiles = (() => {
  const initial = [];
  if (DEFAULT_CONFIG_PATH && fs.existsSync(DEFAULT_CONFIG_PATH)) {
    initial.push(path.resolve(DEFAULT_CONFIG_PATH));
  }
  return initial;
})();

const serverMetaCache = new Map(); // serverId -> { expiresAt, meta }

function resolveConfigPath(candidate) {
  if (!candidate || typeof candidate !== 'string') return '';
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(MCP_DIRECTORY, candidate);
  if (!resolved.startsWith(MCP_DIRECTORY)) {
    return '';
  }
  return resolved;
}

function readConfigFile(filePath) {
  if (!filePath) return { mcpServers: {} };
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return { mcpServers: {} };
  }
  const stats = fs.statSync(resolved);
  const cached = configCacheByFile.get(resolved);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached.data;
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse MCP config JSON (${resolved}): ${err.message}`);
  }
  configCacheByFile.set(resolved, {
    data: parsed,
    mtimeMs: stats.mtimeMs
  });
  return parsed;
}

function loadConfig() {
  if (!Array.isArray(activeConfigFiles) || activeConfigFiles.length === 0) {
    return { mcpServers: {} };
  }
  const aggregated = { mcpServers: {} };
  activeConfigFiles.forEach((filePath) => {
    try {
      const data = readConfigFile(filePath);
      const servers = data?.mcpServers && typeof data.mcpServers === 'object'
        ? data.mcpServers
        : {};
      Object.entries(servers).forEach(([id, entry]) => {
        if (!id) return;
        aggregated.mcpServers[id] = resolveEntryUrls(entry);
      });
    } catch (err) {
      console.error('[MCP] config load error', err);
    }
  });
  return aggregated;
}

function resolvePlaceholder(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('{BASE_URL}')) return url;
  if (!MCP_BASE_URL) {
    throw new Error('MCP_BASE_URL is required to resolve MCP configuration placeholders');
  }
  return url.replace('{BASE_URL}', MCP_BASE_URL);
}

function resolveEntryUrls(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const resolved = { ...entry };
  if (resolved.url) {
    resolved.url = resolvePlaceholder(resolved.url);
  }
  if (resolved.endpoint) {
    resolved.endpoint = resolvePlaceholder(resolved.endpoint);
  }
  if (resolved.command) {
    resolved.command = resolvePlaceholder(resolved.command);
  }
  return resolved;
}

function deriveCategory(serverId) {
  if (!serverId || typeof serverId !== 'string') return 'unknown';
  const idx = serverId.indexOf('-');
  return idx === -1 ? serverId : serverId.slice(0, idx);
}

function normalizeSchema(schema) {
  if (!schema) return null;
  if (schema.parameters || schema.inputSchema) {
    return normalizeSchema(schema.parameters || schema.inputSchema);
  }
  return schema;
}

function enrichTool(tool) {
  if (!tool) return null;
  return {
    name: tool.name,
    description: tool.description || '',
    parameters: normalizeSchema(tool.parameters || tool.inputSchema || null)
  };
}

function classifyTools(tools) {
  const result = {
    submit: null,
    status: null,
    result: null,
    cancel: null,
    others: [],
    all: []
  };
  tools.forEach((tool) => {
    if (!tool || !tool.name) return;
    const entry = enrichTool(tool);
    result.all.push(entry);
    const lower = tool.name.toLowerCase();
    if (!result.submit && lower.includes('submit')) {
      result.submit = entry;
    } else if (!result.status && lower.includes('status')) {
      result.status = entry;
    } else if (!result.result && lower.includes('result')) {
      result.result = entry;
    } else if (!result.cancel && (lower.includes('cancel') || lower.includes('abort') || lower.includes('stop'))) {
      result.cancel = entry;
    } else {
      result.others.push(entry);
    }
  });
  return result;
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) {
    headers.Authorization = AUTH_TOKEN.startsWith('Bearer ')
      ? AUTH_TOKEN
      : `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

async function initializeServer(serverUrl) {
  const body = {
    jsonrpc: '2.0',
    id: 'registry-init',
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'kamui-code-showcase-registry',
        version: '0.1.0'
      }
    }
  };

  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: authHeaders(),
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

  const headers = authHeaders();
  headers['Mcp-Session-Id'] = sessionId;
  headers['MCP-Protocol-Version'] = PROTOCOL_VERSION;

  return {
    init: json.result,
    session: {
      serverUrl,
      headers,
      sessionId
    }
  };
}

async function callRpc(session, method, params = {}) {
  const body = {
    jsonrpc: '2.0',
    id: `registry-${method}`,
    method,
    params
  };
  const res = await fetch(session.serverUrl, {
    method: 'POST',
    headers: session.headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} failed (${res.status}): ${text}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`${method} JSON parse error: ${err.message}`);
  }
  if (json.error) {
    throw new Error(`${method} error: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

async function inspectServer(serverId, entry) {
  const { init, session } = await initializeServer(entry.url);
  const listResult = await callRpc(session, 'tools/list');
  const tools = Array.isArray(listResult?.tools) ? listResult.tools : [];
  const classified = classifyTools(tools);
  return {
    id: serverId,
    category: deriveCategory(serverId),
    url: entry.url,
    description: entry.description || '',
    tools: classified,
    raw: {
      init,
      tools
    }
  };
}

async function getServerMeta(serverId, { forceRefresh = false } = {}) {
  const config = loadConfig();
  const entry = config.mcpServers?.[serverId];
  if (!entry) {
    throw new Error(`Unknown MCP server id: ${serverId}`);
  }

  if (!forceRefresh) {
    const cached = serverMetaCache.get(serverId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.meta;
    }
  }

  const meta = await inspectServer(serverId, entry);
  serverMetaCache.set(serverId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    meta
  });
  return meta;
}

async function listServers({ category = null, forceRefresh = false } = {}) {
  const config = loadConfig();
  const entries = config.mcpServers || {};
  const ids = Object.keys(entries).filter((id) => {
    if (!category) return true;
    return deriveCategory(id) === category;
  });
  const result = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const meta = await getServerMeta(id, { forceRefresh });
    result.push(meta);
  }
  return {
    category: category || null,
    servers: result
  };
}

function listCategories() {
  const config = loadConfig();
  const entries = config.mcpServers || {};
  const categories = new Set();
  Object.keys(entries).forEach((id) => {
    categories.add(deriveCategory(id));
  });
  return Array.from(categories).sort();
}

function refreshServer(serverId) {
  serverMetaCache.delete(serverId);
}

function refreshAll() {
  serverMetaCache.clear();
}

function getConfigSummary() {
  const config = loadConfig();
  const entries = config.mcpServers || {};
  return Object.entries(entries).map(([id, entry]) => ({
    id,
    url: entry.url,
    description: entry.description || '',
    category: deriveCategory(id)
  }));
}

function listConfigFiles() {
  if (!fs.existsSync(MCP_DIRECTORY)) {
    return [];
  }
  const files = fs.readdirSync(MCP_DIRECTORY)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'ja'));
  return files.map((fileName) => {
    const absolutePath = path.join(MCP_DIRECTORY, fileName);
    let stats = null;
    try {
      stats = fs.statSync(absolutePath);
    } catch (err) {
      stats = null;
    }
    return {
      fileName,
      relativePath: path.relative(PROJECT_ROOT, absolutePath),
      absolutePath,
      size: stats ? stats.size : 0,
      mtimeMs: stats ? stats.mtimeMs : 0,
      active: activeConfigFiles.some((entry) => entry === absolutePath)
    };
  });
}

function getActiveConfigFiles() {
  return Array.isArray(activeConfigFiles) ? activeConfigFiles.slice() : [];
}

function setActiveConfigFiles(fileNames = []) {
  const nextFiles = [];
  const seen = new Set();
  (Array.isArray(fileNames) ? fileNames : []).forEach((candidate) => {
    if (typeof candidate !== 'string' || !candidate.trim()) return;
    const resolved = resolveConfigPath(candidate.trim());
    if (!resolved) return;
    if (!fs.existsSync(resolved)) {
      console.warn(`[MCP] config file not found: ${resolved}`);
      return;
    }
    if (seen.has(resolved)) return;
    seen.add(resolved);
    nextFiles.push(resolved);
  });

  activeConfigFiles = nextFiles;
  configCacheByFile.clear();
  refreshAll();
  return getActiveConfigFiles();
}

module.exports = {
  getServerMeta,
  listServers,
  listCategories,
  refreshServer,
  refreshAll,
  getConfigSummary,
  DEFAULT_CONFIG_PATH,
  MCP_DIRECTORY,
  listConfigFiles,
  getActiveConfigFiles,
  setActiveConfigFiles
};
