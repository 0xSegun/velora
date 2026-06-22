# Smoke-test all static Velora frontend routes
$base = "http://localhost:3000"
$routes = @(
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/access-denied",
  "/privacy",
  "/terms",
  "/admin",
  "/admin/analytics",
  "/admin/api-config",
  "/admin/authentication",
  "/admin/branding",
  "/admin/cms",
  "/admin/control",
  "/admin/economic-data",
  "/admin/economic-events",
  "/admin/exchange-rate-api",
  "/admin/fred-api",
  "/admin/intelligence",
  "/admin/models",
  "/admin/news-api",
  "/admin/research",
  "/admin/resend-email",
  "/admin/settings",
  "/admin/training",
  "/admin/users",
  "/dashboard",
  "/dashboard/accuracy",
  "/dashboard/analytics",
  "/dashboard/countries",
  "/dashboard/explainability",
  "/dashboard/help",
  "/dashboard/intelligence",
  "/dashboard/news",
  "/dashboard/notifications",
  "/dashboard/predictions",
  "/dashboard/profile",
  "/dashboard/reports",
  "/dashboard/research",
  "/dashboard/scenarios",
  "/dashboard/settings",
  "/analyst",
  "/analyst/accuracy",
  "/analyst/analytics",
  "/analyst/api-status",
  "/analyst/countries",
  "/analyst/data-sources",
  "/analyst/events",
  "/analyst/explainability",
  "/analyst/models",
  "/analyst/notifications",
  "/analyst/predictions",
  "/analyst/reports",
  "/analyst/research",
  "/analyst/scenarios"
)

$failed = @()
$passed = 0

foreach ($route in $routes) {
  try {
    $resp = Invoke-WebRequest -Uri "$base$route" -UseBasicParsing -TimeoutSec 60
    if ($resp.StatusCode -eq 200) {
      $passed++
      Write-Host "OK  $route"
    } else {
      $failed += "$route -> $($resp.StatusCode)"
      Write-Host "FAIL $route -> $($resp.StatusCode)"
    }
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $failed += "$route -> $code"
    Write-Host "FAIL $route -> $code"
  }
}

Write-Host ""
Write-Host "Passed: $passed / $($routes.Count)"
if ($failed.Count -gt 0) {
  Write-Host "Failures:"
  $failed | ForEach-Object { Write-Host "  $_" }
  exit 1
}
exit 0