import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { startCloudRecording } from './agoraService.js';
import { analyzeSessionRisk } from './llmAnalysisService.js';
import { triggerVideoPostProcessing } from './postProcessingService.js';
import { indexTranscriptSession } from './searchService.js';

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
    `SELECT id, customer_id, agent_id, channel_name, status, started_at, ended_at, recording_url
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
  analyzeSessionRisk({ session_id: sessionId }).catch((error) => {
    console.error('Post-call LLM risk analysis failed', {
      session_id: sessionId,
      error: error.message
    });
  });
  indexTranscriptSession(sessionId).catch((error) => {
    console.error('Transcript indexing failed', {
      session_id: sessionId,
      error: error.message
    });
  });

  return {
    session: result.rows[0],
    post_processing: {
      ...post_processing,
      llm_analysis: 'queued'
    }
  };
}
