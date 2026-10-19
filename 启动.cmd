@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js not found.
  echo   Please install Node.js first: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo   Installing dependencies for the first time...
  echo.
  call npm install
  if errorlevel 1 goto :failed
)

if not exist "dist\index.html" (
  echo.
  echo   Building the app for the first time...
  echo.
  call node "node_modules\vite\bin\vite.js" build
  if errorlevel 1 goto :failed
)

call node "tools\serve.mjs"
pause
exit /b 0

:failed
echo.
echo   Build failed. Check the messages above.
echo.
pause
exit /b 1
