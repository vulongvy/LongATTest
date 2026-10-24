@echo off
title Long AT Test - Khoi Tao Project Tren May Moi
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================================
echo         ⚡ LONG AT TEST - KHOI TAO PROJECT TREN MAY TINH MOI ⚡
echo ======================================================================
echo.

:: 1. Mo khoa file de tranh bi Windows chan
echo [1/3] Dang mo khoa cac file ma nguon va scripts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0' -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1
echo       [OK] Da giai phong quyen han bao mat file.

:: 2. Kiem tra cong cu tren may
echo [2/3] Kiem tra cong cu lap trinh co san tren may:
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo       [+] Git: DA CO
) else (
    echo       [-] Git: CHUA CO
)

where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo       [+] Python: DA CO
) else (
    echo       [-] Python: CHUA CO
)

where dotnet >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo       [+] .NET SDK: DA CO
) else (
    echo       [-] .NET SDK: CHUA CO
)

:: 3. Mo tai lieu Implementation Plan
echo.
echo [3/3] Dang mo tai lieu Implementation Plan & Lich trinh chinh sua...
start notepad "%~dp0LICH_TRINH_CHINH_SUA_IMPLEMENTATION_PLAN.txt"

echo.
echo ======================================================================
echo BAN CO THE BAT DAU "VIBE CODE" NGAY TREN MAY TINH MOI!
echo - De chay thu tool bang Python: Nhap dup vao [ Run_Python.bat ]
echo - De chay thu tool ban EXE:     Nhap dup vao [ Start_Tool.bat ]
echo ======================================================================
echo.
pause
