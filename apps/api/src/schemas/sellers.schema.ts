import { z } from 'zod';

export const CreateSellerSchema = z.object({
  distributorId: z.string().min(1, 'distributorId is required'),
  fullName: z.string().min(1, 'fullName is required'),
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
  password: z.string().min(6, 'password must be at least 6 characters'),
  countryId: z.string().uuid('countryId must be a valid UUID'),
  referredBy: z.string().uuid('referredBy must be a valid UUID').nullable().optional(),
  role: z.enum(['distributor', 'admin', 'company_staff']).default('distributor').optional(),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'newPassword must be at least 6 characters'),
});

export type CreateSellerInput = z.infer<typeof CreateSellerSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
