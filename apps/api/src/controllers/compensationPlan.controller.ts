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

export async function listPendingCommissionsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(200).json(await compensationService.listPendingCommissions()); } catch (err) { next(err); }
}

export async function approveCommissionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Commission ID is required');
    await compensationService.approveCommission(id, req.user.id);
    res.status(200).json({ message: 'Commission approved and wallet credited' });
  } catch (err) { next(err); }
}

export async function rejectCommissionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Commission ID is required');
    await compensationService.rejectCommission(id, req.user.id);
    res.status(200).json({ message: 'Commission rejected' });
  } catch (err) { next(err); }
}

export async function listPendingLeadershipBonusesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(200).json(await compensationService.listPendingLeadershipBonuses()); } catch (err) { next(err); }
}

export async function approveLeadershipBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Leadership bonus ID is required');
    await compensationService.approveLeadershipBonus(id, req.user.id);
    res.status(200).json({ message: 'Leadership bonus approved and wallet credited' });
  } catch (err) { next(err); }
}

export async function rejectLeadershipBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Leadership bonus ID is required');
    await compensationService.rejectLeadershipBonus(id, req.user.id);
    res.status(200).json({ message: 'Leadership bonus rejected' });
  } catch (err) { next(err); }
}

export async function listPendingRankBonusesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.status(200).json(await compensationService.listPendingRankBonuses()); } catch (err) { next(err); }
}

export async function approveRankBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Rank bonus ID is required');
    await compensationService.approveRankBonus(id, req.user.id);
    res.status(200).json({ message: 'Rank bonus approved and wallet credited' });
  } catch (err) { next(err); }
}

export async function rejectRankBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Rank bonus ID is required');
    await compensationService.rejectRankBonus(id, req.user.id);
    res.status(200).json({ message: 'Rank bonus rejected' });
  } catch (err) { next(err); }
}