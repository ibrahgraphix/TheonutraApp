import * as trainingService from '../services/training.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/training/categories
 * Lists all training categories.
 */
export async function listCategoriesHandler(req, res, next) {
    try {
        const categories = await trainingService.listCategories();
        res.status(200).json(categories);
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/training/categories
 * Creates a new training category (staff only).
 */
export async function createCategoryHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const input = req.body;
        const category = await trainingService.createCategory(input, req.user.id);
        res.status(201).json(category);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PUT /api/training/categories/:id
 * Updates an existing training category (staff only).
 */
export async function updateCategoryHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Category ID is required');
        }
        const input = req.body;
        const category = await trainingService.updateCategory(id, input);
        res.status(200).json(category);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/training/categories/:id/materials
 * Lists training materials by category (active only for distributors).
 */
export async function listMaterialsByCategoryHandler(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Category ID is required');
        }
        const materials = await trainingService.listMaterialsByCategory(id);
        res.status(200).json(materials);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/training/materials/:id
 * Gets a specific training material by ID.
 */
export async function getMaterialHandler(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Material ID is required');
        }
        const material = await trainingService.getMaterial(id);
        res.status(200).json(material);
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/training/materials
 * Creates a new training material (staff only).
 */
export async function createMaterialHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const input = req.body;
        const material = await trainingService.createMaterial(input, req.user.id);
        res.status(201).json(material);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PUT /api/training/materials/:id
 * Updates an existing training material (staff only).
 */
export async function updateMaterialHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Material ID is required');
        }
        const input = req.body;
        const material = await trainingService.updateMaterial(id, input);
        res.status(200).json(material);
    }
    catch (err) {
        next(err);
    }
}
/**
 * DELETE /api/training/materials/:id
 * Deactivates a training material (soft delete, staff only).
 */
export async function deactivateMaterialHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Material ID is required');
        }
        await trainingService.deactivateMaterial(id);
        res.status(200).json({ message: 'Training material deactivated successfully' });
    }
    catch (err) {
        next(err);
    }
}
/**
 * DELETE /api/training/materials/:id/permanent
 * Permanently deletes a training material AND its Cloudinary PDF (staff only).
 */
export async function hardDeleteMaterialHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Material ID is required');
        }
        await trainingService.hardDeleteMaterial(id);
        res.status(200).json({ message: 'Training material permanently deleted' });
    }
    catch (err) {
        next(err);
    }
}
/**
 * DELETE /api/training/categories/:id
 * Permanently deletes a category. Blocked if it still has materials. Staff only.
 */
export async function deleteCategoryHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const { id } = req.params;
        if (!id || Array.isArray(id)) {
            throw new ApiError(400, 'Category ID is required');
        }
        await trainingService.deleteCategory(id);
        res.status(200).json({ message: 'Training category deleted successfully' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=training.controller.js.map