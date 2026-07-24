import { z } from 'zod';
export const CreateEventSchema = z.object({
    title: z.string().min(1, 'title is required'),
    description: z.string().optional(),
    eventType: z.enum(['general', 'health_education', 'training', 'product_launch']),
    isVirtual: z.boolean(),
    location: z.string().optional(),
    virtualLink: z.string().url('virtualLink must be a valid URL').optional(),
    startAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'startAt must be a valid ISO date string',
    }),
    endAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'endAt must be a valid ISO date string',
    }),
    bannerImageUrl: z.string().url('bannerImageUrl must be a valid URL').optional(),
}).superRefine((value, ctx) => {
    if (value.isVirtual) {
        if (!value.virtualLink) {
            ctx.addIssue({ path: ['virtualLink'], code: z.ZodIssueCode.custom, message: 'virtualLink is required for virtual events' });
        }
    }
    else {
        if (!value.location) {
            ctx.addIssue({ path: ['location'], code: z.ZodIssueCode.custom, message: 'location is required for in-person events' });
        }
    }
    if (value.startAt && value.endAt) {
        const start = Date.parse(value.startAt);
        const end = Date.parse(value.endAt);
        if (start >= end) {
            ctx.addIssue({ path: ['endAt'], code: z.ZodIssueCode.custom, message: 'endAt must be after startAt' });
        }
    }
});
export const UpdateEventSchema = CreateEventSchema.partial();
//# sourceMappingURL=events.schema.js.map