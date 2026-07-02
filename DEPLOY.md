# Deploy Kredox AI (Windows zip → Vercel + Render)

This guide makes the project work after you zip it on Mac, move to Windows, unzip, and deploy.

## What you need

1. **Node.js 20+** on Windows — https://nodejs.org
2. **Supabase** free Postgres database
3. **Vercel** account (frontend)
4. **Render** account (API backend)
5. Optional: Cloudinary, OpenAI, Agora, Deepgram, SendGrid

---

## Step 1 — Zip the project correctly

**Include:** all source files, `package-lock.json` files, `render.yaml`, `vercel.json`

**Do NOT include:**
- `node_modules/` (any folder)
- `client/dist/`
- `.env` or `server/.env` (secrets — set these in cloud dashboards)

Before zipping, run:

```bash
npm run deploy-prep
```

---

## Step 2 — Unzip on Windows

```bat
cd path\to\Kredox AI
npm install
copy .env.example server\.env
```

Edit `server\.env` and set at minimum:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
JWT_SECRET=your-random-secret-at-least-32-characters-long
REFRESH_JWT_SECRET=another-random-secret-at-least-32-characters
ADMIN_EMAIL=you@company.com
ADMIN_PASSWORD=YourSecurePassword123
```

Then:

```bat
npm run db:migrate
npm run dev
```

Open http://localhost:5173 and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## Step 3 — Deploy API on Render

1. Push the project to GitHub **or** connect Render to your repo.
2. In Render Dashboard → **New** → **Blueprint** → select `render.yaml`  
   **OR** create a Web Service manually:
   - **Root directory:** `server`
   - **Build command:** `npm ci --ignore-scripts`
   - **Start command:** `npm run start:deploy`
   - **Health check path:** `/health`

3. Set these **Environment Variables** on Render:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Supabase connection string with `?sslmode=require` |
| `JWT_SECRET` | 32+ random characters |
| `REFRESH_JWT_SECRET` | 32+ random characters |
| `DOMAIN` | `https://your-app.vercel.app` |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` |
| `CLIENT_ORIGINS` | `https://your-app.vercel.app` |
| `PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `ADMIN_EMAIL` | your login email |
| `ADMIN_PASSWORD` | your login password (8+ chars) |
| `CORS_ALLOW_ALL` | `true` |
| `ALLOW_PUBLIC_REGISTRATION` | `true` |

4. Wait for deploy. Test:

```
https://your-api.onrender.com/health
```

Should return: `{"ok":true,"service":"kredox-ai-api"}`

> First request on Render free tier may take 30–60 seconds (cold start).

---

## Step 4 — Deploy frontend on Vercel

1. Vercel Dashboard → **Add New Project**
2. Import your repo
3. **Root Directory:** `client` (recommended)  
   OR use repo root with root `vercel.json`
4. **Framework:** Vite
5. Set **Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_NODE_API` | `https://your-api.onrender.com` |
| `VITE_API_BASE_URL` | `https://your-api.onrender.com` |
| `VITE_TRANSCRIPT_WS_URL` | `wss://your-api.onrender.com` |
| `VITE_ALLOW_PUBLIC_REGISTRATION` | `true` |

6. Deploy.

---

## Step 5 — Link frontend and backend

After Vercel gives you a URL (e.g. `https://kredox-ai.vercel.app`):

1. Go back to **Render** → your API service → Environment
2. Update:
   - `DOMAIN`
   - `CLIENT_ORIGIN`
   - `PUBLIC_APP_URL`
   - `CLIENT_ORIGINS` (include your Vercel URL)
3. **Redeploy** the Render service

---

## Step 6 — Log in

1. Open your Vercel URL
2. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from Render  
   OR use **Register** to create a new account (if `ALLOW_PUBLIC_REGISTRATION=true`)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails immediately | API not running — check Render logs and `/health` |
| CORS error | Set `CLIENT_ORIGIN` to exact Vercel URL, redeploy Render |
| Database connection error | Use Supabase **pooler** URL with `?sslmode=require` |
| `ENOTFOUND db.xxx.supabase.co` | Wrong or deleted Supabase project — create new DB |
| Build fails on Vercel | Use Node 20, root directory `client` |
| Build fails on Windows | Run `node client/node_modules/vite/bin/vite.js build` |
| Campaign links wrong domain | Set `PUBLIC_APP_URL` on Render to Vercel URL |
| WebSocket/STT fails | Set `VITE_TRANSCRIPT_WS_URL=wss://your-api.onrender.com` |

---

## Optional services

| Service | Env vars | If missing |
|---------|----------|------------|
| OpenAI | `OPENAI_API_KEY` | Reports show less AI analysis |
| Cloudinary | `CLOUDINARY_*` | Recordings may not upload |
| Agora | `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | Browser camera fallback used |
| Deepgram | `DEEPGRAM_API_KEY` | Browser speech fallback used |
| SendGrid | `SENDGRID_*` | Campaign links created but email not sent |

---

## Quick verification checklist

- [ ] `https://your-api.onrender.com/health` returns OK
- [ ] Vercel app loads login page
- [ ] Login with admin credentials works
- [ ] Dashboard loads data
- [ ] Campaign launch creates links
- [ ] Customer `/verify/:token` page opens
