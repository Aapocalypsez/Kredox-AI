import { pool } from '../db/pool.js';

const routeEvents = [
  { method: 'POST', pattern: /^\/api\/campaigns\/create$/, event_type: 'CAMPAIGN_CREATED', entity_type: 'campaign', action: 'create' },
  { method: 'GET', pattern: /^\/api\/links\/validate\/.+$/, event_type: 'LINK_OPENED', entity_type: 'campaign_link', action: 'open' },
  { method: 'POST', pattern: /^\/api\/video\/session\/start$/, event_type: 'SESSION_STARTED', entity_type: 'video_session', action: 'start' },
  { method: 'POST', pattern: /^\/api\/video\/session\/([^/]+)\/end$/, event_type: 'SESSION_ENDED', entity_type: 'video_session', action: 'end', entityParam: 1 },
  { method: 'POST', pattern: /^\/api\/cv\/analyze-frame$/, event_type: 'CV_ANALYSIS_COMPLETE', entity_type: 'video_session', action: 'analyze_frame' },
  { method: 'POST', pattern: /^\/api\/geo\/verify$/, event_type: 'GEO_VERIFIED', entity_type: 'video_session', action: 'verify_geo' },
  { method: 'POST', pattern: /^\/api\/llm\/analyze$/, event_type: 'LLM_ANALYSIS_COMPLETE', entity_type: 'video_session', action: 'analyze_risk' },
  { method: 'POST', pattern: /^\/api\/risk\/final-score$/, event_type: 'RISK_SCORE_CALCULATED', entity_type: 'video_session', action: 'calculate_risk_score' },
  { method: 'POST', pattern: /^\/api\/application\/compile$/, event_type: 'APPLICATION_COMPILED', entity_type: 'loan_application', action: 'compile' },
  { method: 'PATCH', pattern: /^\/api\/application\/([^/]+)\/field$/, event_type: 'FIELD_EDITED', entity_type: 'loan_application', action: 'edit_field', entityParam: 1 },
  { method: 'POST', pattern: /^\/api\/offers\/generate$/, event_type: 'OFFER_GENERATED', entity_type: 'loan_offer', action: 'generate' },
  { method: 'POST', pattern: /^\/api\/offers\/([^/]+)\/accept$/, event_type: 'OFFER_ACCEPTED', entity_type: 'loan_offer', action: 'accept', entityParam: 1 },
  { method: 'POST', pattern: /^\/api\/offers\/([^/]+)\/reject$/, event_type: 'OFFER_REJECTED', entity_type: 'loan_offer', action: 'reject', entityParam: 1 },
  { method: 'POST', pattern: /^\/api\/storage\/upload-recording$/, event_type: 'RECORDING_UPLOADED', entity_type: 'video_session', action: 'upload_recording' }
];

function safeJson(value) {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

export function inferActor(req) {
  if (req.agent) {
    return {
      actor_id: req.agent.id,
      actor_type: 'agent'
    };
  }

  const actorType = req.get('x-actor-type') || req.body?.actor_type || (req.body?.customer_id ? 'customer' : req.body?.agent_id ? 'agent' : 'system');
  return {
    actor_id: req.get('x-actor-id') || req.body?.actor_id || req.body?.agent_id || req.body?.customer_id || req.body?.lender_id || null,
    actor_type: ['agent', 'customer', 'system'].includes(actorType) ? actorType : 'system'
  };
}

function matchRoute(req) {
  for (const item of routeEvents) {
    const match = req.path.match(item.pattern);
    if (req.method === item.method && match) {
      return {
        ...item,
        entity_id: item.entityParam ? match[item.entityParam] : req.body?.session_id || req.body?.application_id || req.body?.customer_id || null
      };
    }
  }

  return {
    event_type: 'API_CALL',
    entity_type: null,
    entity_id: req.params?.id || req.body?.id || req.body?.session_id || null,
    action: `${req.method} ${req.path}`
  };
}

export async function logAuditEvent({
  event_type,
  entity_type,
  entity_id,
  actor_id,
  actor_type = 'system',
  action,
  old_value = null,
  new_value = null,
  ip_address = null,
  user_agent = null
}) {
  await pool.query(
    `INSERT INTO audit_logs (
       event_type,
       entity_type,
       entity_id,
       actor_id,
       actor_type,
       action,
       old_value,
       new_value,
       ip_address,
       user_agent
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)`,
    [
      event_type,
      entity_type || null,
      entity_id ? String(entity_id) : null,
      actor_id ? String(actor_id) : null,
      actor_type,
      action,
      old_value === null ? null : safeJson(old_value),
      new_value === null ? null : safeJson(new_value),
      ip_address,
      user_agent
    ]
  );
}

export function auditLogger(req, res, next) {
  if (!req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/api/auth')) return next();

  const originalJson = res.json.bind(res);
  let responseBody = null;
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const route = matchRoute(req);
    const actor = inferActor(req);
    logAuditEvent({
      event_type: route.event_type,
      entity_type: route.entity_type,
      entity_id: route.entity_id || responseBody?.id || responseBody?.session_id || responseBody?.offer?.id || responseBody?.application_id,
      actor_id: actor.actor_id,
      actor_type: actor.actor_type,
      action: route.action,
      old_value: req.body && Object.keys(req.body).length ? req.body : null,
      new_value: responseBody,
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    }).catch((error) => {
      console.error('Audit logging failed', { error: error.message });
    });
  });

  return next();
}

async function relatedEntityIds(entityId) {
  if (!entityId) return [];
  const result = await pool.query(
    `SELECT id::text AS id FROM (
       SELECT la.id::text AS id
       FROM loan_applications la
       WHERE la.id::text = $1 OR la.session_id::text = $1 OR la.customer_id = $1
       UNION
       SELECT la.session_id::text AS id
       FROM loan_applications la
       WHERE la.id::text = $1 OR la.session_id::text = $1 OR la.customer_id = $1
       UNION
       SELECT la.customer_id AS id
       FROM loan_applications la
       WHERE la.id::text = $1 OR la.session_id::text = $1 OR la.customer_id = $1
       UNION
       SELECT lo.id::text AS id
       FROM loan_offers lo
       JOIN loan_applications la ON la.id = lo.application_id
       WHERE la.id::text = $1 OR la.session_id::text = $1 OR la.customer_id = $1 OR lo.id::text = $1
     ) related
     WHERE id IS NOT NULL`,
    [String(entityId)]
  );
  return [...new Set([String(entityId), ...result.rows.map((row) => row.id)])];
}

export async function fetchAuditTrail({ entity_id, event_type, actor_id, date_from, date_to, limit }) {
  const conditions = [];
  const values = [];

  if (entity_id) {
    values.push(await relatedEntityIds(entity_id));
    conditions.push(`entity_id = ANY($${values.length}::text[])`);
  }
  if (event_type) {
    values.push(event_type);
    conditions.push(`event_type = $${values.length}`);
  }
  if (actor_id) {
    values.push(String(actor_id));
    conditions.push(`actor_id = $${values.length}`);
  }
  if (date_from) {
    values.push(date_from);
    conditions.push(`timestamp >= $${values.length}`);
  }
  if (date_to) {
    values.push(date_to);
    conditions.push(`timestamp <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(Math.min(Math.max(Number(limit) || 500, 1), 1000));
  const result = await pool.query(
    `SELECT id, event_type, entity_type, entity_id, actor_id, actor_type, action,
            old_value, new_value, ip_address, user_agent, timestamp
     FROM audit_logs
     ${where}
     ORDER BY timestamp DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows;
}
