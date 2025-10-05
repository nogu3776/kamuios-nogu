const dataService = require('./dataService');

/**
 * Showcase アプリのエントリーポイント
 * APIルーティングの登録と初期化処理を提供
 */

function mount(server, requestHandler) {
    // すでに server.js でルーティングが実装されているため
    // 将来的にここに移行する予定
    // 現時点では何もしない（段階的リファクタリング）
}

function initialize() {
    dataService.initialize();
}

module.exports = {
    mount,
    initialize,
    dataService
};
