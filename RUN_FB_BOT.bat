@echo off
title Green Health FB Realtime Bot 24/7
color 0A
cd /d "%~dp0"

echo ==========================================================
echo   GREEN HEALTH FB REALTIME AI BOT (24/7 AUTO-RESTART)
echo ==========================================================
echo Starting bot engine...

:loop
node scripts\fb_realtime_bot.js
echo.
echo [WARNING] Bot engine exited or network dropped.
echo Auto-restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
