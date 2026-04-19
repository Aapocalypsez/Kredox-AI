import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { extractTranscriptEntities } from './entityExtractionService.js';

function elasticClient() {
  if (!env.elasticsearch.node) return null;
  const auth = env.elasticsearch.apiKey
    ? { apiKey: env.elasticsearch.apiKey }
    : env.elasticsearch.username && env.elasticsearch.password
      ? { username: env.elasticsearch.username, password: env.elasticsearch.password }
      : undefined;
  return new Client({ node: env.elasticsearch.node, auth });
}

async function buildTranscriptDocument(sessionId) {
  const result = await pool.query(
    `SELECT
       vs.id AS session_id,
       vs.agent_id,
       vs.ended_at,
       c.name AS customer_name,
       ra.risk_band,
       STRING_AGG(t.text, ' ' ORDER BY t.timestamp ASC) AS full_text
     FROM video_sessions vs
     LEFT JOIN customers c ON c.id::text = vs.customer_id
     LEFT JOIN risk_assessments ra ON ra.session_id = vs.id
     LEFT JOIN transcripts t ON t.session_id = vs.id
     WHERE vs.id = $1
     GROUP BY vs.id, vs.agent_id, vs.ended_at, c.name, ra.risk_band
     ORDER BY MAX(ra.created_at) DESC
     LIMIT 1`,
    [sessionId]
  );

  if (!result.rowCount || !result.rows[0].full_text) return null;
  const row = result.rows[0];
  const entities = extractTranscriptEntities(row.full_text).reduce((acc, entity) => {
    acc[entity.field] = entity.display_value || entity.value;
    return acc;
  }, {});

  return {
    session_id: row.session_id,
    customer_name: row.customer_name || 'Customer',
    agent_id: row.agent_id,
    full_text: row.full_text,
    entities_detected: entities,
    risk_band: row.risk_band || 'unclear',
    timestamp: row.ended_at || new Date().toISOString()
  };
}

export async function indexTranscriptSession(sessionId) {
  const document = await buildTranscriptDocument(sessionId);
  if (!document) return { indexed: false, reason: 'empty_transcript' };

  const client = elasticClient();
  if (!client) return { indexed: false, reason: 'elasticsearch_not_configured', document };

  await client.index({
    index: env.elasticsearch.transcriptIndex,
    id: sessionId,
    document
  });

  return { indexed: true };
}

function fallbackSnippet(text, query) {
  if (!query) return text.slice(0, 180);
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text.slice(0, 180);
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + query.length + 90);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

async function fallbackSearch({ q, date_from, date_to, risk_band }) {
  const values = [];
  const conditions = [];
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`full_text ILIKE $${values.length}`);
  }
  if (date_from) {
    values.push(date_from);
    conditions.push(`timestamp >= $${values.length}`);
  }
  if (date_to) {
    values.push(date_to);
    conditions.push(`timestamp <= $${values.length}`);
  }
  if (risk_band) {
    values.push(risk_band);
    conditions.push(`risk_band = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `WITH transcript_docs AS (
       SELECT
         vs.id AS session_id,
         c.name AS customer_name,
         vs.agent_id,
         COALESCE(ra.risk_band, 'unclear') AS risk_band,
         COALESCE(vs.ended_at, vs.started_at) AS timestamp,
         STRING_AGG(t.text, ' ' ORDER BY t.timestamp ASC) AS full_text
       FROM video_sessions vs
       LEFT JOIN customers c ON c.id::text = vs.customer_id
       LEFT JOIN risk_assessments ra ON ra.session_id = vs.id
       LEFT JOIN transcripts t ON t.session_id = vs.id
       GROUP BY vs.id, c.name, vs.agent_id, ra.risk_band
     )
     SELECT * FROM transcript_docs
     ${where}
     ORDER BY timestamp DESC
     LIMIT 50`,
    values
  );

  return result.rows.map((row) => ({
    session_id: row.session_id,
    customer_name: row.customer_name || 'Customer',
    agent_id: row.agent_id,
    risk_band: row.risk_band,
    timestamp: row.timestamp,
    snippet: fallbackSnippet(row.full_text || '', q || '')
  }));
}

export async function searchTranscripts({ q, date_from, date_to, risk_band }) {
  const client = elasticClient();
  if (!client) {
    return { source: 'postgres', results: await fallbackSearch({ q, date_from, date_to, risk_band }) };
  }

  try {
    const filter = [];
    if (date_from || date_to) {
      filter.push({ range: { timestamp: { ...(date_from ? { gte: date_from } : {}), ...(date_to ? { lte: date_to } : {}) } } });
    }
    if (risk_band) filter.push({ term: { risk_band } });

    const response = await client.search({
      index: env.elasticsearch.transcriptIndex,
      query: {
        bool: {
          must: q ? [{ match: { full_text: q } }] : [{ match_all: {} }],
          filter
        }
      },
      highlight: {
        fields: {
          full_text: {}
        }
      },
      size: 50
    });

    return {
      source: 'elasticsearch',
      results: response.hits.hits.map((hit) => ({
        session_id: hit._source.session_id,
        customer_name: hit._source.customer_name,
        agent_id: hit._source.agent_id,
        risk_band: hit._source.risk_band,
        timestamp: hit._source.timestamp,
        snippet: hit.highlight?.full_text?.[0] || fallbackSnippet(hit._source.full_text || '', q || '')
      }))
    };
  } catch (error) {
    console.error('Elasticsearch transcript search failed, falling back to PostgreSQL', { error: error.message });
    return { source: 'postgres', results: await fallbackSearch({ q, date_from, date_to, risk_band }) };
  }
}
