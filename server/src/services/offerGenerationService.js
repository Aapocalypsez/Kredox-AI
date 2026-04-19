import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logAuditEvent } from './auditService.js';
import { sendOfferSummary } from './messagingService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tierPath = path.resolve(__dirname, '../../config/offer_tiers.json');

function openaiClient() {
  if (!env.openai.apiKey) {
    const error = new Error('OpenAI is not configured');
    error.statusCode = 500;
    error.publicMessage = 'OpenAI is not configured on this server';
    throw error;
  }
  return new OpenAI({ apiKey: env.openai.apiKey });
}

async function loadOfferTiers() {
  return JSON.parse(await fs.readFile(tierPath, 'utf8'));
}

function calculateEmi(principal, annualRate, months) {
  const monthlyRate = annualRate / 12 / 100;
  if (!monthlyRate) return Math.round(principal / months);
  const power = (1 + monthlyRate) ** months;
  return Math.round((principal * monthlyRate * power) / (power - 1));
}

function tenureOptions(maxTenure) {
  return [12, 24, 36].filter((months) => months <= maxTenure).concat(maxTenure > 36 ? [Math.min(maxTenure, 48)] : []).slice(0, 3);
}

function pickTier(tiers, risk) {
  const byBand = tiers.find((tier) => tier.band === risk.risk_band);
  if (byBand) return byBand;
  return tiers.find((tier) => Number(risk.final_score) >= Number(tier.min_score || 0)) || tiers.at(-1);
}

function fieldValue(application, path) {
  return path.split('.').reduce((target, key) => target?.[key], application)?.value ?? null;
}

function offerUrl(publicToken) {
  return `${env.domain}/offer/${encodeURIComponent(publicToken)}`;
}

function serializeOffer(row) {
  return {
    ...row,
    amount: Number(row.amount),
    interest_rate: Number(row.interest_rate),
    emi: Number(row.emi),
    processing_fee: Number(row.processing_fee)
  };
}

async function getOfferInput({ session_id, application_id }) {
  const result = await pool.query(
    `SELECT
       la.id AS application_id,
       la.application_json,
       c.name,
       c.declared_monthly_income,
       c.bureau_score,
       c.loan_amount_requested,
       ra.final_score,
       ra.risk_band,
       llm.red_flags,
       cv.liveness_status
     FROM loan_applications la
     JOIN video_sessions vs ON vs.id = la.session_id
     LEFT JOIN customers c ON c.id::text = la.customer_id
     LEFT JOIN risk_assessments ra ON ra.session_id = la.session_id
     LEFT JOIN llm_analysis llm ON llm.session_id = la.session_id
     LEFT JOIN LATERAL (
       SELECT liveness_status
       FROM cv_analysis
       WHERE session_id = la.session_id
       ORDER BY created_at DESC
       LIMIT 1
     ) cv ON true
     WHERE la.id = $1
       AND la.session_id = $2
     ORDER BY ra.created_at DESC
     LIMIT 1`,
    [application_id, session_id]
  );

  if (!result.rowCount) {
    const error = new Error('Application or risk assessment not found');
    error.statusCode = 404;
    error.publicMessage = 'Application or risk assessment not found';
    throw error;
  }

  return result.rows[0];
}

async function getOfferWithCustomer(offerId) {
  const result = await pool.query(
    `SELECT
       lo.id,
       lo.application_id,
       lo.public_token,
       lo.band,
       lo.amount,
       lo.interest_rate,
       lo.tenure_months,
       lo.emi,
       lo.processing_fee,
       lo.explanation_text,
       lo.emi_options,
       lo.status,
       lo.created_at,
       c.id AS customer_id,
       c.name AS customer_name,
       c.phone AS customer_phone,
       c.email AS customer_email
     FROM loan_offers lo
     JOIN loan_applications la ON la.id = lo.application_id
     LEFT JOIN customers c ON c.id::text = la.customer_id
     WHERE lo.id = $1`,
    [offerId]
  );

  if (!result.rowCount) {
    const error = new Error('Loan offer not found');
    error.statusCode = 404;
    error.publicMessage = 'Loan offer not found';
    throw error;
  }

  return result.rows[0];
}

async function generateExplanation({ amount, rate, tenure, band }) {
  const completion = await openaiClient().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Generate a warm, professional 2-sentence offer explanation in simple English for an Indian loan applicant. Do not mention risk band to customer.'
      },
      {
        role: 'user',
        content: `Offer: INR ${amount} at ${rate}% for ${tenure} months. Their risk band is ${band}. Don't mention risk band to customer.`
      }
    ],
    temperature: 0.5
  });

  return completion.choices[0]?.message?.content?.trim() || 'Your loan offer is based on your verified profile and repayment capacity. Please review the terms carefully before accepting.';
}

export async function generateLoanOffer({ session_id, application_id }) {
  const [tiers, input] = await Promise.all([
    loadOfferTiers(),
    getOfferInput({ session_id, application_id })
  ]);
  const tier = pickTier(tiers, input);

  if (tier.eligible === false) {
    const error = new Error(tier.rejection_reason || 'Applicant is not eligible for an offer');
    error.statusCode = 422;
    error.publicMessage = error.message;
    throw error;
  }

  const application = input.application_json;
  const requested = Number(fieldValue(application, 'loan.amount_requested') || input.loan_amount_requested || tier.loan_range.min);
  const income = Number(fieldValue(application, 'financial.monthly_income') || input.declared_monthly_income || 0);
  const redFlags = input.red_flags || [];
  const hasStrongSignals = Number(input.bureau_score || 0) > 750 && input.liveness_status === 'PASS';
  const foirCap = income > 0 ? income * 12 * 0.4 : tier.loan_range.max;
  const hardCap = Math.max(0, Math.min(requested, tier.loan_range.max, foirCap));
  if (hardCap <= 0) {
    const error = new Error('Offer amount could not be calculated from the available income and requested amount');
    error.statusCode = 422;
    error.publicMessage = error.message;
    throw error;
  }
  const lowerBand = Math.min(hardCap, tier.loan_range.min);
  const normalBand = Math.min(hardCap, Math.max(tier.loan_range.min, tier.loan_range.max * 0.75));
  const targetAmount = redFlags.length ? lowerBand : hasStrongSignals ? hardCap : normalBand;
  if (targetAmount < 1000) {
    const error = new Error('Calculated offer amount is below the supported minimum');
    error.statusCode = 422;
    error.publicMessage = error.message;
    throw error;
  }
  const selectedAmount = Math.max(1000, Math.floor(targetAmount / 1000) * 1000);
  const interestRate = redFlags.length ? tier.interest_rates.max : hasStrongSignals ? tier.interest_rates.min : Number(((tier.interest_rates.min + tier.interest_rates.max) / 2).toFixed(1));
  const selectedTenure = Math.min(tier.max_tenure_months, 36);
  const selectedEmi = calculateEmi(selectedAmount, interestRate, selectedTenure);
  const options = tenureOptions(tier.max_tenure_months).map((months) => {
    const emi = calculateEmi(selectedAmount, interestRate, months);
    const totalPayable = emi * months;
    return {
      tenure_months: months,
      emi,
      total_interest: totalPayable - selectedAmount,
      total_payable: totalPayable
    };
  });
  const processingFee = Math.round(selectedAmount * (tier.processing_fee_pct / 100));
  const explanation = await generateExplanation({
    amount: selectedAmount,
    rate: interestRate,
    tenure: selectedTenure,
    band: tier.band
  });

  const result = await pool.query(
    `INSERT INTO loan_offers (
       application_id,
       band,
       amount,
       interest_rate,
       tenure_months,
       emi,
       processing_fee,
       explanation_text,
       emi_options
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, application_id, band, amount, interest_rate, tenure_months, emi,
               processing_fee, explanation_text, emi_options, public_token, status, created_at`,
    [
      application_id,
      tier.band,
      selectedAmount,
      interestRate,
      selectedTenure,
      selectedEmi,
      processingFee,
      explanation,
      JSON.stringify(options)
    ]
  );

  return {
    offer: serializeOffer(result.rows[0]),
    emi_options: options,
    explanation,
    customer_offer_url: offerUrl(result.rows[0].public_token)
  };
}

export async function acceptLoanOffer(offerId) {
  const result = await pool.query(
    `UPDATE loan_offers
     SET status = 'accepted'
     WHERE id = $1
     RETURNING id, application_id, band, amount, interest_rate, tenure_months, emi,
               processing_fee, explanation_text, emi_options, public_token, status, created_at`,
    [offerId]
  );

  if (!result.rowCount) {
    const error = new Error('Loan offer not found');
    error.statusCode = 404;
    error.publicMessage = 'Loan offer not found';
    throw error;
  }

  await pool.query(
    `UPDATE loan_applications
     SET status = 'approved'
     WHERE id = $1`,
    [result.rows[0].application_id]
  );

  logAuditEvent({
    event_type: 'APPLICATION_APPROVED',
    entity_type: 'loan_application',
    entity_id: result.rows[0].application_id,
    actor_type: 'system',
    action: 'approve_application',
    new_value: { offer_id: result.rows[0].id, status: 'approved' }
  }).catch((error) => {
    console.error('Application approval audit logging failed', { error: error.message });
  });

  return serializeOffer(result.rows[0]);
}

export async function rejectLoanOffer(offerId) {
  const result = await pool.query(
    `UPDATE loan_offers
     SET status = 'rejected'
     WHERE id = $1
     RETURNING id, application_id, band, amount, interest_rate, tenure_months, emi,
               processing_fee, explanation_text, emi_options, public_token, status, created_at`,
    [offerId]
  );

  if (!result.rowCount) {
    const error = new Error('Loan offer not found');
    error.statusCode = 404;
    error.publicMessage = 'Loan offer not found';
    throw error;
  }

  await pool.query(
    `UPDATE loan_applications
     SET status = 'rejected'
     WHERE id = $1`,
    [result.rows[0].application_id]
  );

  logAuditEvent({
    event_type: 'APPLICATION_REJECTED',
    entity_type: 'loan_application',
    entity_id: result.rows[0].application_id,
    actor_type: 'system',
    action: 'reject_application',
    new_value: { offer_id: result.rows[0].id, status: 'rejected' }
  }).catch((error) => {
    console.error('Application rejection audit logging failed', { error: error.message });
  });

  return serializeOffer(result.rows[0]);
}

export async function getPublicLoanOffer(publicToken) {
  const result = await pool.query(
    `SELECT
       lo.id,
       lo.public_token,
       lo.band,
       lo.amount,
       lo.interest_rate,
       lo.tenure_months,
       lo.emi,
       lo.processing_fee,
       lo.explanation_text,
       lo.emi_options,
       lo.status,
       c.name AS customer_name
     FROM loan_offers lo
     JOIN loan_applications la ON la.id = lo.application_id
     LEFT JOIN customers c ON c.id::text = la.customer_id
     WHERE lo.public_token = $1`,
    [publicToken]
  );

  if (!result.rowCount) {
    const error = new Error('Loan offer not found');
    error.statusCode = 404;
    error.publicMessage = 'Loan offer not found';
    throw error;
  }

  const row = result.rows[0];
  return {
    offer: {
      id: row.id,
      public_token: row.public_token,
      amount: Number(row.amount),
      interest_rate: Number(row.interest_rate),
      tenure_months: row.tenure_months,
      emi: Number(row.emi),
      processing_fee: Number(row.processing_fee),
      explanation_text: row.explanation_text,
      emi_options: row.emi_options,
      status: row.status
    },
    customer: {
      name: row.customer_name || 'Customer'
    }
  };
}

export async function presentLoanOffer(offerId, channel = 'sms') {
  const row = await getOfferWithCustomer(offerId);
  const offer = serializeOffer(row);
  const url = offerUrl(row.public_token);
  const delivery = await sendOfferSummary({
    channel,
    customer: {
      id: row.customer_id,
      name: row.customer_name || 'Customer',
      phone: row.customer_phone,
      email: row.customer_email
    },
    offer,
    offerUrl: url
  });

  return {
    delivery,
    offer_url: url
  };
}
