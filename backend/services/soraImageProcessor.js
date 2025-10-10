const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const PYTHON = process.env.PYTHON_PATH || 'python3';
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'backend', 'scripts', 'sora_prepare_image.py');

const DEFAULT_OUTPUT_SUBDIR = path.join('showcase', 'sora-prepared');

const SORA_TARGET_SIZES = new Map([
  ['1280x720', { width: 1280, height: 720 }],
  ['720x1280', { width: 720, height: 1280 }],
  ['1792x1024', { width: 1792, height: 1024 }],
  ['1024x1792', { width: 1024, height: 1792 }]
]);

function normalizeSizeKey(rawValue, fallback = '1280x720') {
  if (!rawValue && rawValue !== 0) return fallback;
  const trimmed = String(rawValue).toLowerCase().trim();
  if (!trimmed) return fallback;
  const normalized = trimmed.replace(/[^0-9x]/g, '');
  if (SORA_TARGET_SIZES.has(normalized)) return normalized;
  const swapped = normalized.includes('x')
    ? normalized.split('x').map((token) => token.trim()).filter(Boolean).join('x')
    : '';
  if (SORA_TARGET_SIZES.has(swapped)) return swapped;
  return fallback;
}

function sanitizeSegment(value, { fallback = 'sora', maxLength = 32 } = {}) {
  if (!value && value !== 0) return fallback;
  const trimmed = String(value).trim();
  if (!trimmed) return fallback;
  const limited = trimmed.slice(0, maxLength);
  const normalized = limited
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

async function ensureDir(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

function formatTimestampSegment(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

async function runSmartCrop({ inputPath, outputPath, width, height }) {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT_PATH, inputPath, outputPath, String(width), String(height)];
    const child = spawn(PYTHON, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const message = stderr || stdout || `smart crop failed with code ${code}`;
        reject(new Error(message.trim()));
        return;
      }
      const trimmed = stdout.trim().split(/\r?\n/).filter(Boolean);
      if (!trimmed.length) {
        reject(new Error('smart crop script produced no output'));
        return;
      }
      try {
        const payload = JSON.parse(trimmed[trimmed.length - 1]);
        resolve(payload);
      } catch (err) {
        reject(new Error(`Failed to parse smart crop output: ${err.message}`));
      }
    });
  });
}

async function cropToTargetSize({
  inputPath,
  sizeKey,
  model = '',
  scanPath,
  outputSubdir = DEFAULT_OUTPUT_SUBDIR,
  filePrefix = 'sora'
}) {
  const normalizedSize = normalizeSizeKey(sizeKey);
  const target = SORA_TARGET_SIZES.get(normalizedSize) || SORA_TARGET_SIZES.get('1280x720');
  if (!target) {
    throw new Error(`Unsupported Sora target size: ${sizeKey}`);
  }

  const baseDir = scanPath ? path.resolve(scanPath, outputSubdir) : path.join(PROJECT_ROOT, 'static', outputSubdir);
  const timestamp = formatTimestampSegment();
  const uuid = crypto.randomUUID().slice(0, 8);
  const safePrefix = sanitizeSegment(filePrefix, { fallback: 'sora' });
  const safeModel = sanitizeSegment(model, { fallback: 'std', maxLength: 16 });
  const fileName = `${safePrefix}_${safeModel}_${normalizedSize}_${timestamp}_${uuid}.png`;
  const absoluteOutput = path.join(baseDir, fileName);

  await ensureDir(path.dirname(absoluteOutput));

  const result = await runSmartCrop({
    inputPath,
    outputPath: absoluteOutput,
    width: target.width,
    height: target.height
  });

  const relativePath = scanPath ? path.relative(scanPath, absoluteOutput) : null;
  const relativePosix = relativePath ? relativePath.split(path.sep).join('/') : null;

  return {
    absolutePath: absoluteOutput,
    relativePath,
    relativePathPosix: relativePosix,
    sizeKey: normalizedSize,
    width: target.width,
    height: target.height,
    cropResult: result,
    model: model ? sanitizeSegment(model, { fallback: 'std', maxLength: 16 }) : null
  };
}

module.exports = {
  SORA_TARGET_SIZES,
  normalizeSizeKey,
  cropToTargetSize
};
