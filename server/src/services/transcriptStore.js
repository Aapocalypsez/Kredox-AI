import { pool } from '../db/pool.js';
import { logAuditEvent } from './auditService.js';

export async function saveFinalTranscript({ sessionId, speaker, text, confidence }) {
  if (!text?.trim()) return null;

  const result = await pool.query(
    `INSERT INTO transcripts (session_id, speaker, text, confidence, offset_seconds)
     VALUES (
       $1,
       $2,
       $3,
       $4,
       (SELECT COUNT(*) * 8 FROM transcripts WHERE session_id = $1)
     )
     RETURNING id, session_id, speaker, text, offset_seconds, timestamp, confidence`,
    [sessionId, speaker ? String(speaker) : null, text.trim(), confidence ?? null]
  );

  logAuditEvent({
    event_type: text.toLowerCase().includes('i consent to this loan application') ? 'CONSENT_CONFIRMED' : 'TRANSCRIPT_SAVED',
    entity_type: 'video_session',
    entity_id: sessionId,
    actor_type: speaker ? 'customer' : 'system',
    actor_id: speaker ? String(speaker) : null,
    action: 'save_transcript',
    new_value: result.rows[0]
  }).catch((error) => {
    console.error('Transcript audit logging failed', { error: error.message });
  });

  return result.rows[0];
}
