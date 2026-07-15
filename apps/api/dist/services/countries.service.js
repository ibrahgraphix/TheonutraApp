import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * Returns all active countries ordered alphabetically.
 * Any authenticated user can call this (distributors included).
 */
export async function listCountries() {
    const { data, error } = await supabase
        .from('countries')
        .select('id, name, iso_code, currency_code, is_active, created_at')
        .eq('is_active', true)
        .order('name', { ascending: true });
    if (error) {
        throw new ApiError(500, `Failed to list countries: ${error.message}`);
    }
    return (data ?? []).map(mapCountry);
}
/**
 * Creates a new country row.
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function createCountry(input) {
    const { data, error } = await supabase
        .from('countries')
        .insert({
        name: input.name.trim(),
        iso_code: input.isoCode.trim().toUpperCase(),
        currency_code: input.currencyCode.trim().toUpperCase(),
        is_active: true,
    })
        .select('id, name, iso_code, currency_code, is_active, created_at')
        .single();
    if (error) {
        if (error.code === '23505') {
            throw new ApiError(409, 'A country with that name or ISO code already exists');
        }
        throw new ApiError(500, `Failed to create country: ${error.message}`);
    }
    return mapCountry(data);
}
/**
 * Updates fields on an existing country (e.g. toggle is_active, rename, etc.).
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function updateCountry(id, input) {
    // Build the update payload, only including provided fields
    const patch = {};
    if (input.name !== undefined)
        patch['name'] = input.name;
    if (input.isoCode !== undefined)
        patch['iso_code'] = input.isoCode;
    if (input.currencyCode !== undefined)
        patch['currency_code'] = input.currencyCode;
    if (input.isActive !== undefined)
        patch['is_active'] = input.isActive;
    if (Object.keys(patch).length === 0) {
        throw new ApiError(422, 'No updatable fields provided');
    }
    const { data, error } = await supabase
        .from('countries')
        .update(patch)
        .eq('id', id)
        .select('id, name, iso_code, currency_code, is_active, created_at')
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            throw new ApiError(404, 'Country not found');
        }
        if (error.code === '23505') {
            throw new ApiError(409, 'A country with that name or ISO code already exists');
        }
        throw new ApiError(500, `Failed to update country: ${error.message}`);
    }
    return mapCountry(data);
}
// ── Private helpers ──────────────────────────────────────────────────────────
function mapCountry(row) {
    return {
        id: row['id'],
        name: row['name'],
        isoCode: row['iso_code'],
        currencyCode: row['currency_code'],
        isActive: row['is_active'],
        createdAt: row['created_at'],
    };
}
//# sourceMappingURL=countries.service.js.map