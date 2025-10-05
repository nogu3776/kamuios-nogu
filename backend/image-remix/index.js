const { runImageEdit } = require('./editService');

/**
 * Image Remix アプリのエントリーポイント
 */

/**
 * サーバーにルーティングをマウント（将来の拡張用）
 */
function mount(server, requestHandler) {
    // 将来的にルーティングを分離する場合はここに実装
}

/**
 * アプリの初期化
 */
function initialize() {
    // 現在は特に初期化処理なし
    // 必要に応じてログディレクトリ作成などを追加可能
}

module.exports = {
    mount,
    initialize,
    runImageEdit
};
