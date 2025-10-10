const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const crypto = require('crypto');
const { ensureWithinScanPath, runPythonUpload } = require('./mediaUpload');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PROTOCOL_VERSION = process.env.KAMUI_CODE_PROTOCOL_VERSION || '2025-06-18';
const BASE_URL = process.env.KAMUI_CODE_BASE_URL || 'https://kamui-code.ai';
const AUTH_TOKEN = process.env.KAMUI_CODE_AUTH_TOKEN || '';
const IMAGE_REMIX_LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'image-remix');
const IMAGE_REMIX_STATE_PATH = path.join(IMAGE_REMIX_LOG_DIR, 'version-cache.json');

let versionState = {};
let versionStateLoaded = false;

async function loadVersionState() {
    if (versionStateLoaded) return versionState;
    try {
        const raw = await fsPromises.readFile(IMAGE_REMIX_STATE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        versionState = parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        versionState = {};
    }
    versionStateLoaded = true;
    return versionState;
}

async function saveVersionState() {
    if (!versionStateLoaded) return;
    await fsPromises.mkdir(IMAGE_REMIX_LOG_DIR, { recursive: true });
    await fsPromises.writeFile(IMAGE_REMIX_STATE_PATH, JSON.stringify(versionState, null, 2), 'utf8');
}

function versionStateKey(sourceDir, rootName) {
    return `${path.resolve(sourceDir)}::${rootName}`;
}

const ENGINE_DEFS = {
    'nano-banana': {
        serverPath: '/i2i/fal/nano-banana/edit',
        tools: {
            submit: 'nano_banana_edit_submit',
            status: 'nano_banana_edit_status',
            result: 'nano_banana_edit_result'
        }
    },
    'seedream': {
        serverPath: '/i2i/fal/bytedance/seedream/v4',
        tools: {
            submit: 'bytedance_seedream_v4_edit_submit',
            status: 'bytedance_seedream_v4_edit_status',
            result: 'bytedance_seedream_v4_edit_result'
        }
    }
};

async function createSession(serverUrl) {
    const headers = { 'Content-Type': 'application/json' };
    if (AUTH_TOKEN) headers['Authorization'] = AUTH_TOKEN.startsWith('Bearer ')
        ? AUTH_TOKEN
        : `Bearer ${AUTH_TOKEN}`;

    const initPayload = {
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
                name: process.env.KAMUI_CODE_CLIENT_NAME || 'kamuios-image-remix',
                version: '1.0.0'
            }
        }
    };

    const res = await fetch(serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(initPayload)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to initialize MCP session (${res.status}): ${text}`);
    }

    const sessionId = res.headers.get('mcp-session-id');
    if (!sessionId) {
        throw new Error('MCP session id was not provided by the server');
    }

    return {
        serverUrl,
        headers,
        sessionId
    };
}

async function callTool(session, toolName, args) {
    const headers = {
        ...session.headers,
        'Mcp-Session-Id': session.sessionId,
        'MCP-Protocol-Version': PROTOCOL_VERSION
    };

    const body = {
        jsonrpc: '2.0',
        id: `call-${toolName}`,
        method: 'tools/call',
        params: {
            name: toolName,
            arguments: args
        }
    };

    const res = await fetch(session.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`MCP tool call failed (${res.status}): ${text}`);
    }

    let json;
    try {
        json = JSON.parse(text);
    } catch (err) {
        throw new Error(`Failed to parse MCP response JSON: ${err.message}`);
    }

    if (json.error) {
        throw new Error(`MCP error: ${json.error.message || 'Unknown error'}`);
    }

    const content = Array.isArray(json.result?.content)
        ? json.result.content.map((item) => (item.text || '')).join('\n')
        : '';

    return {
        raw: json,
        text: content
    };
}

function stripMarkdown(text) {
    return text.replace(/\*+/g, '').replace(/`+/g, '');
}

function guessExtensionFromContentType(contentType) {
    if (!contentType || typeof contentType !== 'string') return '';
    const lower = contentType.toLowerCase();
    if (lower.includes('png')) return '.png';
    if (lower.includes('jpeg')) return '.jpg';
    if (lower.includes('webp')) return '.webp';
    if (lower.includes('gif')) return '.gif';
    return '';
}

function guessImageExtension(image) {
    if (!image) return '.png';
    if (typeof image.file_name === 'string') {
        const ext = path.extname(image.file_name);
        if (ext) return ext.toLowerCase();
    }
    if (typeof image.url === 'string') {
        try {
            const url = new URL(image.url);
            const extFromUrl = path.extname(url.pathname);
            if (extFromUrl) return extFromUrl.toLowerCase();
        } catch (_) {
            // ignore invalid URL
        }
    }
    if (image.content_type) {
        const ext = guessExtensionFromContentType(image.content_type);
        if (ext) return ext;
    }
    return '.png';
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
}

function deriveRootNaming(baseName) {
    let candidate = baseName || 'image';
    const legacyMatch = candidate.match(/^(.*)__[a-z0-9-]+__\d{8,}$/i);
    if (legacyMatch && legacyMatch[1]) {
        candidate = legacyMatch[1];
    }

    let separator = '_';
    let detectedVersion = 1;

    const versionMatch = candidate.match(/^(.*?)([_-]?)[vV](\d+)$/);
    if (versionMatch) {
        candidate = versionMatch[1];
        separator = versionMatch[2] || '_';
        detectedVersion = Number.parseInt(versionMatch[3], 10) || 1;
    }

    candidate = candidate.replace(/[_-]+$/, '');
    if (!candidate) {
        candidate = baseName.replace(/[_-]+$/, '') || 'image';
    }
    if (candidate.length > 120) {
        candidate = candidate.slice(0, 120).trim();
    }
    if (!candidate) {
        candidate = 'image';
    }
    if (!separator) separator = '_';

    return { rootName: candidate, separator, detectedVersion: Math.max(detectedVersion, 1) };
}

async function reserveOutputPath(baseName, ext, sourceDir) {
    const normalizedExt = (ext && ext.startsWith('.')) ? ext : `.${ext || 'png'}`;
    const { rootName, separator, detectedVersion } = deriveRootNaming(baseName);
    const joiner = separator || '_';

    const cache = await loadVersionState();
    const stateKey = versionStateKey(sourceDir, rootName);

    let highestVersion = detectedVersion;
    if (fs.existsSync(sourceDir)) {
        const entries = await fsPromises.readdir(sourceDir);
        const versionRegex = new RegExp(`^${escapeRegExp(rootName)}(?:[_-]?)[vV](\\d+)$`, 'i');
        for (const file of entries) {
            const stem = path.basename(file, path.extname(file));
            const match = stem.match(versionRegex);
            if (match) {
                const parsed = Number.parseInt(match[1], 10);
                if (Number.isFinite(parsed) && parsed > highestVersion) {
                    highestVersion = parsed;
                }
            }
        }
    }
    if (cache && Number.isFinite(cache[stateKey])) {
        highestVersion = Math.max(highestVersion, Number(cache[stateKey]));
    }

    let candidateVersion = Math.max(highestVersion + 1, detectedVersion + 1, 2);
    const buildName = (version) => `${rootName}${joiner ? joiner : ''}v${version}${normalizedExt}`;

    for (let attempts = 0; attempts < 1000; attempts += 1) {
        const candidateName = buildName(candidateVersion);
        const absolutePath = path.join(sourceDir, candidateName);
        try {
            const handle = await fsPromises.open(absolutePath, 'wx');
            await handle.close();
            versionState[stateKey] = candidateVersion;
            await saveVersionState();
            return { filename: candidateName, absolutePath, version: candidateVersion };
        } catch (err) {
            if (err && (err.code === 'EEXIST' || err.code === 'EISDIR')) {
                candidateVersion += 1;
                continue;
            }
            throw err;
        }
    }

    throw new Error('Failed to reserve unique filename for remix output');
}

async function persistRunLog({ engine, prompt, sourcePath, requestId, status, durationMs, savedFiles, logs }) {
    try {
        await fsPromises.mkdir(IMAGE_REMIX_LOG_DIR, { recursive: true });
        const timestamp = new Date().toISOString();
        const day = timestamp.slice(0, 10);
        const logPath = path.join(IMAGE_REMIX_LOG_DIR, `${day}.log`);

        const lines = [];
        lines.push('---');
        lines.push(`timestamp: ${timestamp}`);
        lines.push(`engine: ${engine || ''}`);
        lines.push(`prompt: ${prompt || ''}`);
        lines.push(`source: ${sourcePath || ''}`);
        lines.push(`requestId: ${requestId || ''}`);
        lines.push(`status: ${status || ''}`);
        lines.push(`durationMs: ${Number.isFinite(durationMs) ? durationMs : ''}`);
        if (Array.isArray(savedFiles) && savedFiles.length) {
            lines.push('savedFiles:');
            savedFiles.forEach((file) => {
                if (!file) return;
                const target = file.absolute || file.webPath || file.relative || '';
                lines.push(`  - ${target}`);
            });
        } else {
            lines.push('savedFiles: []');
        }
        lines.push('logs:');
        (Array.isArray(logs) ? logs : []).forEach((entry) => {
            lines.push(`  - ${String(entry)}`);
        });
        lines.push('');

        await fsPromises.appendFile(logPath, `${lines.join('\n')}`, 'utf8');
        return logPath;
    } catch (err) {
        console.error('[ImageRemix] failed to persist run log', err);
        return null;
    }
}

async function downloadImageTo(url, destinationPath) {
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to download image (${res.status}): ${text}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    await fsPromises.mkdir(path.dirname(destinationPath), { recursive: true });
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

function extractRequestId(text) {
    const cleaned = stripMarkdown(text);
    const jsonCandidate = parseJsonFragment(cleaned);
    if (jsonCandidate && typeof jsonCandidate.request_id === 'string') {
        return jsonCandidate.request_id;
    }
    const match = cleaned.match(/Request ID:\s*([0-9a-fA-F-]{6,})/i);
    return match ? match[1].trim() : '';
}

function extractStatus(text) {
    const cleaned = stripMarkdown(text);
    const jsonCandidate = parseJsonFragment(cleaned);
    if (jsonCandidate && typeof jsonCandidate.status === 'string') {
        return jsonCandidate.status.toUpperCase();
    }
    const match = cleaned.match(/Status:\s*([A-Za-z_]+)/i);
    return match ? match[1].toUpperCase() : '';
}

function extractJson(text) {
    const match = text.match(/```json\n([\s\S]+?)```/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (err) {
        return null;
    }
}

async function runImageEdit({ engine, prompt, sourcePath, options = {} }) {
    if (!ENGINE_DEFS[engine]) {
        throw new Error(`Unsupported engine: ${engine}`);
    }
    if (!prompt || !prompt.trim()) {
        throw new Error('Prompt is required');
    }
    if (!sourcePath) {
        throw new Error('sourcePath is required');
    }

    const startAt = Date.now();
    const logs = [];
    const engineDef = ENGINE_DEFS[engine];
    const serverUrl = `${BASE_URL}${engineDef.serverPath}`;

    const absoluteSource = ensureWithinScanPath(sourcePath);
    logs.push(`Source: ${absoluteSource}`);

    const upload = await runPythonUpload(absoluteSource);
    logs.push(`Upload URL: ${upload.url}`);

    const session = await createSession(serverUrl);
    logs.push(`MCP session established: ${session.sessionId}`);

    const submitPayload = {
        prompt,
        image_urls: Array.isArray(options.image_urls) ? options.image_urls : [upload.url]
    };

    if (options.num_images && Number.isFinite(Number(options.num_images))) {
        submitPayload.num_images = Number(options.num_images);
    }
    if (options.image_size) submitPayload.image_size = options.image_size;
    if (options.seed !== undefined) submitPayload.seed = options.seed;
    if (options.sync_mode !== undefined) submitPayload.sync_mode = options.sync_mode;

    const submit = await callTool(session, engineDef.tools.submit, submitPayload);
    logs.push(submit.text.trim());
    const requestId = extractRequestId(submit.text);
    if (!requestId) {
        throw new Error('Failed to obtain request ID from submit response');
    }

    let status = 'UNKNOWN';
    let statusText = '';
    const pollLogs = [];
    const intervalMs = Number.parseInt(process.env.IMAGE_REMIX_POLL_INTERVAL_MS || '4000', 10);
    const maxWaitMs = Number.parseInt(process.env.IMAGE_REMIX_MAX_WAIT_MS || '180000', 10);
    const pollStartedAt = Date.now();
    const pollDeadline = pollStartedAt + Math.max(maxWaitMs, intervalMs * 2);

    while (Date.now() < pollDeadline) {
        const statusResp = await callTool(session, engineDef.tools.status, { request_id: requestId });
        statusText = statusResp.text.trim();
        const parsedStatus = extractStatus(statusText);
        pollLogs.push(statusText);
        status = parsedStatus || status;
        if (status === 'COMPLETED' || status === 'FAILED' || status === 'NOT_FOUND' || status === 'CANCELLED') {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    logs.push('--- Status history ---');
    logs.push(...pollLogs);

    if (status !== 'COMPLETED') {
        const waitedMs = Math.max(0, Date.now() - pollStartedAt);
        if (status === 'IN_PROGRESS') {
            throw new Error(`Image edit is still in progress after waiting ${Math.round(waitedMs / 1000)}s`);
        }
        throw new Error(`Image edit did not complete successfully (status=${status})`);
    }

    const resultResp = await callTool(session, engineDef.tools.result, { request_id: requestId });
    logs.push(resultResp.text.trim());
    let resultJson = extractJson(resultResp.text);
    if (!resultJson) {
        const jsonCandidate = parseJsonFragment(resultResp.text);
        if (jsonCandidate && Array.isArray(jsonCandidate.images)) {
            resultJson = jsonCandidate;
        }
    }
    if (!resultJson || !Array.isArray(resultJson.images)) {
        throw new Error('Result JSON could not be parsed from MCP response');
    }

    const durationMs = Date.now() - startAt;

    const savedFiles = [];
    const scanBase = process.env.SCAN_PATH ? path.resolve(process.env.SCAN_PATH) : null;
    const sourceDir = path.dirname(absoluteSource);
    const baseName = path.basename(absoluteSource, path.extname(absoluteSource));

    for (let i = 0; i < resultJson.images.length; i += 1) {
        const image = resultJson.images[i];
        const ext = guessImageExtension(image);
        const { filename, absolutePath } = await reserveOutputPath(baseName, ext, sourceDir);
        try {
            await downloadImageTo(image.url, absolutePath);
        } catch (downloadErr) {
            await fsPromises.unlink(absolutePath).catch(() => {});
            throw downloadErr;
        }
        const relativeOutput = scanBase ? path.relative(scanBase, absolutePath) : '';
        const relativePosix = relativeOutput ? relativeOutput.split(path.sep).join('/') : '';
        const fileName = path.basename(absolutePath);
        savedFiles.push({
            absolute: absolutePath,
            relative: relativeOutput || null,
            webPath: relativePosix || null,
            fileName
        });
        logs.push(`Saved image -> ${fileName}`);
    }

    const logFilePath = await persistRunLog({
        engine,
        prompt,
        sourcePath: absoluteSource,
        requestId,
        status,
        durationMs,
        savedFiles,
        logs: Array.isArray(logs) ? [...logs] : []
    });
    if (logFilePath) {
        logs.push(`Run log saved -> ${logFilePath}`);
    }

    return {
        success: true,
        engine,
        prompt,
        source: {
            path: sourcePath,
            absolute: absoluteSource
        },
        uploadUrl: upload.url,
        requestId,
        status,
        images: resultJson.images,
        rawResult: resultJson,
        savedFiles,
        logs,
        durationMs,
        logFile: logFilePath
    };
}

module.exports = {
    runImageEdit
};
