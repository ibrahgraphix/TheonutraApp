import { supabase } from '../config/supabase.js';
/**
 * Checks if a distributor ID is already in use (case-insensitive compare).
 * Returns true if taken, false if available.
 */
export async function isDistributorIdTaken(distributorId) {
    const cleanId = distributorId.trim().toLowerCase();
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .ilike('distributor_id', cleanId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return data !== null;
}
//# sourceMappingURL=idValidation.js.map