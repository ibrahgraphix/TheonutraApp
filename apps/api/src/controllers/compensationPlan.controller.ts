import { Request, Response, NextFunction } from 'express';
import * as compensationService from '../services/compensationPlan.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function listActiveStatusRanksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(200).json(await compensationService.listActiveStatusRanks()); } catch (err) { next(err); }
}

export async function listLeadershipRanksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(200).json(await compensationService.listLeadershipRanks()); } catch (err) { next(err); }
}

export async function getMyCompensationSnapshotHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const month = req.query['month'] as string | undefined;
    const snapshot = await compensationService.getDistributorCompensationSnapshot(req.user.id, month);
    res.status(200).json(snapshot);
  } catch (err) { next(err); }
}

export async function runMonthlyRequalificationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { period } = req.body as { period: string };
    if (!period) throw new ApiError(400, 'period is required (format: YYYY-MM)');
    const result = await compensationService.runMonthlyRequalification(period);
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function listPendingOPBBonusesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(200).json(await compensationService.listPendingOPBBonuses()); } catch (err) { next(err); }
}

export async function approveOPBBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'OPB bonus ID is required');
    await compensationService.approveOPBBonus(id, req.user.id);
    res.status(200).json({ message: 'OPB bonus approved and wallet credited' });
  } catch (err) { next(err); }
}

export async function rejectOPBBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'OPB bonus ID is required');
    await compensationService.rejectOPBBonus(id, req.user.id);
    res.status(200).json({ message: 'OPB bonus rejected' });
  } catch (err) { next(err); }
}