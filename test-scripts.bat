@echo off
:: Test script to verify installation scripts work correctly

echo Testing AI Catalyst Installation Scripts
echo ========================================
echo.

:: Test 1: Check if Node.js detection works
echo [Test 1] Testing Node.js detection...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found - install.bat should catch this
) else (
    echo ✅ Node.js found: 
    node --version
)
echo.

:: Test 2: Check if npm is available
echo [Test 2] Testing npm availability...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found - install.bat should catch this
) else (
    echo ✅ npm found: 
    npm --version
)
echo.

:: Test 3: Check project structure
echo [Test 3] Testing project structure...
if exist "package.json" (
    echo ✅ Frontend package.json found
) else (
    echo ❌ Frontend package.json missing
)

if exist "server\package.json" (
    echo ✅ Backend package.json found
) else (
    echo ❌ Backend package.json missing
)

if exist "install.bat" (
    echo ✅ install.bat found
) else (
    echo ❌ install.bat missing
)

if exist "run.bat" (
    echo ✅ run.bat found
) else (
    echo ❌ run.bat missing
)
echo.

:: Test 4: Check port availability
echo [Test 4] Testing port availability...
netstat -an | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 3000 is in use - run.bat should detect this
) else (
    echo ✅ Port 3000 is available
)

netstat -an | findstr ":3001 " >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 3001 is in use - run.bat should detect this
) else (
    echo ✅ Port 3001 is available
)
echo.

:: Test 5: Check if dependencies are installed
echo [Test 5] Testing dependency installation status...
if exist "node_modules" (
    echo ✅ Frontend dependencies installed
) else (
    echo ❌ Frontend dependencies not installed - run install.bat
)

if exist "server\node_modules" (
    echo ✅ Backend dependencies installed
) else (
    echo ❌ Backend dependencies not installed - run install.bat
)
echo.

echo Test Summary:
echo - If you see any ❌ errors above, the installation scripts should handle them
echo - If you see ⚠️  warnings, the run script should detect and warn about them
echo - Run install.bat first, then run.bat to test the full setup
echo.
pause
