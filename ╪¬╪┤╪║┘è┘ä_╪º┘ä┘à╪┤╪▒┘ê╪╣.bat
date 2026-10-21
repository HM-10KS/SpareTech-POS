@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo تشغيل منظومة موجة البرمجة...
call npm start
if errorlevel 1 pause
