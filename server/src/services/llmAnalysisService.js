import OpenAI from 'openai';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { getCvSessionSummary } from './cvAnalysisService.js';

const SYSTEM_PROMPT = `You are a senior loan risk analyst at Poonawalla Fincorp. You analyze video KYC interview transcripts, liveness scores, age estimation gaps, geo location mismatches, and CIBIL credit scores to return high-fidelity risk assessments.
Rules for Underwriting Decisions:
1. Risk Band classification:
   - Band A (Low Risk): Bureau Score > 730, consistent income, no red flags, location match, liveness > 75.
   - Band B (Medium Risk): Bureau Score 650-730, stable profile, minor variance in statements.
   - Band C (Moderate Risk): Bureau Score 550-650, minor red flags or small inconsistencies.
   - Band D (High Risk): Bureau Score < 550, major red flags, location mismatch, age discrepancy, or missing verbal consent.
2. Recommended Action:
   - 'auto_approve': Only for Band A candidates with clear verbal consent and no red flags.
   - 'reject': For Band D candidates, CIBIL score < 500, or confirmed identity/location mismatch.
   - 'manual_review': For intermediate cases (Band B & C) or when verbal consent is unconfirmed.
Output must be structured as valid JSON conforming strictly to the requested schema.`;

function openaiClient() {
  if (!env.openai.apiKey) {
    const error = new Error('OpenAI is not configured');
    error.statusCode = 500;
    error.publicMessage = 'OpenAI is not configured on this server';
    throw error;
  }

  return new OpenAI({ apiKey: env.openai.apiKey });
}

function safeValue(value, fallback = 'unknown') {
  return value === null || value === undefined || value === '' ? fallback : value;
}

function parseJsonObject(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(trimmed);
}

function normalizeRiskJson(parsed) {
  return {
    risk_band: parsed.risk_band,
    persona: parsed.persona,
    red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
    confidence_score: Number(parsed.confidence_score || 0),
    income_consistency: parsed.income_consistency,
    recommended_action: parsed.recommended_action,
    summary: parsed.summary,
    key_positive_signals: Array.isArray(parsed.key_positive_signals) ? parsed.key_positive_signals : [],
    suggested_loan_range: parsed.suggested_loan_range || { min: 0, max: 0 },
    interest_rate_band: parsed.interest_rate_band
  };
}

async function getCustomerData(sessionId) {
  const result = await pool.query(
    `SELECT
       vs.id AS session_id,
       vs.customer_id,
       vs.geo_match,
       vs.call_city,
       vs.call_state,
       c.name,
       c.declared_age,
       c.declared_monthly_income,
       c.employment_type,
       c.loan_purpose,
       c.city,
       c.declared_state,
       c.bureau_score
     FROM video_sessions vs
     LEFT JOIN customers c ON c.id::text = vs.customer_id
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

async function getTranscript(sessionId) {
  const result = await pool.query(
    `SELECT speaker, text, confidence, timestamp
     FROM transcripts
     WHERE session_id = $1
     ORDER BY timestamp ASC`,
    [sessionId]
  );

  return result.rows
    .map((row) => `${row.speaker ? `Speaker ${row.speaker}` : 'Speaker'}: ${row.text}`)
    .join('\n');
}

async function getGeoData(sessionId) {
  const result = await pool.query(
    `SELECT gps_city, gps_state, ip_city, ip_region, declared_city, declared_state, geo_score, flags, match_status
     FROM geo_verifications
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  );

  return result.rows[0] || null;
}

function consentDetected(fullTranscript) {
  return /i consent to this loan application/i.test(fullTranscript);
}

function buildUserPrompt({ fullTranscript, customer, cvSummary, geo }) {
  const cvAge = cvSummary.most_common_age_estimate;
  const geoMatch =
    geo?.match_status ||
    (customer.geo_match === null || customer.geo_match === undefined ? 'unknown' : customer.geo_match ? 'match' : 'mismatch');

  return `
CUSTOMER INTERVIEW TRANSCRIPT:
${fullTranscript || 'No transcript rows were captured.'}

CUSTOMER DECLARED DATA:
- Name: ${safeValue(customer.name)}
- Declared Age: ${safeValue(customer.declared_age)}
- Declared Monthly Income: ₹${safeValue(customer.declared_monthly_income)}
- Employment Type: ${safeValue(customer.employment_type)}
- Loan Purpose: ${safeValue(customer.loan_purpose)}
- City of Residence: ${safeValue(customer.city)}
- State of Residence: ${safeValue(customer.declared_state)}

AI ANALYSIS RESULTS:
- CV Estimated Age Range: ${cvAge ? `${cvAge.low}–${cvAge.high}` : 'unknown'} years
- Liveness Score: ${safeValue(cvSummary.average_liveness_score, 0)}/100
- Geo Match: ${geoMatch} (Called from: ${safeValue(geo?.gps_city || customer.call_city)}, Declared: ${safeValue(geo?.declared_city || customer.city)})
- Bureau Score: ${safeValue(customer.bureau_score)}
- Consent Phrase Detected: ${consentDetected(fullTranscript)}

Return ONLY a JSON object with this exact structure:
{
  "risk_band": "A|B|C|D",
  "persona": "string (e.g. Stable Salaried, High-Risk Self-Employed)",
  "red_flags": ["string array of specific concerns"],
  "confidence_score": number (0-100),
  "income_consistency": "consistent|inconsistent|unclear",
  "recommended_action": "auto_approve|manual_review|reject",
  "summary": "3-4 sentence plain English risk narrative",
  "key_positive_signals": ["string array"],
  "suggested_loan_range": { "min": number, "max": number },
  "interest_rate_band": "string e.g. 10.5%–12%"
}
`;
}

export async function gatherRiskAnalysisData(sessionId) {
  const [customer, fullTranscript, cvSummary, geo] = await Promise.all([
    getCustomerData(sessionId),
    getTranscript(sessionId),
    getCvSessionSummary(sessionId),
    getGeoData(sessionId)
  ]);

  return {
    customer,
    fullTranscript,
    cvSummary,
    geo
  };
}

export async function saveRiskAnalysis(sessionId, analysis) {
  const normalized = normalizeRiskJson(analysis);
  const result = await pool.query(
    `INSERT INTO llm_analysis (
       session_id,
       risk_band,
       persona,
       red_flags,
       confidence_score,
       recommended_action,
       summary,
       raw_response
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (session_id) DO UPDATE SET
       risk_band = EXCLUDED.risk_band,
       persona = EXCLUDED.persona,
       red_flags = EXCLUDED.red_flags,
       confidence_score = EXCLUDED.confidence_score,
       recommended_action = EXCLUDED.recommended_action,
       summary = EXCLUDED.summary,
       raw_response = EXCLUDED.raw_response,
       created_at = NOW()
     RETURNING id, session_id, risk_band, persona, red_flags, confidence_score, recommended_action, summary, raw_response, created_at`,
    [
      sessionId,
      normalized.risk_band,
      normalized.persona,
      normalized.red_flags,
      normalized.confidence_score,
      normalized.recommended_action,
      normalized.summary,
      JSON.stringify(normalized)
    ]
  );

  return {
    ...normalized,
    id: result.rows[0].id,
    session_id: result.rows[0].session_id,
    created_at: result.rows[0].created_at
  };
}

export async function analyzeSessionRisk({ session_id }) {
  const client = openaiClient();
  const data = await gatherRiskAnalysisData(session_id);
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT} You must output valid JSON.` },
    { role: 'user', content: buildUserPrompt(data) }
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await client.chat.completions.create({
      model: env.openai.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    const content = completion.choices[0]?.message?.content || '{}';
    try {
      const parsed = parseJsonObject(content);
      return await saveRiskAnalysis(session_id, parsed);
    } catch (error) {
      if (attempt === 1) throw error;
      messages.push({
        role: 'assistant',
        content
      });
      messages.push({
        role: 'user',
        content: 'The previous output was invalid JSON. Retry once and return only valid JSON matching the requested structure.'
      });
    }
  }

  throw new Error('Unable to parse LLM risk analysis JSON');
}

function extractSummaryPartial(content) {
  const match = content.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)/s);
  if (!match) return '';

  return match[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

export async function streamSessionRiskAnalysis({ session_id, onEvent }) {
  const client = openaiClient();
  const data = await gatherRiskAnalysisData(session_id);
  const stream = await client.chat.completions.create({
    model: env.openai.model,
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT} You must output valid JSON.` },
      { role: 'user', content: buildUserPrompt(data) }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    stream: true
  });

  let content = '';
  let summaryLength = 0;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (!delta) continue;

    content += delta;
    onEvent?.({ type: 'json_delta', delta });

    const summary = extractSummaryPartial(content);
    if (summary.length > summaryLength) {
      onEvent?.({
        type: 'summary_delta',
        delta: summary.slice(summaryLength)
      });
      summaryLength = summary.length;
    }
  }

  try {
    const parsed = parseJsonObject(content);
    const saved = await saveRiskAnalysis(session_id, parsed);
    onEvent?.({ type: 'analysis_complete', analysis: saved });
    return saved;
  } catch {
    const saved = await analyzeSessionRisk({ session_id });
    onEvent?.({ type: 'analysis_complete', analysis: saved });
    return saved;
  }
}

export async function getStoredRiskAnalysis(sessionId) {
  const result = await pool.query(
    `SELECT id, session_id, risk_band, persona, red_flags, confidence_score, recommended_action, summary, raw_response, created_at
     FROM llm_analysis
     WHERE session_id = $1`,
    [sessionId]
  );

  if (!result.rowCount) {
    const error = new Error('LLM analysis not found');
    error.statusCode = 404;
    error.publicMessage = 'LLM analysis not found';
    throw error;
  }

  return {
    ...result.rows[0].raw_response,
    id: result.rows[0].id,
    session_id: result.rows[0].session_id,
    created_at: result.rows[0].created_at
  };
}

export async function explainOffer({ risk_band, loan_amount, interest_rate, tenure_months }) {
  const client = openaiClient();
  const completion = await client.chat.completions.create({
    model: env.openai.model,
    messages: [
      {
        role: 'system',
        content: 'Write exactly two warm, simple Hindi-English sentences for an Indian loan customer. No bullet points.'
      },
      {
        role: 'user',
        content: `Risk band: ${risk_band}. Loan amount: ₹${loan_amount}. Interest rate: ${interest_rate}%. Tenure: ${tenure_months} months. Explain why this offer is suitable and what happens next.`
      }
    ],
    temperature: 0.5
  });

  return {
    explanation: completion.choices[0]?.message?.content?.trim() || ''
  };
}
