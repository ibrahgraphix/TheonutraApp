import { z } from 'zod';

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const ChangePhoneNumberSchema = z.object({
  newPhoneNumber: z.string().min(1, 'Phone number is required'),
});

export const PaymentMethodSchema = z.object({
  payment_method: z.enum(['mpesa', 'airtel_money', 'mixx', 'halopesa', 'bank_transfer', 'M-Pesa', 'Airtel Money', 'Mixx by Yas', 'HaloPesa', 'Bank Transfer']),
  payment_full_name: z.string().min(1, 'Full name is required'),
  payment_account_number: z.string().min(1, 'Account number or phone number is required'),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangePhoneNumberInput = z.infer<typeof ChangePhoneNumberSchema>;
export type PaymentMethodInput = z.infer<typeof PaymentMethodSchema>;
