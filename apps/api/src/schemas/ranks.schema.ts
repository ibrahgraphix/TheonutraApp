import { z } from 'zod';

export const PromoteDistributorSchema = z.object({
  newRankId: z.string().uuid('newRankId must be a valid UUID'),
});

export type PromoteDistributorInput = z.infer<typeof PromoteDistributorSchema>;
