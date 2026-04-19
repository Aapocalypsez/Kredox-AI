import { pool } from '../db/pool.js';
import { logAuditEvent } from './auditService.js';

function imageBytesFromBase64(imageBase64 = '') {
  const cleaned = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  return Buffer.from(cleaned || '', 'base64');
}

async function getDeclaredAge(sessionId) {
  const result = await pool.query(
    `SELECT c.declared_age
     FROM video_sessions vs
     LEFT JOIN customers c ON c.id::text = vs.customer_id
     WHERE vs.id = $1`,
    [sessionId]
  );

  return result.rows[0]?.declared_age ?? null;
}

function demoAgeRange(declaredAge, frameNumber) {
  if (!declaredAge) return null;
  const wobble = Number(frameNumber || 0) % 3;
  return {
    low: Math.max(18, Number(declaredAge) - 4 + wobble),
    high: Number(declaredAge) + 4 + wobble
  };
}

function isAgeFlagged(declaredAge, ageRange) {
  if (!declaredAge || !ageRange?.low || !ageRange?.high) return false;
  return declaredAge < ageRange.low - 10 || declaredAge > ageRange.high + 10;
}

function demoLivenessScore(imageBytes, frameNumber) {
  if (!imageBytes.length) return 0;
  const sizeScore = imageBytes.length > 1500 ? 75 : 55;
  const motionScore = Math.min(15, Number(frameNumber || 0) % 16);
  return Math.min(100, sizeScore + motionScore);
}

export async function analyzeFrame({ session_id, image_base64, frame_number }) {
  const imageBytes = imageBytesFromBase64(image_base64);
  const faceDetected = imageBytes.length > 0;
  const declaredAge = await getDeclaredAge(session_id);
  const ageRange = demoAgeRange(declaredAge, frame_number);
  const ageMidpoint = ageRange ? Math.round((ageRange.low + ageRange.high) / 2) : null;
  const livenessScore = demoLivenessScore(imageBytes, frame_number);
  const livenessStatus = livenessScore >= 60 ? 'PASS' : 'FAIL';
  const ageFlag = isAgeFlagged(declaredAge, ageRange);
  const emotions = faceDetected ? [{ type: 'CALM', confidence: 88 }] : [];

  const rawResponse = {
    provider: 'demo_cv',
    note: 'Demo mode estimates liveness from uploaded/captured frame availability and does not call paid cloud CV APIs.',
    image_bytes: imageBytes.length
  };

  await pool.query(
    `INSERT INTO cv_analysis (
       session_id,
       frame_number,
       age_low,
       age_high,
       liveness_score,
       liveness_status,
       age_flag,
       raw_response
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      session_id,
      frame_number,
      ageRange?.low ?? null,
      ageRange?.high ?? null,
      livenessScore,
      livenessStatus,
      ageFlag,
      JSON.stringify(rawResponse)
    ]
  );

  logAuditEvent({
    event_type: 'FRAME_CAPTURED',
    entity_type: 'video_session',
    entity_id: session_id,
    actor_type: 'system',
    action: 'capture_frame',
    new_value: { frame_number, provider: 'demo_cv' }
  }).catch((error) => {
    console.error('Frame capture audit logging failed', { error: error.message });
  });

  return {
    face_detected: faceDetected,
    bounding_box: faceDetected ? { Width: 0.45, Height: 0.55, Left: 0.27, Top: 0.2 } : null,
    confidence: faceDetected ? 90 : 0,
    age_range: ageRange,
    age_midpoint: ageMidpoint,
    declared_age: declaredAge,
    liveness_score: livenessScore,
    liveness_status: livenessStatus,
    age_flag: ageFlag,
    eyes_open: faceDetected ? { Value: true, Confidence: 90 } : null,
    mouth_open: null,
    pose: faceDetected ? { Roll: 0, Yaw: 0, Pitch: 0 } : null,
    emotions,
    provider: 'demo_cv'
  };
}

export async function getCvSessionSummary(sessionId) {
  const result = await pool.query(
    `WITH age_counts AS (
       SELECT
         age_low,
         age_high,
         COUNT(*) AS count
       FROM cv_analysis
       WHERE session_id = $1
         AND age_low IS NOT NULL
         AND age_high IS NOT NULL
       GROUP BY age_low, age_high
       ORDER BY count DESC, age_low ASC
       LIMIT 1
     )
     SELECT
       COUNT(cva.*)::int AS total_frames_analyzed,
       COALESCE(ROUND(AVG(cva.liveness_score))::int, 0) AS average_liveness_score,
       COUNT(*) FILTER (WHERE cva.age_flag)::int AS flag_count,
       (SELECT json_build_object('low', age_low, 'high', age_high) FROM age_counts) AS most_common_age_estimate
     FROM cv_analysis cva
     WHERE cva.session_id = $1`,
    [sessionId]
  );

  return {
    ...result.rows[0],
    provider: 'demo_cv'
  };
}
