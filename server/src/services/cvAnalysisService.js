import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logAuditEvent } from './auditService.js';

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

function fallbackAgeRange(declaredAge) {
  if (!declaredAge) return { low: 25, high: 35 };
  return { low: Math.max(18, Number(declaredAge) - 5), high: Number(declaredAge) + 5 };
}

function dataUrlToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const [, base64 = ''] = dataUrl.split(',');
  return base64 ? Buffer.from(base64, 'base64') : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeProviderName(provider) {
  if (provider === 'azure_face') return 'azure_face';
  return 'demo_cv';
}

function buildRejectedFrameResult(declaredAge, reason = 'unusable_frame', frameQuality = null) {
  return {
    provider: 'demo_cv',
    provider_status: reason,
    face_detected: false,
    age_range: null,
    age_midpoint: declaredAge || null,
    liveness_score: 0,
    liveness_status: 'FAIL',
    age_flag: false,
    emotions: [],
    demo_mode: true,
    quality: frameQuality
  };
}

function buildFallbackResult(declaredAge, reason = 'demo_mode', frameQuality = null) {
  if (frameQuality && frameQuality.usable === false) {
    return buildRejectedFrameResult(declaredAge, frameQuality.reason || 'unusable_frame', frameQuality);
  }

  const ageRange = fallbackAgeRange(declaredAge);
  return {
    provider: 'demo_cv',
    provider_status: reason,
    face_detected: true,
    age_range: ageRange,
    age_midpoint: declaredAge || 30,
    liveness_score: 85,
    liveness_status: 'PASS',
    age_flag: false,
    emotions: [{ type: 'CALM', confidence: 88 }],
    demo_mode: true,
    quality: frameQuality
  };
}

function deriveAzureAgeRange(faceAttributes, declaredAge) {
  const detectedAge = Number(faceAttributes?.age);
  if (!Number.isFinite(detectedAge)) return fallbackAgeRange(declaredAge);
  return {
    low: Math.max(18, Math.floor(detectedAge - 4)),
    high: Math.ceil(detectedAge + 4)
  };
}

function deriveAzureEmotions(faceAttributes) {
  const emotions = faceAttributes?.emotion;
  if (!emotions || typeof emotions !== 'object') {
    return [];
  }

  const top = Object.entries(emotions)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  if (!top) return [];

  return [{ type: String(top[0]).toUpperCase(), confidence: clamp(Number(top[1]) * 100) }];
}

function deriveLivenessFromAzure(face, declaredAge) {
  const attrs = face?.faceAttributes || {};
  let score = 55;

  if (face?.faceRectangle?.width && face?.faceRectangle?.height) {
    const area = face.faceRectangle.width * face.faceRectangle.height;
    if (area >= 18000) score += 12;
    else if (area >= 9000) score += 8;
  }

  const quality = String(attrs.qualityForRecognition || '').toLowerCase();
  if (quality === 'high') score += 18;
  else if (quality === 'medium') score += 10;

  const blurLevel = String(attrs.blur?.blurLevel || '').toLowerCase();
  if (blurLevel === 'low') score += 10;
  else if (blurLevel === 'medium') score += 4;
  else if (blurLevel === 'high') score -= 12;

  const exposureLevel = String(attrs.exposure?.exposureLevel || '').toLowerCase();
  if (exposureLevel === 'goodexposure') score += 6;
  else if (exposureLevel === 'underexposure' || exposureLevel === 'overexposure') score -= 4;

  const ageRange = deriveAzureAgeRange(attrs, declaredAge);
  const ageMid = Math.round((ageRange.low + ageRange.high) / 2);
  const ageFlag = declaredAge ? Math.abs(Number(declaredAge) - ageMid) > 8 : false;
  if (!ageFlag) score += 4;

  const livenessScore = clamp(score);
  return {
    ageRange,
    livenessScore,
    livenessStatus: livenessScore >= 60 ? 'PASS' : 'FAIL',
    ageFlag
  };
}

async function analyzeWithAzureFace(imageBase64, declaredAge) {
  if (!env.cv.azureFaceEndpoint || !env.cv.azureFaceApiKey) {
    throw new Error('Azure Face credentials are not configured');
  }

  const imageBuffer = dataUrlToBuffer(imageBase64);
  if (!imageBuffer) {
    throw new Error('Invalid frame payload for Azure Face');
  }

  const apiVersion = env.cv.azureFaceApiVersion;
  const endpoint = `${env.cv.azureFaceEndpoint}/face/${apiVersion}/detect?returnFaceId=false&returnFaceLandmarks=false&returnFaceAttributes=age,blur,exposure,qualityForRecognition&detectionModel=detection_01&recognitionModel=recognition_04`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Ocp-Apim-Subscription-Key': env.cv.azureFaceApiKey
    },
    body: imageBuffer
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Azure Face detect failed (${response.status}): ${detail}`);
  }

  const faces = await response.json();
  const face = Array.isArray(faces) ? faces[0] : null;
  if (!face) {
    return {
      provider: 'azure_face',
      provider_status: 'no_face_detected',
      face_detected: false,
      age_range: fallbackAgeRange(declaredAge),
      age_midpoint: declaredAge || 30,
      liveness_score: 20,
      liveness_status: 'FAIL',
      age_flag: false,
      emotions: [],
      demo_mode: false,
      raw_provider_response: faces
    };
  }

  const { ageRange, livenessScore, livenessStatus, ageFlag } = deriveLivenessFromAzure(face, declaredAge);
  const ageMidpoint = Math.round((ageRange.low + ageRange.high) / 2);

  return {
    provider: 'azure_face',
    provider_status: 'live',
    face_detected: true,
    age_range: ageRange,
    age_midpoint: ageMidpoint,
    liveness_score: livenessScore,
    liveness_status: livenessStatus,
    age_flag: ageFlag,
    emotions: deriveAzureEmotions(face.faceAttributes),
    demo_mode: false,
    raw_provider_response: face
  };
}

async function saveCvAnalysis({ sessionId, frameNumber, ageRange, livenessScore, livenessStatus, ageFlag, rawResponse }) {
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
      sessionId,
      frameNumber,
      ageRange?.low ?? null,
      ageRange?.high ?? null,
      livenessScore,
      livenessStatus,
      ageFlag,
      JSON.stringify(rawResponse)
    ]
  );
}

function shouldUseAzureFace() {
  return env.cv.analysisEnabled && env.cv.provider === 'azure_face';
}

export async function analyzeFrame({ session_id, image_base64, frame_number, frame_quality }) {
  const declaredAge = await getDeclaredAge(session_id);

  let result;
  let auditPayload = { frame_number };

  if (frame_quality && frame_quality.usable === false) {
    result = buildRejectedFrameResult(declaredAge, frame_quality.reason || 'unusable_frame', frame_quality);
    auditPayload = {
      ...auditPayload,
      provider: 'client_quality_gate',
      demo_mode: true,
      rejected: true,
      quality: frame_quality
    };
  }

  // Real CV analysis: set CV_PROVIDER=azure_face together with
  // AZURE_FACE_ENDPOINT, AZURE_FACE_API_KEY, and CV_ANALYSIS_ENABLED=true.
  if (!result && shouldUseAzureFace()) {
    try {
      result = await analyzeWithAzureFace(image_base64, declaredAge);
      auditPayload = { ...auditPayload, provider: 'azure_face', demo_mode: false };
    } catch (error) {
      console.warn('Azure Face analysis failed; falling back to demo CV', { message: error.message });
      result = buildFallbackResult(declaredAge, 'azure_face_fallback');
      result.fallback_error = error.message;
      auditPayload = { ...auditPayload, provider: 'azure_face', demo_mode: true, fallback_error: error.message };
    }
  } else if (!result) {
    result = buildFallbackResult(declaredAge, env.cv.provider === 'azure_face' ? 'provider_unavailable' : 'demo_mode', frame_quality);
    auditPayload = { ...auditPayload, provider: normalizeProviderName(env.cv.provider), demo_mode: true };
  }

  if (result.face_detected && image_base64) {
    result.frame_preview_data_url = image_base64;
  }

  await saveCvAnalysis({
    sessionId: session_id,
    frameNumber: frame_number,
    ageRange: result.age_range,
    livenessScore: result.liveness_score,
    livenessStatus: result.liveness_status,
    ageFlag: result.age_flag,
    rawResponse: result
  });

  logAuditEvent({
    event_type: 'FRAME_CAPTURED',
    entity_type: 'video_session',
    entity_id: session_id,
    actor_type: 'system',
    action: 'capture_frame',
    new_value: auditPayload
  }).catch((error) => {
    console.error('Frame capture audit logging failed', { error: error.message });
  });

  return result;
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
         AND liveness_status = 'PASS'
         AND COALESCE((raw_response->>'face_detected')::boolean, false) = true
       GROUP BY age_low, age_high
       ORDER BY count DESC, age_low ASC
       LIMIT 1
     ),
     latest_provider AS (
       SELECT
         COALESCE(raw_response->>'provider', 'demo_cv') AS provider,
         COALESCE(raw_response->>'provider_status', 'unknown') AS provider_status,
         COALESCE((raw_response->>'demo_mode')::boolean, false) AS demo_mode,
         COALESCE((raw_response->>'face_detected')::boolean, false) AS face_detected,
         raw_response->'quality' AS quality,
         raw_response->>'frame_preview_data_url' AS frame_preview_data_url
       FROM cv_analysis
       WHERE session_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     )
     SELECT
       COUNT(cva.*)::int AS total_frames_analyzed,
       COALESCE(ROUND(AVG(cva.liveness_score) FILTER (WHERE cva.liveness_status = 'PASS'))::int, 0) AS average_liveness_score,
       COUNT(*) FILTER (WHERE cva.age_flag)::int AS flag_count,
       (SELECT json_build_object('low', age_low, 'high', age_high) FROM age_counts) AS most_common_age_estimate,
       COALESCE((SELECT provider FROM latest_provider), 'demo_cv') AS provider,
       COALESCE((SELECT provider_status FROM latest_provider), 'unknown') AS provider_status,
       COALESCE((SELECT demo_mode FROM latest_provider), true) AS demo_mode,
       COALESCE((SELECT face_detected FROM latest_provider), false) AS face_detected,
       (SELECT quality FROM latest_provider) AS latest_quality,
       (SELECT frame_preview_data_url FROM latest_provider) AS frame_preview_data_url
     FROM cv_analysis cva
     WHERE cva.session_id = $1`,
    [sessionId]
  );

  return result.rows[0];
}
