import { z } from 'zod';

export const BankPaymentSchema = z.object({
  orderId:     z.string().uuid('orderId must be a valid UUID'),
  referenceNo: z.string().min(1, 'referenceNo is required'),
});

export const MobileMoneyPaymentSchema = z.object({
  orderId:     z.string().uuid('orderId must be a valid UUID'),
  provider:    z.enum(['mpesa', 'tigopesa', 'airtelmoney'], {
    errorMap: () => ({ message: 'provider must be mpesa, tigopesa, or airtelmoney' }),
  }),
  phoneNumber: z.string().min(1, 'phoneNumber is required'),
});

export type BankPaymentInput = z.infer<typeof BankPaymentSchema>;
export type MobileMoneyPaymentInput = z.infer<typeof MobileMoneyPaymentSchema>;
