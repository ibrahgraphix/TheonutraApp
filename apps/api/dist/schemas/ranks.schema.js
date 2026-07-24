import { z } from 'zod';
export const PromoteDistributorSchema = z.object({
    newRankId: z.string().uuid('newRankId must be a valid UUID'),
});
//# sourceMappingURL=ranks.schema.js.map