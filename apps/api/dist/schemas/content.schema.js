import { z } from 'zod';
export const CreateContentSchema = z.object({
    title: z.string().min(1, 'title is required'),
    body: z.string().min(1, 'body is required'),
    coverImageUrl: z.string().url('coverImageUrl must be a valid URL').optional().nullable(),
    isPublished: z.boolean().optional().default(true),
});
export const UpdateContentSchema = z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    coverImageUrl: z.string().url('coverImageUrl must be a valid URL').optional().nullable(),
    isPublished: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
//# sourceMappingURL=content.schema.js.map