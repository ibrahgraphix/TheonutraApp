import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';

export interface Country {
  id: string;
  name: string;
  isoCode: string;
  currencyCode: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Returns all active countries ordered alphabetically.
 * Any authenticated user can call this (distributors included).
 */
export async function listCountries(): Promise<Country[]> {
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
export async function createCountry(input: {
  name: string;
  isoCode: string;
  currencyCode: string;
}): Promise<Country> {
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
 * Updates fields on an existing country (e.g. rename, change currency, etc.).
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function updateCountry(
  id: string,
  input: Partial<{
    name: string;
    isoCode: string;
    currencyCode: string;
    isActive: boolean;
  }>,
): Promise<Country> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch['name'] = input.name;
  if (input.isoCode !== undefined) patch['iso_code'] = input.isoCode;
  if (input.currencyCode !== undefined) patch['currency_code'] = input.currencyCode;
  if (input.isActive !== undefined) patch['is_active'] = input.isActive;

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

/**
 * Soft-deactivates a country (is_active = false). Blocked if any distributor
 * profile or available product price still references it — reference data
 * is never hard-deleted while dependents exist.
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function deactivateCountry(id: string): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('countries')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError(500, `Failed to fetch country: ${fetchError.message}`);
  }
  if (!existing) {
    throw new ApiError(404, 'Country not found');
  }

  const { count: profileCount, error: profileError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('country_id', id);

  if (profileError) {
    throw new ApiError(500, `Failed to check referencing profiles: ${profileError.message}`);
  }
  if ((profileCount ?? 0) > 0) {
    throw new ApiError(
      409,
      `Cannot deactivate country: ${profileCount} distributor(s) are still assigned to it`,
    );
  }

  const { count: priceCount, error: priceError } = await supabase
    .from('product_prices')
    .select('*', { count: 'exact', head: true })
    .eq('country_id', id)
    .eq('is_available', true);

  if (priceError) {
    throw new ApiError(500, `Failed to check referencing product prices: ${priceError.message}`);
  }
  if ((priceCount ?? 0) > 0) {
    throw new ApiError(
      409,
      `Cannot deactivate country: ${priceCount} product price(s) still reference it`,
    );
  }

  const { error } = await supabase
    .from('countries')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    throw new ApiError(500, `Failed to deactivate country: ${error.message}`);
  }
}

// ── Private helpers ──────────────────────────────────────────────────────────

function mapCountry(row: Record<string, unknown>): Country {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    isoCode: row['iso_code'] as string,
    currencyCode: row['currency_code'] as string,
    isActive: row['is_active'] as boolean,
    createdAt: row['created_at'] as string,
  };
}