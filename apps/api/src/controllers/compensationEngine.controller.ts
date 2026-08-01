import { Request, Response, NextFunction } from 'express';
import * as engine from '../services/compensationEngine.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function listStarRanksHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await engine.listStarRanks());
  } catch (err) {
    next(err);
  }
}

export async function getMyV1SnapshotHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const month = req.query['month'] as string | undefined;
    res.status(200).json(await engine.getMyCompensationSnapshotV1(req.user.id, month));
  } catch (err) {
    next(err);
  }
}

export async function runMonthlyV1JobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { period } = req.body as { period: string };
    if (!period) throw new ApiError(400, 'period is required (YYYY-MM)');
    res.status(200).json(await engine.runMonthlyCompensationJob(period));
  } catch (err) {
    next(err);
  }
}

export async function listPendingNetworkBonusesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await engine.listPendingNetworkBonuses());
  } catch (err) {
    next(err);
  }
}

export async function approveNetworkBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Bonus ID is required');
    await engine.approveNetworkBonus(id, req.user.id);
    res.status(200).json({ message: 'Network bonus approved and wallet credited' });
  } catch (err) {
    next(err);
  }
}

export async function rejectNetworkBonusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const id = req.params['id'] as string;
    if (!id) throw new ApiError(400, 'Bonus ID is required');
    await engine.rejectNetworkBonus(id, req.user.id);
    res.status(200).json({ message: 'Network bonus rejected' });
  } catch (err) {
    next(err);
  }
}

export async function runPayoutBatchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new ApiError(401, 'Unauthorized');
    const { period } = req.body as { period: string };
    if (!period) throw new ApiError(400, 'period is required (YYYY-MM)');
    res.status(200).json(await engine.runPayoutBatch(period, req.user.id));
  } catch (err) {
    next(err);
  }
}
