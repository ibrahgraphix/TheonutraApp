import { env } from '../config/env.js';
/**
 * Converts a human-facing Distributor ID into the synthetic internal email
 * that Supabase Auth uses under the hood (sellers never see this email).
 *
 * Example: "BF-TZ-00231" → "bf-tz-00231@theonutra.internal"
 *
 * Rules:
 *  - Lowercase the entire ID
 *  - Append "@{INTERNAL_EMAIL_DOMAIN}"
 *  - Trim surrounding whitespace to guard against paste artefacts
 */
export function distributorIdToEmail(distributorId) {
    return `${distributorId.trim().toLowerCase()}@${env.INTERNAL_EMAIL_DOMAIN}`;
}
//# sourceMappingURL=distributorAuth.js.map