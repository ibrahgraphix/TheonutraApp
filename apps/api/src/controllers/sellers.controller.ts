import { Request, Response, NextFunction } from 'express';
import * as sellersService from '../services/sellers.service.js';
import { CreateSellerInput, ResetPasswordInput } from '../schemas/sellers.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function createSellerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as CreateSellerInput;
    const adminUserId = req.user.id;
    const adminUserRole = req.user.role;

    const seller = await sellersService.createSeller(input, adminUserId, adminUserRole);

    res.status(201).json(seller);
  } catch (err) {
    next(err);
  }
}

export async function listSellersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const page = req.query.page ? Math.max(1, parseInt(String(req.query.page), 10)) : 1;
    const limit = req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10)) : 20;

    const sellers = await sellersService.listSellers(search, page, limit);
    res.status(200).json(sellers);
  } catch (err) {
    next(err);
  }
}

export async function getSellerByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'Seller ID is required');
    }

    const seller = await sellersService.getSellerById(id);
    res.status(200).json(seller);
  } catch (err) {
    next(err);
  }
}

export async function updateSellerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'Seller ID is required');
    }

    const input = req.body as sellersService.UpdateSellerInput;
    const seller = await sellersService.updateSeller(id, input);
    res.status(200).json(seller);
  } catch (err) {
    next(err);
  }
}

export async function resetSellerPasswordHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'Seller ID is required');
    }

    const { newPassword } = req.body as ResetPasswordInput;
    await sellersService.resetSellerPassword(id, newPassword);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

export async function deactivateSellerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'Seller ID is required');
    }

    await sellersService.deactivateSeller(id);

    res.status(200).json({ message: 'Seller deactivated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function hardDeleteSellerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      throw new ApiError(400, 'Seller ID is required');
    }

    await sellersService.hardDeleteSeller(id);

    res.status(200).json({ message: 'Seller permanently deleted' });
  } catch (err) {
    next(err);
  }
}