const path = require('path');

// プロジェクトルートと基本パス
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const IMAGE_REMIX_LOG_DIR = path.join(PROJECT_ROOT, 'logs', 'image-remix');
const IMAGE_REMIX_STATE_PATH = path.join(IMAGE_REMIX_LOG_DIR, 'version-cache.json');

// MCP設定
const PROTOCOL_VERSION = process.env.KAMUI_CODE_PROTOCOL_VERSION || '2025-06-18';
const BASE_URL = process.env.KAMUI_CODE_BASE_URL || 'https://kamui-code.ai';
const AUTH_TOKEN = process.env.KAMUI_CODE_AUTH_TOKEN || '';

// エンジン定義
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

// ポーリング設定
const POLL_INTERVAL_MS = Number.parseInt(process.env.IMAGE_REMIX_POLL_INTERVAL_MS || '4000', 10);
const MAX_WAIT_MS = Number.parseInt(process.env.IMAGE_REMIX_MAX_WAIT_MS || '180000', 10);

module.exports = {
    PROJECT_ROOT,
    IMAGE_REMIX_LOG_DIR,
    IMAGE_REMIX_STATE_PATH,
    PROTOCOL_VERSION,
    BASE_URL,
    AUTH_TOKEN,
    ENGINE_DEFS,
    POLL_INTERVAL_MS,
    MAX_WAIT_MS
};
