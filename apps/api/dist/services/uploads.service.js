/**
 * src/services/uploads.service.ts
 *
 * Cloudinary Image Upload Service for Products, Articles, and News.
 *
 * Image size/capacity control limits (Free Tier Optimization):
 * - Max Width: 1200px (cap resolution to prevent huge images)
 * - Max Height: 1200px (cap resolution to prevent huge images)
 * - Crop Mode: 'limit' (downsize only if larger, never upscale smaller images)
 * - Quality: 'auto:good' (balanced visual quality and file size)
 * - Fetch Format: 'auto' (Cloudinary serves WebP/AVIF if supported by client)
 *
 * To adjust these limits, modify the TRANSFORMATION constant below.
 */
import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.middleware.js';
import { v2 as cloudinary } from 'cloudinary';
// Strict transformation parameters for automatic optimization and resizing
const TRANSFORMATION = 'c_limit,f_auto,h_1200,q_auto:good,w_1200';
/**
 * Generates a signed signature and timestamp for secure direct uploads to Cloudinary.
 * The signature binds the transformation parameters so clients cannot bypass the size/quality caps.
 */
export async function getCloudinarySignature() {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new ApiError(500, 'Cloudinary is not configured on the backend');
    }
    const timestamp = Math.round(new Date().getTime() / 1000);
    // Parameter string to sign MUST be sorted alphabetically.
    // Keys: "timestamp", "transformation"
    // Order: timestamp, transformation
    const paramsToSign = `timestamp=${timestamp}&transformation=${TRANSFORMATION}`;
    // Signature is SHA-1 of the params string concatenated with the API Secret
    const signature = crypto
        .createHash('sha1')
        .update(paramsToSign + apiSecret)
        .digest('hex');
    return {
        signature,
        timestamp,
        apiKey,
        cloudName,
        transformation: TRANSFORMATION,
    };
}
/**
 * Deletes a Cloudinary asset by its URL.
 * Extracts the public_id from the URL and calls Cloudinary's destroy API.
 * This is a "best effort" cleanup - failures are logged but don't throw errors.
 */
export async function deleteCloudinaryAsset(imageUrl) {
    // Skip if no URL provided
    if (!imageUrl) {
        return;
    }
    // Check if this is a Cloudinary URL
    // Cloudinary URLs typically look like: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/public_id.format
    const cloudinaryUrlPattern = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;
    if (!cloudinaryUrlPattern.test(imageUrl)) {
        // Not a Cloudinary URL - skip silently (could be leftover test data)
        return;
    }
    try {
        // Configure Cloudinary with credentials from env
        cloudinary.config({
            cloud_name: env.CLOUDINARY_CLOUD_NAME,
            api_key: env.CLOUDINARY_API_KEY,
            api_secret: env.CLOUDINARY_API_SECRET,
        });
        // Extract public_id from URL
        // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.format
        // We need to extract everything after the version (v1234567890) and remove the file extension
        const urlParts = imageUrl.split('/image/upload/');
        if (urlParts.length < 2) {
            console.warn(`[Cloudinary] Could not extract public_id from URL: ${imageUrl}`);
            return;
        }
        // The part after /image/upload/ contains version and public_id
        // Format: v1234567890/folder/public_id.format
        const afterUpload = urlParts[1];
        // Remove version prefix (v followed by digits)
        const withoutVersion = afterUpload.replace(/^v\d+\//, '');
        // Remove file extension (everything after the last dot)
        const publicId = withoutVersion.replace(/\.[^.]+$/, '');
        // Call Cloudinary destroy API
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result !== 'ok' && result.result !== 'not found') {
            console.warn(`[Cloudinary] Failed to delete asset ${publicId}: ${result.result}`);
        }
    }
    catch (error) {
        // Log warning but don't throw - DB update should still succeed
        console.warn(`[Cloudinary] Error deleting asset: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=uploads.service.js.map