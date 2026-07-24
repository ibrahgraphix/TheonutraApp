import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * Lists all training categories ordered by sort_order.
 */
export async function listCategories() {
    const { data, error } = await supabase
        .from('training_categories')
        .select('*')
        .order('sort_order', { ascending: true });
    if (error) {
        throw new ApiError(500, `Failed to fetch training categories: ${error.message}`);
    }
    return data;
}
/**
 * Creates a new training category (staff only).
 */
export async function createCategory(input, uploadedBy) {
    const { data, error } = await supabase
        .from('training_categories')
        .insert({
        name: input.name,
        description: input.description || null,
        sort_order: input.sort_order || 0,
    })
        .select()
        .single();
    if (error) {
        throw new ApiError(500, `Failed to create training category: ${error.message}`);
    }
    return data;
}
/**
 * Updates an existing training category (staff only).
 */
export async function updateCategory(categoryId, input) {
    const { data, error } = await supabase
        .from('training_categories')
        .update({
        name: input.name,
        description: input.description,
        sort_order: input.sort_order,
        updated_at: new Date().toISOString(),
    })
        .eq('id', categoryId)
        .select()
        .single();
    if (error || !data) {
        throw new ApiError(404, 'Training category not found');
    }
    return data;
}
/**
 * Lists training materials by category (active only for distributors).
 */
export async function listMaterialsByCategory(categoryId, includeInactive = false) {
    let query = supabase
        .from('training_materials')
        .select(`
      *,
      training_categories (
        id,
        name,
        description,
        sort_order
      )
    `)
        .eq('category_id', categoryId);
    if (!includeInactive) {
        query = query.eq('is_active', true);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
        throw new ApiError(500, `Failed to fetch training materials: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
        ...row,
        category: row.training_categories,
    }));
}
/**
 * Gets a specific training material by ID.
 */
export async function getMaterial(materialId, includeInactive = false) {
    let query = supabase
        .from('training_materials')
        .select(`
      *,
      training_categories (
        id,
        name,
        description,
        sort_order
      ),
      profiles!training_materials_uploaded_by_fkey (
        full_name,
        distributor_id
      )
    `)
        .eq('id', materialId);
    if (!includeInactive) {
        query = query.eq('is_active', true);
    }
    const { data, error } = await query.single();
    if (error || !data) {
        throw new ApiError(404, 'Training material not found');
    }
    const material = data;
    return {
        ...material,
        category: material.training_categories,
        uploader: material.profiles ? {
            full_name: material.profiles.full_name,
            distributor_id: material.profiles.distributor_id,
        } : undefined,
    };
}
/**
 * Creates a new training material (staff only).
 */
export async function createMaterial(input, uploadedBy) {
    const { data, error } = await supabase
        .from('training_materials')
        .insert({
        category_id: input.category_id,
        title: input.title,
        description: input.description || null,
        pdf_url: input.pdf_url,
        uploaded_by: uploadedBy,
        is_active: true,
    })
        .select(`
      *,
      training_categories (
        id,
        name,
        description,
        sort_order
      )
    `)
        .single();
    if (error) {
        throw new ApiError(500, `Failed to create training material: ${error.message}`);
    }
    const material = data;
    return {
        ...material,
        category: material.training_categories,
    };
}
/**
 * Updates an existing training material (staff only).
 */
export async function updateMaterial(materialId, input) {
    const { data, error } = await supabase
        .from('training_materials')
        .update({
        title: input.title,
        description: input.description,
        pdf_url: input.pdf_url,
        is_active: input.is_active,
        updated_at: new Date().toISOString(),
    })
        .eq('id', materialId)
        .select(`
      *,
      training_categories (
        id,
        name,
        description,
        sort_order
      )
    `)
        .single();
    if (error || !data) {
        throw new ApiError(404, 'Training material not found');
    }
    const material = data;
    return {
        ...material,
        category: material.training_categories,
    };
}
/**
 * Deactivates a training material (soft delete, staff only).
 */
export async function deactivateMaterial(materialId) {
    const { error } = await supabase
        .from('training_materials')
        .update({
        is_active: false,
        updated_at: new Date().toISOString(),
    })
        .eq('id', materialId);
    if (error) {
        throw new ApiError(404, 'Training material not found');
    }
}
//# sourceMappingURL=training.service.js.map