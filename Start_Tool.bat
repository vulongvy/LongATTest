@echo off
title Long AT Test - Launcher
chcp 65001 >nul
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start_Tool.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Da xay ra loi khi chay khoi tao. Nhan phim bat ky de thoat...
    pause >nul
)
