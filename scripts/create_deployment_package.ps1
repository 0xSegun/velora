# Create a lightweight production deployment archive (source + configs only)
param(
    [string]$OutputZip = "optimization/velora-deploy.zip"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$includeRoots = @(
    "backend\app", "backend\ai", "backend\alembic", "backend\scripts",
    "backend\uploads", "backend\data", "backend\alembic.ini",
    "backend\requirements.txt", "backend\Dockerfile", "backend\.dockerignore", "backend\.env.example",
    "frontend\src", "frontend\public", "frontend\package.json", "frontend\package-lock.json",
    "frontend\next.config.ts", "frontend\tsconfig.json", "frontend\tailwind.config.ts",
    "frontend\next-env.d.ts", "frontend\postcss.config.mjs", "frontend\eslint.config.mjs",
    "frontend\Dockerfile", "frontend\.dockerignore", "frontend\.env.example",
    "scripts\create_deployment_package.ps1", "scripts\prepare_for_deploy.ps1",
    "scripts\production_optimize.ps1", "scripts\project_storage_audit.py",
    "optimization\DEPLOYMENT_GUIDE.md", "optimization\GITHUB_VERCEL_DEPLOY.md", "optimization\DEPLOY_EXPORT_REPORT.md",
    "docker-compose.yml", ".env.example", "README.md", ".gitignore", ".dockerignore"
)

$excludePatterns = @(
    "__pycache__", ".pytest_cache", "*.pyc", ".env", ".env.local",
    "patch_velora_branding_db.py", "generate_currency_catalog.py", "verify_intelligence.py"
)

$staging = Join-Path $Root "optimization\deploy_staging"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

foreach ($item in $includeRoots) {
    $src = Join-Path $Root $item
    if (-not (Test-Path $src)) { continue }
    $dest = Join-Path $staging $item
    $parent = Split-Path $dest -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    if ((Get-Item $src).PSIsContainer) {
        Copy-Item -Path $src -Destination $dest -Recurse -Force
    } else {
        Copy-Item -Path $src -Destination $dest -Force
    }
}

Get-ChildItem -Path $staging -Recurse -Directory -Filter "__pycache__" -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
Get-ChildItem -Path $staging -Recurse -Directory -Filter ".pytest_cache" -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force
Get-ChildItem -Path $staging -Recurse -File -Filter "*.pyc" -Force -ErrorAction SilentlyContinue |
    Remove-Item -Force

foreach ($pattern in @("patch_velora_branding_db.py", "generate_currency_catalog.py", "verify_intelligence.py")) {
    Get-ChildItem -Path $staging -Recurse -File -Filter $pattern -Force -ErrorAction SilentlyContinue |
        Remove-Item -Force
}

$outPath = Join-Path $Root $OutputZip
$outDir = Split-Path $outPath -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (Test-Path $outPath) { Remove-Item -Force $outPath }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $outPath -Force
Remove-Item -Recurse -Force $staging

$zipMb = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
Write-Host "Deployment package: $OutputZip ($zipMb MB)"