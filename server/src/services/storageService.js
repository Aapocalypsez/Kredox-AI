import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';

function requireS3Config() {
  if (!env.s3.bucket || !env.s3.accessKeyId || !env.s3.secretAccessKey) {
    const error = new Error('S3 recording storage is not configured');
    error.statusCode = 500;
    error.publicMessage = 'S3 recording storage is not configured on this server';
    throw error;
  }
}

function s3Client() {
  requireS3Config();
  return new S3Client({
    region: env.s3.region,
    credentials: {
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey
    }
  });
}

function recordingKey(sessionId, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `recordings/${year}/${month}/${sessionId}.mp4`;
}

async function presignRecording(key) {
  const expiresIn = env.s3.presignedUrlTtlSeconds;
  const url = await getSignedUrl(
    s3Client(),
    new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    { expiresIn }
  );
  return {
    url,
    expires_at: new Date(Date.now() + expiresIn * 1000)
  };
}

async function fetchTranscriptLines(sessionId) {
  const result = await pool.query(
    `SELECT id, speaker, text, timestamp, confidence,
            COALESCE(offset_seconds, (ROW_NUMBER() OVER (ORDER BY timestamp ASC) - 1) * 8) AS offset_seconds
     FROM transcripts
     WHERE session_id = $1
     ORDER BY timestamp ASC`,
    [sessionId]
  );
  return result.rows.map((row) => ({
    ...row,
    offset_seconds: Number(row.offset_seconds || 0),
    confidence: row.confidence === null ? null : Number(row.confidence)
  }));
}

export async function uploadRecording({ sessionId, file }) {
  if (!file) {
    const error = new Error('Recording file is required');
    error.statusCode = 400;
    error.publicMessage = 'Recording file is required';
    throw error;
  }

  const key = recordingKey(sessionId);
  await s3Client().send(new PutObjectCommand({
    Bucket: env.s3.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || 'video/mp4'
  }));

  const signed = await presignRecording(key);
  const update = await pool.query(
    `UPDATE video_sessions
     SET recording_s3_key = $2,
         recording_url = $3,
         recording_url_expires_at = $4
     WHERE id = $1
     RETURNING id, recording_s3_key, recording_url, recording_url_expires_at`,
    [sessionId, key, signed.url, signed.expires_at]
  );

  if (!update.rowCount) {
    const error = new Error('Video session not found');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found';
    throw error;
  }

  return {
    session_id: sessionId,
    s3_key: key,
    playback_url: signed.url,
    expires_at: signed.expires_at
  };
}

export async function getRecordingPlayback(sessionId) {
  const result = await pool.query(
    `SELECT id, recording_s3_key, recording_url, recording_url_expires_at
     FROM video_sessions
     WHERE id = $1`,
    [sessionId]
  );

  if (!result.rowCount) {
    const error = new Error('Video session not found');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found';
    throw error;
  }

  const session = result.rows[0];
  if (!session.recording_s3_key) {
    return {
      session_id: sessionId,
      playback_url: session.recording_url,
      expires_at: session.recording_url_expires_at,
      transcripts: await fetchTranscriptLines(sessionId)
    };
  }

  const shouldRefresh = !session.recording_url || !session.recording_url_expires_at || new Date(session.recording_url_expires_at).getTime() < Date.now() + 300000;
  if (!shouldRefresh) {
    return {
      session_id: sessionId,
      playback_url: session.recording_url,
      expires_at: session.recording_url_expires_at,
      transcripts: await fetchTranscriptLines(sessionId)
    };
  }

  const signed = await presignRecording(session.recording_s3_key);
  await pool.query(
    `UPDATE video_sessions
     SET recording_url = $2,
         recording_url_expires_at = $3
     WHERE id = $1`,
    [sessionId, signed.url, signed.expires_at]
  );

  return {
    session_id: sessionId,
    playback_url: signed.url,
    expires_at: signed.expires_at,
    transcripts: await fetchTranscriptLines(sessionId)
  };
}
