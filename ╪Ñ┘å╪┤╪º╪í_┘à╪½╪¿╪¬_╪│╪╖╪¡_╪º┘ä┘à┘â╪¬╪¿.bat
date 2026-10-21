@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo سيتم تجهيز مثبت موجة البرمجة لسطح المكتب...
call npm install
if errorlevel 1 (echo فشل تثبيت الحزم. تأكد من تثبيت Node.js واتصال الإنترنت.& pause & exit /b 1)
call npm run dist
if errorlevel 1 (echo فشل إنشاء المثبت.& pause & exit /b 1)
echo تم. افحص مجلد dist للعثور على ملف التثبيت.
pause
