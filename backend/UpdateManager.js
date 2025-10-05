const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const CustomConfigManager = require('./CustomConfigManager');

const execAsync = promisify(exec);

/**
 * KamuiOSアップデート管理クラス
 * 安全なアップデートプロセスを実行
 */
class UpdateManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rootDir = options.rootDir || process.cwd();
    this.customManager = new CustomConfigManager({ rootDir: this.rootDir });
    this.isUpdating = false;
    this.currentStep = '';
    this.progress = 0;
    this.rollbackData = null;
  }

  /**
   * アップデートプロセスを開始
   */
  async startUpdate() {
    if (this.isUpdating) {
      throw new Error('アップデートが既に実行中です');
    }

    this.isUpdating = true;
    this.progress = 0;
    this.emit('updateStarted');

    try {
      // ステップ1: 現在の状態を確認
      await this.updateStep('環境チェック中...', 10);
      await this.checkEnvironment();

      // ステップ2: カスタマイズをバックアップ
      await this.updateStep('カスタム設定をバックアップ中...', 20);
      const backupResult = await this.customManager.backupCustomizations();
      this.rollbackData = backupResult;

      // ステップ3: 最新の変更を取得
      await this.updateStep('最新の変更を確認中...', 40);
      const remoteChanges = await this.checkRemoteChanges();

      if (remoteChanges.hasChanges) {
        // ステップ4: gitプル実行
        await this.updateStep('KamuiOSコアをアップデート中...', 60);
        await this.performGitPull();

        // ステップ5: コンフリクトをチェック
        await this.updateStep('コンフリクトをチェック中...', 70);
        const conflicts = await this.checkConflicts();

        if (conflicts.length > 0) {
          // ステップ6: コンフリクト解決
          await this.updateStep('コンフリクトを解決中...', 80);
          await this.resolveConflicts(conflicts);
        }

        // ステップ7: カスタマイズを復元
        await this.updateStep('カスタム設定を復元中...', 90);
        await this.customManager.restoreCustomizations();
      } else {
        await this.updateStep('既に最新版です', 90);
      }

      // ステップ8: 完了
      await this.updateStep('アップデート完了', 100);
      this.isUpdating = false;
      
      this.emit('updateCompleted', {
        success: true,
        hasChanges: remoteChanges.hasChanges,
        restoredFiles: this.rollbackData?.files?.length || 0
      });

      return {
        success: true,
        message: 'アップデートが正常に完了しました',
        changes: remoteChanges.hasChanges,
        restoredFiles: this.rollbackData?.files?.length || 0
      };

    } catch (error) {
      console.error('アップデートエラー:', error);
      
      // ロールバック実行
      if (this.rollbackData) {
        await this.updateStep('エラーが発生しました。ロールバック中...', 95);
        try {
          await this.performRollback();
        } catch (rollbackError) {
          console.error('ロールバックエラー:', rollbackError);
        }
      }

      this.isUpdating = false;
      this.emit('updateFailed', { error: error.message });
      
      throw new Error(`アップデートに失敗しました: ${error.message}`);
    }
  }

  /**
   * 進捗を更新
   */
  async updateStep(message, progress) {
    this.currentStep = message;
    this.progress = progress;
    this.emit('progress', { message, progress });
    
    // 少し待機（UI更新のため）
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 環境をチェック
   */
  async checkEnvironment() {
    try {
      // Gitリポジトリかチェック
      await execAsync('git status', { cwd: this.rootDir });
      
      // 作業ディレクトリの状態をチェック
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.rootDir });
      
      return {
        isGitRepo: true,
        hasUncommittedChanges: stdout.trim().length > 0,
        workingDirectory: this.rootDir
      };
    } catch (error) {
      throw new Error(`環境チェックに失敗しました: ${error.message}`);
    }
  }

  /**
   * リモートの変更をチェック
   */
  async checkRemoteChanges() {
    try {
      // リモートから最新情報を取得
      await execAsync('git fetch origin', { cwd: this.rootDir });
      
      // ローカルとリモートの差分をチェック
      const { stdout } = await execAsync('git rev-list HEAD..origin/main --count', {
        cwd: this.rootDir
      });
      
      const behindCount = parseInt(stdout.trim(), 10);
      const hasChanges = behindCount > 0;

      if (hasChanges) {
        // 変更されたファイル一覧を取得
        const { stdout: changedFiles } = await execAsync('git diff --name-only HEAD..origin/main', {
          cwd: this.rootDir
        });

        return {
          hasChanges: true,
          behindCount,
          changedFiles: changedFiles.trim().split('\n').filter(f => f.length > 0)
        };
      }

      return { hasChanges: false, behindCount: 0, changedFiles: [] };
    } catch (error) {
      throw new Error(`リモート変更のチェックに失敗しました: ${error.message}`);
    }
  }

  /**
   * Gitプルを実行
   */
  async performGitPull() {
    try {
      const { stdout, stderr } = await execAsync('git pull origin main', {
        cwd: this.rootDir
      });
      
      console.log('Git pull成功:', stdout);
      if (stderr) {
        console.warn('Git pull警告:', stderr);
      }

      return { success: true, output: stdout };
    } catch (error) {
      // プルに失敗した場合でも、コンフリクトの可能性があるので継続
      console.warn('Git pullでエラーが発生:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * コンフリクトをチェック
   */
  async checkConflicts() {
    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.rootDir
      });

      const conflicts = [];
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (line.startsWith('UU') || line.startsWith('AA') || line.includes('<<<<<<< HEAD')) {
          conflicts.push({
            file: line.substring(3),
            type: 'merge_conflict'
          });
        }
      }

      return conflicts;
    } catch (error) {
      console.error('コンフリクトチェックエラー:', error);
      return [];
    }
  }

  /**
   * コンフリクトを解決
   */
  async resolveConflicts(conflicts) {
    try {
      for (const conflict of conflicts) {
        console.log(`コンフリクトを解決中: ${conflict.file}`);
        
        // シンプルな解決戦略: 大部分のファイルでリモートを優先、カスタムファイルはローカルを優先
        if (this.customManager.isCustomFile(conflict.file)) {
          // カスタムファイルはローカル版を保持
          await execAsync(`git checkout --ours "${conflict.file}"`, {
            cwd: this.rootDir
          });
        } else {
          // 通常のファイルはリモート版を採用
          await execAsync(`git checkout --theirs "${conflict.file}"`, {
            cwd: this.rootDir
          });
        }
        
        // ファイルをステージング
        await execAsync(`git add "${conflict.file}"`, {
          cwd: this.rootDir
        });
      }

      // マージコミットを作成
      await execAsync('git commit -m "KamuiOS自動アップデート: コンフリクト解決"', {
        cwd: this.rootDir
      });

      console.log('コンフリクト解決完了');
      return { resolved: conflicts.length };
    } catch (error) {
      throw new Error(`コンフリクト解決に失敗しました: ${error.message}`);
    }
  }

  /**
   * ロールバックを実行
   */
  async performRollback() {
    try {
      console.log('ロールバックを実行中...');
      
      // Gitの状態をリセット
      await execAsync('git reset --hard HEAD~1', { cwd: this.rootDir });
      
      // バックアップからカスタム設定を復元
      if (this.rollbackData) {
        await this.customManager.restoreCustomizations();
      }

      console.log('ロールバック完了');
      this.emit('rollbackCompleted');
      
      return { success: true };
    } catch (error) {
      console.error('ロールバックエラー:', error);
      throw new Error(`ロールバックに失敗しました: ${error.message}`);
    }
  }

  /**
   * アップデートの状態を取得
   */
  getStatus() {
    return {
      isUpdating: this.isUpdating,
      currentStep: this.currentStep,
      progress: this.progress
    };
  }

  /**
   * アップデート履歴を取得
   */
  async getUpdateHistory() {
    try {
      const { stdout } = await execAsync('git log --oneline --since="1 month ago"', {
        cwd: this.rootDir
      });

      return stdout.trim().split('\n').map(line => {
        const [commit, ...messageParts] = line.split(' ');
        return {
          commit: commit,
          message: messageParts.join(' '),
          isAutoUpdate: messageParts.join(' ').includes('KamuiOS自動アップデート')
        };
      });
    } catch (error) {
      console.error('履歴取得エラー:', error);
      return [];
    }
  }

  /**
   * システム情報を取得
   */
  async getSystemInfo() {
    try {
      const gitInfo = await this.customManager.getGitInfo();
      const customFiles = await this.customManager.detectCustomizations();
      
      return {
        version: 'KamuiOS 1.0.0',
        gitInfo,
        customFilesCount: customFiles.length,
        lastUpdate: new Date().toISOString(),
        workingDirectory: this.rootDir
      };
    } catch (error) {
      console.error('システム情報取得エラー:', error);
      return null;
    }
  }
}

module.exports = UpdateManager;