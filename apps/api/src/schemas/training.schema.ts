import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional(),
  sort_order: z.coerce.number().int().default(0),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').optional(),
  description: z.string().optional(),
  sort_order: z.coerce.number().int().optional(),
});

export const CreateMaterialSchema = z.object({
  category_id: z.string().uuid('Invalid category ID'),
  title: z.string().min(1, 'Material title is required'),
  description: z.string().optional(),
  pdf_url: z.string().url('PDF URL must be a valid URL'),
});

export const UpdateMaterialSchema = z.object({
  title: z.string().min(1, 'Material title is required').optional(),
  description: z.string().optional(),
  pdf_url: z.string().url('PDF URL must be a valid URL').optional(),
  is_active: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
