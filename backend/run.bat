@echo off
chcp 65001 >nul
cd /d %~dp0
echo ============================================
echo   同路人 Python 后端启动中（MySQL: carpool）
echo   接口文档: http://127.0.0.1:8000/docs
echo ============================================

REM 自动终止占用 8000 端口的旧进程，避免 WinError 10048 端口冲突
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
  echo   终止旧后端进程 PID=%%a
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" run.py
) else (
  python run.py
)
pause
