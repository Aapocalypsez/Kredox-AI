import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  declared_age: z.coerce.number().int().min(1).max(120).optional(),
  declared_monthly_income: z.coerce.number().min(0).optional(),
  employment_type: z.string().trim().optional(),
  loan_purpose: z.string().trim().optional(),
  city: z.string().trim().optional(),
  declared_state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  bureau_score: z.coerce.number().int().min(300).max(900).optional(),
  existing_loans: z.coerce.number().int().min(0).optional(),
  loan_amount_requested: z.coerce.number().min(0).optional()
}).refine((customer) => customer.phone || customer.email, {
  message: 'Phone or email is required'
});

export const campaignFormSchema = z.object({
  lender_id: z.string().trim().min(1, 'Lender ID is required'),
  name: z.string().trim().optional(),
  customer_list: z.array(customerSchema).min(1, 'Upload at least one customer'),
  channel: z.enum(['sms', 'whatsapp', 'email']),
  expiry_minutes: z.number().int().min(30).max(1440)
});
