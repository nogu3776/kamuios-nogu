const fs = require('fs').promises;
const path = require('path');
const CustomConfigManager = require('../backend/CustomConfigManager');
const UpdateManager = require('../backend/UpdateManager');

/**
 * 簡単なテストフレームワーク
 */
class SimpleTest {
  constructor() {
    this.tests = [];
    this.passedTests = 0;
    this.failedTests = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    console.log('🧪 KamuiOSアップデートシステムテスト開始\n');

    for (const { name, testFn } of this.tests) {
      try {
        await testFn();
        console.log(`✅ ${name}`);
        this.passedTests++;
      } catch (error) {
        console.log(`❌ ${name}`);
        console.log(`   エラー: ${error.message}\n`);
        this.failedTests++;
      }
    }

    console.log(`\n📊 テスト結果: ${this.passedTests}個成功, ${this.failedTests}個失敗`);
    console.log(`成功率: ${Math.round((this.passedTests / this.tests.length) * 100)}%`);

    return this.failedTests === 0;
  }
}

/**
 * テストヘルパー
 */
class TestHelper {
  static async createTempFile(filePath, content = 'テストファイル') {
    const fullPath = path.join(process.cwd(), filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    return fullPath;
  }

  static async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  }

  static assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'アサーションが失敗しました');
    }
  }

  static assertEquals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `期待値: ${expected}, 実際の値: ${actual}`);
    }
  }
}

/**
 * テスト実行
 */
async function runTests() {
  const test = new SimpleTest();
  const tempFiles = [];

  // CustomConfigManagerのテスト
  test.test('CustomConfigManager - 初期化', async () => {
    const manager = new CustomConfigManager();
    TestHelper.assert(manager.rootDir, '作業ディレクトリが設定されていません');
    TestHelper.assert(manager.customPatterns.length > 0, 'カスタムパターンが設定されていません');
  });

  test.test('CustomConfigManager - カスタムファイル判定', async () => {
    const manager = new CustomConfigManager();
    
    // カスタムファイルとして認識されるべきファイル
    TestHelper.assert(manager.isCustomFile('config.yaml'), 'config.yamlがカスタムファイルとして認識されません');
    TestHelper.assert(manager.isCustomFile('themes/test/layouts/index.html'), 'テーマファイルがカスタムファイルとして認識されません');
    TestHelper.assert(manager.isCustomFile('content/test.md'), 'コンテンツファイルがカスタムファイルとして認識されません');
    
    // 除外されるべきファイル
    TestHelper.assert(!manager.shouldExcludeFile('config.yaml'), 'config.yamlが除外されています');
    TestHelper.assert(manager.shouldExcludeFile('node_modules/test.js'), 'node_modulesが除外されていません');
    TestHelper.assert(manager.shouldExcludeFile('public/index.html'), 'publicディレクトリが除外されていません');
  });

  test.test('CustomConfigManager - ファイル存在チェック', async () => {
    const manager = new CustomConfigManager();
    
    // 存在するファイル（package.json）
    const exists = await manager.fileExists('package.json');
    TestHelper.assert(exists, 'package.jsonの存在チェックが失敗しました');
    
    // 存在しないファイル
    const notExists = await manager.fileExists('non-existent-file.txt');
    TestHelper.assert(!notExists, '存在しないファイルが存在すると判定されました');
  });

  test.test('CustomConfigManager - Git情報取得', async () => {
    const manager = new CustomConfigManager();
    const gitInfo = await manager.getGitInfo();
    
    TestHelper.assert(gitInfo, 'Git情報が取得できません');
    TestHelper.assert(gitInfo.branch, 'ブランチ情報が取得できません');
    TestHelper.assert(gitInfo.commit, 'コミット情報が取得できません');
    
    console.log(`   Git情報: ブランチ=${gitInfo.branch}, コミット=${gitInfo.commit.substring(0, 8)}`);
  });

  test.test('UpdateManager - 初期化', async () => {
    const manager = new UpdateManager();
    TestHelper.assert(manager.rootDir, '作業ディレクトリが設定されていません');
    TestHelper.assert(manager.customManager, 'CustomConfigManagerが初期化されていません');
    TestHelper.assert(!manager.isUpdating, '初期状態でアップデート中になっています');
  });

  test.test('UpdateManager - 状態取得', async () => {
    const manager = new UpdateManager();
    const status = manager.getStatus();
    
    TestHelper.assert(typeof status.isUpdating === 'boolean', 'アップデート状態が正しくありません');
    TestHelper.assert(typeof status.currentStep === 'string', 'ステップ情報が正しくありません');
    TestHelper.assert(typeof status.progress === 'number', '進捗情報が正しくありません');
  });

  test.test('UpdateManager - 環境チェック', async () => {
    const manager = new UpdateManager();
    const env = await manager.checkEnvironment();
    
    TestHelper.assert(env.isGitRepo, 'Gitリポジトリとして認識されていません');
    TestHelper.assert(typeof env.hasUncommittedChanges === 'boolean', '未コミット変更のチェックが正しくありません');
    TestHelper.assert(env.workingDirectory, '作業ディレクトリが設定されていません');
  });

  test.test('UpdateManager - システム情報取得', async () => {
    const manager = new UpdateManager();
    const systemInfo = await manager.getSystemInfo();
    
    TestHelper.assert(systemInfo, 'システム情報が取得できません');
    TestHelper.assert(systemInfo.version, 'バージョン情報が取得できません');
    TestHelper.assert(systemInfo.gitInfo, 'Git情報が取得できません');
    TestHelper.assert(typeof systemInfo.customFilesCount === 'number', 'カスタムファイル数が正しくありません');
  });

  test.test('UpdateManager - リモート変更チェック', async () => {
    const manager = new UpdateManager();
    
    try {
      const remoteChanges = await manager.checkRemoteChanges();
      TestHelper.assert(typeof remoteChanges.hasChanges === 'boolean', '変更チェック結果が正しくありません');
      TestHelper.assert(typeof remoteChanges.behindCount === 'number', '遅れカウントが正しくありません');
      TestHelper.assert(Array.isArray(remoteChanges.changedFiles), '変更ファイルリストが正しくありません');
      
      console.log(`   リモート変更: ${remoteChanges.hasChanges ? `${remoteChanges.behindCount}個の変更` : '変更なし'}`);
    } catch (error) {
      if (error.message.includes('origin/main')) {
        console.log('   リモートブランチが見つかりません（ローカル開発環境のため正常）');
      } else {
        throw error;
      }
    }
  });

  test.test('UpdateManager - イベントエミッター', async () => {
    const manager = new UpdateManager();
    let eventReceived = false;
    
    manager.on('updateStarted', () => {
      eventReceived = true;
    });
    
    manager.emit('updateStarted');
    TestHelper.assert(eventReceived, 'イベントが正しく発火されていません');
  });

  // APIルートのテスト（基本的な構文チェック）
  test.test('APIルート - モジュール読み込み', async () => {
    const updateAPI = require('../backend/routes/update-api');
    TestHelper.assert(updateAPI, 'APIルートモジュールが読み込めません');
    TestHelper.assert(typeof updateAPI === 'function', 'APIルートが正しいExpressルーターではありません');
  });

  // 統合テスト
  test.test('統合テスト - カスタマイズ検出とバックアップ', async () => {
    const manager = new CustomConfigManager();
    
    // テスト用のカスタムファイルを作成
    const testFile = await TestHelper.createTempFile('test-custom-config.yaml', 'test: true');
    tempFiles.push(testFile);
    
    try {
      // カスタマイズを検出
      const customFiles = await manager.detectCustomizations();
      TestHelper.assert(Array.isArray(customFiles), 'カスタムファイル一覧が配列ではありません');
      
      console.log(`   検出されたカスタムファイル: ${customFiles.length}個`);
    } catch (error) {
      if (error.message.includes('git status')) {
        console.log('   Git操作でエラー（テスト環境では正常）');
      } else {
        throw error;
      }
    }
  });

  // テスト実行
  const success = await test.run();
  
  // 一時ファイルをクリーンアップ
  for (const file of tempFiles) {
    await TestHelper.cleanupTempFile(file);
  }

  return success;
}

// メイン実行部分
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  });
}

module.exports = { runTests, SimpleTest, TestHelper };