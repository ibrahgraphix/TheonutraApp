import * as countriesService from '../services/countries.service.js';
import { ApiError } from '../middleware/error.middleware.js';
/**
 * GET /api/countries
 * Returns all active countries. Any authenticated user can call this.
 */
export async function listCountriesHandler(_req, res, next) {
    try {
        const countries = await countriesService.listCountries();
        res.status(200).json(countries);
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/countries
 * Creates a new country. Staff only.
 */
export async function createCountryHandler(req, res, next) {
    try {
        const input = req.body;
        const country = await countriesService.createCountry(input);
        res.status(201).json(country);
    }
    catch (err) {
        next(err);
    }
}
/**
 * PATCH /api/countries/:id
 * Updates a country. Staff only.
 */
export async function updateCountryHandler(req, res, next) {
    try {
        const id = req.params['id'];
        if (!id) {
            throw new ApiError(400, 'Country ID is required');
        }
        const input = req.body;
        const country = await countriesService.updateCountry(id, input);
        res.status(200).json(country);
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=countries.controller.js.map