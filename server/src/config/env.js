import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: serverEnvPath, override: true });

const trimTrailingSlash = (value) => value?.replace(/\/+$/, '');

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  refreshJwtSecret: process.env.REFRESH_JWT_SECRET || process.env.JWT_SECRET,
  domain: trimTrailingSlash(process.env.DOMAIN || 'http://localhost:5173'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    smsFrom: process.env.TWILIO_SMS_FROM,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL
  },
  agora: {
    appId: process.env.AGORA_APP_ID,
    appCertificate: process.env.AGORA_APP_CERTIFICATE,
    customerId: process.env.AGORA_CUSTOMER_ID,
    customerSecret: process.env.AGORA_CUSTOMER_SECRET,
    recordingUid: process.env.AGORA_RECORDING_UID || '900001'
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'kredox-ai-demo'
  },
  cv: {
    provider: process.env.CV_PROVIDER || 'demo'
  },
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY,
    wsPort: Number(process.env.TRANSCRIPT_WS_PORT || process.env.PORT || 5000)
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  google: {
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY
  },
  ml: {
    apiUrl: process.env.ML_SERVICE_URL || process.env.ML_API_URL || 'http://localhost:8001'
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    apiKey: process.env.ELASTICSEARCH_API_KEY,
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    transcriptIndex: process.env.ELASTICSEARCH_TRANSCRIPT_INDEX || 'transcripts'
  }
};

export function assertCoreEnv() {
  const missing = [];
  if (!env.databaseUrl) missing.push('DATABASE_URL');
  if (!env.jwtSecret || env.jwtSecret.length < 32) missing.push('JWT_SECRET (32+ chars)');

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
