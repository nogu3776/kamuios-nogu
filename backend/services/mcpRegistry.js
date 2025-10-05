const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ENV_CONFIG_PATH = process.env.KAMUI_CODE_CONFIG_PATH;
const DEFAULT_CONFIG_PATH = (() => {
  if (ENV_CONFIG_PATH) return ENV_CONFIG_PATH;
  const candidates = [
    path.join(PROJECT_ROOT, 'mcp', 'mcp-kamui-code.json')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
})();
const PROTOCOL_VERSION = process.env.KAMUI_CODE_PROTOCOL_VERSION || '2025-06-18';
const AUTH_TOKEN = process.env.KAMUI_CODE_AUTH_TOKEN || '';
const CACHE_TTL_MS = Number.parseInt(process.env.MCP_META_CACHE_TTL_MS || '600000', 10);

let configCache = null;
let configMtimeMs = 0;

const serverMetaCache = new Map(); // serverId -> { expiresAt, meta }

function loadConfig() {
  const configPath = DEFAULT_CONFIG_PATH;
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`MCP config file not found: ${resolved}`);
  }
  const stats = fs.statSync(resolved);
  if (!configCache || stats.mtimeMs !== configMtimeMs) {
    const raw = fs.readFileSync(resolved, 'utf8');
    try {
      configCache = JSON.parse(raw);
      configMtimeMs = stats.mtimeMs;
    } catch (err) {
      throw new Error(`Failed to parse MCP config JSON (${resolved}): ${err.message}`);
    }
  }
  return configCache;
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
    const entry = entries[id];
    // httpタイプのMCPサーバーのみ処理
    if (entry.type !== 'http') return false;
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

module.exports = {
  getServerMeta,
  listServers,
  listCategories,
  refreshServer,
  refreshAll,
  getConfigSummary,
  DEFAULT_CONFIG_PATH
};
