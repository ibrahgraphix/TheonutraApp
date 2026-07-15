import * as productsService from '../services/products.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/products?countryId=<uuid>
 * Returns all active products priced for the given country.
 */
export async function listProductsByCountryHandler(req, res, next) {
    try {
        const countryId = req.query['countryId'];
        if (!countryId) {
            throw new ApiError(400, 'countryId query parameter is required');
        }
        const products = await productsService.getProductsByCountry(countryId);
        res.status(200).json(products);
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/products/:id?countryId=<uuid>
 * Returns a single product with price for the given country.
 */
export async function getProductByIdHandler(req, res, next) {
    try {
        const id = req.params['id'];
        const countryId = req.query['countryId'];
        if (!id) {
            throw new ApiError(400, 'Product ID is required');
        }
        if (!countryId) {
            throw new ApiError(400, 'countryId query parameter is required');
        }
        const product = await productsService.getProductById(id, countryId);
        res.status(200).json(product);
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/products
 * Creates a product with per-country pricing. Staff only.
 */
export async function createProductHandler(req, res, next) {
    try {
        if (!req.user) {
            throw new ApiError(401, 'Unauthorized');
        }
        const input = req.body;
        const product = await productsService.createProduct(input, req.user.id);
        res.status(201).json(product);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PATCH /api/products/:id
 * Updates product fields and/or upserts price rows. Staff only.
 */
export async function updateProductHandler(req, res, next) {
    try {
        const id = req.params['id'];
        if (!id) {
            throw new ApiError(400, 'Product ID is required');
        }
        const input = req.body;
        const product = await productsService.updateProduct(id, input);
        res.status(200).json(product);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PATCH /api/products/:id/deactivate
 * Soft-deletes a product. Staff only.
 */
export async function deactivateProductHandler(req, res, next) {
    try {
        const id = req.params['id'];
        if (!id) {
            throw new ApiError(400, 'Product ID is required');
        }
        await productsService.deactivateProduct(id);
        res.status(200).json({ message: 'Product deactivated successfully' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=products.controller.js.map