import { z } from 'zod';

export const channelSchema = z.enum(['sms', 'whatsapp', 'email']);

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  declared_age: z.coerce.number().int().min(1).max(120).optional(),
  declared_monthly_income: z.coerce.number().min(0).optional(),
  employment_type: z.string().trim().optional().or(z.literal('')),
  loan_purpose: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  declared_state: z.string().trim().optional().or(z.literal('')),
  pincode: z.string().trim().optional().or(z.literal('')),
  bureau_score: z.coerce.number().int().min(300).max(900).optional(),
  existing_loans: z.coerce.number().int().min(0).optional(),
  loan_amount_requested: z.coerce.number().min(0).optional()
}).refine((customer) => customer.phone || customer.email, {
  message: 'A phone number or email is required'
});

export const createCampaignSchema = z.object({
  lender_id: z.string().trim().min(1, 'lender_id is required'),
  name: z.string().trim().min(1).optional(),
  customer_list: z.array(customerSchema).min(1, 'Upload at least one customer'),
  channel: channelSchema,
  expiry_minutes: z.coerce.number().int().min(1).max(1440)
});

export const completeLinkSchema = z.object({
  token: z.string().min(1),
  session_token: z.string().uuid()
});
