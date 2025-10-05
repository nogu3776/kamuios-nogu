const fs = require('fs');
const path = require('path');
const fsPromises = fs.promises;
const { IMAGE_REMIX_LOG_DIR, IMAGE_REMIX_STATE_PATH } = require('./config');

let versionState = {};
let versionStateLoaded = false;

/**
 * バージョン状態をファイルから読み込み
 */
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

/**
 * バージョン状態をファイルに保存
 */
async function saveVersionState() {
    if (!versionStateLoaded) return;
    await fsPromises.mkdir(IMAGE_REMIX_LOG_DIR, { recursive: true });
    await fsPromises.writeFile(IMAGE_REMIX_STATE_PATH, JSON.stringify(versionState, null, 2), 'utf8');
}

/**
 * バージョン状態のキーを生成
 */
function versionStateKey(sourceDir, rootName) {
    return `${path.resolve(sourceDir)}::${rootName}`;
}

/**
 * 正規表現エスケープ
 */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
}

/**
 * ベース名からルート名とセパレータ、検出バージョンを導出
 */
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

/**
 * 出力パスを予約（一意なファイル名を生成）
 */
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

module.exports = {
    loadVersionState,
    saveVersionState,
    versionStateKey,
    deriveRootNaming,
    reserveOutputPath
};
