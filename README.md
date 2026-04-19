# Kredox AI

Kredox AI is a demo-friendly loan verification and underwriting platform. This version is optimized for low-cost public demos:

- Frontend: Vite + React on Vercel
- Backend/API: Node.js + Express on Render
- ML service: Python FastAPI on Render, optional for demos
- Database: Supabase Postgres
- Video storage: Cloudinary
- STT: Deepgram when configured, browser Web Speech fallback when not configured
- LLM: OpenAI `gpt-4o-mini`
- Video workflow: upload-based verification first, optional Agora live RTC if keys are provided

## Local Quick Start

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run dev
```

Local URLs:

- React: `http://localhost:5173`
- Node API: `http://localhost:5000`
- ML service: `http://localhost:8001`
- STT WebSocket relay: `ws://localhost:5000`

## Required Environment Variables

Minimum demo setup:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
REFRESH_JWT_SECRET=replace-with-a-second-long-random-secret
DOMAIN=https://your-vercel-app.vercel.app
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
VITE_NODE_API=https://your-render-api.onrender.com
VITE_API_BASE_URL=https://your-render-api.onrender.com
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
CLOUDINARY_FOLDER=kredox-ai-demo
```

Optional providers:

```bash
REDIS_URL=redis://...
DEEPGRAM_API_KEY=...
TRANSCRIPT_WS_PORT=5000
VITE_TRANSCRIPT_WS_URL=wss://your-render-api.onrender.com
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
GOOGLE_MAPS_API_KEY=...
VITE_GOOGLE_MAPS_API_KEY=...
ML_SERVICE_URL=https://your-render-ml.onrender.com
VITE_PYTHON_API=https://your-render-ml.onrender.com
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=...
TWILIO_WHATSAPP_FROM=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
```

## Demo Video Flow

The customer verification page supports an upload-first demo path. If Agora keys are not configured, the API returns a safe `demo_upload` response and the customer page lets the user upload a verification video. Uploaded videos are stored in Cloudinary and linked back to the `video_sessions` row.

Live RTC can still be used by setting `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`, but it is no longer required for a working demo.

## Speech-to-Text Fallback

The WebSocket relay uses Deepgram when `DEEPGRAM_API_KEY` is configured. If the key is missing or the relay cannot connect, the frontend automatically switches to browser Web Speech where available and still sends final transcript text back through the relay so entity detection and transcript persistence continue to work.

## Computer Vision Demo Mode

Frame analysis uses a local demo-safe analyzer. It records frame availability, liveness-style scores, declared-age consistency, and a calm emotion signal without calling paid cloud CV services. This keeps demos predictable and free.

## Deploy Frontend On Vercel

1. Import this GitHub repo into Vercel.
2. Set the project root to `client`.
3. Use:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add Vercel environment variables:
   - `VITE_NODE_API=https://your-render-api.onrender.com`
   - `VITE_API_BASE_URL=https://your-render-api.onrender.com`
   - `VITE_PYTHON_API=https://your-render-ml.onrender.com` if using the ML service
   - `VITE_TRANSCRIPT_WS_URL=wss://your-render-api.onrender.com` if the relay is exposed on the API service
   - `VITE_GOOGLE_MAPS_API_KEY=` only if geo maps are enabled
5. Deploy.

The `client/vercel.json` file keeps the Vercel build command and output directory explicit.

## Deploy Backend On Render

Create a Render Web Service for the Node API:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node 20+

Set Render environment variables:

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=your-supabase-connection-string
REDIS_URL=optional-redis-url
JWT_SECRET=...
REFRESH_JWT_SECRET=...
DOMAIN=https://your-vercel-app.vercel.app
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=kredox-ai-demo
DEEPGRAM_API_KEY=optional
TRANSCRIPT_WS_PORT=5000
ML_SERVICE_URL=optional-render-ml-url
```

After first deploy, run the database migration from your machine or a Render shell:

```bash
npm run db:migrate --workspace server
```

Create the first admin:

```powershell
$env:ADMIN_EMAIL="admin@kredox.ai"
$env:ADMIN_PASSWORD="change-this-password"
npm run db:seed-admin --workspace server
```

## Deploy ML Service On Render

The ML service is optional for the demo. To deploy it:

- Root directory: `ml`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set `ML_SERVICE_URL` on the Node API and `VITE_PYTHON_API` on Vercel.

The root `render.yaml` can be used as a Render blueprint. It defines the API service and optional ML service with secrets marked as manually supplied values.

## GitHub Actions

The workflow is CI-only and requires no paid cloud credentials. It installs Node dependencies, checks server syntax, builds the React app, audits production dependencies, and checks Python syntax.

## Useful Scripts

```bash
npm run dev
npm run build
npm run db:migrate
npm run start
npm run check --workspace server
```

## Main API Areas

- Campaign links: `/api/campaigns/create`, `/api/links/validate/:token`
- Video sessions and upload playback: `/api/video/*`, `/api/storage/*`
- STT relay: `ws://localhost:5000`
- CV demo analysis: `/api/cv/analyze-frame`
- LLM risk analysis: `/api/llm/*`
- Geo verification: `/api/geo/verify`
- Risk scoring: `/api/risk/*`
- Application compile: `/api/application/*`
- Offers: `/api/offers/*`
- Reports/search: `/api/reports/*`, `/api/search/transcripts`
