import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  SUPABASE_JWKS_URL: z.string().url('SUPABASE_JWKS_URL must be a valid URL'),

  INTERNAL_EMAIL_DOMAIN: z.string().default('theonutra.internal'),

  /**
   * Commission rates per upline level — comma-separated decimals.
   * Level 1 = direct sponsor, level 2 = their sponsor, etc.
   * Stored as a raw string; parsed into number[] by getCommissionRates().
   */
  COMMISSION_RATES: z.string().default('0.05,0.03,0.02'),

  /**
   * Flat commission percentage for direct recruiter (level 1 only).
   * ⚠️ MUST be confirmed with client before going live.
   */
  COMMISSION_PERCENTAGE: z.coerce.number().default(10),

  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  FRONTEND_URL: z.string().default('https://app.domain'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n');
  parsed.error.issues.forEach((issue) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;

/** Commission rates as an ordered number array (index 0 = level-1 upline). */
export function getCommissionRates(): number[] {
  return env.COMMISSION_RATES.split(',').map((r) => parseFloat(r.trim()));
}
