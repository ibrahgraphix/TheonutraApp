import { z } from 'zod';
export const SubmitKycSchema = z.object({
    id_type: z.enum(['national_id', 'passport', 'voter_id', 'driver_license'], {
        errorMap: () => ({ message: "id_type must be one of: national_id, passport, voter_id, driver_license" }),
    }),
    id_number: z.string().min(1, 'id_number is required'),
    document_front_url: z.string().url('document_front_url must be a valid URL'),
    document_back_url: z.string().url('document_back_url must be a valid URL').optional(),
    selfie_url: z.string().url('selfie_url must be a valid URL').optional(),
});
export const ReviewKycSchema = z.object({
    decision: z.enum(['approve', 'reject', 'request_resubmission'], {
        errorMap: () => ({ message: "decision must be one of: approve, reject, request_resubmission" }),
    }),
    reason: z.string().optional(),
});
//# sourceMappingURL=kyc.schema.js.map