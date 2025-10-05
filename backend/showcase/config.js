const path = require('path');

// プロジェクトルート
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Showcase データディレクトリ
const STATIC_SHOWCASE_DATA_DIR = path.join(PROJECT_ROOT, 'static', 'data', 'showcase');
const SHOWCASE_DATA_DIR = path.join(PROJECT_ROOT, 'showcase');
const SHOWCASE_TEMPLATES_YAML = path.join(STATIC_SHOWCASE_DATA_DIR, 'templates.yaml');
const SHOWCASE_TEMPLATES_JSON = path.join(SHOWCASE_DATA_DIR, 'templates.json');
const SHOWCASE_HISTORY_FILE = path.join(SHOWCASE_DATA_DIR, 'history.json');

// Showcase サポートカテゴリ
const SHOWCASE_SUPPORTED_CATEGORIES = new Set(['image', 'video', '3d', 'sound', 'other']);

// Showcase タイププレフィックス
const SHOWCASE_TYPE_PREFIXES = new Set([
    't2i', 'i2i', 't2v', 'i2v', 'r2v', 's2v', 'a2v', 'v2v',
    'v2a', 'v2sfx', 't2a', 't2s', 'tts', 't2m', 'i2i3d',
    't2visual', 'file', 'train', 'misc'
]);

module.exports = {
    PROJECT_ROOT,
    STATIC_SHOWCASE_DATA_DIR,
    SHOWCASE_DATA_DIR,
    SHOWCASE_TEMPLATES_YAML,
    SHOWCASE_TEMPLATES_JSON,
    SHOWCASE_HISTORY_FILE,
    SHOWCASE_SUPPORTED_CATEGORIES,
    SHOWCASE_TYPE_PREFIXES
};
