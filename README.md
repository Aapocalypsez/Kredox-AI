# Kredox AI

Kredox AI is a live video-call loan onboarding and underwriting platform. This repo is optimized to stay demo-friendly on low-cost infrastructure without losing the primary live onboarding flow:

- Frontend: Vite + React on Vercel
- Backend/API: Node.js + Express on Render
- ML service: Python FastAPI on Render, optional for demos
- Database: Supabase Postgres
- Video storage: Cloudinary
- STT: Deepgram when configured, browser Web Speech fallback when not configured
- LLM: OpenAI `gpt-4o-mini`
- Video workflow: live onboarding first with Agora when configured, browser media fallback for low-cost demos

## Local Quick Start

```bash
npm install
cp .env.example server/.env    # Windows: copy .env.example server\.env
# Edit server/.env — set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:migrate
npm run dev
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env`.

## Deploy (Vercel + Render)

See **[DEPLOY.md](./DEPLOY.md)** for the full Windows zip → Vercel + Render guide.

Before zipping for transfer:

```bash
npm run deploy-prep
```

Local URLs:

- React: `http://localhost:5173`
- Node API: `http://localhost:4000`
- ML service: `http://localhost:8001`
- STT WebSocket relay: `ws://localhost:8080`

## Required Environment Variables

Minimum demo setup:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-chars
REFRESH_JWT_SECRET=replace-with-a-second-long-random-secret
DOMAIN=https://your-vercel-app.vercel.app
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
CLIENT_ORIGINS=https://your-vercel-app.vercel.app,https://your-preview.vercel.app
CORS_ALLOW_ALL=true
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
TRANSCRIPT_WS_PORT=8080
VITE_TRANSCRIPT_WS_URL=wss://your-render-api.onrender.com
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
CV_ANALYSIS_ENABLED=false
CV_PROVIDER=demo
AZURE_FACE_ENDPOINT=
AZURE_FACE_API_KEY=
AZURE_FACE_API_VERSION=v1.0
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
ML_SERVICE_URL=https://your-render-ml.onrender.com
VITE_PYTHON_API=https://your-render-ml.onrender.com
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=...
TWILIO_WHATSAPP_FROM=...
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
```

## Live Video Flow

The primary onboarding path is now a live video session. When `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are configured:

- the customer verification page joins a live RTC channel first
- the agent session page subscribes to the same channel
- STT, geo capture, and CV frame analysis run during the session
- customer steps progress automatically from identity to income to consent

If Agora is not configured, the UI falls back to browser camera/microphone capture so the live verification journey still works for demos.

## Speech-to-Text Fallback

The WebSocket relay uses Deepgram when `DEEPGRAM_API_KEY` is configured. If the key is missing or the relay cannot connect, the frontend automatically switches to browser Web Speech where available and still sends final transcript text back through the relay so entity detection and transcript persistence continue to work.

## Geo Stack

Geo verification now uses browser geolocation plus OpenStreetMap/Nominatim for reverse geocoding. This keeps the demo stack free and removes the Google Maps billing dependency.

Notes:

- no Google Maps key is required
- public Nominatim is appropriate for demos and low-traffic environments
- if you later need more control, point `NOMINATIM_BASE_URL` to your own hosted Nominatim service

## Computer Vision Provider Modes

By default, frame analysis uses a local demo-safe analyzer. It records frame availability, liveness-style scores, declared-age consistency, and a calm emotion signal without calling paid cloud CV services.

If you want stronger authenticity for a client or judging environment, you can enable Azure Face:

```bash
CV_ANALYSIS_ENABLED=true
CV_PROVIDER=azure_face
AZURE_FACE_ENDPOINT=https://your-face-resource.cognitiveservices.azure.com
AZURE_FACE_API_KEY=your-key
AZURE_FACE_API_VERSION=v1.0
```

Notes:

- the frontend already surfaces whether CV is running in demo or live-provider mode
- if Azure Face fails or is not configured, the service falls back to demo CV instead of breaking the session
- Azure Face access for age and some face attributes can be restricted by Microsoft, so treat this as an environment-dependent upgrade path

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
PORT=4000
DATABASE_URL=your-supabase-connection-string
REDIS_URL=optional-redis-url
JWT_SECRET=...
REFRESH_JWT_SECRET=...
DOMAIN=https://your-vercel-app.vercel.app
CLIENT_ORIGIN=https://your-vercel-app.vercel.app
CLIENT_ORIGINS=https://your-vercel-app.vercel.app,https://your-preview.vercel.app
CORS_ALLOW_ALL=true
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=kredox-ai-demo
DEEPGRAM_API_KEY=optional
TRANSCRIPT_WS_PORT=8080
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
CV_ANALYSIS_ENABLED=false
CV_PROVIDER=demo
AZURE_FACE_ENDPOINT=
AZURE_FACE_API_KEY=
AZURE_FACE_API_VERSION=v1.0
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

For demos, the frontend can include a Register tab on the login page when `ALLOW_PUBLIC_REGISTRATION=true` on the API and `VITE_ALLOW_PUBLIC_REGISTRATION=true` on the frontend. It calls `POST /api/auth/register` and can create `admin`, `agent`, or `viewer` accounts. For production or judging builds, keep public registration disabled and seed/admin-manage users manually.

## Auth Roles

- `admin`: full platform access, including audit logs, transcript search, storage/recordings, reports, campaigns, sessions, and risk workflows.
- `agent`: operational onboarding access for campaigns, sessions, applications, CV, LLM, and risk workflows.
- `viewer`: read-only access to reports and activity.

The Admin console is available at `/admin` after login. It shows audit logs, transcript search, and recording lookup.

## Deploy ML Service On Render

The ML service is optional for the demo. It now includes a fallback scorer, so `/ml/predict` still returns a risk score even when `risk_model.pkl` has not been trained yet.

To deploy it:

- Root directory: `ml`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Set `ML_SERVICE_URL` on the Node API and `VITE_PYTHON_API` on Vercel.

For a real trained XGBoost model later, install training dependencies locally with:

```bash
pip install -r requirements-train.txt
python train_model.py --data historical_loan_data.csv
```

That will generate `risk_model.pkl`. Without that file, the service runs in `demo_mode: true` and uses deterministic fallback scoring based on bureau score, income, age, employment, existing loans, loan amount, geo score, liveness score, and LLM confidence.

The root `render.yaml` can be used as a Render blueprint. It defines the API service and optional ML service with secrets marked as manually supplied values.

## GitHub Actions

The workflow is CI-only and requires no paid cloud credentials. It installs Node dependencies, checks server syntax, builds the React app, audits production dependencies, and checks Python syntax.

## PDF Alignment Matrix

For a line-by-line comparison against the "Agentic AI Video Call Based Onboarding" PDF, see [docs/pdf-gap-matrix.md](./docs/pdf-gap-matrix.md).

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
- STT relay: `ws://localhost:8080`
- CV demo analysis: `/api/cv/analyze-frame`
- LLM risk analysis: `/api/llm/*`
- Geo verification: `/api/geo/verify`
- Risk scoring: `/api/risk/*`
- Application compile: `/api/application/*`
- Offers: `/api/offers/*`
- Reports/search: `/api/reports/*`, `/api/search/transcripts`
