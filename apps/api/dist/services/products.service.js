import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { deleteCloudinaryAsset } from './uploads.service.js';
// ── Public service functions ──────────────────────────────────────────────────
/**
 * Returns all active products that have a price record for the given country
 * and are marked as available in that country.
 */
export async function getProductsByCountry(countryId) {
    const { data, error } = await supabase
        .from('products')
        .select(`
      id,
      name,
      description,
      image_url,
      is_active,
      created_at,
      updated_at,
      product_prices!inner (
        price,
        is_available,
        country_id,
        countries (
          currency_code
        )
      )
    `)
        .eq('is_active', true)
        .eq('product_prices.country_id', countryId)
        .eq('product_prices.is_available', true)
        .order('name', { ascending: true });
    if (error) {
        throw new ApiError(500, `Failed to fetch products: ${error.message}`);
    }
    return (data ?? []).map((row) => mapProductWithPrice(row));
}
/**
 * Returns a single active product with its price for the given country.
 * Throws 404 if the product doesn't exist, is inactive, or has no price for
 * the requested country.
 */
export async function getProductById(id, countryId) {
    const { data, error } = await supabase
        .from('products')
        .select(`
      id,
      name,
      description,
      image_url,
      is_active,
      created_at,
      updated_at,
      product_prices!inner (
        price,
        is_available,
        country_id,
        countries (
          currency_code
        )
      )
    `)
        .eq('id', id)
        .eq('is_active', true)
        .eq('product_prices.country_id', countryId)
        .eq('product_prices.is_available', true)
        .maybeSingle();
    if (error) {
        throw new ApiError(500, `Failed to fetch product: ${error.message}`);
    }
    if (!data) {
        throw new ApiError(404, 'Product not found or not available in the requested country');
    }
    return mapProductWithPrice(data);
}
/**
 * Creates a new product and inserts one `product_prices` row per entry in input.prices.
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function createProduct(input, staffUserId) {
    // 1. Insert the product row
    const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
        name: input.name,
        description: input.description ?? null,
        image_url: input.imageUrl ?? null,
        is_active: true,
        created_by: staffUserId,
    })
        .select('id, name, description, image_url, is_active, created_at, updated_at')
        .single();
    if (productError || !product) {
        throw new ApiError(500, `Failed to create product: ${productError?.message}`);
    }
    // 2. Insert price rows
    const priceRows = input.prices.map((p) => ({
        product_id: product.id,
        country_id: p.countryId,
        price: p.price,
        is_available: p.isAvailable,
    }));
    const { error: priceError } = await supabase
        .from('product_prices')
        .insert(priceRows);
    if (priceError) {
        // Rollback: delete the orphaned product
        await supabase.from('products').delete().eq('id', product.id);
        throw new ApiError(500, `Failed to insert product prices: ${priceError.message}`);
    }
    return mapProduct(product);
}
/**
 * Updates product fields and/or upserts product_prices rows for each country
 * included in the update payload.
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function updateProduct(id, input) {
    // 1. Fetch existing product to get old imageUrl before updating
    const { data: existingProduct, error: fetchError } = await supabase
        .from('products')
        .select('id, name, description, image_url, is_active, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();
    if (fetchError) {
        throw new ApiError(500, `Failed to fetch product: ${fetchError.message}`);
    }
    if (!existingProduct) {
        throw new ApiError(404, 'Product not found');
    }
    const oldImageUrl = existingProduct.image_url;
    // 2. Update the product row if any product-level fields are present
    const productPatch = {};
    if (input.name !== undefined)
        productPatch['name'] = input.name;
    if (input.description !== undefined)
        productPatch['description'] = input.description;
    if (input.imageUrl !== undefined)
        productPatch['image_url'] = input.imageUrl;
    let product = null;
    if (Object.keys(productPatch).length > 0) {
        const { data, error } = await supabase
            .from('products')
            .update(productPatch)
            .eq('id', id)
            .select('id, name, description, image_url, is_active, created_at, updated_at')
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                throw new ApiError(404, 'Product not found');
            }
            throw new ApiError(500, `Failed to update product: ${error.message}`);
        }
        product = data;
    }
    else {
        product = existingProduct;
    }
    // 3. Upsert price rows if provided (conflict on product_id + country_id)
    if (input.prices && input.prices.length > 0) {
        const priceRows = input.prices.map((p) => ({
            product_id: id,
            country_id: p.countryId,
            price: p.price,
            is_available: p.isAvailable,
        }));
        const { error: priceError } = await supabase
            .from('product_prices')
            .upsert(priceRows, { onConflict: 'product_id,country_id' });
        if (priceError) {
            throw new ApiError(500, `Failed to upsert product prices: ${priceError.message}`);
        }
    }
    // 4. Delete old Cloudinary asset if imageUrl changed
    if (input.imageUrl !== undefined && input.imageUrl !== oldImageUrl) {
        // Delete the old image after successful DB update
        await deleteCloudinaryAsset(oldImageUrl);
    }
    return mapProduct(product);
}
/**
 * Soft-deletes a product by setting is_active = false.
 * Does NOT hard-delete to preserve existing order_items references.
 * Staff-only — caller must have already passed requireStaff middleware.
 */
export async function deactivateProduct(id) {
    // 1. Fetch existing product to get imageUrl before deactivating
    const { data: existingProduct, error: fetchError } = await supabase
        .from('products')
        .select('image_url')
        .eq('id', id)
        .maybeSingle();
    if (fetchError) {
        throw new ApiError(500, `Failed to fetch product: ${fetchError.message}`);
    }
    if (!existingProduct) {
        throw new ApiError(404, 'Product not found');
    }
    const oldImageUrl = existingProduct.image_url;
    // 2. Deactivate the product
    const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);
    if (error) {
        throw new ApiError(500, `Failed to deactivate product: ${error.message}`);
    }
    // 3. Delete Cloudinary asset after successful deactivation
    await deleteCloudinaryAsset(oldImageUrl);
}
// ── Private helpers ──────────────────────────────────────────────────────────
function mapProduct(row) {
    return {
        id: row['id'],
        name: row['name'],
        description: row['description'] ?? null,
        imageUrl: row['image_url'] ?? null,
        isActive: row['is_active'],
        createdAt: row['created_at'],
        updatedAt: row['updated_at'],
    };
}
function mapProductWithPrice(row) {
    const base = mapProduct(row);
    // product_prices comes back as an array (join) even with !inner
    const priceRows = row['product_prices'];
    const priceRow = Array.isArray(priceRows) ? priceRows[0] : null;
    if (priceRow) {
        base.price = priceRow['price'];
        const countryData = priceRow['countries'];
        base.currencyCode = countryData?.['currency_code'];
    }
    return base;
}
//# sourceMappingURL=products.service.js.map