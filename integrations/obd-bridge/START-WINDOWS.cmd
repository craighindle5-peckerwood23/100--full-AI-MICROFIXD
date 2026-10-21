@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  python bridge.py --setup
) else (
  py -3 bridge.py --setup
)
pause
