# Velora — Export & Deployment Guide

**Platform:** Inflation & Deflation Prediction Platform  
**Stack:** Next.js 16 (frontend) · FastAPI + PyTorch (backend) · PostgreSQL 16  
**Last updated:** 2026-06-11

This guide explains how to **export** the project safely and **deploy** it to GitHub, Vercel, cPanel, and other common hosting platforms.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Pre-Export Checklist](#2-pre-export-checklist)
3. [Create a Deployment Package](#3-create-a-deployment-package)
4. [Deploy to GitHub](#4-deploy-to-github)
5. [Deploy Frontend to Vercel](#5-deploy-frontend-to-vercel)
6. [Deploy Backend (Required for Full App)](#6-deploy-backend-required-for-full-app)
7. [Deploy to cPanel](#7-deploy-to-cpanel)
8. [Deploy with Docker](#8-deploy-with-docker)
9. [Other Platforms](#9-other-platforms)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Database Setup & Migrations](#11-database-setup--migrations)
12. [Post-Deploy Verification](#12-post-deploy-verification)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Architecture Overview

Velora is a **split-stack** application:

| Component | Technology | Typical Host |
|-----------|------------|--------------|
| **Frontend** | Next.js 16, TypeScript | Vercel, Netlify, cPanel Node, Docker |
| **Backend API** | FastAPI, PyTorch, Alembic | Railway, Render, Fly.io, VPS, Docker |
| **Database** | PostgreSQL 16 | Neon, Supabase, Railway, managed PG on VPS |

```
┌─────────────┐     HTTPS      ┌──────────────┐     SQL      ┌────────────┐
│   Browser   │ ─────────────► │   Frontend   │            │ PostgreSQL │
│             │                │  (Next.js)   │            │            │
│             │ ─────────────► │   Backend    │ ─────────► │            │
│             │   API calls    │  (FastAPI)   │            └────────────┘
└─────────────┘                └──────────────┘
```

**Important:** Vercel and most static hosts run **only the frontend**. The FastAPI backend and PostgreSQL must be hosted separately and connected via environment variables.

Authentication uses **JWT tokens** (FastAPI) with session cookies (`ic_session`, `ic_role`) on the frontend — not a serverless-only setup.

---

## 2. Pre-Export Checklist

Before pushing to GitHub or uploading anywhere, confirm:

- [ ] **No secrets in source** — `.env` files are gitignored; use `.env.example` as a template only
- [ ] **No large artifacts** — exclude `node_modules/`, `.next/`, `venv/`, `__pycache__/`, logs, caches
- [ ] **Production build passes locally**

```powershell
# From project root
cd frontend
npm ci
npm run build

cd ..\backend
pip install -r requirements.txt
python -c "from app.main import app; print('OK:', app.title)"
```

- [ ] **Change default admin password** in production (`ADMIN_PASSWORD` in backend `.env`)
- [ ] **Set `APP_ENV=production`** on the backend so CORS locks to your frontend URL

### What NOT to upload

| Path | Reason |
|------|--------|
| `node_modules/` | Regenerate with `npm ci` |
| `frontend/.next/` | Regenerate with `npm run build` |
| `venv/` / `.venv/` | Regenerate with `pip install` |
| `backup_archive/` | Local PostgreSQL bundle (~878 MB) |
| `backend/postgres/` | Archived portable DB — use Docker or managed PG |
| `.env`, `.env.local` | Secrets |

---

## 3. Create a Deployment Package

A lightweight zip (~0.5 MB) with source only is available:

```powershell
cd C:\Users\segun\OneDrive\desktop\velora\velora
powershell -File scripts\create_deployment_package.ps1
```

**Output:** `optimization/velora-deploy.zip`

Unpack on any server, then install dependencies:

```bash
# Frontend
cd frontend && npm ci && npm run build

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m alembic upgrade head
```

---

## 4. Deploy to GitHub

### Step 1 — Initialize Git (if not already)

```bash
cd velora
git init
git add .
git status   # verify no .env or node_modules staged
git commit -m "Initial commit: Velora platform"
```

The root `.gitignore` already excludes caches, dependencies, archives, and secrets.

### Step 2 — Create GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name: `velora` (or your choice)
3. **Do not** initialize with README if you already have one locally
4. Copy the remote URL

### Step 3 — Push

```bash
git remote add origin https://github.com/YOUR_USERNAME/velora.git
git branch -M main
git push -u origin main
```

### Step 4 — Recommended repository settings

| Setting | Recommendation |
|---------|----------------|
| **Branch protection** | Require PR reviews for `main` (optional) |
| **Secrets** | Store `DATABASE_URL`, `JWT_SECRET`, API keys in GitHub Actions secrets — never in code |
| **Large files** | Do not commit `node_modules` or postgres bundles — Git LFS not needed for source |

### Optional — GitHub Actions CI

Add `.github/workflows/ci.yml` to verify builds on every push:

```yaml
name: CI
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8000

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -r requirements.txt
      - run: python -c "from app.main import app; print(app.title)"
```

---

## 5. Deploy Frontend to Vercel

> **Note:** “Verve” in hosting contexts usually means **Vercel** — the platform referenced in this project’s CORS config (`velora.vercel.app`).

### Prerequisites

- GitHub repo connected to Vercel
- Backend already deployed and reachable via HTTPS (see [Section 6](#6-deploy-backend-required-for-full-app))

### Step 1 — Import project

1. Log in at [vercel.com](https://vercel.com)
2. **Add New → Project**
3. Import your GitHub `velora` repository
4. Set **Root Directory** to `frontend`

### Step 2 — Build settings

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` (default) |
| Install Command | `npm ci` |
| Node.js Version | 20.x |

### Step 3 — Environment variables (Vercel dashboard)

| Variable | Example | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | **Yes** |
| `NEXT_PUBLIC_SHOW_ADMIN_CREDENTIALS` | `false` | Recommended in prod |

Redeploy after adding variables.

### Step 4 — Custom domain (optional)

1. Vercel → Project → **Settings → Domains**
2. Add `yourdomain.com`
3. Update DNS per Vercel instructions
4. Update backend `FRONTEND_URL` and redeploy backend

### Vercel limitations

- **Cannot run FastAPI or PostgreSQL** on Vercel’s serverless frontend tier
- **PyTorch backend** needs a separate Python host (Railway, Render, VPS)
- API routes in Next.js are not a substitute for the full FastAPI backend in this project

---

## 6. Deploy Backend (Required for Full App)

The backend includes PyTorch (~large install). Choose a host with sufficient memory (≥1 GB RAM recommended).

### Option A — Railway (recommended for simplicity)

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Add **PostgreSQL** plugin (provides `DATABASE_URL`)
3. Set **Root Directory** / start command:

```bash
# Build: N/A (Python)
# Start command (from backend/):
pip install -r requirements.txt && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

4. Environment variables:

```env
APP_ENV=production
DATABASE_URL=postgresql+asyncpg://...   # from Railway PG plugin
JWT_SECRET=<openssl rand -hex 32>
SECRET_KEY=<openssl rand -hex 32>
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGINS=["https://your-app.vercel.app"]
RESEND_API_KEY=re_...
FRED_API_KEY=...
```

5. Copy the public Railway URL → set as `NEXT_PUBLIC_API_URL` on Vercel

### Option B — Render

1. **New Web Service** → connect GitHub repo
2. **Root Directory:** `backend`
3. **Runtime:** Python 3.11
4. **Build Command:** `pip install -r requirements.txt && alembic upgrade head`
5. **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add **Render PostgreSQL** and link `DATABASE_URL`

### Option C — VPS (DigitalOcean, Linode, Hetzner, AWS EC2)

```bash
# On Ubuntu 22.04+
sudo apt update && sudo apt install -y python3.11 python3.11-venv postgresql nginx

cd /var/www/velora/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head

# systemd service (example)
sudo nano /etc/systemd/system/velora-api.service
```

```ini
[Unit]
Description=Velora FastAPI
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/velora/backend
EnvironmentFile=/var/www/velora/backend/.env
ExecStart=/var/www/velora/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now velora-api
```

Put Nginx in front with SSL (Certbot):

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option D — Managed PostgreSQL (any backend host)

Works with **Neon**, **Supabase**, **ElephantSQL**, or **Railway PG**:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
POSTGRES_HOST=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
```

Run migrations once after first deploy:

```bash
cd backend && alembic upgrade head
```

---

## 7. Deploy to cPanel

cPanel shared hosting has constraints. This project needs **Node.js** (frontend) and **Python 3.11+ with long-running processes** (backend). Many shared plans only support PHP — verify your plan first.

### Recommended cPanel split

| Part | Where on cPanel | Alternative |
|------|-----------------|-------------|
| Frontend | cPanel **Setup Node.js App** | Deploy frontend to Vercel instead |
| Backend | Often **not supported** on basic shared hosting | Railway / Render / VPS |
| Database | cPanel **PostgreSQL** (if available) or remote Neon/Supabase | Managed PG |

### Frontend on cPanel (Node.js Selector)

1. Upload project files (or clone via Git in cPanel)
2. **Exclude** `node_modules` and `.next` — install on server
3. cPanel → **Setup Node.js App**
4. Application root: `velora/frontend`
5. Application URL: your subdomain (e.g. `app.yourdomain.com`)
6. Application startup file: use npm scripts

```bash
# In cPanel terminal
cd ~/velora/frontend
npm ci
npm run build
```

7. Set environment variables in the Node.js app panel:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NODE_ENV=production
```

8. Start command: `npm start` (runs `next start` on port assigned by cPanel)

### Backend on cPanel (if Python app supported)

Some hosts offer **Setup Python App** (Passenger):

1. Application root: `velora/backend`
2. Entry point: `passenger_wsgi.py` or configure uvicorn via proxy
3. Many shared hosts **kill long-running processes** — FastAPI + PyTorch may exceed limits

**Practical recommendation:** Host the **backend on Railway/Render** and only put the **frontend on cPanel**, pointing `NEXT_PUBLIC_API_URL` to the external API.

### Database on cPanel

1. cPanel → **PostgreSQL Databases** → create DB and user
2. Set backend env:

```env
POSTGRES_HOST=localhost
POSTGRES_USER=cpanel_user_dbname
POSTGRES_PASSWORD=...
POSTGRES_DB=cpanel_dbname
```

3. Whitelist backend server IP if DB is remote

### File upload via cPanel File Manager

1. Zip the deploy package locally (`optimization/velora-deploy.zip`)
2. Upload to `public_html` or home directory
3. Extract
4. Run install commands via **Terminal** in cPanel

---

## 8. Deploy with Docker

Best for VPS or any Docker-capable host. Uses `docker-compose.yml` at project root.

### Step 1 — Prepare environment

```bash
cp .env.example .env
# Edit .env with production secrets
```

### Step 2 — Start all services

```bash
docker compose up -d --build
```

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | internal |

### Step 3 — Run migrations (first time)

```bash
docker compose exec backend alembic upgrade head
```

### Production Docker notes

- Put **Nginx** or **Traefik** in front for HTTPS
- Use Docker volumes for `postgres_data` persistence
- Set `APP_ENV=production` in backend environment
- Remove `--reload` from production (already removed in `backend/Dockerfile`)
- Frontend uses multi-stage `frontend/Dockerfile` with `output: "standalone"`

---

## 9. Other Platforms

### Netlify (frontend only)

Same as Vercel — set root to `frontend`, build `npm run build`, env `NEXT_PUBLIC_API_URL`.

### Fly.io (full stack)

Deploy backend as a Fly app; use `fly postgres create` for DB. Frontend can be a second Fly app or Vercel.

```bash
cd backend
fly launch
fly secrets set DATABASE_URL=... JWT_SECRET=... FRONTEND_URL=...
fly deploy
```

### AWS

| Service | Use for |
|---------|---------|
| **Amplify** or **S3 + CloudFront** | Frontend |
| **ECS / Elastic Beanstalk / EC2** | Backend |
| **RDS PostgreSQL** | Database |

### Azure / Google Cloud

- **Azure Static Web Apps** or **App Service** — frontend
- **Container Apps** or **Cloud Run** — backend (container from `backend/Dockerfile`)
- **Azure Database for PostgreSQL** / **Cloud SQL** — database

---

## 10. Environment Variables Reference

### Backend (`.env` in `backend/` or host dashboard)

| Variable | Description | Production |
|----------|-------------|------------|
| `APP_ENV` | `development` or `production` | `production` |
| `DATABASE_URL` | Async PG connection string | **Required** |
| `JWT_SECRET` | Token signing key | **Required** — random 32+ bytes |
| `SECRET_KEY` | App secret | **Required** |
| `FRONTEND_URL` | Frontend origin for CORS | `https://your-app.vercel.app` |
| `RESEND_API_KEY` | Email (Resend) | For email features |
| `FRED_API_KEY` | Economic data | For FRED integration |
| `GOOGLE_CLIENT_ID` | OAuth | Optional |
| `GOOGLE_CLIENT_SECRET` | OAuth | Optional |
| `ADMIN_PASSWORD` | Seed admin password | **Change from default** |
| `SHOW_DEFAULT_ADMIN_CREDENTIALS` | Show login hints | `false` |

Generate secrets:

```bash
openssl rand -hex 32
```

### Frontend (Vercel / cPanel / `.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Public backend URL (HTTPS) |
| `NEXT_PUBLIC_SHOW_ADMIN_CREDENTIALS` | `false` in production |

---

## 11. Database Setup & Migrations

Velora uses **Alembic** with 9 migration versions (`001`–`009`).

### Fresh database

```bash
cd backend
# Ensure PostgreSQL is running and .env is configured
python -m alembic upgrade head
```

Migrations cover: initial schema, dashboard, API credentials, intelligence, exchange rates, Resend email, and related constraints.

### On application startup

The backend also runs `bootstrap_database()` which seeds default countries, admin user, and catalog data if missing.

### Docker PostgreSQL (local / VPS)

```bash
docker compose up -d db
# Wait for healthy status, then:
docker compose exec backend alembic upgrade head
```

---

## 12. Post-Deploy Verification

Run through this checklist after every deployment:

| # | Check | Command / URL | Expected |
|---|-------|---------------|----------|
| 1 | Backend health | `GET https://api.yourdomain.com/health` | `200` healthy |
| 2 | API docs | `https://api.yourdomain.com/docs` | Swagger UI loads |
| 3 | Root | `GET https://api.yourdomain.com/` | `status: operational` |
| 4 | Frontend | `https://your-app.vercel.app` | Home page loads |
| 5 | Login | `/login` → admin credentials | Dashboard access |
| 6 | Protected API | `GET /api/countries` without token | `401` |
| 7 | CORS | Frontend calls API from browser | No CORS errors in DevTools |
| 8 | Reports | Generate a report from dashboard | PDF/download works |
| 9 | Exchange rates | Admin → Exchange Rate API | Sync / pair conversion |
| 10 | Build | `npm run build` in CI | All 41 routes compile |

---

## 13. Troubleshooting

### `npm run build` fails (TypeScript)

```bash
cd frontend && npm ci && npm run build
```

Fix any reported `.tsx` type errors before deploying.

### CORS errors in browser

- Set `APP_ENV=production` on backend
- Set `FRONTEND_URL` to exact frontend origin (no trailing slash)
- Ensure `NEXT_PUBLIC_API_URL` uses HTTPS in production

### `401` on all API calls after login

- Verify `JWT_SECRET` is identical across backend restarts
- Check `NEXT_PUBLIC_API_URL` points to the correct backend
- Clear browser `localStorage` and cookies, log in again

### Database connection failed

- Confirm `DATABASE_URL` uses `postgresql+asyncpg://` for the app
- Alembic uses sync URL automatically via `sync_database_url`
- Open firewall port 5432 only for trusted backend IPs

### PyTorch install fails on small VPS

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

Use CPU-only PyTorch on hosts without GPU.

### cPanel: app stops after a few minutes

Shared hosting often limits process lifetime. Move the backend to Railway, Render, or a VPS.

### Vercel: API calls go to `localhost:8000`

`NEXT_PUBLIC_API_URL` was not set in Vercel environment variables. Redeploy after fixing.

### Large upload to GitHub fails

Ensure `.gitignore` excludes `node_modules`, `.next`, and `backup_archive`. Run:

```powershell
git rm -r --cached frontend/node_modules 2>$null
git rm -r --cached frontend/.next 2>$null
```

---

## Quick Reference — Recommended Production Setup

| Layer | Service | Cost tier |
|-------|---------|-----------|
| Source control | **GitHub** | Free |
| Frontend | **Vercel** | Free hobby |
| Backend | **Railway** or **Render** | ~$5–7/mo |
| Database | **Neon** or Railway PG | Free tier available |
| Email | **Resend** | Free tier |
| DNS | **Cloudflare** | Free |

**Deploy order:**

1. PostgreSQL (managed)
2. Backend → run migrations → copy API URL
3. Frontend → set `NEXT_PUBLIC_API_URL` → deploy
4. Update `FRONTEND_URL` on backend → redeploy backend
5. Run [verification checklist](#12-post-deploy-verification)

---

## Related Files

| File | Purpose |
|------|---------|
| `optimization/velora-deploy.zip` | Lightweight source export |
| `optimization/PROJECT_OPTIMIZATION_REPORT.md` | Size audit & cleanup log |
| `scripts/create_deployment_package.ps1` | Regenerate deploy zip |
| `docker-compose.yml` | Full local/production Docker stack |
| `.env.example` | Environment template |
| `frontend/.env.example` | Frontend env template |

---

*For questions about a specific host, check their docs for Node.js 20+, Python 3.11+, PostgreSQL 16+, and outbound HTTPS (required for FRED, Resend, and ExchangeRate-API).*