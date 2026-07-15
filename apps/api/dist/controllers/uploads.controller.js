import * as uploadsService from '../services/uploads.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/uploads/cloudinary-signature
 * Generates a signed Cloudinary upload signature. Staff only.
 */
export async function getCloudinarySignatureHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const signatureData = await uploadsService.getCloudinarySignature();
        res.status(200).json(signatureData);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=uploads.controller.js.map