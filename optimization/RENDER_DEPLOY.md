# Velora — Render Backend Deploy

## Automatic (Blueprint)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. **New → Blueprint**
3. Connect GitHub repo: `0xSegun/velora`
4. Render reads `render.yaml` and creates:
   - PostgreSQL database `velora-db`
   - Web service `velora-api` at `https://velora-api.onrender.com`
5. Wait for first build (~10–15 min; PyTorch install is slow on free tier)

## After deploy

| Variable | Where | Value |
|----------|-------|-------|
| `FRONTEND_URL` | Render → velora-api → Environment | Your Vercel URL |
| `NEXT_PUBLIC_API_URL` | Vercel → Environment (or `frontend/.env.production`) | `https://velora-api.onrender.com` |

Redeploy both services after updating URLs.

## Health check

```bash
curl https://velora-api.onrender.com/health
```

Expected: `{"status":"healthy","database":"connected",...}`

## Optional env vars (Render dashboard)

- `FRED_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`

## Model checkpoint

`backend/models/best_model.pt` is committed to Git for inference on Render.