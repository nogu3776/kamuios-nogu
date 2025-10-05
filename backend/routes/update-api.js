const express = require('express');
const router = express.Router();
const UpdateManager = require('../UpdateManager');
const CustomConfigManager = require('../CustomConfigManager');

// アップデートマネージャーのインスタンス
let updateManager = null;

/**
 * アップデートマネージャーを取得（シングルトンパターン）
 */
function getUpdateManager() {
  if (!updateManager) {
    updateManager = new UpdateManager();
    
    // イベントリスナーを設定
    updateManager.on('updateStarted', () => {
      console.log('[UPDATE] アップデート開始');
    });
    
    updateManager.on('progress', (data) => {
      console.log(`[UPDATE] 進捗: ${data.progress}% - ${data.message}`);
    });
    
    updateManager.on('updateCompleted', (data) => {
      console.log('[UPDATE] アップデート完了:', data);
    });
    
    updateManager.on('updateFailed', (data) => {
      console.error('[UPDATE] アップデート失敗:', data.error);
    });
    
    updateManager.on('rollbackCompleted', () => {
      console.log('[UPDATE] ロールバック完了');
    });
  }
  return updateManager;
}

/**
 * エラーハンドリング用ミドルウェア
 */
function handleError(res, error, message = 'サーバーエラーが発生しました') {
  console.error(message, error);
  res.status(500).json({
    success: false,
    error: message,
    details: error.message
  });
}

/**
 * POST /api/update/start
 * アップデートを開始
 */
router.post('/update/start', async (req, res) => {
  try {
    const manager = getUpdateManager();
    
    if (manager.isUpdating) {
      return res.status(409).json({
        success: false,
        error: 'アップデートが既に実行中です',
        status: manager.getStatus()
      });
    }

    // アップデートを非同期で開始
    manager.startUpdate().catch(error => {
      console.error('アップデート非同期エラー:', error);
    });

    res.json({
      success: true,
      message: 'アップデートを開始しました',
      status: manager.getStatus()
    });
  } catch (error) {
    handleError(res, error, 'アップデート開始に失敗しました');
  }
});

/**
 * GET /api/update/status
 * アップデート状況を取得
 */
router.get('/update/status', async (req, res) => {
  try {
    const manager = getUpdateManager();
    const status = manager.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    handleError(res, error, 'ステータス取得に失敗しました');
  }
});

/**
 * GET /api/update/check
 * アップデートの確認（リモートに新しい変更があるかチェック）
 */
router.get('/update/check', async (req, res) => {
  try {
    const manager = getUpdateManager();
    
    if (manager.isUpdating) {
      return res.status(409).json({
        success: false,
        error: 'アップデート実行中のため、チェックできません'
      });
    }

    const remoteChanges = await manager.checkRemoteChanges();
    
    res.json({
      success: true,
      ...remoteChanges
    });
  } catch (error) {
    handleError(res, error, 'アップデートチェックに失敗しました');
  }
});

/**
 * POST /api/update/rollback
 * ロールバックを実行
 */
router.post('/update/rollback', async (req, res) => {
  try {
    const manager = getUpdateManager();
    
    if (manager.isUpdating) {
      return res.status(409).json({
        success: false,
        error: 'アップデート実行中のため、ロールバックできません'
      });
    }

    const result = await manager.performRollback();
    
    res.json({
      success: true,
      message: 'ロールバックが完了しました',
      result
    });
  } catch (error) {
    handleError(res, error, 'ロールバックに失敗しました');
  }
});

/**
 * GET /api/update/history
 * アップデート履歴を取得
 */
router.get('/update/history', async (req, res) => {
  try {
    const manager = getUpdateManager();
    const history = await manager.getUpdateHistory();
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    handleError(res, error, '履歴取得に失敗しました');
  }
});

/**
 * GET /api/update/system-info
 * システム情報を取得
 */
router.get('/update/system-info', async (req, res) => {
  try {
    const manager = getUpdateManager();
    const systemInfo = await manager.getSystemInfo();
    
    res.json({
      success: true,
      systemInfo
    });
  } catch (error) {
    handleError(res, error, 'システム情報取得に失敗しました');
  }
});

/**
 * GET /api/update/custom-files
 * カスタマイズされたファイル一覧を取得
 */
router.get('/update/custom-files', async (req, res) => {
  try {
    const customManager = new CustomConfigManager();
    const customFiles = await customManager.detectCustomizations();
    
    res.json({
      success: true,
      customFiles,
      count: customFiles.length
    });
  } catch (error) {
    handleError(res, error, 'カスタムファイル取得に失敗しました');
  }
});

/**
 * POST /api/update/backup
 * カスタム設定のバックアップを実行
 */
router.post('/update/backup', async (req, res) => {
  try {
    const customManager = new CustomConfigManager();
    const backupResult = await customManager.backupCustomizations();
    
    res.json({
      success: true,
      message: 'バックアップが完了しました',
      ...backupResult
    });
  } catch (error) {
    handleError(res, error, 'バックアップに失敗しました');
  }
});

/**
 * POST /api/update/restore
 * カスタム設定の復元を実行
 */
router.post('/update/restore', async (req, res) => {
  try {
    const customManager = new CustomConfigManager();
    const restoreResult = await customManager.restoreCustomizations();
    
    res.json({
      success: true,
      message: '復元が完了しました',
      ...restoreResult
    });
  } catch (error) {
    handleError(res, error, '復元に失敗しました');
  }
});

/**
 * GET /api/update/backup-info
 * バックアップ情報を取得
 */
router.get('/update/backup-info', async (req, res) => {
  try {
    const customManager = new CustomConfigManager();
    const backupInfo = await customManager.getBackupInfo();
    
    if (!backupInfo) {
      return res.json({
        success: true,
        hasBackup: false,
        message: 'バックアップが見つかりません'
      });
    }
    
    res.json({
      success: true,
      hasBackup: true,
      backupInfo
    });
  } catch (error) {
    handleError(res, error, 'バックアップ情報取得に失敗しました');
  }
});

/**
 * DELETE /api/update/backup
 * バックアップをクリーンアップ
 */
router.delete('/update/backup', async (req, res) => {
  try {
    const customManager = new CustomConfigManager();
    await customManager.cleanupBackup();
    
    res.json({
      success: true,
      message: 'バックアップをクリーンアップしました'
    });
  } catch (error) {
    handleError(res, error, 'バックアップクリーンアップに失敗しました');
  }
});

module.exports = router;