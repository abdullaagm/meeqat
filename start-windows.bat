@echo off
title Miqat Prayer Display
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org and run this again. & pause & exit /b)
node server.js
pause
