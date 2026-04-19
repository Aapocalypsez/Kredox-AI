import { z } from 'zod';

export const verifyGeoSchema = z.object({
  session_id: z.string().uuid(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  ip_address: z.string().trim().optional().or(z.literal(''))
});

