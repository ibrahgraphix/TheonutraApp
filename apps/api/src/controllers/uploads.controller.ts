import { Request, Response, NextFunction } from 'express';
import { getCloudinarySignature, deleteCloudinaryAsset } from '../services/uploads.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/uploads/cloudinary-signature
 * Returns a signed timestamp + signature for direct client uploads to
 * Cloudinary. Any authenticated user can call this (used by products,
 * articles, news, KYC docs, training PDFs, etc.).
 */
export async function getCloudinarySignatureHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signature = await getCloudinarySignature();
    res.status(200).json(signature);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/uploads/delete
 * Deletes a Cloudinary asset by URL. Staff only. Used by the frontend to
 * clean up images/PDFs that were uploaded but never attached to a saved
 * record (e.g. admin picked a new image before saving, or left the screen
 * without saving at all).
 */
export async function deleteUploadedAssetHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { url, resourceType } = req.body as { url?: string; resourceType?: 'image' | 'raw' };
    if (!url) {
      throw new ApiError(400, 'url is required');
    }

    await deleteCloudinaryAsset(url, resourceType ?? 'image');
    res.status(200).json({ message: 'Asset deleted' });
  } catch (err) {
    next(err);
  }
}