@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo TFI_NEW Python environment is missing.
  echo Run: python -m venv .venv
  echo Then: .venv\Scripts\python.exe -m pip install -r requirements.txt
  pause
  exit /b 1
)

if not exist ".env" (
  echo TFI_NEW .env configuration is missing.
  echo Copy .env.example to .env and configure the TFI2 URL and publishable key.
  pause
  exit /b 1
)

start "TFI_NEW Backend" /min cmd /k "set PYTHONPATH=%CD%\src && .venv\Scripts\python.exe -m tfi_backend.app"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:5100/"
endlocal
