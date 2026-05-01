@echo off
setlocal

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8076"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-docker.ps1" -Port %PORT%

endlocal
