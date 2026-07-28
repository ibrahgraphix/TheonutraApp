import { Request, Response, NextFunction } from 'express';
import { getCloudinarySignature, deleteCloudinaryAsset } from '../services/uploads.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/uploads/cloudinary-signature?resourceType=image|raw
 * Returns a signed timestamp + signature for direct client uploads to
 * Cloudinary. Defaults to 'image' if resourceType is omitted or invalid.
 */
export async function getCloudinarySignatureHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const resourceType = req.query['resourceType'] === 'raw' ? 'raw' : 'image';
    const signature = await getCloudinarySignature(resourceType);
    res.status(200).json(signature);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/uploads/delete
 * Deletes a Cloudinary asset by URL. Staff only.
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