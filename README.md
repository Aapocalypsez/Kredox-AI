# Kredox AI

Secure campaign link generation for a loan origination platform.

## Stack

- Node.js + Express API
- PostgreSQL for campaigns, customers, and link status
- Redis for single-use token TTL enforcement
- React + Vite campaign console
- Twilio SMS/WhatsApp and SendGrid email adapters
- Agora RTC video sessions for agent/customer verification calls
- Deepgram realtime speech-to-text relay over WebSockets
- AWS Rekognition face analysis for frame-level liveness and age consistency
- OpenAI GPT-4o post-call loan risk analysis
- Browser GPS plus Google Maps and IP backup geo verification
- Rules-based policy engine plus Python XGBoost propensity model
- Intelligent loan application auto-fill with field-level confidence metadata
- Loan offer generation with configurable tiers, EMI options, and public customer acceptance links
- Audit trail logging, S3 recording playback, Elasticsearch transcript search, and reporting dashboards
- JWT agent authentication with role-based access and httpOnly refresh-token cookies

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
copy .env.example .env
```

3. Start Postgres and Redis:

```bash
docker compose up -d
```

4. Create the database tables:

```bash
npm run db:migrate
```

5. Start the API and React app:

```bash
npm run dev
```

The React app runs at `http://localhost:5173` and the API runs at `http://localhost:5000`.

## API

- `POST /api/campaigns/create`
- `GET /api/links/validate/:token`
- `POST /api/campaigns/:id/stats`
- `GET /api/campaigns`
- `GET /api/campaigns/:id/links`
- `POST /api/video/token`
- `POST /api/video/session/start`
- `GET /api/video/session/:id`
- `POST /api/video/session/:id/end`
- `POST /api/cv/analyze-frame`
- `GET /api/cv/session/:session_id/summary`
- `POST /api/llm/analyze`
- `GET /api/llm/analysis/:session_id`
- `POST /api/llm/explain-offer`
- `POST /api/geo/verify`
- `GET /api/geo/session/:session_id/report`
- `POST /api/risk/policy-check`
- `POST /api/risk/final-score`
- `POST /api/application/compile`
- `PATCH /api/application/:id/field`
- `POST /api/offers/generate`
- `GET /api/offers/public/:token`
- `POST /api/offers/:id/present`
- `POST /api/offers/:id/accept`
- `POST /api/offers/:id/reject`
- `GET /api/audit/logs`
- `POST /api/storage/upload-recording`
- `GET /api/storage/recording/:session_id`
- `GET /api/search/transcripts`
- `GET /api/reports/daily-summary`
- `GET /api/reports/agent-performance`
- `GET /api/reports/dashboard`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Tokens are signed with `JWT_SECRET`, cached in Redis with the campaign TTL, and deleted from Redis on first successful validation.

## Speech To Text

The API process starts a WebSocket relay on `ws://localhost:8080`. The agent dashboard connects with the video session id, forwards Agora audio chunks, and receives normalized Deepgram events:

```json
{ "type": "transcript", "transcript": "I consent to this loan application", "confidence": 0.98, "speaker": 0, "is_final": true }
```

After final transcript chunks, Kredox AI stores rows in `transcripts` and emits simple detected entities:

```json
{ "type": "entity_detected", "field": "income", "value": "45000", "display_value": "INR 45,000 / month" }
```

Add this to `.env`:

```bash
DEEPGRAM_API_KEY=your-deepgram-key
TRANSCRIPT_WS_PORT=8080
VITE_TRANSCRIPT_WS_URL=ws://localhost:8080
```

## Video Calls

Kredox AI uses `agora-token` on the API and the published Agora React SDK package `agora-rtc-react` on the frontend.

Add these values to `.env` before testing live calls:

```bash
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-app-certificate
```

Customer calls open at `/verify/:token` after a secure campaign link validates. Agent calls open at `/dashboard/session/:sessionId`.

Cloud Recording is optional. If `AGORA_CUSTOMER_ID`, `AGORA_CUSTOMER_SECRET`, and S3 credentials are present, the API attempts to start Agora Cloud Recording when a video session begins and stores the target S3 URL on `video_sessions.recording_url`.

## Computer Vision

The agent dashboard captures the customer video tile every 3 seconds and posts JPEG frames to Rekognition through the backend. AWS credentials stay server-side only.

Add this to `.env`:

```bash
AWS_REGION=ap-south-1
AWS_REKOGNITION_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

For age consistency checks, include an `age` or `declared_age` column in campaign CSV uploads. Frame-level results are saved in `cv_analysis`, and `/api/cv/session/:session_id/summary` returns average liveness score, most common age estimate, analyzed frame count, and flag count.

## LLM Risk Analysis

When a video session ends, Kredox AI queues a GPT-4o risk analysis using transcript rows, declared customer data, CV summary, geo match, bureau score, and consent detection. The analysis is saved in `llm_analysis`.

Add this to `.env`:

```bash
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o
```

The agent report screen uses `POST /api/llm/analyze?stream=true` so GPT response chunks can stream while the summary types onto the report. The stored result can be fetched later with `GET /api/llm/analysis/:session_id`.

## Geo Verification

The customer verification page asks the browser for GPS coordinates when the call starts. If the customer denies GPS, the frontend still sends an IP-only verification request. The backend reverse geocodes GPS coordinates through Google Maps, checks IP location with `ip-api.com`, compares against the declared city/state, and saves the fraud score in `geo_verifications`.

Add this to `.env`:

```bash
GOOGLE_MAPS_API_KEY=your-google-maps-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

The agent dashboard shows the latest geo verification card. The application detail report is available at `/application/session/:sessionId/geo`.

## Risk Scoring Engine

The Node API evaluates configurable policy rules from `server/config/policy_rules.json`. The final-score endpoint runs policy checks and the Python ML prediction path concurrently, then combines:

```text
final_score = (ml_risk_score * 0.5) + (policy_score * 0.3) + (llm_confidence * 0.2)
```

Start the Python service:

```bash
cd ml
pip install -r requirements.txt
python train_model.py --data historical_loan_data.csv
uvicorn main:app --host 0.0.0.0 --port 8001
```

Add this to `.env`:

```bash
ML_API_URL=http://localhost:8001
```

The risk report screen shows the final circular score gauge, ML/policy/AI contribution bars, SHAP feature contribution chart, and collapsible policy rules table.

## Application Auto-fill

`POST /api/application/compile` gathers transcript entities, CV analysis, geo verification, bureau/declaration data, LLM analysis, and risk assessment data in parallel. The compiled application is validated with Zod, saved to `loan_applications`, and every field carries:

```json
{ "value": "45000", "source": "stt_extracted", "confidence": 0.92, "needs_review": false }
```

Agent corrections use `PATCH /api/application/:id/field` and are logged in `application_edits`. The review UI is available at `/application/session/:sessionId`.

## Loan Offers

`POST /api/offers/generate` fetches the completed application plus risk assessment, applies tier rules from `server/config/offer_tiers.json`, caps the offer using the requested amount, tier maximum, and FOIR, then calculates EMI options. GPT-4o-mini generates the two-sentence customer explanation, and the offer is saved in `loan_offers` with a public token.

Agent review is available at `/application/:applicationId/offer/:sessionId`. The page shows the generated amount, rate, EMI cards, processing fee, typewriter explanation, a present-to-customer action, and an override placeholder for the audit workflow.

Customer acceptance opens at `/offer/:token`. The public token fetches only customer-facing offer details, requires a terms checkbox, and accepts through `POST /api/offers/:id/accept`.

## Audit, Storage, Search, And Reports

Every successful `/api/*` request is captured by the audit middleware and saved to `audit_logs` with actor, entity, IP, user agent, before/after JSON, and an event type such as `SESSION_STARTED`, `FIELD_EDITED`, `OFFER_ACCEPTED`, or `RISK_SCORE_CALCULATED`. Application timelines are available at `/admin/audit/:applicationId`, with filters and CSV export.

Recordings upload through `POST /api/storage/upload-recording` as multipart form data with fields `session_id` and `recording`. Files are stored under `recordings/{year}/{month}/{session_id}.mp4`; playback opens at `/recordings/:sessionId` with a fresh 7-day S3 pre-signed URL and synchronized transcript lines.

When a session ends, Kredox AI indexes the full transcript into Elasticsearch. If Elasticsearch is unavailable, transcript search falls back to PostgreSQL. Global search is available at `/search`, and dashboard analytics refresh every five minutes from `GET /api/reports/dashboard`.

Add this to `.env` for live S3 and Elasticsearch:

```bash
AWS_S3_BUCKET=your-recording-bucket
S3_PRESIGNED_URL_TTL_SECONDS=604800
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_API_KEY=
ELASTICSEARCH_TRANSCRIPT_INDEX=transcripts
```

## Authentication

Agent access uses short-lived JWT access tokens and 7-day refresh tokens stored in an httpOnly cookie. Roles are `admin`, `agent`, and `viewer`; admins can access all protected routes, agents can run operational workflows, and viewers are limited to read-only reporting.

Create the first admin after migration:

```powershell
$env:ADMIN_EMAIL="admin@kredox.ai"
$env:ADMIN_PASSWORD="change-this-password"
npm run db:seed-admin --workspace server
```

Protected React pages show the agent sign-in screen automatically. Public customer paths remain open for `/verify/:token` and `/offer/:token`.

## AWS Deployment

The deployment target is:

- React frontend: S3 + CloudFront or AWS Amplify, with SSL from AWS Certificate Manager.
- Node API: Docker image in ECR, deployed to ECS Fargate behind API Gateway or an Application Load Balancer.
- Python ML service: separate Docker image in ECR, deployed to ECS Fargate.
- PostgreSQL: Amazon RDS PostgreSQL, Multi-AZ for production.
- Redis: Amazon ElastiCache in private subnets.
- Transcript search: Amazon OpenSearch Service.
- Recording storage: S3 bucket with pre-signed playback URLs.
- WebSockets: API Gateway WebSocket API, or EC2/Nginx for the Deepgram relay if keeping raw WebSockets.
- Network: all services in a private VPC; only CloudFront/API Gateway/ALB are public entry points.

Provided deployment files:

- `server/Dockerfile` for the Node.js API and Deepgram WebSocket relay.
- `ml/Dockerfile` for the FastAPI/XGBoost service.
- `docker-compose.yml` for local Postgres, Redis, Elasticsearch, API, ML, and Nginx.
- `nginx.conf` for local reverse proxy and WebSocket forwarding.
- `.github/workflows/deploy-aws.yml` for GitHub Actions build, push to ECR, ECS redeploy, S3 sync, and CloudFront invalidation.
