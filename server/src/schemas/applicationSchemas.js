import { z } from 'zod';

const fieldSchema = z.object({
  value: z.any().nullable(),
  source: z.enum(['stt_extracted', 'declared', 'bureau', 'cv', 'geo', 'llm', 'risk_engine', 'manual', 'empty']),
  confidence: z.number().min(0).max(1),
  needs_review: z.boolean(),
  conflicts: z.array(z.object({
    source: z.string(),
    value: z.any().nullable(),
    confidence: z.number().min(0).max(1).optional()
  })).optional()
});

export const loanApplicationSchema = z.object({
  personal: z.object({
    full_name: fieldSchema,
    dob: fieldSchema,
    age: fieldSchema,
    pan_number: fieldSchema,
    aadhaar_last4: fieldSchema,
    phone: fieldSchema,
    email: fieldSchema,
    gender: fieldSchema
  }),
  financial: z.object({
    monthly_income: fieldSchema,
    employment_type: fieldSchema,
    employer_name: fieldSchema,
    years_employed: fieldSchema,
    existing_emi: fieldSchema,
    bureau_score: fieldSchema
  }),
  loan: z.object({
    amount_requested: fieldSchema,
    purpose: fieldSchema,
    tenure_months: fieldSchema
  }),
  verification: z.object({
    video_session_id: fieldSchema,
    liveness_score: fieldSchema,
    consent_confirmed: fieldSchema,
    geo_verified: fieldSchema,
    cv_age_estimate: fieldSchema,
    age_flag: fieldSchema
  }),
  risk: z.object({
    risk_band: fieldSchema,
    policy_passed: fieldSchema,
    ml_score: fieldSchema,
    llm_confidence: fieldSchema,
    recommended_action: fieldSchema,
    red_flags: fieldSchema
  })
});

export const compileApplicationSchema = z.object({
  session_id: z.string().uuid()
});

export const patchApplicationFieldSchema = z.object({
  agent_id: z.string().trim().min(1),
  field_path: z.string().trim().min(1),
  new_value: z.any(),
  reason: z.enum(['Typo correction', 'Customer clarified', 'Source conflict', 'Other'])
});

