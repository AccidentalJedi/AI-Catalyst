@echo off
echo.
echo ========================================
echo   AI Catalyst Progress Check
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found. Please install Python to use this tool.
    echo.
    echo Alternative: Check GitHub Actions tab in your browser:
    echo https://github.com/AccidentalJedi/AI-Catalyst/actions
    pause
    exit /b 1
)

REM Install required packages if needed
echo 🔧 Installing required packages...
pip install requests pyyaml >nul 2>&1

REM Run progress dashboard
echo 🔍 Checking automation progress...
echo.
python progress_dashboard.py

echo.
echo 💡 TIP: You can also check:
echo    - GitHub Actions: https://github.com/AccidentalJedi/AI-Catalyst/actions
echo    - Pull Requests: https://github.com/AccidentalJedi/AI-Catalyst/pulls
echo.
pause
