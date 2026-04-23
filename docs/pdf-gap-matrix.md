# Kredox AI vs PDF Gap Matrix

Source PDF: `Agentic AI video Call Based Onboarding.pdf`

Legend:

- `Done` = implemented and wired
- `Partial` = implemented but depends on provider/env/demo fallback
- `Missing` = still needs work

| PDF requirement | Current implementation | Status | Exact file/path | Fix needed / note |
| --- | --- | --- | --- | --- |
| Customer entry via secure campaign link | Campaigns create links and customer verify page validates token before starting a session | Done | `server/src/routes/campaigns.js`, `server/src/routes/links.js`, `client/src/pages/CustomerVideoPage.jsx` | No change required |
| Live video call as primary interaction channel | Customer page now joins Agora first when configured, with browser media fallback only as secondary path | Partial | `client/src/pages/CustomerVideoPage.jsx`, `client/src/pages/LiveSession.jsx`, `server/src/services/agoraService.js` | Requires real Agora keys in env to be fully live-first in deployed environments |
| Capture live video/audio streams during call | Agent and customer pages now wire live RTC or browser media and keep session state live | Partial | `client/src/pages/CustomerVideoPage.jsx`, `client/src/pages/LiveSession.jsx` | Browser fallback is still used when Agora is absent |
| Geo-location + device/timestamp/IP metadata | Geo verification is live; session timestamp/IP metadata are already persisted in session/audit records | Done | `server/src/services/geoVerificationService.js`, `server/src/services/auditService.js`, `client/src/hooks/useGeoCapture.js` | No change required |
| STT transcript from live call | WebSocket relay persists transcripts and entity detection from live/fallback speech | Partial | `server/src/realtime/deepgramRelayServer.js`, `client/src/hooks/useDeepgramTranscript.js` | Best quality still depends on Deepgram key; browser speech remains fallback |
| Extract employment, income, loan purpose, consent | Entity extraction and consent trail are wired into transcript handling | Done | `server/src/services/transcriptService.js`, `server/src/realtime/deepgramRelayServer.js`, `client/src/pages/LiveSession.jsx` | No change required |
| Create auditable consent trail | Consent confirmation lands in transcript plus audit timeline | Done | `server/src/services/auditService.js`, `client/src/pages/ApplicationReport.jsx` | No change required |
| CV-based age estimation from video feed | Frame capture runs during live session; CV service now supports demo mode and Azure Face provider mode | Partial | `server/src/services/cvAnalysisService.js`, `client/src/hooks/useFrameCapture.js`, `client/src/pages/LiveSession.jsx` | Needs `CV_ANALYSIS_ENABLED=true`, `CV_PROVIDER=azure_face`, Azure Face endpoint/key for real provider mode |
| Auto-fill application from alternate data | Compile service merges STT, CV, geo, bureau, LLM, and declared data into an application object | Done | `server/src/services/applicationCompileService.js`, `client/src/pages/ApplicationReport.jsx` | No change required |
| Risk and policy evaluation | Policy engine + ML + LLM orchestrator are present and reportable | Done | `server/src/services/riskPolicyService.js`, `server/src/routes/risk.js`, `ml/main.py` | No change required |
| LLM interprets conversation but does not override deterministic rules | LLM analysis is stored separately and risk orchestration still keeps deterministic scoring | Done | `server/src/services/llmAnalysisService.js`, `server/src/services/riskPolicyService.js` | No change required |
| Offer generation from policy/risk/LLM outputs | Offer generation and acceptance flows exist | Done | `server/src/services/offerGenerationService.js`, `server/src/routes/offers.js`, `client/src/pages/ApplicationReport.jsx` | No change required |
| Central logging and audit repository | Audit timeline, session reports, transcripts, geo, risk, and offers are all queryable | Partial | `server/src/services/reportingService.js`, `server/src/routes/reports.js`, `client/src/pages/ApplicationReport.jsx` | Video recording storage exists, but automatic end-to-end live recording capture still depends on your recording workflow choice |
| Minimal manual intervention / paperless flow | Customer steps auto-progress from identity -> income -> consent, with fallback buttons only | Done | `client/src/pages/CustomerVideoPage.jsx` | No change required |
| Fraud detection: location mismatch, age inconsistency | Geo mismatch and age consistency signals appear in geo/CV/risk views | Done | `server/src/services/geoVerificationService.js`, `server/src/services/cvAnalysisService.js`, `client/src/pages/ApplicationReport.jsx` | No change required |
| Real-time decisioning / low latency | Core flow is live and demo-safe, but real latency depends on configured providers and infrastructure | Partial | whole stack | Render/Vercel free tier is okay for demo; production latency will need stronger hosting |
| Compliance-friendly access control | Role-based auth exists; public registration can now be disabled by env | Partial | `server/src/services/authService.js`, `server/src/config/env.js`, `client/src/pages/Login.jsx` | For judging/prod, keep `ALLOW_PUBLIC_REGISTRATION=false` and seed admin users manually |

## Highest-priority remaining gaps

1. **Real provider enablement**
   - Agora keys must be configured to make the deployed flow truly live-first.
   - Deepgram key should be configured for robust STT quality.
   - Azure Face requires access plus endpoint/key if you want non-demo CV.

2. **Automatic recording strategy**
   - The repository supports storage/playback and session reports, but you should decide whether live calls are recorded automatically, uploaded after the call, or left out for demo/privacy.

3. **Judging/production hardening**
   - Disable public registration.
   - Seed admin/agent users.
   - Set exact Vercel origins instead of broad demo CORS.

## Recommended judging configuration

```bash
ALLOW_PUBLIC_REGISTRATION=false
VITE_ALLOW_PUBLIC_REGISTRATION=false
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
DEEPGRAM_API_KEY=...
CV_ANALYSIS_ENABLED=true
CV_PROVIDER=azure_face
AZURE_FACE_ENDPOINT=...
AZURE_FACE_API_KEY=...
```
