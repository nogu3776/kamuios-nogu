@echo off
REM Kamui OS 全サービス起動スクリプト (Windows版)
REM このスクリプトは以下のサービスを起動します：
REM - Node.js backend server (port 7777)
REM - Hugo development server (port 1313)

setlocal enabledelayedexpansion

REM スクリプトのディレクトリを取得
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM 色付きログ用の関数を定義
set "ESC="

REM PIDファイルの設定
set "PIDS_DIR=%SCRIPT_DIR%.pids"
if not exist "%PIDS_DIR%" mkdir "%PIDS_DIR%"

REM ログディレクトリの作成
set "LOGS_DIR=%SCRIPT_DIR%logs"
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM .envファイルの存在確認
if not exist "%SCRIPT_DIR%.env" (
    echo [ERROR] .env file not found! Please copy env.sample to .env and configure it.
    exit /b 1
)

REM 停止処理
if "%1"=="stop" (
    echo [INFO] Stopping all services...

    REM Node.js server
    if exist "%PIDS_DIR%\node_server.pid" (
        set /p NODE_PID=<"%PIDS_DIR%\node_server.pid"
        taskkill /PID !NODE_PID! /F >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            echo [INFO] Stopped Node.js server (PID: !NODE_PID!)
        )
        del "%PIDS_DIR%\node_server.pid"
    )

    REM Hugo server
    if exist "%PIDS_DIR%\hugo_server.pid" (
        set /p HUGO_PID=<"%PIDS_DIR%\hugo_server.pid"
        taskkill /PID !HUGO_PID! /F >nul 2>&1
        if !ERRORLEVEL! equ 0 (
            echo [INFO] Stopped Hugo server (PID: !HUGO_PID!)
        )
        del "%PIDS_DIR%\hugo_server.pid"
    )

    echo [SUCCESS] All services stopped.
    exit /b 0
)

REM 既存のプロセスを停止
call "%~f0" stop >nul 2>&1

REM .envファイルを読み込む (PowerShellを使用)
echo [INFO] Loading environment variables from .env...
for /f "usebackq tokens=*" %%a in (`powershell -Command "Get-Content .env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object { $_.Trim() }"`) do (
    set "%%a"
)

REM 必要な環境変数の確認
if "%ANTHROPIC_API_KEY%"=="" if "%CLAUDE_API_KEY%"=="" (
    echo [ERROR] ANTHROPIC_API_KEY or CLAUDE_API_KEY must be set in .env file!
    exit /b 1
)

REM 環境変数の確認（デバッグ用）
echo [INFO] Environment variables loaded:
echo [INFO]   ANTHROPIC_API_KEY: %ANTHROPIC_API_KEY:~0,20%...
echo [INFO]   KAMUI_CODE_CONFIG_PATH: %KAMUI_CODE_CONFIG_PATH%

if "%KAMUI_CODE_CONFIG_PATH%"=="" (
    echo [ERROR] KAMUI_CODE_CONFIG_PATH must be set in .env file!
    exit /b 1
)

if not exist "%KAMUI_CODE_CONFIG_PATH%" (
    echo [ERROR] Kamui Code config file not found at: %KAMUI_CODE_CONFIG_PATH%
    exit /b 1
)

REM Hugoの生成キャッシュをクリア
set "GEN_DIR=%SCRIPT_DIR%resources\_gen"
if exist "%GEN_DIR%" (
    echo [INFO] Clearing Hugo generated assets cache...
    rmdir /s /q "%GEN_DIR%"
)

REM 1. Node.js backend server の起動
echo [INFO] Starting Node.js backend server on port %PORT%...
cd /d "%SCRIPT_DIR%backend"
start /b "" cmd /c "node server.js > "%LOGS_DIR%\node_server.log" 2>&1"

REM プロセスIDを取得して保存（PowerShellを使用）
for /f %%i in ('powershell -Command "(Get-Process node | Select-Object -Last 1).Id"') do set "NODE_PID=%%i"
echo !NODE_PID! > "%PIDS_DIR%\node_server.pid"
timeout /t 2 /nobreak >nul

REM Node.jsサーバーの起動確認
tasklist /FI "PID eq !NODE_PID!" 2>nul | find "!NODE_PID!" >nul
if !ERRORLEVEL! equ 0 (
    echo [SUCCESS] Node.js server started (PID: !NODE_PID!)
) else (
    echo [ERROR] Failed to start Node.js server. Check logs\node_server.log for details.
    exit /b 1
)

REM 2. Hugo development server の起動
echo [INFO] Starting Hugo development server on port 1313...
cd /d "%SCRIPT_DIR%"
start /b "" cmd /c "hugo server -D -p 1313 > "%LOGS_DIR%\hugo_server.log" 2>&1"

REM プロセスIDを取得して保存
for /f %%i in ('powershell -Command "(Get-Process hugo | Select-Object -Last 1).Id"') do set "HUGO_PID=%%i"
echo !HUGO_PID! > "%PIDS_DIR%\hugo_server.pid"
timeout /t 3 /nobreak >nul

REM Hugoサーバーの起動確認
tasklist /FI "PID eq !HUGO_PID!" 2>nul | find "!HUGO_PID!" >nul
if !ERRORLEVEL! equ 0 (
    echo [SUCCESS] Hugo server started (PID: !HUGO_PID!)
) else (
    echo [ERROR] Failed to start Hugo server. Check logs\hugo_server.log for details.
    exit /b 1
)

REM サービス情報の表示
echo.
echo [SUCCESS] All services started successfully!
echo.
echo Service URLs:
echo   - Kamui OS (Hugo):     http://localhost:1313/
echo   - Node.js API:         http://localhost:%PORT%/
echo.
echo Log files:
echo   - Node.js:    logs\node_server.log
echo   - Hugo:       logs\hugo_server.log
echo.
echo To stop all services, run: start_all.bat stop
echo Press Ctrl+C to stop monitoring logs.
echo.

REM ブラウザを自動で開く
echo [INFO] Opening browser...
start http://localhost:1313/

REM ログをtailして表示（PowerShellを使用）
echo [INFO] Monitoring logs (press Ctrl+C to stop)...
powershell -Command "Get-Content -Path '%LOGS_DIR%\node_server.log','%LOGS_DIR%\hugo_server.log' -Wait"

endlocal
