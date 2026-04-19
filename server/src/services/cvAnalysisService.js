import { DetectFacesCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logAuditEvent } from './auditService.js';

function rekognitionClient() {
  return new RekognitionClient({
    region: env.rekognition.region,
    credentials: env.rekognition.accessKeyId && env.rekognition.secretAccessKey
      ? {
          accessKeyId: env.rekognition.accessKeyId,
          secretAccessKey: env.rekognition.secretAccessKey
        }
      : undefined
  });
}

function imageBytesFromBase64(imageBase64) {
  const cleaned = imageBase64.includes(',') ? imageBase64.split(',').pop() : imageBase64;
  return Buffer.from(cleaned, 'base64');
}

function calculateLiveness(face) {
  if (!face) {
    return { liveness_score: 0, liveness_status: 'FAIL' };
  }

  let score = 100;
  if ((face.Confidence || 0) < 90) score -= 30;
  if (face.EyesOpen?.Value === false) score -= 20;

  const yaw = Math.abs(face.Pose?.Yaw || 0);
  const pitch = Math.abs(face.Pose?.Pitch || 0);
  if (yaw > 30 || pitch > 30) score -= 15;

  score = Math.max(0, score);
  return {
    liveness_score: score,
    liveness_status: score >= 70 ? 'PASS' : 'FAIL'
  };
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

function isAgeFlagged(declaredAge, ageRange) {
  if (!declaredAge || !ageRange?.Low || !ageRange?.High) return false;
  return declaredAge < ageRange.Low - 10 || declaredAge > ageRange.High + 10;
}

function dominantEmotions(face) {
  return (face?.Emotions || [])
    .map((emotion) => ({
      type: emotion.Type,
      confidence: Number((emotion.Confidence || 0).toFixed(2))
    }))
    .sort((left, right) => right.confidence - left.confidence);
}

export async function analyzeFrame({ session_id, image_base64, frame_number }) {
  const response = await rekognitionClient().send(new DetectFacesCommand({
    Image: {
      Bytes: imageBytesFromBase64(image_base64)
    },
    Attributes: ['ALL']
  }));

  const face = response.FaceDetails?.[0] || null;
  const declaredAge = await getDeclaredAge(session_id);
  const ageRange = face?.AgeRange || null;
  const ageMidpoint = ageRange ? Math.round((ageRange.Low + ageRange.High) / 2) : null;
  const liveness = calculateLiveness(face);
  const ageFlag = isAgeFlagged(declaredAge, ageRange);
  const emotions = dominantEmotions(face);

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
      ageRange?.Low ?? null,
      ageRange?.High ?? null,
      liveness.liveness_score,
      liveness.liveness_status,
      ageFlag,
      JSON.stringify(response)
    ]
  );

  logAuditEvent({
    event_type: 'FRAME_CAPTURED',
    entity_type: 'video_session',
    entity_id: session_id,
    actor_type: 'system',
    action: 'capture_frame',
    new_value: { frame_number }
  }).catch((error) => {
    console.error('Frame capture audit logging failed', { error: error.message });
  });

  return {
    face_detected: Boolean(face),
    bounding_box: face?.BoundingBox || null,
    confidence: face?.Confidence ?? null,
    age_range: ageRange ? { low: ageRange.Low, high: ageRange.High } : null,
    age_midpoint: ageMidpoint,
    declared_age: declaredAge,
    liveness_score: liveness.liveness_score,
    liveness_status: liveness.liveness_status,
    age_flag: ageFlag,
    eyes_open: face?.EyesOpen || null,
    mouth_open: face?.MouthOpen || null,
    pose: face?.Pose || null,
    emotions
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

  return result.rows[0];
}
