@echo off
setlocal
cd /d "%~dp0"

echo.
echo =========================  VENV CHECK  =========================
echo [STATUS] Project directory: %CD%
echo.

if exist "venv\" (
  echo [STATUS] Folder "venv" found - using existing virtual environment.
) else (
  echo [STATUS] Folder "venv" not found - creating virtual environment...
  python -m venv venv
  if errorlevel 1 (
    echo [ERROR] Failed to create venv with: python -m venv venv
    pause
    exit /b 1
  )
  echo [STATUS] Virtual environment created successfully.
)

echo.
echo [STATUS] Syncing dependencies from requirements.txt ...
venv\Scripts\pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed.
  pause
  exit /b 1
)
echo [STATUS] Dependencies are up to date.

echo.
echo =========================  ACTIVATE VENV  =========================
echo [STATUS] Activating virtual environment...
call venv\Scripts\activate
if errorlevel 1 (
  echo [ERROR] Failed to activate venv. Tried: call venv\Scripts\activate
  pause
  exit /b 1
)
echo [STATUS] Virtual environment is active.

echo.
echo =========================  NGROK MENU  =========================
echo   [1] Run locally only (http://localhost:5000^)
echo   [2] Run with ngrok tunnel (https://dif.ngrok.app^)
echo.
set /p LAUNCH_CHOICE="Enter your choice (1 or 2): "

if "%LAUNCH_CHOICE%"=="2" goto run_with_ngrok
if "%LAUNCH_CHOICE%"=="1" goto run_local_only

echo [STATUS] Unrecognized choice "%LAUNCH_CHOICE%" - defaulting to local only.
goto run_local_only

:run_local_only
echo.
echo =========================  RUN LOCAL  =========================
echo [STATUS] Starting Flask in the foreground (http://localhost:5000^) ...
cd /d "%~dp0prompt-builder"
python app.py
goto done

:run_with_ngrok
echo.
echo =========================  RUN + NGROK  =========================
echo [STATUS] Starting Flask in the background...
cd /d "%~dp0prompt-builder"
start /B python app.py
cd /d "%~dp0"
echo [STATUS] Waiting 2 seconds for Flask to bind to port 5000...
timeout /t 2 /nobreak
echo Tunnel live at https://dif.ngrok.app
echo [STATUS] Starting ngrok (static domain dif.ngrok.app, port 5000^) ...
f:\ngrok\ngrok http --domain=dif.ngrok.app 5000
goto done

:done
echo.
echo =========================  END  =========================
pause
endlocal
