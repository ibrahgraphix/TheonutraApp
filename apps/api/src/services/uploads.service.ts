/**
 * src/services/uploads.service.ts
 *
 * Cloudinary Image Upload Service for Products, Articles, News, and PDF
 * cleanup for Training Materials / KYC documents.
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

export interface CloudinarySignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  transformation: string;
}

/**
 * Generates a signed signature and timestamp for secure direct uploads to Cloudinary.
 * The signature binds the transformation parameters so clients cannot bypass the size/quality caps.
 */
export async function getCloudinarySignature(): Promise<CloudinarySignatureResponse> {
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
 *
 * @param assetUrl      the full Cloudinary secure_url stored in the DB
 * @param resourceType  'image' (default — products/articles/news/KYC photos)
 *                       or 'raw' (PDFs — training materials)
 */
export async function deleteCloudinaryAsset(
  assetUrl: string | null | undefined,
  resourceType: 'image' | 'raw' = 'image',
): Promise<void> {
  // Skip if no URL provided
  if (!assetUrl) {
    return;
  }

  // Check if this is a Cloudinary URL of the expected resource type.
  // Cloudinary URLs look like:
  //   https://res.cloudinary.com/cloud_name/image/upload/v123/public_id.ext
  //   https://res.cloudinary.com/cloud_name/raw/upload/v123/public_id.ext
  const pattern =
    resourceType === 'raw'
      ? /^https?:\/\/res\.cloudinary\.com\/[^/]+\/raw\/upload\//
      : /^https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//;

  if (!pattern.test(assetUrl)) {
    // Not a Cloudinary URL of this resource type - skip silently (could be leftover test data)
    return;
  }

  try {
    // Configure Cloudinary with credentials from env
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

    // The part after the marker contains version and public_id
    // Format: v1234567890/folder/public_id.format
    const afterUpload = urlParts[1];

    // Remove version prefix (v followed by digits)
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');

    // For images, Cloudinary's public_id excludes the file extension.
    // For raw resources (PDFs), the public_id INCLUDES the extension —
    // stripping it would target the wrong asset and fail to delete it.
    const publicId =
      resourceType === 'raw' ? withoutVersion : withoutVersion.replace(/\.[^.]+$/, '');

    // Call Cloudinary destroy API with the matching resource_type
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      console.warn(`[Cloudinary] Failed to delete asset ${publicId}: ${result.result}`);
    }
  } catch (error) {
    // Log warning but don't throw - DB update/delete should still succeed
    console.warn(
      `[Cloudinary] Error deleting asset: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Deletes multiple Cloudinary assets of the same resource type in parallel.
 * Convenience wrapper for cases like KYC submissions with several document
 * URLs (front/back/selfie) that all need cleanup together.
 */
export async function deleteCloudinaryAssets(
  assetUrls: Array<string | null | undefined>,
  resourceType: 'image' | 'raw' = 'image',
): Promise<void> {
  await Promise.all(assetUrls.map((url) => deleteCloudinaryAsset(url, resourceType)));
}