@echo off
setlocal

docker compose -f "%~dp0docker\compose.yml" down

endlocal
