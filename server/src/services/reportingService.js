import { pool } from '../db/pool.js';
import { fetchAuditTrail } from './auditService.js';

function dayBounds(date) {
  const start = date ? new Date(date) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function periodBounds(period = '7d') {
  const end = new Date();
  const start = new Date(end);
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  start.setDate(end.getDate() - days);
  return { start, end };
}

export async function getDailySummary(date) {
  const { start, end } = dayBounds(date);
  const [sessions, risk, flags, funnel, duration] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total_sessions
       FROM video_sessions
       WHERE started_at >= $1 AND started_at < $2`,
      [start, end]
    ),
    pool.query(
      `SELECT
         COALESCE(AVG(final_score), 0)::float AS avg_risk_score,
         risk_band,
         COUNT(*)::int AS count
       FROM risk_assessments
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY risk_band`,
      [start, end]
    ),
    pool.query(
      `SELECT flag, COUNT(*)::int AS count
       FROM llm_analysis,
       LATERAL UNNEST(red_flags) AS flag
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY flag
       ORDER BY count DESC
       LIMIT 8`,
      [start, end]
    ),
    pool.query(
      `SELECT
         COUNT(cl.id)::int AS sent,
         COUNT(cl.id) FILTER (WHERE cl.opened_at IS NOT NULL)::int AS opened,
         COUNT(cl.id) FILTER (WHERE cl.completed_at IS NOT NULL)::int AS completed,
         COUNT(la.id) FILTER (WHERE la.status = 'approved')::int AS approved
       FROM campaign_links cl
       LEFT JOIN video_sessions vs ON vs.customer_id = cl.customer_id::text
       LEFT JOIN loan_applications la ON la.session_id = vs.id
       WHERE cl.created_at >= $1 AND cl.created_at < $2`,
      [start, end]
    ),
    pool.query(
      `SELECT
         COALESCE(ra.risk_band, 'unclear') AS risk_band,
         COALESCE(AVG(EXTRACT(EPOCH FROM (vs.ended_at - vs.started_at))), 0)::float AS avg_seconds
       FROM video_sessions vs
       LEFT JOIN risk_assessments ra ON ra.session_id = vs.id
       WHERE vs.started_at >= $1 AND vs.started_at < $2
       GROUP BY COALESCE(ra.risk_band, 'unclear')`,
      [start, end]
    )
  ]);

  const bandDistribution = { A: 0, B: 0, C: 0, D: 0 };
  let weightedScore = 0;
  let scoreCount = 0;
  for (const row of risk.rows) {
    bandDistribution[row.risk_band] = row.count;
    weightedScore += Number(row.avg_risk_score || 0) * row.count;
    scoreCount += row.count;
  }
  const sentForApprovalRate = funnel.rows[0].completed || funnel.rows[0].sent || 0;

  return {
    total_sessions: sessions.rows[0].total_sessions,
    approval_rate: sentForApprovalRate ? Number(((funnel.rows[0].approved / sentForApprovalRate) * 100).toFixed(1)) : 0,
    avg_risk_score: scoreCount ? Number((weightedScore / scoreCount).toFixed(1)) : 0,
    top_red_flags: flags.rows,
    band_distribution: bandDistribution,
    approval_funnel: funnel.rows[0],
    avg_call_duration_by_band: duration.rows
  };
}

export async function getAgentPerformance({ agent_id, period }) {
  const { start, end } = periodBounds(period);
  const result = await pool.query(
    `SELECT
       vs.agent_id,
       COUNT(vs.id)::int AS sessions_handled,
       COALESCE(AVG(EXTRACT(EPOCH FROM (vs.ended_at - vs.started_at))), 0)::float AS avg_call_duration_seconds,
       AVG(CASE WHEN la.status = 'approved' THEN 1 ELSE 0 END)::float AS approval_rate,
       AVG(CASE WHEN COALESCE(cardinality(llm.red_flags), 0) > 0 THEN 1 ELSE 0 END)::float AS flag_rate
     FROM video_sessions vs
     LEFT JOIN loan_applications la ON la.session_id = vs.id
     LEFT JOIN llm_analysis llm ON llm.session_id = vs.id
     WHERE vs.started_at >= $1
       AND vs.started_at < $2
       AND ($3::text IS NULL OR vs.agent_id = $3)
     GROUP BY vs.agent_id
     ORDER BY sessions_handled DESC`,
    [start, end, agent_id || null]
  );
  return { period: period || '7d', agents: result.rows };
}

export async function getDashboardAnalytics() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const [volume, summary] = await Promise.all([
    pool.query(
      `SELECT day::date,
              COUNT(la.id)::int AS applications
       FROM GENERATE_SERIES($1::date, $2::date, INTERVAL '1 day') AS day
       LEFT JOIN loan_applications la ON la.created_at::date = day::date
       GROUP BY day
       ORDER BY day`,
      [start, end]
    ),
    getDailySummary()
  ]);

  return {
    daily_volume: volume.rows.map((row) => ({
      date: row.day,
      applications: row.applications
    })),
    ...summary
  };
}

export async function listRecentApplications({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const result = await pool.query(
    `WITH base AS (
       SELECT
         cl.id AS link_id,
         cl.status AS link_status,
         cl.created_at AS link_created_at,
         cl.opened_at,
         cl.completed_at,
         cl.expires_at,
         c.id AS customer_uuid,
         c.name,
         c.phone,
         c.email,
         c.city,
         camp.name AS campaign,
         vs.id AS session_id,
         vs.status AS session_status,
         vs.call_city,
         COALESCE(vs.started_at, cl.opened_at, cl.created_at) AS activity_at,
         la.id AS application_id,
         la.status AS loan_application_status,
         la.created_at AS application_created_at,
         ROW_NUMBER() OVER (
           PARTITION BY cl.customer_id
           ORDER BY COALESCE(la.created_at, vs.started_at, cl.completed_at, cl.opened_at, cl.created_at) DESC
         ) AS row_number
       FROM campaign_links cl
       JOIN customers c ON c.id = cl.customer_id
       LEFT JOIN campaigns camp ON camp.id = cl.campaign_id
       LEFT JOIN LATERAL (
         SELECT id, status, call_city, started_at
         FROM video_sessions
         WHERE customer_id = cl.customer_id::text
         ORDER BY started_at DESC
         LIMIT 1
       ) vs ON true
       LEFT JOIN LATERAL (
         SELECT id, status, created_at
         FROM loan_applications
         WHERE customer_id = cl.customer_id::text
         ORDER BY created_at DESC
         LIMIT 1
       ) la ON true
     )
     SELECT
       COALESCE(application_id::text, session_id::text, link_id::text) AS id,
       session_id,
       customer_uuid::text AS customer_id,
       COALESCE(
         loan_application_status,
         CASE
           WHEN link_status = 'completed' THEN 'completed'
           WHEN link_status = 'opened' THEN 'under_review'
           WHEN link_status = 'expired' OR expires_at <= NOW() THEN 'expired'
           ELSE 'pending'
         END
       ) AS application_status,
       COALESCE(application_created_at, activity_at, link_created_at) AS created_at,
       name,
       phone,
       email,
       city,
       campaign,
       session_status,
       call_city,
       ra.risk_band,
       ra.final_score,
       geo.match_status AS geo_match_status,
       link_status
     FROM base
     LEFT JOIN LATERAL (
       SELECT risk_band, final_score
       FROM risk_assessments
       WHERE session_id = base.session_id
       ORDER BY created_at DESC
       LIMIT 1
     ) ra ON true
     LEFT JOIN LATERAL (
       SELECT match_status
       FROM geo_verifications
       WHERE session_id = base.session_id
       ORDER BY created_at DESC
       LIMIT 1
     ) geo ON true
     WHERE row_number = 1
     ORDER BY COALESCE(application_created_at, activity_at, link_created_at) DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
}

export async function getSessionReport(sessionId) {
  const [sessionResult, transcriptResult, riskResult, offerResult, audit] = await Promise.all([
    pool.query(
      `SELECT id, customer_id, agent_id, channel_name, status, started_at, ended_at, geo_match, call_city, call_state, recording_url
       FROM video_sessions
       WHERE id = $1`,
      [sessionId]
    ),
    pool.query(
      `SELECT id, speaker, text, timestamp, confidence, offset_seconds
       FROM transcripts
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId]
    ),
    pool.query(
      `SELECT id, final_score, risk_band, policy_score, ml_risk_score, llm_confidence_score, policy_result, ml_result, created_at
       FROM risk_assessments
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    ),
    pool.query(
      `SELECT id, application_id, public_token, band, amount, interest_rate, tenure_months, emi,
              processing_fee, explanation_text, emi_options, status, created_at
       FROM loan_offers
       WHERE application_id IN (
         SELECT id FROM loan_applications WHERE session_id = $1
       )
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    ),
    fetchAuditTrail({ entity_id: sessionId, limit: 250 })
  ]);

  if (!sessionResult.rowCount) {
    const error = new Error('Session report not found');
    error.statusCode = 404;
    error.publicMessage = 'Session report not found';
    throw error;
  }

  return {
    session: sessionResult.rows[0],
    transcripts: transcriptResult.rows.map((row) => ({
      ...row,
      confidence: row.confidence === null ? null : Number(row.confidence),
      offset_seconds: row.offset_seconds === null ? null : Number(row.offset_seconds)
    })),
    risk: riskResult.rows[0]
      ? {
          ...riskResult.rows[0],
          final_score: Number(riskResult.rows[0].final_score),
          policy_score: Number(riskResult.rows[0].policy_score),
          ml_risk_score: Number(riskResult.rows[0].ml_risk_score),
          llm_confidence_score: Number(riskResult.rows[0].llm_confidence_score)
        }
      : null,
    offer: offerResult.rows[0]
      ? {
          ...offerResult.rows[0],
          amount: Number(offerResult.rows[0].amount),
          interest_rate: Number(offerResult.rows[0].interest_rate),
          emi: Number(offerResult.rows[0].emi),
          processing_fee: Number(offerResult.rows[0].processing_fee)
        }
      : null,
    audit
  };
}

export async function getActivityFeed({ limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const result = await pool.query(
    `SELECT event_type, entity_type, entity_id, actor_type, action, timestamp
     FROM audit_logs
     ORDER BY timestamp DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows.map((row) => ({
    type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor_type: row.actor_type,
    message: `${row.event_type.replaceAll('_', ' ')}${row.entity_id ? ` - ${row.entity_id}` : ''}`,
    action: row.action,
    timestamp: row.timestamp
  }));
}
