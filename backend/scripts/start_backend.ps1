# Start Velora FastAPI backend with PostgreSQL
param(
    [switch]$SetupDb,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
Set-Location $BackendRoot

& "$PSScriptRoot\start_postgres.ps1"

if ($SetupDb) {
    & "$PSScriptRoot\setup_postgres.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "setup_postgres.ps1 returned exit code $LASTEXITCODE - continuing if PostgreSQL is already running."
    }
}

# Skip start if API is already healthy on this port
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
    if ($health.status -eq "healthy") {
        Write-Host "Backend already running on http://127.0.0.1:$Port (status: healthy)"
        exit 0
    }
} catch {
    # Not running - proceed with startup
}

Write-Host "Installing Python dependencies..."
pip install -r requirements.txt -q

Write-Host "Running Alembic migrations..."
python -m alembic upgrade head

Write-Host "Starting FastAPI server on port $Port..."
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port $Port