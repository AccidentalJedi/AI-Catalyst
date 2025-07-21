@echo off
:: Quick test to verify the AI Catalyst installation scripts work

echo Testing AI Catalyst Installation Scripts
echo ========================================
echo.

:: Test if the application is running
echo [1/3] Testing if frontend is accessible...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 3 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host '[OK] Frontend is running at http://localhost:3000' } else { Write-Host '[ERROR] Frontend returned status:' $response.StatusCode } } catch { Write-Host '[ERROR] Frontend is not accessible' }"

echo.
echo [2/3] Testing if backend is accessible...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001' -TimeoutSec 3 -UseBasicParsing; if ($response.StatusCode -eq 404) { Write-Host '[OK] Backend is running at http://localhost:3001 (404 expected for root)' } else { Write-Host '[INFO] Backend returned status:' $response.StatusCode } } catch { Write-Host '[ERROR] Backend is not accessible' }"

echo.
echo [3/3] Testing browser access...
echo Opening browser to test the wizard...
start "" "http://localhost:3000"

echo.
echo ========================================
echo Test Results Summary:
echo ========================================
echo.
echo If you see:
echo - [OK] Frontend is running - The wizard should open in your browser
echo - [OK] Backend is running - The API server is responding
echo.
echo If you see [ERROR] messages:
echo - Make sure you ran install.bat first
echo - Make sure you ran run.bat and it's still running
echo - Check that no other applications are using ports 3000/3001
echo.
echo The AI Catalyst Launch Wizard should now be accessible at:
echo http://localhost:3000
echo.
pause
