import crypto from 'crypto';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.middleware.js';
import { v2 as cloudinary } from 'cloudinary';
const TRANSFORMATION = 'c_limit,f_auto,h_1200,q_auto:good,w_1200';
/**
 * Generates a signed signature and timestamp for direct uploads to Cloudinary.
 * For 'image' uploads, binds the size/quality transformation so clients
 * cannot bypass it. For 'raw' uploads (PDFs), Cloudinary doesn't support
 * image transformations, so only the timestamp is signed.
 */
export async function getCloudinarySignature(resourceType = 'image') {
    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new ApiError(500, 'Cloudinary is not configured on the backend');
    }
    const timestamp = Math.round(new Date().getTime() / 1000);
    if (resourceType === 'raw') {
        const paramsToSign = `timestamp=${timestamp}`;
        const signature = crypto
            .createHash('sha1')
            .update(paramsToSign + apiSecret)
            .digest('hex');
        return {
            signature,
            timestamp,
            apiKey,
            cloudName,
            transformation: '',
        };
    }
    const paramsToSign = `timestamp=${timestamp}&transformation=${TRANSFORMATION}`;
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
 * Deletes a Cloudinary asset by its URL. Best-effort — failures are logged
 * but don't throw.
 */
export async function deleteCloudinaryAsset(assetUrl, resourceType = 'image') {
    if (!assetUrl) {
        return;
    }
    const pattern = resourceType === 'raw'
        ? /^https?:\/\/res\.cloudinary\.com\/[^/]+\/raw\/upload\//
        : /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;
    if (!pattern.test(assetUrl)) {
        return;
    }
    try {
        cloudinary.config({
            cloud_name: env.CLOUDINARY_CLOUD_NAME,
            api_key: env.CLOUDINARY_API_KEY,
            api_secret: env.CLOUDINARY_API_SECRET,
        });
        const marker = resourceType === 'raw' ? '/raw/upload/' : '/image/upload/';
        const urlParts = assetUrl.split(marker);
        if (urlParts.length < 2) {
            console.warn(`[Cloudinary] Could not extract public_id from URL: ${assetUrl}`);
            return;
        }
        const afterUpload = urlParts[1];
        const withoutVersion = afterUpload.replace(/^v\d+\//, '');
        const publicId = resourceType === 'raw' ? withoutVersion : withoutVersion.replace(/\.[^.]+$/, '');
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        if (result.result !== 'ok' && result.result !== 'not found') {
            console.warn(`[Cloudinary] Failed to delete asset ${publicId}: ${result.result}`);
        }
    }
    catch (error) {
        console.warn(`[Cloudinary] Error deleting asset: ${error instanceof Error ? error.message : String(error)}`);
    }
}
export async function deleteCloudinaryAssets(assetUrls, resourceType = 'image') {
    await Promise.all(assetUrls.map((url) => deleteCloudinaryAsset(url, resourceType)));
}
//# sourceMappingURL=uploads.service.js.map