# Velora — GitHub + Vercel Deploy Guide

Straightforward steps to put your code on GitHub and launch the **frontend** on Vercel.

> **Heads up:** Vercel runs the Next.js site only. Login, predictions, and admin features need a **separate backend API** (FastAPI + PostgreSQL). You will point Vercel at that API with one env variable.

---

## What goes where

| Piece             | Host                                        |
| ----------------- | ------------------------------------------- |
| Source code       | **GitHub**                                  |
| Website (Next.js) | **Vercel**                                  |
| API + database    | Somewhere else (Railway, Render, VPS, etc.) |

---

## Before you start

- [ ] Backend is live and reachable over **HTTPS** (e.g. `https://api.yourdomain.com`)
- [ ] You know that backend URL — you will paste it into Vercel
- [ ] On the backend, set `FRONTEND_URL` to your future Vercel URL (you can update this after the first deploy)

---

## Part 1 — Push to GitHub

### 1. Open the project folder

```bash
cd path/to/velora
```

### 2. Initialize Git (skip if already a repo)

```bash
git init
```

### 3. Check nothing secret is staged

```bash
git add .
git status
```

**Do not commit these** (they should be ignored automatically):

- `backend/.env`
- `frontend/.env.local`
- `node_modules/`
- `frontend/.next/`

### 4. Commit

```bash
git commit -m "Initial commit: Velora"
```

### 5. Create repo and push

1. Go to [github.com/new](https://github.com/new)
2. Create a repo (e.g. `velora`) — **don’t** add a README if you already have one
3. Run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/velora.git
git branch -M main
git push -u origin main
```

Done. Your code is on GitHub.

---

## Part 2 — Deploy on Vercel

### 1. Import the repo

1. Log in at [vercel.com](https://vercel.com)
2. Click **Add New → Project**
3. Choose **Import** next to your GitHub repo
4. If asked, authorize Vercel to access your GitHub account

### 2. Set the root folder

Vercel must build from the `frontend` folder, not the repo root.

| Setting            | Value      |
| ------------------ | ---------- |
| **Root Directory** | `frontend` |

Click **Edit** next to Root Directory → select `frontend` → **Continue**.

### 3. Build settings (usually auto-detected)

| Setting         | Value           |
| --------------- | --------------- |
| Framework       | Next.js         |
| Build Command   | `npm run build` |
| Install Command | `npm ci`        |
| Node.js Version | 20.x            |

Leave Output Directory as default (`.next`).

### 4. Add environment variables

Before clicking **Deploy**, open **Environment Variables** and add:

| Name                                 | Value                      | Notes                                           |
| ------------------------------------ | -------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                | `https://your-api-url.com` | **Required** — your live FastAPI backend        |
| `NEXT_PUBLIC_SHOW_ADMIN_CREDENTIALS` | `false`                    | Hides default admin hint on login in production |

Apply to **Production** (and Preview if you want preview deploys to work with the API).

### 5. Deploy

Click **Deploy**. Wait for the build to finish (~2–5 minutes).

Vercel gives you a URL like:

```
https://velora-xxxxx.vercel.app
```

### 6. Update backend CORS (one-time)

On your **backend** host, set:

```env
APP_ENV=production
FRONTEND_URL=https://velora-xxxxx.vercel.app
```

Redeploy the backend so it accepts requests from your Vercel site.

---

## Custom domain (optional)

1. Vercel → your project → **Settings → Domains**
2. Add your domain (e.g. `velora.com`)
3. Add the DNS records Vercel shows you
4. Update backend `FRONTEND_URL` to `https://velora.com`
5. Redeploy backend

---

## Check that it works

| Step | What to do                      | Expected                                                         |
| ---- | ------------------------------- | ---------------------------------------------------------------- |
| 1    | Open your Vercel URL            | Home page loads                                                  |
| 2    | Open `/login`                   | Login form appears                                               |
| 3    | Log in                          | Redirects to dashboard (needs working backend)                   |
| 4    | Open browser DevTools → Network | API calls go to your `NEXT_PUBLIC_API_URL`, not `localhost:8000` |

---

## Common fixes

### API calls fail or hit `localhost:8000`

`NEXT_PUBLIC_API_URL` is missing or wrong on Vercel.

1. Vercel → **Settings → Environment Variables**
2. Fix the value
3. **Deployments → Redeploy** (env changes need a new deploy)

### CORS / “blocked by CORS policy”

Backend `FRONTEND_URL` does not match your Vercel URL exactly (including `https://`).

### Build fails on Vercel

- Confirm **Root Directory** is `frontend`
- Confirm **Node.js** is 20.x
- Check build logs for TypeScript errors

### Login works locally but not on Vercel

Backend is not deployed, not reachable over HTTPS, or `FRONTEND_URL` / `NEXT_PUBLIC_API_URL` are mismatched.

---

## Redeploy after code changes

Push to GitHub — Vercel redeploys automatically:

```bash
git add .
git commit -m "Your change"
git push
```

Or manually: Vercel → **Deployments → Redeploy**.

---

## Quick reference

```text
GitHub  → stores source code
Vercel  → hosts frontend (folder: frontend)
Backend → separate host; set NEXT_PUBLIC_API_URL on Vercel to point at it
```

For full-stack hosting (backend, database, Docker, cPanel), see `optimization/DEPLOYMENT_GUIDE.md`.
