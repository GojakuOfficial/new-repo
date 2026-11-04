@echo off
setlocal
title Lumina City Launcher

REM Lumina City portable launcher
REM Place this file beside the "dist" folder.

set "SITE_DIR=%~dp0dist"
set "PORT=8080"
set "URL=http://localhost:%PORT%"

if not exist "%SITE_DIR%\index.html" (
    echo.
    echo ERROR: Could not find dist\index.html.
    echo Make sure the "dist" folder is beside this launch.bat file.
    echo.
    pause
    exit /b 1
)

REM Prefer the Python launcher, then python.exe.
where py >nul 2>nul
if not errorlevel 1 (
    py -3 --version >nul 2>nul
    if not errorlevel 1 goto use_py
)

where python >nul 2>nul
if not errorlevel 1 (
    python --version >nul 2>nul
    if not errorlevel 1 goto use_python
)

REM Optional fallback: Node.js + npx (may need internet the first time).
where npx >nul 2>nul
if not errorlevel 1 goto use_npx

echo.
echo ERROR: Lumina City needs Python 3 or Node.js with npx to launch.
echo Install Python 3 from https://www.python.org/downloads/
echo During installation, enable "Add Python to PATH".
echo Then double-click launch.bat again.
echo.
pause
exit /b 1

:use_py
echo Starting Lumina City with Python...
start "Lumina City local server" /min cmd /c "cd /d ""%~dp0"" && py -3 -m http.server %PORT% --directory ""%SITE_DIR%"""
goto open_site

:use_python
echo Starting Lumina City with Python...
start "Lumina City local server" /min cmd /c "cd /d ""%~dp0"" && python -m http.server %PORT% --directory ""%SITE_DIR%"""
goto open_site

:use_npx
echo Python was not found. Trying Node.js with npx serve...
start "Lumina City local server" /min cmd /c "cd /d ""%~dp0"" && npx --yes serve ""%SITE_DIR%"" -l %PORT%"
goto open_site

:open_site
timeout /t 3 /nobreak >nul
start "" "%URL%"
echo.
echo Lumina City should now be opening in your browser.
echo Keep the local server window running while using the website.
echo To stop the server, close its window.
echo.
endlocal
