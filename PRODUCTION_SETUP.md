# Kredox AI: Production Integrations & Setup Guide

To transition Kredox AI from the developer sandbox mode to a fully functional, production-ready system with live video calls, real-time speech-to-text, facial biometrics, and automated notifications, you need to configure the respective environment variables in your server's `.env` (or Render's Environment Variables dashboard).

---

## 1. Video & Audio Call Streams (Agora.io)
Kredox AI uses Agora for high-concurrency, low-latency WebRTC video calls.

1. Create a free account at [Agora.io Console](https://console.agora.io/).
2. Create a new project and select **Secure Mode: APP ID + Token**.
3. Copy your project's **App ID** and **Primary Certificate**.
4. Configure these in your server environment:
   ```env
   AGORA_APP_ID=your_agora_app_id
   AGORA_APP_CERTIFICATE=your_agora_primary_certificate
   ```

---

## 2. Speech-to-Text Transcription (Deepgram)
Used to translate verbal customer responses (Hindi, Hinglish, English) into structured text in real time.

1. Sign up at [Deepgram Console](https://console.deepgram.com/).
2. Create an API key with `Member` or `Admin` permissions.
3. Configure the key:
   ```env
   DEEPGRAM_API_KEY=your_deepgram_api_key
   ```

---

## 3. Computer Vision (Azure Face API)
Used for live face detection, age estimation, and liveness verification.

1. Create an Azure Account and deploy a **Face API** resource from the [Azure Portal](https://portal.azure.com/).
2. Copy your resource **Endpoint URL** and **API Key** (Key 1 or Key 2).
3. Update your configuration to enable CV and set the active provider to `azure_face`:
   ```env
   CV_ANALYSIS_ENABLED=true
   CV_PROVIDER=azure_face
   AZURE_FACE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
   AZURE_FACE_API_KEY=your_azure_face_api_key
   AZURE_FACE_API_VERSION=v1.0
   ```

---

## 4. LLM Intelligence & Risk Analysis (OpenAI)
Used by the AI Underwriter to classify customer risk bands, construct personas, detect red flags, and generate decision explanations.

1. Create an account at [OpenAI Platform](https://platform.openai.com/).
2. Purchase API credits and generate a new **Secret Key**.
3. Configure the key:
   ```env
   OPENAI_API_KEY=sk-proj-your_openai_secret_key
   OPENAI_MODEL=gpt-4o-mini
   ```

---

## 5. SMS & WhatsApp Notifications (Twilio)
Used to distribute secure KYC links directly to customers.

1. Create an account at [Twilio Console](https://www.twilio.com/console).
2. Copy your **Account SID** and **Auth Token**.
3. Configure the parameters:
   ```env
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   ```

---

## 6. Email Delivery (SendGrid)
Used to distribute loan offer receipts and admin alerts.

1. Create an account at [SendGrid](https://sendgrid.com/).
2. Create and verify a Sender Identity (Single Sender Verification or Domain Authentication).
3. Generate an API Key with **Full Access**.
4. Configure the key:
   ```env
   SENDGRID_API_KEY=SG.your_sendgrid_api_key
   ```

---

## 7. Production Database Connection (Supabase)
For production, use Supabase's **Transaction Connection Pooler** to avoid exceeding concurrent connection limits.

1. Go to your [Supabase Dashboard](https://supabase.com/) -> Project Settings -> Database.
2. Under Connection Strings, select **Pooler** and set the Mode to **Transaction** (port `5432` or `6543`).
3. Configure the pooled URL in your environment:
   ```env
   DATABASE_URL=postgres://postgres.your-project-id:password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
   ```
