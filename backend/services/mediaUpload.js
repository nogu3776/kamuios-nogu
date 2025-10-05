const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function resolveScanPath() {
  const scanPath = process.env.SCAN_PATH;
  if (!scanPath) {
    throw new Error('SCAN_PATH is not configured. Please set it in .env');
  }
  return path.resolve(scanPath);
}

function ensureWithinScanPath(targetPath) {
  if (!targetPath) {
    throw new Error('Media path is required');
  }
  const base = resolveScanPath();
  const absoluteTarget = path.resolve(base, targetPath);
  if (!absoluteTarget.startsWith(base)) {
    throw new Error('Requested file is outside of the configured SCAN_PATH');
  }
  if (!fs.existsSync(absoluteTarget)) {
    throw new Error(`Media file not found: ${absoluteTarget}`);
  }
  return absoluteTarget;
}

function runPythonUpload(filePath) {
  return new Promise((resolve, reject) => {
    const script = path.join(PROJECT_ROOT, 'local_fal_upload.py');
    const python = process.env.PYTHON_PATH || 'python3';
    const child = spawn(python, [script, filePath], { cwd: PROJECT_ROOT });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        const url = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
        if (!url) {
          reject(new Error('Upload succeeded but no URL was returned'));
          return;
        }
        resolve({ url, logs: stdout.trim() });
      } else {
        reject(new Error(`Upload failed (code ${code}): ${stderr || stdout}`));
      }
    });
  });
}

module.exports = {
  ensureWithinScanPath,
  runPythonUpload
};
