import { z } from 'zod';

export const policyCheckSchema = z.object({
  customer_id: z.string().uuid().optional(),
  session_id: z.string().uuid()
});

export const finalScoreSchema = z.object({
  customer_id: z.string().uuid().optional(),
  session_id: z.string().uuid()
});

