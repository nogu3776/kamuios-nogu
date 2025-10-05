/**
 * KamuiOSアップデートクライアント
 * フロントエンド側のアップデート機能を管理
 */
class KamuiUpdateClient {
  constructor() {
    this.apiBase = '/api'; // サーバーのAPIベースパス
    this.isInitialized = false;
    this.updateTimer = null;
    this.logBuffer = [];
    this.maxLogLines = 100;
    
    // DOM要素
    this.elements = {};
    
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    if (this.isInitialized) return;
    
    // DOM要素を取得
    this.bindElements();
    
    // イベントリスナーを設定
    this.bindEvents();
    
    // システム情報を読み込み
    await this.loadSystemInfo();
    await this.loadUpdateHistory();
    
    this.isInitialized = true;
    this.log('アップデートクライアントが初期化されました');
  }

  /**
   * DOM要素をバインド
   */
  bindElements() {
    const elements = [
      'update-toggle-btn', 'update-close-btn', 'update-main-panel',
      'check-update-btn', 'start-update-btn', 'rollback-btn',
      'backup-custom-btn', 'restore-custom-btn', 'view-custom-files-btn',
      'toggle-logs-btn', 'clear-logs-btn', 'toast-close',
      'system-version', 'git-branch', 'custom-files-count',
      'update-check-result', 'update-progress-section', 'progress-fill',
      'progress-text', 'progress-percentage', 'update-logs', 'log-content',
      'custom-files-list', 'update-history-list', 'update-status-text',
      'update-spinner', 'update-toast', 'toast-message'
    ];

    elements.forEach(id => {
      this.elements[id.replace(/-/g, '_')] = document.getElementById(id);
    });
  }

  /**
   * イベントリスナーをバインド
   */
  bindEvents() {
    // パネルの表示/非表示
    this.elements.update_toggle_btn?.addEventListener('click', () => {
      this.togglePanel();
    });

    this.elements.update_close_btn?.addEventListener('click', () => {
      this.hidePanel();
    });

    // アップデート関連
    this.elements.check_update_btn?.addEventListener('click', () => {
      this.checkUpdate();
    });

    this.elements.start_update_btn?.addEventListener('click', () => {
      this.startUpdate();
    });

    this.elements.rollback_btn?.addEventListener('click', () => {
      this.performRollback();
    });

    // カスタムファイル管理
    this.elements.backup_custom_btn?.addEventListener('click', () => {
      this.backupCustomFiles();
    });

    this.elements.restore_custom_btn?.addEventListener('click', () => {
      this.restoreCustomFiles();
    });

    this.elements.view_custom_files_btn?.addEventListener('click', () => {
      this.viewCustomFiles();
    });

    // ログ管理
    this.elements.toggle_logs_btn?.addEventListener('click', () => {
      this.toggleLogs();
    });

    this.elements.clear_logs_btn?.addEventListener('click', () => {
      this.clearLogs();
    });

    // トースト通知
    this.elements.toast_close?.addEventListener('click', () => {
      this.hideToast();
    });

    // パネル外クリックで閉じる
    this.elements.update_main_panel?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#kamui-update-panel') && 
          !this.elements.update_main_panel?.classList.contains('hidden')) {
        this.hidePanel();
      }
    });

    // ESCキーでパネルを閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && 
          !this.elements.update_main_panel?.classList.contains('hidden')) {
        this.hidePanel();
      }
    });
  }

  /**
   * パネルの表示/非表示を切り替え
   */
  togglePanel() {
    if (this.elements.update_main_panel?.classList.contains('hidden')) {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  }

  /**
   * パネルを表示
   */
  async showPanel() {
    this.elements.update_main_panel?.classList.remove('hidden');
    await this.loadSystemInfo();
    await this.refreshStatus();
  }

  /**
   * パネルを非表示
   */
  hidePanel() {
    this.elements.update_main_panel?.classList.add('hidden');
  }

  /**
   * システム情報を読み込み
   */
  async loadSystemInfo() {
    try {
      const response = await this.apiCall('/update/system-info');
      if (response.success && response.systemInfo) {
        const info = response.systemInfo;
        
        if (this.elements.system_version) {
          this.elements.system_version.textContent = info.version || 'Unknown';
        }
        if (this.elements.git_branch) {
          this.elements.git_branch.textContent = info.gitInfo?.branch || 'Unknown';
        }
        if (this.elements.custom_files_count) {
          this.elements.custom_files_count.textContent = `${info.customFilesCount || 0}個`;
        }
      }
    } catch (error) {
      this.showError('システム情報の取得に失敗しました: ' + error.message);
    }
  }

  /**
   * アップデートをチェック
   */
  async checkUpdate() {
    try {
      this.setButtonLoading(this.elements.check_update_btn, true);
      
      const response = await this.apiCall('/update/check');
      
      if (response.success) {
        const resultDiv = this.elements.update_check_result;
        if (resultDiv) {
          resultDiv.classList.remove('hidden');
          
          if (response.hasChanges) {
            resultDiv.innerHTML = `
              <div class="alert alert-info">
                <strong>アップデートが利用可能です！</strong><br>
                ${response.behindCount}個の新しい変更があります。<br>
                変更されたファイル: ${response.changedFiles?.length || 0}個
              </div>
            `;
            if (this.elements.start_update_btn) {
              this.elements.start_update_btn.disabled = false;
            }
          } else {
            resultDiv.innerHTML = `
              <div class="alert alert-success">
                <strong>最新版です</strong><br>
                アップデートは必要ありません。
              </div>
            `;
          }
        }
        
        this.showSuccess('アップデートチェック完了');
      }
    } catch (error) {
      this.showError('アップデートチェックに失敗しました: ' + error.message);
    } finally {
      this.setButtonLoading(this.elements.check_update_btn, false);
    }
  }

  /**
   * アップデートを開始
   */
  async startUpdate() {
    try {
      if (!confirm('アップデートを開始しますか？\nカスタム設定は自動的にバックアップされます。')) {
        return;
      }

      const response = await this.apiCall('/update/start', 'POST');
      
      if (response.success) {
        this.showSuccess('アップデートを開始しました');
        this.elements.update_progress_section?.classList.remove('hidden');
        
        // 進捗監視を開始
        this.startProgressMonitoring();
        
        // ボタン状態を更新
        if (this.elements.start_update_btn) {
          this.elements.start_update_btn.disabled = true;
        }
      }
    } catch (error) {
      this.showError('アップデート開始に失敗しました: ' + error.message);
    }
  }

  /**
   * 進捗監視を開始
   */
  startProgressMonitoring() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    this.updateTimer = setInterval(async () => {
      await this.updateProgress();
    }, 1000);
  }

  /**
   * 進捗を更新
   */
  async updateProgress() {
    try {
      const response = await this.apiCall('/update/status');
      
      if (response.success && response.status) {
        const status = response.status;
        
        // 進捗バーを更新
        if (this.elements.progress_fill) {
          this.elements.progress_fill.style.width = `${status.progress || 0}%`;
        }
        if (this.elements.progress_text) {
          this.elements.progress_text.textContent = status.currentStep || '待機中...';
        }
        if (this.elements.progress_percentage) {
          this.elements.progress_percentage.textContent = `${status.progress || 0}%`;
        }

        // アップデート完了またはエラーの場合
        if (!status.isUpdating) {
          this.stopProgressMonitoring();
          
          if (status.progress === 100) {
            this.showSuccess('アップデートが完了しました！');
            this.elements.rollback_btn?.classList.remove('hidden');
          } else {
            this.showError('アップデートでエラーが発生しました');
          }
          
          // UI状態をリセット
          if (this.elements.start_update_btn) {
            this.elements.start_update_btn.disabled = false;
          }
          
          await this.refreshStatus();
        }
      }
    } catch (error) {
      console.error('進捗更新エラー:', error);
    }
  }

  /**
   * 進捗監視を停止
   */
  stopProgressMonitoring() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * ロールバックを実行
   */
  async performRollback() {
    try {
      if (!confirm('ロールバックを実行しますか？\n前回のアップデートが取り消されます。')) {
        return;
      }

      const response = await this.apiCall('/update/rollback', 'POST');
      
      if (response.success) {
        this.showSuccess('ロールバックが完了しました');
        this.elements.rollback_btn?.classList.add('hidden');
        await this.refreshStatus();
      }
    } catch (error) {
      this.showError('ロールバックに失敗しました: ' + error.message);
    }
  }

  /**
   * カスタムファイルをバックアップ
   */
  async backupCustomFiles() {
    try {
      this.setButtonLoading(this.elements.backup_custom_btn, true);
      
      const response = await this.apiCall('/update/backup', 'POST');
      
      if (response.success) {
        this.showSuccess(`${response.files?.length || 0}個のファイルをバックアップしました`);
      }
    } catch (error) {
      this.showError('バックアップに失敗しました: ' + error.message);
    } finally {
      this.setButtonLoading(this.elements.backup_custom_btn, false);
    }
  }

  /**
   * カスタムファイルを復元
   */
  async restoreCustomFiles() {
    try {
      if (!confirm('カスタム設定を復元しますか？\n現在のファイルが上書きされる可能性があります。')) {
        return;
      }

      this.setButtonLoading(this.elements.restore_custom_btn, true);
      
      const response = await this.apiCall('/update/restore', 'POST');
      
      if (response.success) {
        this.showSuccess(`${response.restoredFiles?.length || 0}個のファイルを復元しました`);
      }
    } catch (error) {
      this.showError('復元に失敗しました: ' + error.message);
    } finally {
      this.setButtonLoading(this.elements.restore_custom_btn, false);
    }
  }

  /**
   * カスタムファイル一覧を表示
   */
  async viewCustomFiles() {
    try {
      const response = await this.apiCall('/update/custom-files');
      
      if (response.success) {
        const listDiv = this.elements.custom_files_list;
        if (listDiv) {
          if (response.customFiles && response.customFiles.length > 0) {
            const filesHtml = response.customFiles.map(file => `
              <div class="custom-file-item">
                <span class="file-path">${file.path}</span>
                <span class="file-status ${file.type}">${file.type}</span>
              </div>
            `).join('');
            
            listDiv.innerHTML = filesHtml;
            listDiv.classList.remove('hidden');
          } else {
            listDiv.innerHTML = '<div class="no-custom-files">カスタムファイルが見つかりません</div>';
            listDiv.classList.remove('hidden');
          }
        }
      }
    } catch (error) {
      this.showError('カスタムファイル一覧の取得に失敗しました: ' + error.message);
    }
  }

  /**
   * ログの表示/非表示を切り替え
   */
  toggleLogs() {
    if (this.elements.update_logs) {
      if (this.elements.update_logs.classList.contains('hidden')) {
        this.elements.update_logs.classList.remove('hidden');
        this.updateLogDisplay();
      } else {
        this.elements.update_logs.classList.add('hidden');
      }
    }
  }

  /**
   * ログをクリア
   */
  clearLogs() {
    this.logBuffer = [];
    this.updateLogDisplay();
  }

  /**
   * ログを追加
   */
  log(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.logBuffer.push(`[${timestamp}] ${message}`);
    
    if (this.logBuffer.length > this.maxLogLines) {
      this.logBuffer = this.logBuffer.slice(-this.maxLogLines);
    }
    
    this.updateLogDisplay();
  }

  /**
   * ログ表示を更新
   */
  updateLogDisplay() {
    const logContent = this.elements.update_logs?.querySelector('.log-content');
    if (logContent) {
      logContent.textContent = this.logBuffer.join('\n');
      logContent.scrollTop = logContent.scrollHeight;
    }
  }

  /**
   * アップデート履歴を読み込み
   */
  async loadUpdateHistory() {
    try {
      const response = await this.apiCall('/update/history');
      
      if (response.success && response.history) {
        const historyDiv = this.elements.update_history_list;
        if (historyDiv) {
          if (response.history.length > 0) {
            const historyHtml = response.history.slice(0, 10).map(item => `
              <div class="history-item ${item.isAutoUpdate ? 'auto-update' : ''}">
                <div class="commit-info">
                  <span class="commit-id">${item.commit}</span>
                  <span class="commit-message">${item.message}</span>
                </div>
              </div>
            `).join('');
            
            historyDiv.innerHTML = historyHtml;
          } else {
            historyDiv.innerHTML = '<div class="no-history">履歴がありません</div>';
          }
        }
      }
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
      if (this.elements.update_history_list) {
        this.elements.update_history_list.innerHTML = '<div class="error">履歴の読み込みに失敗しました</div>';
      }
    }
  }

  /**
   * 状態を更新
   */
  async refreshStatus() {
    await Promise.all([
      this.loadSystemInfo(),
      this.loadUpdateHistory()
    ]);
  }

  /**
   * ボタンのローディング状態を設定
   */
  setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = '処理中...';
    } else {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
      delete button.dataset.originalText;
    }
  }

  /**
   * 成功メッセージを表示
   */
  showSuccess(message) {
    this.showToast(message, 'success');
    this.log(`✓ ${message}`);
  }

  /**
   * エラーメッセージを表示
   */
  showError(message) {
    this.showToast(message, 'error');
    this.log(`✗ ${message}`);
  }

  /**
   * トースト通知を表示
   */
  showToast(message, type = 'info') {
    if (this.elements.toast_message && this.elements.update_toast) {
      this.elements.toast_message.textContent = message;
      this.elements.update_toast.classList.remove('hidden');
      
      // 5秒後に自動で非表示
      setTimeout(() => {
        this.hideToast();
      }, 5000);
    }
  }

  /**
   * トースト通知を非表示
   */
  hideToast() {
    if (this.elements.update_toast) {
      this.elements.update_toast.classList.add('hidden');
    }
  }

  /**
   * API呼び出し
   */
  async apiCall(endpoint, method = 'GET', data = null) {
    const url = `${this.apiBase}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', () => {
  // グローバルインスタンスを作成
  window.kamuiUpdateClient = new KamuiUpdateClient();
});

// 追加のスタイル
const additionalStyles = `
.alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin-top: 8px;
  font-size: 14px;
}

.alert-info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.alert-success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.alert-error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.history-item {
  padding: 8px 12px;
  border-left: 3px solid #e9ecef;
  margin-bottom: 8px;
  font-size: 13px;
}

.history-item.auto-update {
  border-left-color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.commit-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.commit-id {
  font-family: monospace;
  font-size: 11px;
  color: #6c757d;
}

.commit-message {
  font-size: 13px;
  color: #333;
}

.no-custom-files,
.no-history,
.error {
  padding: 16px;
  text-align: center;
  color: #6c757d;
  font-style: italic;
}
`;

// スタイルを動的に追加
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);