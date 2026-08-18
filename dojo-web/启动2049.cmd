@echo off
chcp 65001 >nul
title 2049 Local Workspace
cd /d "%~dp0"

if not exist "node_modules\.bin\vite.cmd" (
  echo [2049] 缺少本地依赖，请先在项目目录执行 pnpm install。
  pause
  exit /b 1
)

echo [2049] 正在启动本地工作台...
echo [2049] 地址：http://127.0.0.1:5191/#/today
echo [2049] 关闭本窗口即可停止服务。
echo.

call "node_modules\.bin\vite.cmd" --host 127.0.0.1 --port 5191 --strictPort --open /#/today

if errorlevel 1 (
  echo.
  echo [2049] 启动失败。若 5191 已在运行，请直接打开上面的地址。
  pause
)
