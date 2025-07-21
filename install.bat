@echo off
setlocal enabledelayedexpansion

:: AI Catalyst Launch Wizard - Automated Installation Script
:: This script sets up the complete development environment for non-technical users

echo.
echo ========================================
echo  AI Catalyst Launch Wizard Installer
echo ========================================
echo.
echo This script will automatically set up the AI Catalyst Launch Wizard
echo development environment on your computer.
echo.

:: Check if Node.js is installed and get version
echo [1/6] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Node.js is not installed or not found in PATH
    echo.
    echo Please install Node.js 18 or higher from:
    echo https://nodejs.org/en/download/
    echo.
    echo After installation, restart your computer and run this script again.
    echo.
    pause
    exit /b 1
)

:: Get Node.js version and check if it's 18+
for /f "tokens=1 delims=." %%a in ('node --version') do (
    set "major_version=%%a"
    set "major_version=!major_version:v=!"
)

if !major_version! lss 18 (
    echo.
    echo ❌ ERROR: Node.js version !major_version! is too old
    echo.
    echo AI Catalyst requires Node.js 18 or higher.
    echo Please update Node.js from: https://nodejs.org/en/download/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js version found:
node --version
echo.

:: Check if npm is available
echo [2/6] Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: npm is not available
    echo npm should be installed with Node.js. Please reinstall Node.js.
    pause
    exit /b 1
)

echo [OK] npm version found:
npm --version
echo.

:: Install frontend dependencies
echo [3/6] Installing frontend dependencies...
echo This may take a few minutes...
echo.

npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Failed to install frontend dependencies
    echo.
    echo Common solutions:
    echo 1. Check your internet connection
    echo 2. Try running as Administrator
    echo 3. Clear npm cache: npm cache clean --force
    echo.
    pause
    exit /b 1
)

echo [OK] Frontend dependencies installed successfully
echo.

:: Install backend dependencies
echo [4/6] Installing backend dependencies...
echo.

cd server
if not exist package.json (
    echo ❌ ERROR: server/package.json not found
    echo Please ensure you're running this script from the AI Catalyst root directory
    pause
    exit /b 1
)

npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Failed to install backend dependencies
    echo.
    echo Try running this script as Administrator or check your internet connection.
    echo.
    pause
    exit /b 1
)

echo [OK] Backend dependencies installed successfully
echo.

cd ..

:: Set up environment file
echo [5/6] Setting up environment configuration...

if not exist "server\.env" (
    if exist "server\.env.example" (
        copy "server\.env.example" "server\.env" >nul
        echo [OK] Created server/.env from template
    ) else (
        echo # AI Catalyst Environment Configuration > "server\.env"
        echo # This file contains development defaults >> "server\.env"
        echo. >> "server\.env"
        echo JWT_SECRET=dev-secret-key-change-in-production >> "server\.env"
        echo PORT=3001 >> "server\.env"
        echo NODE_ENV=development >> "server\.env"
        echo DATABASE_PATH=./data/ai-catalyst.db >> "server\.env"
        echo [OK] Created basic server/.env file
    )
) else (
    echo [OK] server/.env already exists
)
echo.

:: Create necessary directories
echo [6/6] Creating directory structure...

if not exist "server\data" mkdir "server\data"
if not exist "server\logs" mkdir "server\logs"
if not exist "server\uploads" mkdir "server\uploads"

echo [OK] Directory structure created
echo.

:: Installation complete
echo ========================================
echo  🎉 Installation Complete!
echo ========================================
echo.
echo The AI Catalyst Launch Wizard has been successfully installed.
echo.
echo Next steps:
echo 1. Double-click 'run.bat' to start the application
echo 2. Your browser will automatically open to http://localhost:3000
echo 3. Follow the wizard to explore the AI Catalyst system
echo.
echo If you encounter any issues:
echo - Check the troubleshooting section in README.md
echo - Ensure no other applications are using ports 3000 or 3001
echo - Try running as Administrator if you get permission errors
echo.
echo Press any key to exit...
pause >nul
