# Start PostgreSQL + FastAPI for local development
$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent

& "$PSScriptRoot\start_postgres.ps1"

Set-Location $BackendRoot
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload