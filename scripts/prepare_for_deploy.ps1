# Remove local dev artifacts and regenerate the Velora deployment package.
# For full optimization (audit + report), use scripts/production_optimize.ps1 instead.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Remove-IfExists([string]$Path) {
    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
        Write-Host "Removed: $Path"
    }
}

$beforeMb = [math]::Round(
    (Get-ChildItem $Root -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2
)

# Large build / dependency caches
Remove-IfExists (Join-Path $Root "frontend\.next")
Remove-IfExists (Join-Path $Root "frontend\node_modules")
Remove-IfExists (Join-Path $Root "frontend\tsconfig.tsbuildinfo")

# IDE / session / MCP artifacts
Remove-IfExists (Join-Path $Root "terminals")
Remove-IfExists (Join-Path $Root "mcps")

# Python caches
Get-ChildItem -Path $Root -Recurse -Directory -Filter "__pycache__" -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
Get-ChildItem -Path $Root -Recurse -Directory -Filter ".pytest_cache" -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force

# Backend runtime logs (not needed for export)
Remove-IfExists (Join-Path $Root "backend\logs")

# Empty local-only placeholder dirs
@(
    "cache", "temp", "generated_reports", "dataset_archive", "datasets_archive",
    "external_storage", "old_models", "backup_archive"
) | ForEach-Object { Remove-IfExists (Join-Path $Root $_) }

# Dev-only docs and one-off scripts
@(
    "frontend\AGENTS.md", "frontend\CLAUDE.md",
    "backend\scripts\patch_velora_branding_db.py",
    "backend\scripts\generate_currency_catalog.py",
    "backend\scripts\verify_intelligence.py",
    "scripts\project_storage_audit.ps1",
    "optimization\audit_before.json",
    "optimization\audit_after.json",
    "optimization\audit_after_cleanup.json",
    "optimization\PROJECT_OPTIMIZATION_REPORT.md",
    "optimization\velora-deploy.zip"
) | ForEach-Object { Remove-IfExists (Join-Path $Root $_) }

# Recreate upload dirs for branding assets
$brandingDir = Join-Path $Root "backend\uploads\branding"
New-Item -ItemType Directory -Path $brandingDir -Force | Out-Null
$gitkeep = Join-Path $brandingDir ".gitkeep"
if (-not (Test-Path $gitkeep)) { New-Item -ItemType File -Path $gitkeep -Force | Out-Null }

& (Join-Path $Root "scripts\create_deployment_package.ps1")

$afterMb = [math]::Round(
    (Get-ChildItem $Root -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 2
)

Write-Host ""
Write-Host "Deploy prep complete."
Write-Host "Before: $beforeMb MB"
Write-Host "After:  $afterMb MB"