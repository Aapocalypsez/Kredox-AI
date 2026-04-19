# Demo Deployment Guide

This project now uses a free/demo-friendly deployment stack:

- Vercel for the React frontend
- Render for the Node API
- Supabase for Postgres
- Cloudinary for uploaded verification videos
- Deepgram with browser Web Speech fallback for transcription
- OpenAI `gpt-4o-mini` for risk summaries
- Optional Agora live RTC

## Supabase

1. Create a Supabase project.
2. Copy the Postgres connection string.
3. Set `DATABASE_URL` on Render.
4. Run `npm run db:migrate --workspace server` once after the API has access to the database.

## Cloudinary

1. Create a free Cloudinary account.
2. Copy `cloud_name`, `api_key`, and `api_secret`.
3. Set these on Render:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=kredox-ai-demo
```

The app stores uploaded verification videos as Cloudinary video resources and returns the secure playback URL.

## Blueprint Files

- `client/vercel.json` pins the Vercel Vite build settings.
- `render.yaml` defines the Render API service and optional ML service. Secrets are marked with `sync: false` so they must be supplied in Render.

## Render API

Create a Render Web Service:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node 20+

Core variables:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=
JWT_SECRET=
REFRESH_JWT_SECRET=
DOMAIN=https://your-vercel-app.vercel.app
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Optional variables:

```bash
REDIS_URL=
DEEPGRAM_API_KEY=
TRANSCRIPT_WS_PORT=8080
ML_SERVICE_URL=
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
GOOGLE_MAPS_API_KEY=
```

## Vercel Frontend

Create a Vercel project:

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`

Variables:

```bash
VITE_NODE_API=https://your-render-api.onrender.com
VITE_API_BASE_URL=https://your-render-api.onrender.com
VITE_TRANSCRIPT_WS_URL=wss://your-render-api.onrender.com
VITE_PYTHON_API=https://your-render-ml.onrender.com
VITE_GOOGLE_MAPS_API_KEY=
```

## Demo Behavior Without Paid Keys

- Missing Agora keys: customer page switches to video upload.
- Missing Deepgram key: browser Web Speech fallback is enabled where supported.
- Missing ML service: the Node risk orchestrator should still show policy/LLM results and report ML service errors gracefully.
- Missing messaging keys: campaign creation can still generate links; delivery provider calls are skipped or reported by the API.

## CI

The GitHub workflow is CI-only. It performs install, syntax checks, frontend build, production dependency audit, and Python syntax checks. It does not deploy and does not require cloud secrets.
