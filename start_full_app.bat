@echo off
title Evaluate Platform Launcher
echo ======================================================================
echo   Evaluate Platform -- Minimalist Editorial Architecture
echo ======================================================================
echo.
echo [1/2] Launching FastAPI Backend on http://localhost:8000...
start "Evaluate Backend (FastAPI)" /d "c:\Users\kumbh\OneDrive\Desktop\coding\eval_app" cmd /k "uvicorn api.main:app --reload --port 8000"

echo [2/2] Launching Vite Minimalist Frontend on http://localhost:5173...
timeout /t 2 >nul
start http://localhost:5173
cd /d "c:\Users\kumbh\OneDrive\Desktop\coding\eval_app\frontend"
call npm run dev
pause
