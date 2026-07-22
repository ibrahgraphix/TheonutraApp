import { z } from 'zod';

export const RequestWithdrawalSchema = z.object({
  amount: z.number().positive('amount must be greater than 0'),
  method: z.enum(['bank', 'mobile_money'], {
    errorMap: () => ({ message: "method must be either 'bank' or 'mobile_money'" }),
  }),
  payoutDetails: z.string().min(1, 'payoutDetails is required'),
});

export type RequestWithdrawalInput = z.infer<typeof RequestWithdrawalSchema>;
