@echo off
setlocal
cd /d "%~dp0"
set "NOVA_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "NOVA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
if not "%NOVA_NODE%"=="node" if not exist "%NOVA_NODE%" (
  echo Node.js 24 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
"%NOVA_NODE%" -e "if(Number(process.versions.node.split('.')[0])<24)process.exit(1)"
if errorlevel 1 (
  echo Please install Node.js 24 or newer.
  pause
  exit /b 1
)
echo NovaCare - Clinic Management
echo Keep this window open while using NovaCare.
echo.
"%NOVA_NODE%" server.mjs
pause

