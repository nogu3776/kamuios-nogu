const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const REGEX_SPECIAL_CHARS = /[|\\{}()[\]^$+?.]/g;

function escapeRegexFragment(fragment) {
  return fragment.replace(REGEX_SPECIAL_CHARS, '\\$&');
}

function globToRegExp(pattern) {
  let regex = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      const next = pattern[i + 1];
      if (next === '*') {
        const after = pattern[i + 2];
        if (after === '/') {
          regex += '(?:.*\\/)?';
          i += 2;
        } else {
          regex += '.*';
          i += 1;
        }
      } else {
        regex += '[^/]*';
      }
    } else if (char === '?') {
      regex += '[^/]';
    } else {
      regex += escapeRegexFragment(char);
    }
  }
  regex += '$';
  return new RegExp(regex);
}

/**
 * カスタム設定管理クラス
 * ユーザーのカスタマイズ設定を検出・バックアップ・復元する
 */
class CustomConfigManager {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.backupDir = path.join(this.rootDir, '.kamui-backup');
    this.configFile = path.join(this.backupDir, 'custom-config.json');
    
    // カスタマイズを検出するファイルパターン
    this.customPatterns = [
      'config.yaml',
      'config.toml',
      '.env',
      '.env.local',
      'themes/*/layouts/*.html',
      'themes/*/layouts/**/*.html',
      'themes/*/static/**/*',
      'content/**/*.md',
      'data/**/*.yaml',
      'data/**/*.json',
      'static/css/*.css',
      'static/js/*.js'
    ];
    
    // 除外するパターン
    this.excludePatterns = [
      'node_modules/**',
      '.git/**',
      'public/**',
      '.kamui-backup/**',
      '*.log',
      'tmp/**'
    ];

    this.customRegexes = this.customPatterns.map(globToRegExp);
    this.excludeRegexes = this.excludePatterns.map(globToRegExp);
  }

  /**
   * カスタマイズされたファイルを検出
   */
  async detectCustomizations() {
    try {
      const customFiles = [];
      
      // gitで変更されたファイルを検出
      const { stdout: modifiedFiles } = await execAsync('git status --porcelain', {
        cwd: this.rootDir
      });
      
      if (modifiedFiles.trim()) {
        const lines = modifiedFiles.trim().split('\n');
        for (const line of lines) {
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          
          if (!this.shouldExcludeFile(filePath)) {
            customFiles.push({
              path: filePath,
              status: status.trim(),
              type: 'modified'
            });
          }
        }
      }

      // 追跡されていないファイルのうち、カスタムパターンに一致するものを検出
      const { stdout: untrackedFiles } = await execAsync('git ls-files --others --exclude-standard', {
        cwd: this.rootDir
      });

      if (untrackedFiles.trim()) {
        const lines = untrackedFiles.trim().split('\n');
        for (const filePath of lines) {
          if (this.isCustomFile(filePath) && !this.shouldExcludeFile(filePath)) {
            customFiles.push({
              path: filePath,
              status: '??',
              type: 'untracked'
            });
          }
        }
      }

      return customFiles;
    } catch (error) {
      console.error('カスタマイズ検出エラー:', error);
      throw new Error(`カスタマイズ検出に失敗しました: ${error.message}`);
    }
  }

  /**
   * カスタム設定をバックアップ
   */
  async backupCustomizations() {
    try {
      const customFiles = await this.detectCustomizations();
      
      if (customFiles.length === 0) {
        console.log('バックアップするカスタマイズが見つかりません');
        return { files: [], backupPath: null };
      }

      // バックアップディレクトリを作成
      await fs.mkdir(this.backupDir, { recursive: true });

      const backupData = {
        timestamp: new Date().toISOString(),
        files: [],
        gitInfo: await this.getGitInfo()
      };

      // 各ファイルをバックアップ
      for (const file of customFiles) {
        const sourcePath = path.join(this.rootDir, file.path);
        const backupPath = path.join(this.backupDir, file.path);
        
        try {
          // バックアップディレクトリを作成
          await fs.mkdir(path.dirname(backupPath), { recursive: true });
          
          // ファイルをコピー
          if (await this.fileExists(sourcePath)) {
            await fs.copyFile(sourcePath, backupPath);
            
            backupData.files.push({
              ...file,
              backupPath: path.relative(this.rootDir, backupPath),
              size: (await fs.stat(sourcePath)).size
            });
          }
        } catch (fileError) {
          console.warn(`ファイルのバックアップに失敗: ${file.path}`, fileError);
        }
      }

      // バックアップ情報を保存
      await fs.writeFile(this.configFile, JSON.stringify(backupData, null, 2));
      
      console.log(`${backupData.files.length}個のファイルをバックアップしました`);
      return {
        files: backupData.files,
        backupPath: this.backupDir,
        configFile: this.configFile
      };
    } catch (error) {
      console.error('バックアップエラー:', error);
      throw new Error(`カスタム設定のバックアップに失敗しました: ${error.message}`);
    }
  }

  /**
   * カスタム設定を復元
   */
  async restoreCustomizations() {
    try {
      if (!(await this.fileExists(this.configFile))) {
        throw new Error('バックアップファイルが見つかりません');
      }

      const backupData = JSON.parse(await fs.readFile(this.configFile, 'utf8'));
      const restoredFiles = [];

      for (const file of backupData.files) {
        const backupPath = path.join(this.rootDir, file.backupPath);
        const targetPath = path.join(this.rootDir, file.path);

        try {
          if (await this.fileExists(backupPath)) {
            // ターゲットディレクトリを作成
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            
            // ファイルを復元
            await fs.copyFile(backupPath, targetPath);
            restoredFiles.push(file.path);
          }
        } catch (fileError) {
          console.warn(`ファイルの復元に失敗: ${file.path}`, fileError);
        }
      }

      console.log(`${restoredFiles.length}個のファイルを復元しました`);
      return {
        restoredFiles,
        backupInfo: backupData
      };
    } catch (error) {
      console.error('復元エラー:', error);
      throw new Error(`カスタム設定の復元に失敗しました: ${error.message}`);
    }
  }

  /**
   * バックアップをクリーンアップ
   */
  async cleanupBackup() {
    try {
      if (await this.fileExists(this.backupDir)) {
        await fs.rm(this.backupDir, { recursive: true, force: true });
        console.log('バックアップをクリーンアップしました');
      }
    } catch (error) {
      console.warn('バックアップクリーンアップエラー:', error);
    }
  }

  /**
   * バックアップ情報を取得
   */
  async getBackupInfo() {
    try {
      if (!(await this.fileExists(this.configFile))) {
        return null;
      }
      return JSON.parse(await fs.readFile(this.configFile, 'utf8'));
    } catch (error) {
      console.error('バックアップ情報取得エラー:', error);
      return null;
    }
  }

  /**
   * ファイルがカスタムファイルかどうかを判定
   */
  isCustomFile(filePath) {
    return this.customRegexes.some((regex) => regex.test(filePath));
  }

  /**
   * ファイルを除外すべきかどうかを判定
   */
  shouldExcludeFile(filePath) {
    return this.excludeRegexes.some((regex) => regex.test(filePath));
  }

  /**
   * ファイルの存在を確認
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Git情報を取得
   */
  async getGitInfo() {
    try {
      const { stdout: branch } = await execAsync('git branch --show-current', {
        cwd: this.rootDir
      });
      const { stdout: commit } = await execAsync('git rev-parse HEAD', {
        cwd: this.rootDir
      });
      const { stdout: remote } = await execAsync('git config --get remote.origin.url', {
        cwd: this.rootDir
      });

      return {
        branch: branch.trim(),
        commit: commit.trim(),
        remote: remote.trim()
      };
    } catch (error) {
      console.warn('Git情報取得エラー:', error);
      return {
        branch: 'unknown',
        commit: 'unknown',
        remote: 'unknown'
      };
    }
  }
}

module.exports = CustomConfigManager;
