import { z } from 'zod';

export const AwardManualBonusSchema = z.object({
  distributorId: z.string().uuid('distributorId must be a valid UUID'),
  bonusCategory: z.enum(['leadership', 'rank_achievement', 'monthly_performance', 'other'], {
    errorMap: () => ({ message: "bonusCategory must be 'leadership', 'rank_achievement', 'monthly_performance', or 'other'" }),
  }),
  amount: z.number().positive('amount must be greater than 0'),
  note: z.string().optional(),
});

export type AwardManualBonusInput = z.infer<typeof AwardManualBonusSchema>;
