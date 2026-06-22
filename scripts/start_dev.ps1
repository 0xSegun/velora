# Start full Velora local dev stack: PostgreSQL + Backend + Frontend
$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot | Split-Path -Parent
$BackendRoot = Join-Path $RepoRoot "backend"
$FrontendRoot = Join-Path $RepoRoot "frontend"

function Test-PortOpen([int]$Port) {
    try {
        return [bool](Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue).TcpTestSucceeded
    } catch { return $false }
}

Write-Host "=== Velora Dev Stack ===" -ForegroundColor Cyan

# 1. PostgreSQL
& (Join-Path $BackendRoot "scripts\start_postgres.ps1")

# 2. Backend (skip if already healthy)
$backendUp = $false
if (Test-PortOpen 8000) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
        if ($health.status -eq "healthy") {
            Write-Host "Backend already healthy on http://127.0.0.1:8000"
            $backendUp = $true
        }
    } catch {}
}
if (-not $backendUp) {
    Write-Host "Starting backend on http://127.0.0.1:8000 ..."
    Push-Location $BackendRoot
    & .\venv\Scripts\python.exe -m alembic upgrade head | Out-Null
    Start-Process -FilePath ".\venv\Scripts\python.exe" `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000" `
        -WorkingDirectory $BackendRoot -WindowStyle Hidden
    Pop-Location
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortOpen 8000) {
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5
                if ($health.database -eq "connected") {
                    Write-Host "Backend ready (database connected)."
                    break
                }
            } catch {}
        }
        Start-Sleep -Seconds 2
    }
}

# 3. Frontend (skip if already running)
if (-not (Test-PortOpen 3000)) {
    Write-Host "Starting frontend on http://localhost:3000 ..."
    Push-Location $FrontendRoot
    Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $FrontendRoot -WindowStyle Hidden
    Pop-Location
    Start-Sleep -Seconds 8
} else {
    Write-Host "Frontend already running on http://localhost:3000"
}

Write-Host ""
Write-Host "URLs:" -ForegroundColor Green
Write-Host "  App:     http://localhost:3000"
Write-Host "  API:     http://127.0.0.1:8000"
Write-Host "  API Docs http://127.0.0.1:8000/docs"
Write-Host "  Admin:   http://localhost:3000/admin"
Write-Host "  Login:   admin@inflationplatform.com / Admin123!"