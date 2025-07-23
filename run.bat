@echo off
setlocal enabledelayedexpansion

:: AI Catalyst Launch Wizard - Execution Script
:: This script starts both frontend and backend servers and opens the browser

echo.
echo ========================================
echo  AI Catalyst Launch Wizard
echo ========================================
echo.
echo Starting the AI Catalyst Launch Wizard...
echo.

:: Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js not found
    echo.
    echo Please run install.bat first to set up the environment.
    echo.
    pause
    exit /b 1
)

:: Check if dependencies are installed
if not exist "node_modules" (
    echo ❌ ERROR: Frontend dependencies not installed
    echo.
    echo Please run install.bat first to install dependencies.
    echo.
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo ❌ ERROR: Backend dependencies not installed
    echo.
    echo Please run install.bat first to install dependencies.
    echo.
    pause
    exit /b 1
)

:: Check for port conflicts
echo [1/4] Checking for port conflicts...

netstat -an | findstr ":9655 " >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  WARNING: Port 9655 is already in use
    echo Another application may be running on this port.
    echo.
    echo Options:
    echo 1. Close other applications using port 9655
    echo 2. Continue anyway (may cause conflicts)
    echo.
    set /p choice="Continue anyway? (y/n): "
    if /i "!choice!" neq "y" (
        echo.
        echo Startup cancelled. Please close applications using port 9655 and try again.
        pause
        exit /b 1
    )
)

netstat -an | findstr ":9652 " >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  WARNING: Port 9652 is already in use
    echo Another application may be running on this port.
    echo.
    echo Options:
    echo 1. Close other applications using port 9652
    echo 2. Continue anyway (may cause conflicts)
    echo.
    set /p choice="Continue anyway? (y/n): "
    if /i "!choice!" neq "y" (
        echo.
        echo Startup cancelled. Please close applications using port 9652 and try again.
        pause
        exit /b 1
    )
)

echo [OK] Port check complete
echo.

:: Create log directory if it doesn't exist
if not exist "logs" mkdir "logs"

:: Start backend server
echo [2/4] Starting backend server (port 9652)...
echo.

start "AI Catalyst Backend" cmd /k "cd server && npm run dev"

:: Wait a moment for backend to start
timeout /t 5 /nobreak >nul

:: Start frontend server
echo [3/4] Starting frontend server (port 9655)...
echo.

start "AI Catalyst Frontend" cmd /k "npm run dev"

:: Wait for servers to start
echo [4/4] Waiting for servers to start...
echo This may take 30-60 seconds...
echo.

:: Wait up to 60 seconds for frontend to be ready
set /a counter=0
:wait_loop
timeout /t 3 /nobreak >nul
set /a counter+=3

:: Check if frontend is responding using PowerShell
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:9655' -TimeoutSec 3 -UseBasicParsing; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    goto servers_ready
)

if %counter% geq 60 (
    echo [WARNING] Servers are taking longer than expected to start...
    echo.
    echo You can:
    echo 1. Wait a bit longer and manually open http://localhost:9655
    echo 2. Check the server windows for error messages
    echo 3. Try running install.bat again if there are dependency issues
    echo.
    goto manual_open
)

echo [INFO] Still waiting for servers... (%counter%/60 seconds)
goto wait_loop

:servers_ready
echo [OK] Servers are ready!
echo.

:: Open browser automatically
echo Opening AI Catalyst Launch Wizard in your default browser...
echo.

start "" "http://localhost:9655"

:manual_open
echo ========================================
echo  🚀 AI Catalyst Launch Wizard Running
echo ========================================
echo.
echo Frontend: http://localhost:9655
echo Backend:  http://localhost:9652
echo.
echo The wizard should open automatically in your browser.
echo If not, manually navigate to: http://localhost:9655
echo.
echo Server Status:
echo - Two command windows should be open (Frontend and Backend)
echo - Keep both windows open while using the application
echo - You'll see server logs and status messages in those windows
echo.
echo To stop the servers:
echo 1. Close both server command windows, OR
echo 2. Press Ctrl+C in each server window
echo.
echo Troubleshooting:
echo - If the page doesn't load, wait 30 seconds and refresh
echo - Check server windows for error messages
echo - Ensure ports 9655 and 9652 are not blocked by firewall
echo.
echo Press any key to exit this window (servers will keep running)...
pause >nul
