param(
    [int]$Port = 8076,
    [switch]$BuildOnly,
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$ComposeFile = Join-Path $Root "docker\compose.yml"
$KeyFile = Join-Path $Root "inventory-photo-kit\apikey_test"

if (-not (Test-Path $ComposeFile)) {
    Write-Error "Missing docker\compose.yml"
    exit 1
}

if (-not (Test-Path $KeyFile)) {
    Write-Warning "Missing inventory-photo-kit\apikey_test. The app will start, but classification needs a Gemini key."
} elseif ((Get-Item $KeyFile).PSIsContainer) {
    Write-Error "inventory-photo-kit\apikey_test must be a file, not a folder."
    exit 1
} elseif ((Get-Content $KeyFile -First 1).Trim() -eq "PASTE_GEMINI_API_KEY_HERE") {
    Write-Warning "inventory-photo-kit\apikey_test still contains the placeholder. Replace it with your Gemini key before classifying photos."
}

if (-not $BuildOnly) {
    $PortInUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($PortInUse) {
        Write-Warning "Port $Port is already in use. Stop the other server or run: start-docker.bat 8090"
        exit 1
    }
}

$env:PORT = "$Port"

$buildArgs = @("compose", "-f", $ComposeFile, "build")
if ($NoCache) {
    $buildArgs += "--no-cache"
}
$buildArgs += "torxflow-sorter"

docker @buildArgs

if ($BuildOnly) {
    exit 0
}

docker compose -f $ComposeFile up -d torxflow-sorter

Write-Host "TorxFlow is starting on http://localhost:$Port/sorter"
Write-Host "Health check: http://localhost:$Port/api/health"
