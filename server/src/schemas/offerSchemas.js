import { z } from 'zod';

export const generateOfferSchema = z.object({
  session_id: z.string().uuid(),
  application_id: z.string().uuid()
});

