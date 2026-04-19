import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';

function cloudinaryConfigured() {
  return Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true
  });
}

function recordingPublicId(sessionId, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `kredox/recordings/${year}/${month}/${sessionId}`;
}

function uploadBufferToCloudinary(file, publicId) {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        public_id: publicId,
        overwrite: true
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    Readable.from(file.buffer).pipe(upload);
  });
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

  if (!cloudinaryConfigured()) {
    console.warn('Cloudinary is not configured — recording upload running in demo mode');
    return { demo_mode: true, playback_url: null };
  }

  const publicId = recordingPublicId(sessionId);
  const upload = await uploadBufferToCloudinary(file, publicId);
  const playbackUrl = upload.secure_url;

  const update = await pool.query(
    `UPDATE video_sessions
     SET recording_url = $2
     WHERE id = $1
     RETURNING id, recording_url`,
    [sessionId, playbackUrl]
  );

  if (!update.rowCount) {
    const error = new Error('Video session not found');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found';
    throw error;
  }

  return {
    session_id: sessionId,
    storage_provider: 'cloudinary',
    public_id: upload.public_id || publicId,
    playback_url: playbackUrl,
    expires_at: null
  };
}

export async function getRecordingPlayback(sessionId) {
  const result = await pool.query(
    `SELECT id, recording_url
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

  return {
    session_id: sessionId,
    playback_url: result.rows[0].recording_url,
    expires_at: null,
    transcripts: await fetchTranscriptLines(sessionId)
  };
}
