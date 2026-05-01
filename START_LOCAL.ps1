param(
    [int]$BackendPort = 8076,
    [int]$FrontendPort = 5192
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Web = Join-Path $Root "web"
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Host "Missing virtual environment. Run the setup commands from README.md first." -ForegroundColor Yellow
    exit 1
}

Write-Host "Starting backend on port $BackendPort..."
Start-Process powershell -WorkingDirectory $Backend -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:SKIP_AUTH='1'; `$env:DEV_GARAGE_ID='local-dev'; & '$Python' -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort"
)

Write-Host "Starting frontend on port $FrontendPort..."
Start-Process powershell -WorkingDirectory $Web -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:VITE_CLASSIFY_API_URL='http://127.0.0.1:$BackendPort'; npm run dev -- --host 0.0.0.0 --port $FrontendPort --strictPort"
)

Write-Host "Open http://localhost:$FrontendPort/sorter"
