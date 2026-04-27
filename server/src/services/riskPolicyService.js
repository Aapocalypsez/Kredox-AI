import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { getCvSessionSummary } from './cvAnalysisService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policyPath = path.resolve(__dirname, '../../config/policy_rules.json');

function normalizeEmployment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .trim();
}

async function loadPolicyRules() {
  return JSON.parse(await fs.readFile(policyPath, 'utf8'));
}

async function resolveCustomerId(sessionId, customerId) {
  if (customerId) return customerId;

  const result = await pool.query('SELECT customer_id FROM video_sessions WHERE id = $1', [sessionId]);
  if (!result.rowCount) {
    const error = new Error('Video session not found');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found';
    throw error;
  }

  return result.rows[0].customer_id;
}

async function getRiskInputData({ customer_id, session_id }) {
  const resolvedCustomerId = await resolveCustomerId(session_id, customer_id);
  const [customerResult, cvSummary, consentResult, geoResult, llmResult] = await Promise.all([
    pool.query(
      `SELECT id, name, declared_age, declared_monthly_income, employment_type, pincode,
              bureau_score, existing_loans, loan_amount_requested
       FROM customers
       WHERE id = $1`,
      [resolvedCustomerId]
    ),
    getCvSessionSummary(session_id),
    pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM transcripts
         WHERE session_id = $1
           AND text ILIKE '%I consent to this loan application%'
       ) AS consent_detected`,
      [session_id]
    ),
    pool.query(
      `SELECT geo_score, match_status, flags
       FROM geo_verifications
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session_id]
    ),
    pool.query(
      `SELECT confidence_score
       FROM llm_analysis
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session_id]
    )
  ]);

  if (!customerResult.rowCount) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    error.publicMessage = 'Customer not found';
    throw error;
  }

  return {
    customer_id: resolvedCustomerId,
    session_id,
    customer: customerResult.rows[0],
    cvSummary,
    consent_detected: Boolean(consentResult.rows[0]?.consent_detected),
    geo: geoResult.rows[0] || null,
    llm_confidence_score: Number(llmResult.rows[0]?.confidence_score || 0)
  };
}

function cvAgeMidpoint(cvSummary = {}) {
  const estimate = cvSummary.most_common_age_estimate;
  if (!estimate?.low || !estimate?.high) return null;
  return Math.round((Number(estimate.low) + Number(estimate.high)) / 2);
}

function policyAge(data) {
  return data.customer.declared_age || cvAgeMidpoint(data.cvSummary);
}

function evaluateNumericRule({ rule, required, actual, predicate }) {
  if (actual === null || actual === undefined || actual === '') {
    return { rule, required, actual: null, status: 'WARN' };
  }

  return {
    rule,
    required,
    actual: Number(actual),
    status: predicate(Number(actual), Number(required)) ? 'PASS' : 'FAIL'
  };
}

function evaluateCvAgeMatchRule({ declaredAge, cvEstimate, maxDelta }) {
  if (!declaredAge || !cvEstimate?.low || !cvEstimate?.high) {
    return {
      rule: 'cv_age_declared_match',
      required: `Declared age within ${maxDelta} yrs of CV estimate`,
      actual: cvEstimate?.low && cvEstimate?.high ? `${cvEstimate.low}-${cvEstimate.high} yrs / declared missing` : null,
      status: 'WARN'
    };
  }

  const declared = Number(declaredAge);
  const low = Number(cvEstimate.low);
  const high = Number(cvEstimate.high);
  const midpoint = Math.round((low + high) / 2);
  const delta = Math.abs(declared - midpoint);

  return {
    rule: 'cv_age_declared_match',
    required: `<= ${maxDelta} yrs delta`,
    actual: `declared ${declared}, CV ${low}-${high}, delta ${delta}`,
    status: delta <= Number(maxDelta) ? 'PASS' : 'FAIL'
  };
}

function evaluateRules(rules, data) {
  const customer = data.customer;
  const livenessScore = data.cvSummary.average_liveness_score;
  const employment = normalizeEmployment(customer.employment_type);
  const ageForPolicy = policyAge(data);
  const evaluations = [
    evaluateNumericRule({
      rule: 'min_age',
      required: rules.min_age,
      actual: ageForPolicy,
      predicate: (actual, required) => actual >= required
    }),
    evaluateNumericRule({
      rule: 'max_age',
      required: rules.max_age,
      actual: ageForPolicy,
      predicate: (actual, required) => actual <= required
    }),
    evaluateNumericRule({
      rule: 'min_income',
      required: rules.min_income,
      actual: customer.declared_monthly_income,
      predicate: (actual, required) => actual >= required
    }),
    evaluateNumericRule({
      rule: 'max_existing_loans',
      required: rules.max_existing_loans,
      actual: customer.existing_loans,
      predicate: (actual, required) => actual <= required
    }),
    evaluateNumericRule({
      rule: 'min_bureau_score',
      required: rules.min_bureau_score,
      actual: customer.bureau_score,
      predicate: (actual, required) => actual >= required
    }),
    {
      rule: 'allowed_employment_types',
      required: rules.allowed_employment_types,
      actual: employment || null,
      status: employment ? (rules.allowed_employment_types.includes(employment) ? 'PASS' : 'FAIL') : 'WARN'
    },
    {
      rule: 'blocked_pincodes',
      required: rules.blocked_pincodes,
      actual: customer.pincode || null,
      status: customer.pincode ? (rules.blocked_pincodes.includes(customer.pincode) ? 'FAIL' : 'PASS') : 'WARN'
    },
    evaluateNumericRule({
      rule: 'min_liveness_score',
      required: rules.min_liveness_score,
      actual: livenessScore,
      predicate: (actual, required) => actual >= required
    }),
    evaluateCvAgeMatchRule({
      declaredAge: customer.declared_age,
      cvEstimate: data.cvSummary.most_common_age_estimate,
      maxDelta: rules.max_cv_age_delta || 8
    }),
    {
      rule: 'consent_required',
      required: rules.consent_required,
      actual: data.consent_detected,
      status: rules.consent_required ? (data.consent_detected ? 'PASS' : 'FAIL') : 'PASS'
    }
  ];

  const passed = evaluations.filter((item) => item.status === 'PASS');
  const failed = evaluations.filter((item) => item.status === 'FAIL');
  const warned = evaluations.filter((item) => item.status === 'WARN');

  return {
    overall_eligible: failed.length === 0,
    passed_rules: passed.length,
    failed_rules: failed.map((item) => item.rule),
    warn_rules: warned.map((item) => item.rule),
    policy_score: Math.round((passed.length / evaluations.length) * 100),
    rules: evaluations
  };
}

export async function runPolicyCheck({ customer_id, session_id }) {
  const [rules, data] = await Promise.all([
    loadPolicyRules(),
    getRiskInputData({ customer_id, session_id })
  ]);

  return evaluateRules(rules, data);
}

export async function buildMlFeatures({ customer_id, session_id }) {
  const data = await getRiskInputData({ customer_id, session_id });
  return {
    bureau_score: Number(data.customer.bureau_score || 0),
    monthly_income: Number(data.customer.declared_monthly_income || 0),
    age: Number(policyAge(data) || 0),
    employment_type: normalizeEmployment(data.customer.employment_type) || 'unknown',
    existing_loans: Number(data.customer.existing_loans || 0),
    loan_amount_requested: Number(data.customer.loan_amount_requested || 0),
    geo_score: Number(data.geo?.geo_score || 0),
    geo_mismatch: data.geo?.match_status === 'MISMATCH' ? 1 : 0,
    liveness_score: Number(data.cvSummary.average_liveness_score || 0),
    llm_confidence_score: Number(data.llm_confidence_score || 0)
  };
}

export async function callMlPredict(features) {
  const response = await fetch(`${env.ml.apiUrl.replace(/\/+$/, '')}/ml/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features)
  });

  if (!response.ok) {
    throw new Error(`ML API failed with ${response.status}`);
  }

  return response.json();
}

function demoMlPrediction(features) {
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Number(features.bureau_score || 0) / 10 +
          Number(features.geo_score || 0) * 0.15 +
          Number(features.liveness_score || 0) * 0.2 +
          Number(features.llm_confidence_score || 0) * 0.15 -
          Number(features.geo_mismatch || 0) * 10
      )
    )
  );

  return {
    default_probability: Number(((100 - score) / 100).toFixed(2)),
    risk_score: score,
    risk_band: finalBand(score),
    feature_contributions: {
      bureau_score: Number(features.bureau_score || 0) >= 650 ? 12 : -12,
      geo_mismatch: Number(features.geo_mismatch || 0) ? -8 : 6,
      income: Number(features.monthly_income || 0) >= 15000 ? 6 : -6,
      liveness_score: Number(features.liveness_score || 0) >= 60 ? 8 : -8
    },
    provider: 'demo_fallback'
  };
}

function finalBand(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

export async function calculateFinalRiskScore({ customer_id, session_id }) {
  const resolvedCustomerId = await resolveCustomerId(session_id, customer_id);
  const policyPromise = runPolicyCheck({ customer_id: resolvedCustomerId, session_id });
  const mlPredictionPromise = buildMlFeatures({ customer_id: resolvedCustomerId, session_id })
    .then(async (features) => ({
      features,
      mlResult: await callMlPredict(features).catch(() => demoMlPrediction(features))
    }));

  const [policy, mlPrediction] = await Promise.all([policyPromise, mlPredictionPromise]);
  const { features, mlResult } = mlPrediction;
  const llmConfidence = features.llm_confidence_score;
  const mlRiskScore = Number(mlResult.risk_score || 0);
  const policyScore = Number(policy.policy_score || 0);
  const finalScore = Math.round(mlRiskScore * 0.5 + policyScore * 0.3 + llmConfidence * 0.2);
  const riskBand = finalBand(finalScore);

  const result = await pool.query(
    `INSERT INTO risk_assessments (
       session_id,
       customer_id,
       final_score,
       risk_band,
       policy_score,
       ml_risk_score,
       llm_confidence_score,
       policy_result,
       ml_result
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, session_id, customer_id, final_score, risk_band, policy_score, ml_risk_score,
               llm_confidence_score, policy_result, ml_result, created_at`,
    [
      session_id,
      resolvedCustomerId,
      finalScore,
      riskBand,
      policyScore,
      mlRiskScore,
      llmConfidence,
      JSON.stringify(policy),
      JSON.stringify(mlResult)
    ]
  );

  return {
    ...result.rows[0],
    final_score: Number(result.rows[0].final_score),
    policy_score: Number(result.rows[0].policy_score),
    ml_risk_score: Number(result.rows[0].ml_risk_score),
    llm_confidence_score: Number(result.rows[0].llm_confidence_score)
  };
}

export async function getLatestRiskAssessment(session_id) {
  const result = await pool.query(
    `SELECT id, session_id, customer_id, final_score, risk_band, policy_score, ml_risk_score,
            llm_confidence_score, policy_result, ml_result, created_at
     FROM risk_assessments
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [session_id]
  );

  if (!result.rowCount) {
    const error = new Error('Risk assessment not found');
    error.statusCode = 404;
    error.publicMessage = 'Risk assessment not found';
    throw error;
  }

  return {
    ...result.rows[0],
    final_score: Number(result.rows[0].final_score),
    policy_score: Number(result.rows[0].policy_score),
    ml_risk_score: Number(result.rows[0].ml_risk_score),
    llm_confidence_score: Number(result.rows[0].llm_confidence_score)
  };
}
