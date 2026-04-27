import { z } from 'zod';

export const channelSchema = z.enum(['sms', 'whatsapp', 'email']);

const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);
const optionalInt = (schema) => z.preprocess(blankToUndefined, schema.optional());
const optionalNumber = (schema) => z.preprocess(blankToUndefined, schema.optional());

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  declared_age: optionalInt(z.coerce.number().int().min(1).max(120)),
  declared_monthly_income: optionalNumber(z.coerce.number().min(0)),
  employment_type: z.string().trim().optional().or(z.literal('')),
  loan_purpose: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  declared_state: z.string().trim().optional().or(z.literal('')),
  pincode: z.string().trim().optional().or(z.literal('')),
  bureau_score: optionalInt(z.coerce.number().int().min(300).max(900)),
  existing_loans: optionalInt(z.coerce.number().int().min(0)),
  loan_amount_requested: optionalNumber(z.coerce.number().min(0))
}).refine((customer) => customer.phone || customer.email, {
  message: 'A phone number or email is required'
});

export const createCampaignSchema = z.object({
  lender_id: z.string().trim().min(1, 'lender_id is required'),
  name: z.string().trim().min(1).optional(),
  customer_list: z.array(customerSchema).min(1, 'Upload at least one customer'),
  channel: channelSchema,
  expiry_minutes: z.coerce.number().int().min(1).max(1440),
  message_template: z.string().trim().min(10).max(320).optional()
});

export const completeLinkSchema = z.object({
  token: z.string().min(1),
  session_token: z.string().uuid()
});
