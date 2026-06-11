"""Verify backend health, auth, and database connectivity."""

import sys

import httpx

BASE = "http://127.0.0.1:8000"


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=15.0)
    errors = []

    try:
        health = client.get("/health").json()
        print("Health:", health)
        if health.get("database") != "connected":
            errors.append("Database not connected")
    except Exception as exc:
        errors.append(f"Health check failed: {exc}")

    try:
        status = client.get("/system/status").json()
        print("System status:", status.get("database", {}))
    except Exception as exc:
        errors.append(f"System status failed: {exc}")

    try:
        login = client.post(
            "/api/auth/login",
            json={
                "email": "admin@inflationplatform.com",
                "password": "Admin123!",
            },
        )
        if login.status_code != 200:
            errors.append(f"Admin login failed: {login.status_code} {login.text}")
        else:
            token = login.json()["access_token"]
            me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            print("Admin /me:", me.json().get("email"), me.json().get("role"))
    except Exception as exc:
        errors.append(f"Auth test failed: {exc}")

    if errors:
        print("\nFAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("\nAll verification checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())