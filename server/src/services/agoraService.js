import agoraToken from 'agora-token';
import { env } from '../config/env.js';

const { RtcRole, RtcTokenBuilder } = agoraToken;
const TOKEN_EXPIRY_SECONDS = 3600;

function agoraConfigured() {
  return Boolean(env.agora.appId && env.agora.appCertificate);
}

export function generateRtcToken({ channel_name, uid, role }) {
  if (!agoraConfigured()) {
    return {
      token: null,
      appId: null,
      channel_name,
      uid,
      provider: 'demo_upload',
      disabled: true,
      reason: 'agora_not_configured'
    };
  }

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
    uid: normalizedUid,
    provider: 'agora'
  };
}

export async function startCloudRecording() {
  return {
    enabled: false,
    recording_url: null,
    reason: 'live_rtc_recording_disabled_for_demo_upload_flow'
  };
}
