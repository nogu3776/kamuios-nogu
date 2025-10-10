#!/usr/bin/env node
/**
 * 開発用ユーティリティ: MCP サーバーへ initialize を送り、
 * 利用可能なツールとパラメータ構造をダンプする。
 *
 * 使用例:
 *   node backend/scripts/inspectMcpTools.js t2i-kamui-imagen4-fast t2i-kamui-dreamina-v31
 * 引数がない場合は Imagen4 Fast / Dreamina v3.1 / Flux Krea LoRA を対象にする。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function loadDotEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

loadDotEnv();

const ENV_CONFIG_PATH = process.env.KAMUI_CODE_MCP_CONFIG_PATH;
const DEFAULT_CONFIG_PATH = (() => {
  if (ENV_CONFIG_PATH) return ENV_CONFIG_PATH;
  const candidates = [
    path.join(PROJECT_ROOT, 'mcp', 'mcp-kamui-code_local.json'),
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

function loadConfig(configPath) {
  const resolved = path.resolve(configPath);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

async function initializeServer(serverUrl) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) {
    headers['Authorization'] = AUTH_TOKEN.startsWith('Bearer ')
      ? AUTH_TOKEN
      : `Bearer ${AUTH_TOKEN}`;
  }

  const body = {
    jsonrpc: '2.0',
    id: 'inspect-init',
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'kamui-code-showcase-inspector',
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
    throw new Error(`initialize response JSON parse error: ${err.message}`);
  }

  if (!json.result) {
    throw new Error(`initialize did not return result: ${text}`);
  }
  const sessionId = res.headers.get('mcp-session-id');
  if (!sessionId) {
    throw new Error('initialize response missing mcp-session-id header');
  }
  return { result: json.result, sessionId, headers: buildSessionHeaders(sessionId) };
}

function buildSessionHeaders(sessionId) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) {
    headers['Authorization'] = AUTH_TOKEN.startsWith('Bearer ')
      ? AUTH_TOKEN
      : `Bearer ${AUTH_TOKEN}`;
  }
  headers['Mcp-Session-Id'] = sessionId;
  headers['MCP-Protocol-Version'] = PROTOCOL_VERSION;
  return headers;
}

async function callRpc(serverUrl, headers, method, params = {}) {
  const body = {
    jsonrpc: '2.0',
    id: `inspect-${method}`,
    method,
    params
  };
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers,
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
    throw new Error(`${method} response JSON parse error: ${err.message}`);
  }
  if (json.error) {
    throw new Error(`${method} error: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

function summariseParameters(parameters = {}) {
  const required = Array.isArray(parameters.required) ? parameters.required : [];
  const props = parameters.properties && typeof parameters.properties === 'object'
    ? parameters.properties
    : {};
  const lines = [];
  for (const [name, schema] of Object.entries(props)) {
    const flag = required.includes(name) ? '[req]' : '     ';
    const type = Array.isArray(schema.type) ? schema.type.join('|') : schema.type || 'unknown';
    const desc = schema.description ? schema.description.replace(/\s+/g, ' ').trim() : '';
    lines.push(`    ${flag} ${name}: ${type}${desc ? ' // ' + desc : ''}`);
  }
  if (!lines.length) {
    lines.push('    (no parameters)');
  }
  return lines.join('\n');
}

async function inspectServer(name, entry) {
  if (!entry || !entry.url) {
    console.warn(`- ${name}: URL が設定されていません`);
    return;
  }

  console.log(`\n=== ${name} ===`);
  console.log(`Endpoint: ${entry.url}`);
  if (entry.description) {
    console.log(`Description: ${entry.description}`);
  }

  try {
    const { result: initResult, sessionId, headers } = await initializeServer(entry.url);
    const listResult = await callRpc(entry.url, headers, 'tools/list');
    const tools = Array.isArray(listResult.tools) ? listResult.tools : [];
    console.log(`Tools (${tools.length}):`);
    tools.forEach((tool) => {
      console.log(`  - ${tool.name}`);
      if (tool.description) {
        console.log(`    desc: ${tool.description.replace(/\s+/g, ' ').trim()}`);
      }
      const schema = tool.parameters || tool.inputSchema;
      if (schema) {
        console.log(summariseParameters(schema));
      }
    });
  } catch (err) {
    console.error(`  [error] ${err.message}`);
  }
}

async function main() {
  const config = loadConfig(DEFAULT_CONFIG_PATH);
  const targets = process.argv.slice(2);
  const names = targets.length
    ? targets
    : [
        't2i-kamui-imagen4-fast',
        't2i-kamui-dreamina-v31',
        't2i-kamui-flux-krea-lora'
      ];

  for (const name of names) {
    const entry = config.mcpServers?.[name];
    if (!entry) {
      console.warn(`- ${name}: mcpServers に存在しません`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await inspectServer(name, entry);
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exitCode = 1;
});
