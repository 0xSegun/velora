# Smoke-test API endpoints used by dashboard and admin pages
$base = "http://127.0.0.1:8000"
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@inflationplatform.com","password":"Admin123!"}'
$h = @{ Authorization = "Bearer $($login.access_token)" }

$endpoints = @(
  @{ Name = "health"; Method = "GET"; Path = "/health"; Auth = $false },
  @{ Name = "public-settings"; Method = "GET"; Path = "/api/public/settings"; Auth = $false },
  @{ Name = "dashboard-overview"; Method = "GET"; Path = "/api/dashboard/overview"; Auth = $true },
  @{ Name = "predictions-history"; Method = "GET"; Path = "/api/predictions/history?per_page=5"; Auth = $true },
  @{ Name = "predictions-latest"; Method = "GET"; Path = "/api/predictions/latest"; Auth = $true },
  @{ Name = "countries"; Method = "GET"; Path = "/api/countries?per_page=5"; Auth = $true },
  @{ Name = "economic-latest"; Method = "GET"; Path = "/api/economic-data/latest"; Auth = $true },
  @{ Name = "economic-historical"; Method = "GET"; Path = "/api/economic-data/historical?limit=10"; Auth = $true },
  @{ Name = "reports"; Method = "GET"; Path = "/api/reports?per_page=5"; Auth = $true },
  @{ Name = "notifications"; Method = "GET"; Path = "/api/notifications"; Auth = $true },
  @{ Name = "users-profile"; Method = "GET"; Path = "/api/users/profile"; Auth = $true },
  @{ Name = "intelligence-accuracy"; Method = "GET"; Path = "/api/intelligence/accuracy"; Auth = $true },
  @{ Name = "intelligence-scenarios"; Method = "GET"; Path = "/api/intelligence/scenarios"; Auth = $true },
  @{ Name = "intelligence-research"; Method = "GET"; Path = "/api/intelligence/research"; Auth = $true },
  @{ Name = "intelligence-events"; Method = "GET"; Path = "/api/intelligence/events?per_page=10"; Auth = $true },
  @{ Name = "intelligence-health-NG"; Method = "GET"; Path = "/api/intelligence/health/NG"; Auth = $true },
  @{ Name = "exchange-analytics"; Method = "GET"; Path = "/api/exchange-rates/analytics"; Auth = $true },
  @{ Name = "admin-dashboard"; Method = "GET"; Path = "/api/admin/dashboard"; Auth = $true },
  @{ Name = "admin-settings-bundle"; Method = "GET"; Path = "/api/admin/settings/bundle"; Auth = $true },
  @{ Name = "admin-users"; Method = "GET"; Path = "/api/users/?per_page=5"; Auth = $true },
  @{ Name = "admin-models"; Method = "GET"; Path = "/api/admin/models"; Auth = $true },
  @{ Name = "admin-economic-data"; Method = "GET"; Path = "/api/admin/economic-data"; Auth = $true },
  @{ Name = "admin-system-health"; Method = "GET"; Path = "/api/admin/system-health"; Auth = $true },
  @{ Name = "admin-analytics"; Method = "GET"; Path = "/api/analytics/comprehensive?days=30"; Auth = $true },
  @{ Name = "admin-api-configs"; Method = "GET"; Path = "/api/admin/api-configs"; Auth = $true },
  @{ Name = "admin-api-health"; Method = "GET"; Path = "/api/admin/api-configs/health"; Auth = $true },
  @{ Name = "admin-google-oauth"; Method = "GET"; Path = "/api/admin/auth/google"; Auth = $true },
  @{ Name = "admin-resend-config"; Method = "GET"; Path = "/api/admin/resend-config"; Auth = $true },
  @{ Name = "admin-resend-health"; Method = "GET"; Path = "/api/admin/resend-config/health"; Auth = $true },
  @{ Name = "admin-exchange-config"; Method = "GET"; Path = "/api/admin/exchange-rate-config"; Auth = $true },
  @{ Name = "admin-exchange-health"; Method = "GET"; Path = "/api/admin/exchange-rate-config/health"; Auth = $true },
  @{ Name = "admin-fred-config"; Method = "GET"; Path = "/api/admin/fred-config"; Auth = $true },
  @{ Name = "admin-fred-health"; Method = "GET"; Path = "/api/admin/fred-config/health"; Auth = $true },
  @{ Name = "admin-fred-analytics"; Method = "GET"; Path = "/api/admin/fred-config/analytics"; Auth = $true },
  @{ Name = "admin-intelligence-settings"; Method = "GET"; Path = "/api/admin/intelligence/settings"; Auth = $true },
  @{ Name = "admin-intelligence-retraining"; Method = "GET"; Path = "/api/admin/intelligence/retraining"; Auth = $true }
)

$failed = @()
$passed = 0
foreach ($ep in $endpoints) {
  $headers = if ($ep.Auth) { $h } else { @{} }
  try {
    $null = Invoke-RestMethod -Uri "$base$($ep.Path)" -Method $ep.Method -Headers $headers -TimeoutSec 30
    Write-Host "OK   $($ep.Name)"
    $passed++
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    $detail = $_.ErrorDetails.Message
    if (-not $detail) { $detail = $_.Exception.Message }
    Write-Host "FAIL $($ep.Name) [$status] $detail"
    $failed += $ep
  }
}
Write-Host "`n$passed passed, $($failed.Count) failed"
if ($failed.Count -gt 0) { exit 1 }