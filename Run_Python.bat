@echo off
title Long AT Test (Python Mode)
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================================
echo         ⚡ LONG AT TEST - CHE DO CHAY BACKEND PYTHON SERVER ⚡
echo ======================================================================
echo.

:: 1. Mo khoa cac file script phong truong hop Windows chan
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0scripts' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1

:: 2. Tim kiem trinh thong dich Python tren may
set "PY_CMD="

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python"
    goto :FOUND_PY
)

where py >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=py"
    goto :FOUND_PY
)

where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "PY_CMD=python3"
    goto :FOUND_PY
)

:: Thu tim trong duong dan mac dinh cua Windows AppData
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
    if exist "%%D\python.exe" (
        set "PY_CMD=%%D\python.exe"
        goto :FOUND_PY
    )
)

for /d %%D in ("C:\Python*") do (
    if exist "%%D\python.exe" (
        set "PY_CMD=%%D\python.exe"
        goto :FOUND_PY
    )
)

:FOUND_PY
if "%PY_CMD%"=="" (
    echo [LOI] Khong tim thay trinh thong dich Python tren may nay!
    echo Vui long cai dat Python hoac chay file "Start_Tool.bat" de tu dong tai bo cai .NET.
    echo.
    pause
    exit /b 1
)

echo [OK] Da tim thay Python: %PY_CMD%
echo Dang khoi chay may chu Long AT Test tai http://127.0.0.1:8765 ...
echo Trinh duyet se tu dong mo len trong giay lat...
echo (De dung tool, hay dong cua so console nay)
echo.

"%PY_CMD%" "%~dp0server.py"

pause
