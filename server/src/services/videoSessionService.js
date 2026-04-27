import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { startCloudRecording } from './agoraService.js';
import { triggerVideoPostProcessing } from './postProcessingService.js';

function defaultChannelName() {
  return `kredox-${crypto.randomUUID()}`;
}

export async function startVideoSession({ customer_id, agent_id, channel_name }) {
  const sessionResult = await pool.query(
    `INSERT INTO video_sessions (customer_id, agent_id, channel_name, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING id, customer_id, agent_id, channel_name, status, started_at, ended_at, recording_url`,
    [customer_id, agent_id, channel_name || defaultChannelName()]
  );

  const session = sessionResult.rows[0];

  try {
    const recording = await startCloudRecording({
      sessionId: session.id,
      channelName: session.channel_name
    });

    if (recording.recording_url) {
      const updateResult = await pool.query(
        `UPDATE video_sessions
         SET recording_url = $2
         WHERE id = $1
         RETURNING id, customer_id, agent_id, channel_name, status, started_at, ended_at, recording_url`,
        [session.id, recording.recording_url]
      );
      return {
        session: updateResult.rows[0],
        recording
      };
    }

    return {
      session,
      recording
    };
  } catch (error) {
    await pool.query(
      `UPDATE video_sessions
       SET status = 'failed'
       WHERE id = $1`,
      [session.id]
    );
    throw error;
  }
}

export async function getVideoSession(sessionId) {
  const result = await pool.query(
    `SELECT
       vs.id,
       vs.customer_id,
       vs.agent_id,
       vs.channel_name,
       vs.status,
       vs.started_at,
       vs.ended_at,
       vs.recording_url,
       c.name AS customer_name,
       c.phone AS customer_phone,
       c.email AS customer_email,
       c.city AS declared_city,
       c.declared_age,
       c.declared_monthly_income,
       c.employment_type,
       c.loan_purpose,
       c.loan_amount_requested,
       c.bureau_score
     FROM video_sessions vs
     LEFT JOIN customers c ON c.id = vs.customer_id
     WHERE vs.id = $1`,
    [sessionId]
  );

  if (!result.rowCount) {
    const error = new Error('Video session not found');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found';
    throw error;
  }

  return result.rows[0];
}

export async function endVideoSession(sessionId) {
  const result = await pool.query(
    `UPDATE video_sessions
     SET status = 'completed',
         ended_at = NOW()
     WHERE id = $1
       AND status = 'active'
     RETURNING id, customer_id, agent_id, channel_name, status, started_at, ended_at, recording_url`,
    [sessionId]
  );

  if (!result.rowCount) {
    const error = new Error('Video session not found or already closed');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found or already closed';
    throw error;
  }

  const post_processing = await triggerVideoPostProcessing(result.rows[0]);

  return {
    session: result.rows[0],
    post_processing: {
      ...post_processing,
      risk_analysis: 'queued',
      application_compile: 'queued'
    }
  };
}
