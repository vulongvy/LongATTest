@echo off
title Long AT Test (Administrator)
chcp 65001 >nul
cd /d "%~dp0"

powershell -Command "Start-Process '%~dp0LongATTest.exe' -Verb RunAs"
