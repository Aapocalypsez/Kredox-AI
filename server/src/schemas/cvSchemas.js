import { z } from 'zod';

export const analyzeFrameSchema = z.object({
  session_id: z.string().uuid(),
  image_base64: z.string().min(100, 'image_base64 is required'),
  frame_number: z.coerce.number().int().min(0),
  frame_quality: z
    .object({
      usable: z.boolean(),
      reason: z.string().optional(),
      brightness: z.coerce.number().optional(),
      variance: z.coerce.number().optional()
    })
    .nullable()
    .optional()
});

