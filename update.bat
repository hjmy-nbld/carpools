@echo off
chcp 65001 >nul
title 同路人 - 更新代码
echo ============================================
echo   同路人 一键更新（拉取代码 + 装依赖 + 重编译）
echo ============================================
cd /d %~dp0

REM ---------- 1. 同步远程最新代码 ----------
echo [1/4] 拉取远程代码...
git pull --ff-only origin main
if errorlevel 1 (
  echo [WARN] fast-forward 拉取失败（可能有本地未提交改动）
  echo        如需强制覆盖本地改动，手动执行：git fetch --all ^&^& git reset --hard origin/main
  pause
  exit /b 1
)

REM ---------- 2. 后端依赖（用项目 venv，不用系统 pip） ----------
echo [2/4] 安装后端依赖...
if exist "backend\.venv\Scripts\python.exe" (
  backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
) else (
  echo [WARN] 未找到 backend\.venv，使用系统 pip（依赖可能装到系统环境）
  pip install -r backend\requirements.txt
)
if errorlevel 1 (
  echo [FAIL] 后端依赖安装失败
  pause
  exit /b 1
)

REM ---------- 3. 前端依赖 ----------
echo [3/4] 安装前端依赖...
call npm install
if errorlevel 1 (
  echo [FAIL] 前端依赖安装失败
  pause
  exit /b 1
)

REM ---------- 4. 重新编译小程序 ----------
echo [4/4] 重新编译小程序...
call npm.cmd run build:weapp
if errorlevel 1 (
  echo [FAIL] 小程序编译失败
  pause
  exit /b 1
)

echo.
echo ============================================
echo   更新完成！
echo   记得重启后端（run.bat），微信开发者工具刷新即可。
echo ============================================
pause