import { z } from 'zod';

const channelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9 !#$%&()+\-:;<=>.?@[\]^_{|}~,]+$/, 'Unsupported Agora channel name');

export const videoTokenSchema = z.object({
  channel_name: channelNameSchema,
  uid: z.union([z.string().trim().min(1), z.number().int().positive()]),
  role: z.enum(['publisher', 'subscriber'])
});

export const startVideoSessionSchema = z.object({
  customer_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1).nullable().optional(),
  channel_name: channelNameSchema.optional(),
  device_metadata: z.record(z.any()).optional()
});

