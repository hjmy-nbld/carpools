@echo off
chcp 65001 >nul
title 同路人 - 一键启动
cd /d %~dp0
echo ============================================
echo   同路人 一键启动
echo   窗口1: 后端 FastAPI（run.bat，含自动清端口）
echo   窗口2: 小程序 watch 编译（本窗口，改动自动重编译）
echo ============================================

REM ---------- 1. 新窗口启动后端 ----------
start /min "同路人后端" cmd /k "cd /d %~dp0backend && call run.bat"

REM 等后端先起 2 秒
timeout /t 2 /nobreak >nul

REM ---------- 2. 本窗口启动小程序 watch 编译 ----------
echo 开始小程序 watch 编译（改动自动重编译，Ctrl+C 退出）...
call npm.cmd run dev:weapp

pause