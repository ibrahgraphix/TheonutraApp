import { z } from 'zod';

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const ChangePhoneNumberSchema = z.object({
  newPhoneNumber: z.string().min(1, 'Phone number is required'),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangePhoneNumberInput = z.infer<typeof ChangePhoneNumberSchema>;
