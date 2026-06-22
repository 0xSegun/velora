"""Smoke-test key Velora API endpoints with admin credentials."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
ADMIN_EMAIL = "admin@inflationplatform.com"
ADMIN_PASSWORD = "Admin123!"


def req(method: str, path: str, token: str | None = None, body: dict | None = None) -> tuple[int, object]:
    data = None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode()
    request = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as resp:
            raw = resp.read().decode()
            try:
                payload = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                payload = raw
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = raw
        return exc.code, payload


def main() -> int:
    failures: list[str] = []

    code, login = req("POST", "/api/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if code != 200 or not isinstance(login, dict) or not login.get("access_token"):
        print(f"FAIL login -> {code} {login}")
        return 1
    token = login["access_token"]
    print("OK  login")

    endpoints = [
        ("GET", "/health"),
        ("GET", "/api/admin/dashboard"),
        ("GET", "/api/admin/news-api"),
        ("GET", "/api/admin/news-api/health"),
        ("GET", "/api/admin/fred-config/health"),
        ("GET", "/api/admin/exchange-rate-config/health"),
        ("GET", "/api/dashboard/overview"),
        ("GET", "/api/dashboard/user-insights"),
        ("GET", "/api/intelligence/news?limit=5"),
        ("GET", "/api/intelligence/news/status"),
        ("GET", "/api/predictions/history?per_page=5"),
        ("GET", "/api/countries"),
        ("GET", "/api/reports?limit=5"),
        ("GET", "/api/users/?per_page=5"),
        ("GET", "/api/admin/intelligence/settings"),
    ]

    for method, path in endpoints:
        code, payload = req(method, path, token=token)
        ok = 200 <= code < 300
        print(f"{'OK ' if ok else 'FAIL'} {method} {path} -> {code}")
        if not ok:
            failures.append(f"{method} {path} -> {code}: {payload}")

    # Dynamic pages: prediction detail
    _, preds = req("GET", "/api/predictions/history?per_page=1", token=token)
    pred_id = None
    if isinstance(preds, dict):
        items = preds.get("items") or preds.get("predictions") or preds.get("data") or []
        if items:
            pred_id = items[0].get("id")
    if pred_id:
        code, _ = req("GET", f"/api/predictions/{pred_id}", token=token)
        ok = 200 <= code < 300
        print(f"{'OK ' if ok else 'FAIL'} GET /api/predictions/{pred_id} -> {code}")
        if not ok:
            failures.append(f"GET /api/predictions/{pred_id} -> {code}")
    else:
        print("SKIP prediction detail (no predictions in DB)")

    _, reports = req("GET", "/api/reports?limit=1", token=token)
    report_id = None
    if isinstance(reports, list) and reports:
        report_id = reports[0].get("id")
    elif isinstance(reports, dict):
        items = reports.get("items") or reports.get("reports") or []
        if items:
            report_id = items[0].get("id")
    if report_id:
        code, _ = req("GET", f"/api/reports/{report_id}", token=token)
        ok = 200 <= code < 300
        print(f"{'OK ' if ok else 'FAIL'} GET /api/reports/{report_id} -> {code}")
        if not ok:
            failures.append(f"GET /api/reports/{report_id} -> {code}")
    else:
        print("SKIP report detail (no reports in DB)")

    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nAll API smoke tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())