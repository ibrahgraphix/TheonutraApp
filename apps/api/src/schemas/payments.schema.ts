import { z } from 'zod';

export const BankPaymentSchema = z.object({
  orderId:     z.string().uuid('orderId must be a valid UUID'),
  referenceNo: z.string().min(1, 'referenceNo is required'),
});

export const MobileMoneyPaymentSchema = z.object({
  orderId:     z.string().uuid('orderId must be a valid UUID'),
  provider:    z.enum(['mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'mixx'] as const, {
    message: 'provider must be mpesa, tigopesa, airtelmoney, halopesa, or mixx',
  }),
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
});

export type BankPaymentInput = z.infer<typeof BankPaymentSchema>;
export type MobileMoneyPaymentInput = z.infer<typeof MobileMoneyPaymentSchema>;