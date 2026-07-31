import { Request, Response, NextFunction } from 'express';
import * as customerSalesService from '../services/customerSales.service.js';
import { LogCustomerSaleInput } from '../schemas/customerSales.schema.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * POST /api/customer-sales
 * Logs a customer sale for the authenticated distributor.
 */
export async function logCustomerSaleHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const input = req.body as LogCustomerSaleInput;
    const sale = await customerSalesService.logCustomerSale(req.user.id, input);
    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/customer-sales?page=1&limit=20
 * Returns paginated list of customer sales for the authenticated distributor.
 */
export async function listMyCustomerSalesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = parseInt(req.query['limit'] as string, 10) || 20;

    const result = await customerSalesService.listMyCustomerSales(req.user.id, page, limit);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/customer-sales/summary?month=2024-01
 * Returns summary of retail profit and PV from customer sales for the authenticated distributor.
 */
export async function getMyCustomerSalesSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const month = req.query['month'] as string | undefined;
    const summary = await customerSalesService.getMyCustomerSalesSummary(req.user.id, month);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/customer-sales/retail-profit-report?month=2024-01
 * Returns detailed retail profit report for the authenticated distributor.
 * Report-only - does not affect wallet balance.
 */
export async function getRetailProfitReportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const month = req.query['month'] as string | undefined;
    const report = await customerSalesService.getRetailProfitReport(req.user.id, month);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}
