import { Request, Response, NextFunction } from 'express';
import * as trainingService from '../services/training.service.js';
import { CreateCategoryInput, UpdateCategoryInput, CreateMaterialInput, UpdateMaterialInput } from '../services/training.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/training/categories
 * Lists all training categories.
 */
export async function listCategoriesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await trainingService.listCategories();
    res.status(200).json(categories);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/training/categories
 * Creates a new training category (staff only).
 */
export async function createCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const input = req.body as CreateCategoryInput;
    const category = await trainingService.createCategory(input, req.user.id);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/training/categories/:id
 * Updates an existing training category (staff only).
 */
export async function updateCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Category ID is required');
    }
    const input = req.body as UpdateCategoryInput;
    const category = await trainingService.updateCategory(id as string, input);
    res.status(200).json(category);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/training/categories/:id/materials
 * Lists training materials by category (active only for distributors).
 */
export async function listMaterialsByCategoryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Category ID is required');
    }
    const materials = await trainingService.listMaterialsByCategory(id as string);
    res.status(200).json(materials);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/training/materials/:id
 * Gets a specific training material by ID.
 */
export async function getMaterialHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Material ID is required');
    }
    const material = await trainingService.getMaterial(id as string);
    res.status(200).json(material);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/training/materials
 * Creates a new training material (staff only).
 */
export async function createMaterialHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const input = req.body as CreateMaterialInput;
    const material = await trainingService.createMaterial(input, req.user.id);
    res.status(201).json(material);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/training/materials/:id
 * Updates an existing training material (staff only).
 */
export async function updateMaterialHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Material ID is required');
    }
    const input = req.body as UpdateMaterialInput;
    const material = await trainingService.updateMaterial(id as string, input);
    res.status(200).json(material);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/training/materials/:id
 * Deactivates a training material (soft delete, staff only).
 */
export async function deactivateMaterialHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Material ID is required');
    }
    await trainingService.deactivateMaterial(id as string);
    res.status(200).json({ message: 'Training material deactivated successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/training/materials/:id/permanent
 * Permanently deletes a training material AND its Cloudinary PDF (staff only).
 */
export async function hardDeleteMaterialHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Material ID is required');
    }
    await trainingService.hardDeleteMaterial(id as string);
    res.status(200).json({ message: 'Training material permanently deleted' });
  } catch (err) {
    next(err);
  }
}