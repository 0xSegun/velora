# Velora production optimization — audit, cleanup, archive, deploy package.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Get-DirSizeMb([string]$Path) {
    if (-not (Test-Path $Path)) { return 0 }
    $bytes = (Get-ChildItem $Path -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { -not $_.PSIsContainer } | Measure-Object -Property Length -Sum).Sum
    return [math]::Round(($bytes / 1MB), 2)
}

function Remove-IfExists([string]$Path) {
    if (-not (Test-Path $Path)) { return $false }
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        return $true
    } catch {
        Write-Warning "Could not remove (file may be locked): $Path"
        return $false
    }
}

$removed = [System.Collections.Generic.List[string]]::new()
$beforeMb = Get-DirSizeMb $Root

# ── 1. Storage audit ────────────────────────────────────────────────────────
& C:\Python313\python.exe (Join-Path $Root "scripts\project_storage_audit.py")

# ── 2. Remove development artifacts ─────────────────────────────────────────
$artifactPaths = @(
    "frontend\.next",
    "frontend\node_modules",
    "frontend\tsconfig.tsbuildinfo",
    "terminals",
    "mcps",
    "cache",
    "temp",
    "generated_reports",
    "backend\cache",
    "backend\logs",
    "backend\__pycache__"
)
foreach ($rel in $artifactPaths) {
    if (Remove-IfExists (Join-Path $Root $rel)) { $removed.Add($rel) }
}

Get-ChildItem -Path $Root -Recurse -Directory -Filter "__pycache__" -Force -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force; $removed.Add($_.FullName.Replace($Root + "\", "")) }
foreach ($cache in @(".pytest_cache", ".mypy_cache", ".ruff_cache")) {
    Get-ChildItem -Path $Root -Recurse -Directory -Filter $cache -Force -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force; $removed.Add($_.FullName.Replace($Root + "\", "")) }
}

# Dev dump files
@(
    "backend\_openapi.json",
    "backend\_map.json",
    "backend_final.log",
    "~`$APTERS_FOUR_AND_FIVE.docx"
) | ForEach-Object {
    $p = Join-Path $Root $_
    if (Remove-IfExists $p) { $removed.Add($_) }
}

# ── 3. Archive old exports (thesis/docs stay in repo, excluded from deploy zip) ─
$archiveRoot = Join-Path $Root "archive"
$archiveExports = Join-Path $archiveRoot "old_exports"
New-Item -ItemType Directory -Path $archiveExports -Force | Out-Null
Get-ChildItem -Path (Join-Path $Root "optimization") -Filter "*-deploy.zip" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne "velora-deploy.zip" } |
    ForEach-Object {
        Move-Item $_.FullName -Destination $archiveExports -Force
        $removed.Add("archived: optimization\$($_.Name)")
    }

# ── 4. Ensure runtime directories exist ─────────────────────────────────────
@(
    "backend\uploads\branding",
    "backend\generated_pdfs",
    "backend\models",
    "backend\logs"
) | ForEach-Object {
    $dir = Join-Path $Root $_
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    $gitkeep = Join-Path $dir ".gitkeep"
    if (-not (Test-Path $gitkeep)) { New-Item -ItemType File -Path $gitkeep -Force | Out-Null }
}

# ── 5. Deployment package ───────────────────────────────────────────────────
& (Join-Path $Root "scripts\create_deployment_package.ps1")

$afterMb = Get-DirSizeMb $Root
$report = @{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    before_mb    = $beforeMb
    after_mb     = $afterMb
    saved_mb     = [math]::Round($beforeMb - $afterMb, 2)
    removed      = $removed
    deploy_zip   = "optimization/velora-deploy.zip"
    deploy_zip_mb = if (Test-Path (Join-Path $Root "optimization\velora-deploy.zip")) {
        [math]::Round((Get-Item (Join-Path $Root "optimization\velora-deploy.zip")).Length / 1MB, 2)
    } else { 0 }
}
$reportPath = Join-Path $Root "optimization\audit_after.json"
$report | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding UTF8

Write-Host ""
Write-Host "Production optimization complete."
Write-Host "Before: $beforeMb MB"
Write-Host "After:  $afterMb MB"
Write-Host "Saved:  $($report.saved_mb) MB"
Write-Host "Deploy: optimization/velora-deploy.zip ($($report.deploy_zip_mb) MB)"
Write-Host "Report: optimization/audit_after.json"