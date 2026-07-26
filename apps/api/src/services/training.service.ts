import { supabase } from '../config/supabase.js';
import { ApiError } from '../middleware/error.middleware.js';
import { deleteCloudinaryAsset } from './uploads.service.js';

export interface TrainingCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingMaterial {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  pdf_url: string;
  uploaded_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: TrainingCategory;
  uploader?: {
    full_name: string;
    distributor_id: string;
  };
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  sort_order?: number;
}

export interface CreateMaterialInput {
  category_id: string;
  title: string;
  description?: string;
  pdf_url: string;
}

export interface UpdateMaterialInput {
  title?: string;
  description?: string;
  pdf_url?: string;
  is_active?: boolean;
}

/**
 * Lists all training categories ordered by sort_order.
 */
export async function listCategories(): Promise<TrainingCategory[]> {
  const { data, error } = await supabase
    .from('training_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new ApiError(500, `Failed to fetch training categories: ${error.message}`);
  }

  return data as TrainingCategory[];
}

/**
 * Creates a new training category (staff only).
 */
export async function createCategory(
  input: CreateCategoryInput,
  uploadedBy: string,
): Promise<TrainingCategory> {
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

  return data as TrainingCategory;
}

/**
 * Updates an existing training category (staff only).
 */
export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<TrainingCategory> {
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

  return data as TrainingCategory;
}

/**
 * Lists training materials by category (active only for distributors).
 */
export async function listMaterialsByCategory(
  categoryId: string,
  includeInactive: boolean = false,
): Promise<TrainingMaterial[]> {
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

  return (data ?? []).map((row: any) => ({
    ...row,
    category: row.training_categories,
  })) as TrainingMaterial[];
}

/**
 * Gets a specific training material by ID.
 */
export async function getMaterial(
  materialId: string,
  includeInactive: boolean = false,
): Promise<TrainingMaterial> {
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

  const material = data as any;
  return {
    ...material,
    category: material.training_categories,
    uploader: material.profiles ? {
      full_name: material.profiles.full_name,
      distributor_id: material.profiles.distributor_id,
    } : undefined,
  } as TrainingMaterial;
}

/**
 * Creates a new training material (staff only).
 */
export async function createMaterial(
  input: CreateMaterialInput,
  uploadedBy: string,
): Promise<TrainingMaterial> {
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

  const material = data as any;
  return {
    ...material,
    category: material.training_categories,
  } as TrainingMaterial;
}

/**
 * Updates an existing training material (staff only). If pdf_url changes,
 * deletes the old Cloudinary PDF (raw resource type) after a successful update.
 */
export async function updateMaterial(
  materialId: string,
  input: UpdateMaterialInput,
): Promise<TrainingMaterial> {
  // Fetch existing to know the old pdf_url before updating
  const { data: existing, error: fetchError } = await supabase
    .from('training_materials')
    .select('pdf_url')
    .eq('id', materialId)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError(500, `Failed to fetch training material: ${fetchError.message}`);
  }
  if (!existing) {
    throw new ApiError(404, 'Training material not found');
  }

  const oldPdfUrl = existing.pdf_url as string | null;

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

  if (input.pdf_url !== undefined && input.pdf_url !== oldPdfUrl) {
    await deleteCloudinaryAsset(oldPdfUrl, 'raw');
  }

  const material = data as any;
  return {
    ...material,
    category: material.training_categories,
  } as TrainingMaterial;
}

/**
 * Deactivates a training material (soft delete, staff only). Keeps the
 * Cloudinary PDF in place — use hardDeleteMaterial to also remove it.
 */
export async function deactivateMaterial(materialId: string): Promise<void> {
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

/**
 * Permanently deletes a training material row AND its Cloudinary PDF.
 * Use this instead of deactivateMaterial when the admin wants it fully
 * gone (e.g. to reclaim Cloudinary free-tier storage), not just hidden.
 */
export async function hardDeleteMaterial(materialId: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('training_materials')
    .select('pdf_url')
    .eq('id', materialId)
    .maybeSingle();

  if (fetchError) {
    throw new ApiError(500, `Failed to fetch training material: ${fetchError.message}`);
  }
  if (!data) {
    throw new ApiError(404, 'Training material not found');
  }

  const { error } = await supabase
    .from('training_materials')
    .delete()
    .eq('id', materialId);

  if (error) {
    throw new ApiError(500, `Failed to delete training material: ${error.message}`);
  }

  await deleteCloudinaryAsset(data.pdf_url as string | null, 'raw');
}