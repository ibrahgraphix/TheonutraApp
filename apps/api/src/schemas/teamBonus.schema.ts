import { z } from 'zod';

// ── Team Bonus ───────────────────────────────────────────────────────────────

export const RunTeamBonusSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
});

export type RunTeamBonusInput = z.infer<typeof RunTeamBonusSchema>;

// ── Team Bonus Rate (for admin configuration) ─────────────────────────────────

export const TeamBonusRateSchema = z.object({
  rankId: z.string().uuid('rankId must be a valid UUID'),
  level: z.number().int().positive('level must be a positive integer'),
  percentage: z.number().positive('percentage must be positive'),
});

export const CreateTeamBonusRateSchema = z.object({
  rates: z.array(TeamBonusRateSchema).min(1, 'At least one rate is required'),
});

export type CreateTeamBonusRateInput = z.infer<typeof CreateTeamBonusRateSchema>;
