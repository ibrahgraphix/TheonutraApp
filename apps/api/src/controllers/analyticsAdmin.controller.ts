import { Request, Response, NextFunction } from 'express';
import * as analyticsAdminService from '../services/analyticsAdmin.service.js';

export async function getCompanyOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const overview = await analyticsAdminService.getCompanyOverview();
    res.status(200).json(overview);
  } catch (err) {
    next(err);
  }
}

export async function getCountryPerformanceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const performance = await analyticsAdminService.getCountryPerformance();
    res.status(200).json(performance);
  } catch (err) {
    next(err);
  }
}

export async function getProductPerformanceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const performance = await analyticsAdminService.getProductPerformance();
    res.status(200).json(performance);
  } catch (err) {
    next(err);
  }
}