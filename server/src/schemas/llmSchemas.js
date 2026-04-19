import { z } from 'zod';

export const analyzeLlmSchema = z.object({
  session_id: z.string().uuid()
});

export const explainOfferSchema = z.object({
  risk_band: z.enum(['A', 'B', 'C', 'D']),
  loan_amount: z.coerce.number().positive(),
  interest_rate: z.coerce.number().positive(),
  tenure_months: z.coerce.number().int().positive()
});

