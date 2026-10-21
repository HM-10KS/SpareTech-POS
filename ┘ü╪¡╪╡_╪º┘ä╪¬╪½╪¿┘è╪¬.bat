@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Node:
node -v
echo NPM:
npm -v
echo Electron:
npm list electron
pause
