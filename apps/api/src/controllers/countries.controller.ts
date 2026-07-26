import { Request, Response, NextFunction } from 'express';
import * as countriesService from '../services/countries.service.js';
import { CreateCountryInput, UpdateCountryInput } from '../schemas/catalog.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * GET /api/countries
 * Returns all active countries. Any authenticated user can call this.
 */
export async function listCountriesHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const countries = await countriesService.listCountries();
    res.status(200).json(countries);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/countries
 * Creates a new country. Admin only.
 */
export async function createCountryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as CreateCountryInput;
    const country = await countriesService.createCountry(input);
    res.status(201).json(country);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/countries/:id
 * Updates a country. Staff only.
 */
export async function updateCountryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'];
    if (!id) {
      throw new ApiError(400, 'Country ID is required');
    }

    const input = req.body as UpdateCountryInput;
    const country = await countriesService.updateCountry(id, input);
    res.status(200).json(country);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/countries/:id/deactivate
 * Soft-deactivates a country. Blocked if profiles/products still reference
 * it. Staff only.
 */
export async function deactivateCountryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params['id'];
    if (!id) {
      throw new ApiError(400, 'Country ID is required');
    }

    await countriesService.deactivateCountry(id);
    res.status(200).json({ message: 'Country deactivated successfully' });
  } catch (err) {
    next(err);
  }
}