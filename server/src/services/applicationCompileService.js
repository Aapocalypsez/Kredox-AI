import { pool } from '../db/pool.js';
import { extractTranscriptEntities } from './entityExtractionService.js';
import { getCvSessionSummary } from './cvAnalysisService.js';
import { getGeoSessionReport } from './geoVerificationService.js';
import { getStoredRiskAnalysis } from './llmAnalysisService.js';
import { loanApplicationSchema } from '../schemas/applicationSchemas.js';
import { logAuditEvent } from './auditService.js';

function emptyField() {
  return {
    value: null,
    source: 'empty',
    confidence: 0,
    needs_review: true
  };
}

function makeField(value, source, confidence = 0.9, conflicts = []) {
  const isEmpty = value === null || value === undefined || value === '';
  const hasConflict = conflicts.some((item) => item.value !== value && item.value !== null && item.value !== undefined && item.value !== '');
  return {
    value: isEmpty ? null : value,
    source: isEmpty ? 'empty' : source,
    confidence: isEmpty ? 0 : confidence,
    needs_review: isEmpty || (source === 'stt_extracted' && confidence < 0.75) || hasConflict || confidence < 0.6,
    ...(conflicts.length ? { conflicts } : {})
  };
}

function flattenReviewFields(application, prefix = '') {
  return Object.entries(application).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && 'needs_review' in value) {
      return value.needs_review ? [path] : [];
    }
    if (value && typeof value === 'object') {
      return flattenReviewFields(value, path);
    }
    return [];
  });
}

async function getSession(sessionId) {
  const result = await pool.query(
    `SELECT id, customer_id FROM video_sessions WHERE id = $1`,
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

async function fetchTranscriptEntities(sessionId) {
  const result = await pool.query(
    `SELECT text, confidence FROM transcripts WHERE session_id = $1 ORDER BY timestamp ASC`,
    [sessionId]
  );
  const transcript = result.rows.map((row) => row.text).join(' ');
  const extracted = extractTranscriptEntities(transcript);
  const byField = {};
  for (const entity of extracted) {
    byField[entity.field] = {
      value: entity.value,
      display_value: entity.display_value,
      confidence: Number(result.rows.find((row) => row.text.includes(entity.value))?.confidence || 0.82)
    };
  }
  return byField;
}

async function fetchCustomerDeclaredData(customerId) {
  const result = await pool.query(
    `SELECT id, name, phone, email, declared_age, declared_monthly_income, employment_type,
            loan_purpose, bureau_score, existing_loans, loan_amount_requested
     FROM customers
     WHERE id = $1`,
    [customerId]
  );
  return result.rows[0] || {};
}

async function fetchBureauData(customerId) {
  const result = await pool.query(
    `SELECT bureau_score FROM customers WHERE id = $1`,
    [customerId]
  );
  const bureau = {
    bureau_score: result.rows[0]?.bureau_score ?? null
  };
  logAuditEvent({
    event_type: 'BUREAU_FETCHED',
    entity_type: 'customer',
    entity_id: customerId,
    actor_type: 'system',
    action: 'fetch_bureau',
    new_value: bureau
  }).catch((error) => {
    console.error('Bureau audit logging failed', { error: error.message });
  });
  return bureau;
}

async function fetchRiskAssessment(sessionId) {
  const result = await pool.query(
    `SELECT final_score, risk_band, policy_result, ml_result
     FROM risk_assessments
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  );
  return result.rows[0] || null;
}

async function fetchLatestCv(sessionId) {
  const summary = await getCvSessionSummary(sessionId);
  const result = await pool.query(
    `SELECT age_flag
     FROM cv_analysis
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  );
  return {
    ...summary,
    age_flag: Boolean(result.rows[0]?.age_flag)
  };
}

async function safeFetch(fetcher, fallback) {
  try {
    return await fetcher();
  } catch {
    return fallback;
  }
}

function buildApplication({ session, declared, transcriptEntities, cv, geo, bureau, llm, risk }) {
  const incomeConflict = transcriptEntities.income
    ? [{ source: 'declared', value: declared.declared_monthly_income, confidence: 0.9 }]
    : [];
  const employmentConflict = transcriptEntities.employment
    ? [{ source: 'declared', value: declared.employment_type, confidence: 0.9 }]
    : [];
  const cvAge = cv.most_common_age_estimate
    ? `${cv.most_common_age_estimate.low}-${cv.most_common_age_estimate.high}`
    : null;

  return loanApplicationSchema.parse({
    personal: {
      full_name: makeField(declared.name, 'declared', 0.95),
      dob: emptyField(),
      age: makeField(declared.declared_age, 'declared', 0.9, cvAge ? [{ source: 'cv', value: cvAge, confidence: 0.78 }] : []),
      pan_number: emptyField(),
      aadhaar_last4: emptyField(),
      phone: makeField(declared.phone, 'declared', 0.95),
      email: makeField(declared.email, 'declared', 0.95),
      gender: emptyField()
    },
    financial: {
      monthly_income: makeField(transcriptEntities.income?.value || declared.declared_monthly_income, transcriptEntities.income ? 'stt_extracted' : 'declared', transcriptEntities.income?.confidence || 0.9, incomeConflict),
      employment_type: makeField(transcriptEntities.employment?.value || declared.employment_type, transcriptEntities.employment ? 'stt_extracted' : 'declared', transcriptEntities.employment?.confidence || 0.9, employmentConflict),
      employer_name: makeField(transcriptEntities.employer_name?.value, 'stt_extracted', transcriptEntities.employer_name?.confidence || 0.82),
      years_employed: makeField(transcriptEntities.years_employed?.value, 'stt_extracted', transcriptEntities.years_employed?.confidence || 0.82),
      existing_emi: makeField(declared.existing_loans, 'declared', 0.75),
      bureau_score: makeField(bureau.bureau_score, 'bureau', 0.95)
    },
    loan: {
      amount_requested: makeField(declared.loan_amount_requested, 'declared', 0.9),
      purpose: makeField(transcriptEntities.loan_purpose?.value || declared.loan_purpose, transcriptEntities.loan_purpose ? 'stt_extracted' : 'declared', transcriptEntities.loan_purpose?.confidence || 0.9),
      tenure_months: emptyField()
    },
    verification: {
      video_session_id: makeField(session.id, 'declared', 1),
      liveness_score: makeField(cv.average_liveness_score, 'cv', 0.86),
      consent_confirmed: makeField(Boolean(transcriptEntities.consent), 'stt_extracted', transcriptEntities.consent ? 0.94 : 0.45),
      geo_verified: makeField(geo?.match_status === 'MATCH', 'geo', geo?.match_status === 'MATCH' ? 0.92 : 0.62),
      cv_age_estimate: makeField(cvAge, 'cv', 0.78),
      age_flag: makeField(Boolean(cv.age_flag), 'cv', 0.8)
    },
    risk: {
      risk_band: makeField(risk?.risk_band || llm?.risk_band, risk?.risk_band ? 'risk_engine' : 'llm', 0.88),
      policy_passed: makeField(risk?.policy_result?.overall_eligible ?? null, 'risk_engine', 0.9),
      ml_score: makeField(risk?.ml_risk_score ?? risk?.final_score ?? null, 'risk_engine', 0.82),
      llm_confidence: makeField(llm?.confidence_score, 'llm', 0.82),
      recommended_action: makeField(llm?.recommended_action, 'llm', 0.82),
      red_flags: makeField(llm?.red_flags || [], 'llm', 0.82)
    }
  });
}

export async function compileLoanApplication({ session_id }) {
  const session = await getSession(session_id);
  const [
    transcriptEntities,
    cv,
    geo,
    bureau,
    llm,
    declared,
    risk
  ] = await Promise.all([
    fetchTranscriptEntities(session_id),
    safeFetch(() => fetchLatestCv(session_id), { average_liveness_score: 0, most_common_age_estimate: null, age_flag: false }),
    safeFetch(() => getGeoSessionReport(session_id), null),
    fetchBureauData(session.customer_id),
    safeFetch(() => getStoredRiskAnalysis(session_id), null),
    fetchCustomerDeclaredData(session.customer_id),
    fetchRiskAssessment(session_id)
  ]);

  const application = buildApplication({ session, declared, transcriptEntities, cv, geo, bureau, llm, risk });
  const fieldsNeedingReview = flattenReviewFields(application);
  const insert = await pool.query(
    `INSERT INTO loan_applications (customer_id, session_id, application_json, status, fields_needing_review)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, customer_id, session_id, application_json, status, fields_needing_review, created_at`,
    [
      session.customer_id,
      session_id,
      JSON.stringify(application),
      fieldsNeedingReview.length ? 'under_review' : 'draft',
      fieldsNeedingReview
    ]
  );

  return insert.rows[0];
}

export async function getLatestLoanApplication(session_id) {
  const result = await pool.query(
    `SELECT id, customer_id, session_id, application_json, status, fields_needing_review, created_at
     FROM loan_applications
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [session_id]
  );

  if (!result.rowCount) {
    const error = new Error('Loan application not found');
    error.statusCode = 404;
    error.publicMessage = 'Loan application not found';
    throw error;
  }

  return result.rows[0];
}

function setNestedField(root, path, newValue) {
  const parts = path.split('.');
  let target = root;
  for (const part of parts.slice(0, -1)) {
    target = target[part];
  }
  const leaf = parts[parts.length - 1];
  const oldValue = target?.[leaf]?.value ?? null;
  target[leaf] = {
    ...(target[leaf] || {}),
    value: newValue,
    source: 'manual',
    confidence: 1,
    needs_review: false,
    conflicts: []
  };
  return oldValue;
}

export async function patchApplicationField(applicationId, { agent_id, field_path, new_value, reason }) {
  const result = await pool.query(
    `SELECT application_json FROM loan_applications WHERE id = $1`,
    [applicationId]
  );

  if (!result.rowCount) {
    const error = new Error('Loan application not found');
    error.statusCode = 404;
    error.publicMessage = 'Loan application not found';
    throw error;
  }

  const application = result.rows[0].application_json;
  const oldValue = setNestedField(application, field_path, new_value);
  const fieldsNeedingReview = flattenReviewFields(application);

  const [updated] = await Promise.all([
    pool.query(
      `UPDATE loan_applications
       SET application_json = $2,
           fields_needing_review = $3,
           status = CASE WHEN cardinality($3::text[]) = 0 THEN 'draft' ELSE 'under_review' END
       WHERE id = $1
       RETURNING id, customer_id, session_id, application_json, status, fields_needing_review, created_at`,
      [applicationId, JSON.stringify(application), fieldsNeedingReview]
    ),
    pool.query(
      `INSERT INTO application_edits (application_id, agent_id, field_path, old_value, new_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [applicationId, agent_id, field_path, JSON.stringify(oldValue), JSON.stringify(new_value), reason]
    )
  ]);

  logAuditEvent({
    event_type: 'FIELD_EDITED',
    entity_type: 'loan_application',
    entity_id: applicationId,
    actor_id: agent_id,
    actor_type: 'agent',
    action: 'edit_field',
    old_value: { field_path, value: oldValue },
    new_value: { field_path, value: new_value, reason }
  }).catch((error) => {
    console.error('Field edit audit logging failed', { error: error.message });
  });

  return updated.rows[0];
}
