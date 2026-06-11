# Velora — Deploy Export Report

**Date:** 2026-06-11  
**Status:** Ready for export / deployment

---

## Size Summary

| Metric | Size |
|--------|------|
| **Before cleanup** | ~1,868 MB |
| **After cleanup (export-ready)** | **~2.47 MB** |
| **Deployment zip** | **0.54 MB** (`optimization/velora-deploy.zip`) |

The project folder now contains **source code and configs only**. Dependencies and build outputs are excluded and restored at deploy time via `npm ci` / `pip install` / Docker.

---

## Removed (safe to delete locally)

| Category | Items |
|----------|-------|
| **Build caches** | `frontend/.next` (~1,306 MB), `frontend/node_modules` (~551 MB), `frontend/tsconfig.tsbuildinfo` |
| **Session / IDE** | `terminals/`, `mcps/` |
| **Python caches** | All `__pycache__/`, `.pytest_cache/` |
| **Runtime logs** | `backend/logs/` (email debug HTML) |
| **Empty placeholders** | `cache/`, `temp/`, `generated_reports/`, `dataset_archive/`, `external_storage/`, `old_models/`, `backup_archive/` |
| **Dev-only docs** | `frontend/AGENTS.md`, `frontend/CLAUDE.md` |
| **One-off scripts** | `patch_velora_branding_db.py`, `generate_currency_catalog.py`, `verify_intelligence.py`, `project_storage_audit.ps1` |
| **Old audit artifacts** | `optimization/audit_*.json`, `PROJECT_OPTIMIZATION_REPORT.md`, `infinicast-deploy.zip` |

---

## Kept (required for deploy)

- `backend/app/`, `backend/ai/`, `backend/alembic/`, `backend/scripts/` (startup, seed, verify)
- `backend/uploads/branding/.gitkeep` (branding upload directory structure)
- `frontend/src/`, `frontend/public/`, all config files (`tailwind.config.ts`, `next-env.d.ts`, etc.)
- `docker-compose.yml`, Dockerfiles, `.env.example`, `README.md`
- `optimization/DEPLOYMENT_GUIDE.md`
- `scripts/create_deployment_package.ps1`, `scripts/prepare_for_deploy.ps1`

**Not included in zip (local only):** `backend/.env`, `frontend/.env.local`

---

## Deployment Package

```powershell
# One-command cleanup + zip
.\scripts\prepare_for_deploy.ps1

# Or zip only
.\scripts\create_deployment_package.ps1
```

**Output:** `optimization/velora-deploy.zip`

---

## Post-Cleanup Verification

| Check | Result |
|-------|--------|
| Backend import (`from app.main import app`) | OK — title: **Velora** |
| Frontend production build (`npm run build`) | OK — 42 routes |
| Deploy zip created | OK — 0.54 MB |

---

## Launch Checklist

1. **Extract** `velora-deploy.zip` or clone the repo
2. **Backend:** copy `backend/.env.example` → `backend/.env`, set `DATABASE_URL`, `JWT_SECRET`, `APP_NAME=Velora`
3. **Frontend:** copy `frontend/.env.example` → `frontend/.env.local`, set `NEXT_PUBLIC_API_URL`
4. **Database:** run `alembic upgrade head` against PostgreSQL
5. **Install & run:**
   - Backend: `pip install -r requirements.txt` → `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Frontend: `npm ci` → `npm run build` → `npm start`
6. **Docker (optional):** `docker compose up --build`

See `optimization/DEPLOYMENT_GUIDE.md` for GitHub, Vercel, cPanel, Railway, and VPS instructions.