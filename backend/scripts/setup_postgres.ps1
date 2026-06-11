# Setup PostgreSQL database and user for Velora
# Prefers system PostgreSQL or Docker (docker compose up db).
# Portable bundle was archived to backup_archive/local_postgres_bundle/

param(
    [string]$DbName = "inflation_prediction_db",
    [string]$DbUser = "inflation_app",
    [string]$DbPassword = "InflationDb2026!",
    [int]$Port = 5432
)

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path $BackendRoot -Parent
$ArchivedPgRoot = Join-Path (Split-Path $RepoRoot -Parent) "backup_archive\local_postgres_bundle"

function Find-Psql {
    $candidates = @(
        (Join-Path $ArchivedPgRoot "bin\psql.exe"),
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

$psql = Find-Psql
if (-not $psql) {
    Write-Error @"
psql not found. Use one of:
  1. docker compose up -d db
  2. Install PostgreSQL 15+ system-wide
  3. Restore portable bundle from backup_archive/local_postgres_bundle to backend/postgres
"@
}

function Invoke-Psql {
    param(
        [string]$Database = "postgres",
        [string]$Query
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $psql -h 127.0.0.1 -p $Port -U postgres -d $Database -c $Query 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return $code
}

$env:PGPASSWORD = "postgres"
$null = Invoke-Psql -Query "SELECT 1"

Write-Host "Creating role and database (idempotent)..."
$roleSql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DbUser') THEN
    CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPassword';
  END IF;
END `$`$;
"@
$null = Invoke-Psql -Query $roleSql

$ErrorActionPreference = "Continue"
$dbExists = (& $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DbName';" 2>&1)
$ErrorActionPreference = "Stop"

if (-not ("$dbExists" -match "1")) {
    $null = Invoke-Psql -Query "CREATE DATABASE $DbName OWNER $DbUser;"
} else {
    Write-Host "Database '$DbName' already exists - skipping create."
}

$null = Invoke-Psql -Query "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;"
$null = Invoke-Psql -Database $DbName -Query "GRANT ALL ON SCHEMA public TO $DbUser;"

Write-Host "PostgreSQL ready: $DbName on 127.0.0.1:$Port (user: $DbUser)"