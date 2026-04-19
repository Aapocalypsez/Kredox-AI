import agoraToken from 'agora-token';
import { env } from '../config/env.js';

const { RtcRole, RtcTokenBuilder } = agoraToken;
const TOKEN_EXPIRY_SECONDS = 3600;

const s3VendorByRegion = {
  'us-east-1': 1,
  'us-east-2': 1,
  'us-west-1': 1,
  'us-west-2': 1,
  'ap-south-1': 1,
  'ap-southeast-1': 1,
  'ap-southeast-2': 1,
  'ap-northeast-1': 1,
  'eu-west-1': 1,
  'eu-west-2': 1,
  'eu-central-1': 1
};

function assertAgoraTokenEnv() {
  const missing = [];
  if (!env.agora.appId) missing.push('AGORA_APP_ID');
  if (!env.agora.appCertificate) missing.push('AGORA_APP_CERTIFICATE');

  if (missing.length) {
    const error = new Error(`Missing Agora configuration: ${missing.join(', ')}`);
    error.statusCode = 500;
    error.publicMessage = 'Agora is not configured on this server';
    throw error;
  }
}

function cloudRecordingConfigured() {
  return Boolean(
    env.agora.customerId &&
      env.agora.customerSecret &&
      env.s3.bucket &&
      env.s3.accessKeyId &&
      env.s3.secretAccessKey
  );
}

function cloudRecordingHeaders() {
  const credentials = Buffer.from(`${env.agora.customerId}:${env.agora.customerSecret}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/json'
  };
}

function s3ObjectPrefix(sessionId) {
  return ['kredox-ai', 'video-sessions', sessionId];
}

function s3RecordingUrl(sessionId) {
  if (!env.s3.bucket) return null;
  return `s3://${env.s3.bucket}/${s3ObjectPrefix(sessionId).join('/')}/`;
}

export function generateRtcToken({ channel_name, uid, role }) {
  assertAgoraTokenEnv();

  const agoraRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const normalizedUid = typeof uid === 'string' && /^\d+$/.test(uid) ? Number(uid) : uid;
  const token =
    typeof normalizedUid === 'number'
      ? RtcTokenBuilder.buildTokenWithUid(
          env.agora.appId,
          env.agora.appCertificate,
          channel_name,
          normalizedUid,
          agoraRole,
          TOKEN_EXPIRY_SECONDS,
          TOKEN_EXPIRY_SECONDS
        )
      : RtcTokenBuilder.buildTokenWithUserAccount(
          env.agora.appId,
          env.agora.appCertificate,
          channel_name,
          normalizedUid,
          agoraRole,
          TOKEN_EXPIRY_SECONDS,
          TOKEN_EXPIRY_SECONDS
        );

  return {
    token,
    appId: env.agora.appId,
    channel_name,
    uid: normalizedUid
  };
}

export async function startCloudRecording({ sessionId, channelName }) {
  if (!cloudRecordingConfigured()) {
    return {
      enabled: false,
      recording_url: null,
      reason: 'cloud_recording_not_configured'
    };
  }

  assertAgoraTokenEnv();

  const recordingUid = env.agora.recordingUid;
  const recorderToken = generateRtcToken({
    channel_name: channelName,
    uid: Number(recordingUid),
    role: 'publisher'
  }).token;

  const baseUrl = `https://api.agora.io/v1/apps/${env.agora.appId}/cloud_recording`;
  const acquireResponse = await fetch(`${baseUrl}/acquire`, {
    method: 'POST',
    headers: cloudRecordingHeaders(),
    body: JSON.stringify({
      cname: channelName,
      uid: recordingUid,
      clientRequest: {}
    })
  });

  if (!acquireResponse.ok) {
    throw new Error(`Agora recording acquire failed with ${acquireResponse.status}`);
  }

  const acquireData = await acquireResponse.json();
  const startResponse = await fetch(`${baseUrl}/resourceid/${acquireData.resourceId}/mode/mix/start`, {
    method: 'POST',
    headers: cloudRecordingHeaders(),
    body: JSON.stringify({
      cname: channelName,
      uid: recordingUid,
      clientRequest: {
        token: recorderToken,
        recordingConfig: {
          channelType: 0,
          streamTypes: 2,
          maxIdleTime: 30,
          transcodingConfig: {
            width: 1280,
            height: 720,
            fps: 15,
            bitrate: 2260,
            mixedVideoLayout: 1
          }
        },
        storageConfig: {
          vendor: s3VendorByRegion[env.s3.region] || 1,
          region: 0,
          bucket: env.s3.bucket,
          accessKey: env.s3.accessKeyId,
          secretKey: env.s3.secretAccessKey,
          fileNamePrefix: s3ObjectPrefix(sessionId)
        }
      }
    })
  });

  if (!startResponse.ok) {
    throw new Error(`Agora recording start failed with ${startResponse.status}`);
  }

  const startData = await startResponse.json();
  return {
    enabled: true,
    recording_url: s3RecordingUrl(sessionId),
    resource_id: acquireData.resourceId,
    sid: startData.sid
  };
}
