# Start portable PostgreSQL for local Velora development (idempotent)
param([int]$Port = 5432)

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path $BackendRoot -Parent
$PgRoot = Join-Path (Split-Path $RepoRoot -Parent) "backup_archive\local_postgres_bundle"
$data = Join-Path $PgRoot "data"
$postgresExe = Join-Path $PgRoot "bin\postgres.exe"
$pgCtl = Join-Path $PgRoot "bin\pg_ctl.exe"

if (-not (Test-Path $postgresExe)) {
    Write-Error "Portable PostgreSQL not found at $PgRoot. Install PostgreSQL or restore the bundle."
}

function Test-PostgresPort {
    param([int]$TargetPort)
    try {
        $result = Test-NetConnection -ComputerName 127.0.0.1 -Port $TargetPort -WarningAction SilentlyContinue
        return [bool]$result.TcpTestSucceeded
    } catch {
        return $false
    }
}

if (Test-PostgresPort -TargetPort $Port) {
    Write-Host "PostgreSQL already listening on 127.0.0.1:$Port"
    exit 0
}

$pidFile = Join-Path $data "postmaster.pid"
if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Starting PostgreSQL on 127.0.0.1:$Port ..."
Start-Process -FilePath $postgresExe `
    -ArgumentList "-D", $data, "-p", "$Port", "-c", "listen_addresses=127.0.0.1" `
    -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(15)
while ((Get-Date) -lt $deadline) {
    if (Test-PostgresPort -TargetPort $Port) {
        Write-Host "PostgreSQL ready."
        exit 0
    }
    Start-Sleep -Seconds 1
}

& $pgCtl status -D $data 2>&1
Write-Error "PostgreSQL failed to start on port $Port. Check $PgRoot\postgres.log"