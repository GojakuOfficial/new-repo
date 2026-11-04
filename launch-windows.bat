@echo off
setlocal enabledelayedexpansion
title LUMINA CITY - Offline Launcher

cd /d "%~dp0"

echo ================================================================
echo   LUMINA CITY - Autonomous Intelligent City Showcase
echo   Offline Local Launcher
echo ================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js detected. Starting zero-dependency offline server...
    echo.
    node launch.js
    goto :end
)

:: 2. Check if Python is installed as fallback
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python detected. Using Python HTTP server...
    if not exist "dist\index.html" (
        echo [!] Warning: "dist" folder not found.
        echo Please run "npm run build" first to generate the production build.
        pause
        goto :end
    )
    start "" "http://localhost:8080"
    python -m http.server 8080 --directory dist
    goto :end
)

where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Python 3 detected. Using Python HTTP server...
    if not exist "dist\index.html" (
        echo [!] Warning: "dist" folder not found.
        echo Please run "npm run build" first to generate the production build.
        pause
        goto :end
    )
    start "" "http://localhost:8080"
    python3 -m http.server 8080 --directory dist
    goto :end
)

echo [X] Neither Node.js nor Python were found in your PATH.
echo.
echo To run Lumina City offline, please ensure either Node.js or Python is installed.
echo.
pause

:end
