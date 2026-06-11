# Start PostgreSQL + FastAPI for local development
$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path $BackendRoot -Parent
$PgRoot = Join-Path (Split-Path $RepoRoot -Parent) "backup_archive\local_postgres_bundle"

if (Test-Path (Join-Path $PgRoot "bin\pg_ctl.exe")) {
    $data = Join-Path $PgRoot "data"
    $status = & (Join-Path $PgRoot "bin\pg_ctl.exe") status -D $data 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Starting PostgreSQL..."
        if (Test-Path (Join-Path $data "postmaster.pid")) {
            Remove-Item (Join-Path $data "postmaster.pid") -Force -ErrorAction SilentlyContinue
        }
        & (Join-Path $PgRoot "bin\pg_ctl.exe") start -D $data -l (Join-Path $PgRoot "postgres.log") -o "-p 5432"
        Start-Sleep -Seconds 4
    } else {
        Write-Host "PostgreSQL already running."
    }
} else {
    Write-Warning "Portable PostgreSQL not found. Ensure PostgreSQL is running on port 5432."
}

Set-Location $BackendRoot
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload