import { z } from 'zod';

// ── Countries ────────────────────────────────────────────────────────────────

export const CreateCountrySchema = z.object({
  name:         z.string().min(1, 'name is required'),
  isoCode:      z.string().min(2, 'isoCode must be at least 2 characters').max(3, 'isoCode must be at most 3 characters'),
  currencyCode: z.string().min(3, 'currencyCode must be exactly 3 characters').max(3, 'currencyCode must be exactly 3 characters'),
});

export const UpdateCountrySchema = z.object({
  name:         z.string().min(1).optional(),
  isoCode:      z.string().min(2).max(3).optional(),
  currencyCode: z.string().length(3).optional(),
  isActive:     z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type CreateCountryInput = z.infer<typeof CreateCountrySchema>;
export type UpdateCountryInput = z.infer<typeof UpdateCountrySchema>;

// ── Products ─────────────────────────────────────────────────────────────────

const PriceEntrySchema = z.object({
  countryId:   z.string().uuid('countryId must be a valid UUID'),
  price:       z.number().positive('price must be a positive number'),
  isAvailable: z.boolean(),
});

export const CreateProductSchema = z.object({
  name:        z.string().min(1, 'name is required'),
  description: z.string().optional(),
  imageUrl:    z.string().url('imageUrl must be a valid URL').optional(),
  prices:      z.array(PriceEntrySchema).min(1, 'At least one price entry is required'),
});

export const UpdateProductSchema = z.object({
  name:        z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl:    z.string().url().optional(),
  prices:      z.array(PriceEntrySchema).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
