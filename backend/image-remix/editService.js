const path = require('path');
const fsPromises = require('fs').promises;
const { ensureWithinScanPath, runPythonUpload } = require('../services/mediaUpload');
const { createSession, callTool } = require('./mcpClient');
const { reserveOutputPath } = require('./dataService');
const { ENGINE_DEFS, BASE_URL, IMAGE_REMIX_LOG_DIR, POLL_INTERVAL_MS, MAX_WAIT_MS } = require('./config');

/**
 * Markdownをストリップ
 */
function stripMarkdown(text) {
    return text.replace(/\*+/g, '').replace(/`+/g, '');
}

/**
 * Content-Typeから拡張子を推測
 */
function guessExtensionFromContentType(contentType) {
    if (!contentType || typeof contentType !== 'string') return '';
    const lower = contentType.toLowerCase();
    if (lower.includes('png')) return '.png';
    if (lower.includes('jpeg')) return '.jpg';
    if (lower.includes('webp')) return '.webp';
    if (lower.includes('gif')) return '.gif';
    return '';
}

/**
 * 画像オブジェクトから拡張子を推測
 */
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

/**
 * JSONフラグメントをパース
 */
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

/**
 * テキストからリクエストIDを抽出
 */
function extractRequestId(text) {
    const cleaned = stripMarkdown(text);
    const jsonCandidate = parseJsonFragment(cleaned);
    if (jsonCandidate && typeof jsonCandidate.request_id === 'string') {
        return jsonCandidate.request_id;
    }
    const match = cleaned.match(/Request ID:\s*([0-9a-fA-F-]{6,})/i);
    return match ? match[1].trim() : '';
}

/**
 * テキストからステータスを抽出
 */
function extractStatus(text) {
    const cleaned = stripMarkdown(text);
    const jsonCandidate = parseJsonFragment(cleaned);
    if (jsonCandidate && typeof jsonCandidate.status === 'string') {
        return jsonCandidate.status.toUpperCase();
    }
    const match = cleaned.match(/Status:\s*([A-Za-z_]+)/i);
    return match ? match[1].toUpperCase() : '';
}

/**
 * コードブロックからJSONを抽出
 */
function extractJson(text) {
    const match = text.match(/```json\n([\s\S]+?)```/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (err) {
        return null;
    }
}

/**
 * 実行ログを永続化
 */
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

/**
 * 画像をダウンロード
 */
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

/**
 * 画像編集を実行
 */
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
    const intervalMs = POLL_INTERVAL_MS;
    const maxWaitMs = MAX_WAIT_MS;
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
