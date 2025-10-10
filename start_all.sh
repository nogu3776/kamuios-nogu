#!/bin/bash

# Kamui OS 全サービス起動スクリプト
# このスクリプトは以下のサービスを起動します：
# - Node.js backend server (port 7777)
# - Hugo development server (port 1313)

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 色付きのログ出力用関数
function log_info() {
    printf "\033[1;34m[INFO]\033[0m %s\n" "$1"
}

function log_success() {
    printf "\033[1;32m[SUCCESS]\033[0m %s\n" "$1"
}

function log_error() {
    printf "\033[1;31m[ERROR]\033[0m %s\n" "$1"
}

function log_warn() {
    printf "\033[1;33m[WARNING]\033[0m %s\n" "$1"
}

# PIDファイルの設定
PIDS_DIR="$SCRIPT_DIR/.pids"
mkdir -p "$PIDS_DIR"

# .envファイルの存在確認
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    log_error ".env file not found! Please copy env.sample to .env and configure it."
    exit 1
fi

# 既存のプロセスを停止する関数
function stop_all() {
    log_info "Stopping all services..."
    
    # Node.js server
    if [ -f "$PIDS_DIR/node_server.pid" ]; then
        PID=$(cat "$PIDS_DIR/node_server.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            log_info "Stopped Node.js server (PID: $PID)"
        fi
        rm -f "$PIDS_DIR/node_server.pid"
    fi
    
    # Hugo server
    if [ -f "$PIDS_DIR/hugo_server.pid" ]; then
        PID=$(cat "$PIDS_DIR/hugo_server.pid")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            log_info "Stopped Hugo server (PID: $PID)"
        fi
        rm -f "$PIDS_DIR/hugo_server.pid"
    fi
}

# Ctrl+Cで終了時にすべてのサービスを停止
trap 'printf "\n"; log_warn "Interrupted. Stopping all services..."; stop_all; exit 0' INT TERM

# 引数チェック
if [ "$1" = "stop" ]; then
    stop_all
    log_success "All services stopped."
    exit 0
fi

# 既存のプロセスがあれば停止
stop_all

# 環境変数を読み込む
log_info "Loading environment variables from .env..."
if [ -f .env ]; then
    set -a  # 自動的にexportする
    source .env
    set +a  # 自動exportを無効化
else
    log_error ".env file not found!"
    exit 1
fi

# 必要な環境変数の確認
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$CLAUDE_API_KEY" ]; then
    log_error "ANTHROPIC_API_KEY or CLAUDE_API_KEY must be set in .env file!"
    exit 1
fi

# 環境変数の確認（デバッグ用）
log_info "Environment variables loaded:"
log_info "  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:0:20}...${ANTHROPIC_API_KEY: -4}"
log_info "  CLAUDE_MCP_CONFIG_PATH: $CLAUDE_MCP_CONFIG_PATH"
log_info "  CLAUDE_SKIP_PERMISSIONS: $CLAUDE_SKIP_PERMISSIONS"
log_info "  CLAUDE_DEBUG: $CLAUDE_DEBUG"

if [ -z "$CLAUDE_MCP_CONFIG_PATH" ]; then
    log_error "CLAUDE_MCP_CONFIG_PATH must be set in .env file!"
    exit 1
fi

if [ ! -f "$CLAUDE_MCP_CONFIG_PATH" ]; then
    log_error "MCP config file not found at: $CLAUDE_MCP_CONFIG_PATH"
    exit 1
fi

# ログディレクトリの作成
LOGS_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOGS_DIR"

# Hugoの生成キャッシュをクリア（古いmain.js等が配信されるのを防ぐ）
GEN_DIR="$SCRIPT_DIR/resources/_gen"
if [ -d "$GEN_DIR" ]; then
    log_info "Clearing Hugo generated assets cache..."
    rm -rf "$GEN_DIR"
fi

# 1. Node.js backend server の起動
log_info "Starting Node.js backend server on port ${PORT:-7777}..."
cd "$SCRIPT_DIR/backend"
nohup node server.js > "$LOGS_DIR/node_server.log" 2>&1 &
NODE_PID=$!
echo $NODE_PID > "$PIDS_DIR/node_server.pid"
sleep 2

# Node.jsサーバーの起動確認
if kill -0 $NODE_PID 2>/dev/null; then
    log_success "Node.js server started (PID: $NODE_PID)"
else
    log_error "Failed to start Node.js server. Check logs/node_server.log for details."
    exit 1
fi

# 2. Hugo development server の起動
log_info "Starting Hugo development server on port 1313..."
cd "$SCRIPT_DIR"
nohup hugo server -D -p 1313 > "$LOGS_DIR/hugo_server.log" 2>&1 &
HUGO_PID=$!
echo $HUGO_PID > "$PIDS_DIR/hugo_server.pid"
sleep 3

# Hugoサーバーの起動確認
if kill -0 $HUGO_PID 2>/dev/null; then
    log_success "Hugo server started (PID: $HUGO_PID)"
else
    log_error "Failed to start Hugo server. Check logs/hugo_server.log for details."
    exit 1
fi

# サービス情報の表示
printf "\n"
log_success "All services started successfully!"
printf "\n"
printf "Service URLs:\n"
printf "  - Kamui OS (Hugo):     http://localhost:1313/\n"
printf "  - Node.js API:         http://localhost:%s/\n" "${PORT:-7777}"
printf "\n"
printf "Log files:\n"
printf "  - Node.js:    logs/node_server.log\n"
printf "  - Hugo:       logs/hugo_server.log\n"
printf "\n"
printf "To stop all services, run: ./start_all.sh stop\n"
printf "Press Ctrl+C to stop all services and exit.\n"
printf "\n"

# ブラウザを自動で開く
log_info "Opening browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "http://localhost:1313/"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if command -v xdg-open > /dev/null; then
        xdg-open "http://localhost:1313/"
    elif command -v gnome-open > /dev/null; then
        gnome-open "http://localhost:1313/"
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    start "http://localhost:1313/"
fi

# ログをtailして表示（すべてのサービスのログを監視）
log_info "Monitoring logs (press Ctrl+C to stop all services)..."
tail -f "$LOGS_DIR/node_server.log" "$LOGS_DIR/hugo_server.log"
