# KamuiOSアップデートシステム

個々人のカスタマイズ設定を保持したまま、KamuiOSのコア機能を安全にアップデートするシステムです。

## 機能概要

### 主な機能

- **カスタム設定の自動検出・バックアップ**: ユーザーが変更したファイルを自動検出し、安全にバックアップ
- **gitコンフリクト回避**: 自動的にコンフリクトを解決し、カスタム設定を優先
- **段階的アップデート**: リアルタイム進捗表示でアップデートプロセスを可視化
- **自動ロールバック**: エラー時の自動復旧機能
- **直感的なUI**: フローティングボタンからワンクリックでアップデート

### アーキテクチャ

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   フロントエンド     │    │     バックエンド     │    │    Git リポジトリ    │
├─────────────────────┤    ├─────────────────────┤    ├─────────────────────┤
│ update-panel.html   │←→  │ CustomConfigManager │    │ origin/main         │
│ update-client.js    │    │ UpdateManager       │←→  │ (最新のKamuiOS)      │
│                     │    │ update-api.js       │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## インストールと使用方法

### 1. セットアップ

```bash
# 依存関係をインストール
npm install

# サーバーを起動
npm start
```

### 2. 使用方法

1. **画面右下のアップデートボタンをクリック**
2. **"最新版をチェック"ボタンでアップデートの有無を確認**
3. **アップデートがある場合、"アップデート実行"ボタンをクリック**
4. **進捗バーでプロセスを確認**
5. **完了後、必要に応じてカスタム設定を確認**

### 3. API エンドポイント

#### アップデート操作
- `POST /api/update/start` - アップデート開始
- `GET /api/update/status` - 進捗状況取得  
- `GET /api/update/check` - アップデート確認
- `POST /api/update/rollback` - ロールバック実行

#### カスタム設定管理
- `GET /api/update/custom-files` - カスタムファイル一覧
- `POST /api/update/backup` - バックアップ実行
- `POST /api/update/restore` - 復元実行
- `GET /api/update/backup-info` - バックアップ情報
- `DELETE /api/update/backup` - バックアップクリーンアップ

#### システム情報
- `GET /api/update/system-info` - システム情報取得
- `GET /api/update/history` - アップデート履歴

## 技術仕様

### CustomConfigManager

カスタマイズされたファイルの検出・管理を行います。

**検出対象パターン:**
- `config.yaml`, `config.toml`
- `.env`, `.env.local`  
- `themes/*/layouts/**/*.html`
- `themes/*/static/**/*`
- `content/**/*.md`
- `data/**/*.yaml`, `data/**/*.json`
- `static/css/*.css`, `static/js/*.js`

**除外パターン:**
- `node_modules/**`
- `.git/**`
- `public/**`（Hugo生成ディレクトリ）
- `.kamui-backup/**`

### UpdateManager  

安全なアップデートプロセスを管理します。

**アップデート手順:**
1. 環境チェック（Gitリポジトリ、作業ディレクトリ状態）
2. カスタマイズのバックアップ
3. リモート変更の確認・取得
4. gitプル実行
5. コンフリクト検出・自動解決
6. カスタム設定の復元
7. 完了通知

**コンフリクト解決戦略:**
- カスタムファイル: ローカル版を優先
- システムファイル: リモート版を優先
- 自動マージが不可能な場合: 手動解決を促す

### セキュリティ

- **パストラバーサル攻撃防止**: ファイルパスの検証
- **入力値サニタイズ**: APIリクエストの検証
- **権限チェック**: 適切なファイル・ディレクトリアクセス制限
- **安全なgit操作**: シェルインジェクション対策

## テスト

```bash
# ユニットテスト実行
npm test

# または
npm run test:unit
```

### テスト項目

- CustomConfigManager: 初期化、ファイル検出、バックアップ・復元
- UpdateManager: 環境チェック、リモート確認、アップデート処理
- API: エンドポイントの動作確認
- 統合テスト: 全体フローの検証

## トラブルシューティング

### よくある問題

**Q: アップデートボタンが表示されない**
A: `themes/kamui-docs/layouts/_default/baseof.html`に`{{ partial "update-panel" . }}`が追加されているか確認してください。

**Q: APIエラーが発生する**  
A: `server.js`に`app.use('/api', updateAPI);`が追加されているか確認してください。

**Q: カスタム設定が復元されない**
A: `.kamui-backup`ディレクトリの権限とバックアップファイルの整合性を確認してください。

**Q: gitコンフリクトが解決できない**
A: 手動でコンフリクトを解決後、「復元」ボタンでカスタム設定を再適用してください。

### ログの確認

```bash
# サーバーコンソール
npm start

# ブラウザーの開発者ツール
F12 → Console タブ

# アップデートパネルのログ
アップデートパネル → "ログを表示/非表示"ボタン
```

## ファイル構成

```
kamuios/
├── backend/
│   ├── CustomConfigManager.js      # カスタム設定管理
│   ├── UpdateManager.js           # アップデート制御  
│   └── routes/
│       └── update-api.js          # RESTful API
├── themes/kamui-docs/layouts/partials/
│   └── update-panel.html          # UIコンポーネント
├── static/js/
│   └── update-client.js           # クライアントサイドロジック
├── test/
│   └── update-system.test.js      # テストスイート
├── server.js                      # メインサーバー（統合済み）
└── UPDATE_SYSTEM_README.md        # このファイル
```

## ライセンス

このアップデートシステムはKamuiOSプロジェクトの一部として、同じライセンスの下で提供されます。

## 貢献

バグ報告や機能改善の提案は、KamuiOSプロジェクトのIssueページまでお願いします。

---

**Generated with [Claude Code](https://claude.ai/code)**