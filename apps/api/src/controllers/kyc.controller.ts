import { Request, Response, NextFunction } from 'express';
import * as kycService from '../services/kyc.service.js';
import { SubmitKycInput, ReviewKycInput } from '../services/kyc.service.js';
import { ApiError } from '../middleware/error.middleware.js';

/**
 * POST /api/kyc/submit
 * Submits a new KYC submission for the authenticated user.
 */
export async function submitKycHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const input = req.body as SubmitKycInput;
    const submission = await kycService.submitKyc(req.user.id, input);
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/kyc/me
 * Returns the authenticated user's KYC status and latest submission.
 */
export async function getMyKycHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const status = await kycService.getMyKycStatus(req.user.id);
    const submission = await kycService.getMyKycSubmission(req.user.id);
    res.status(200).json({
      status: status.status,
      submission,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/kyc/pending
 * Returns all pending KYC submissions. Staff only.
 */
export async function listPendingKycHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const pageParam = req.query['page'];
    const limitParam = req.query['limit'];
    const page = parseInt(Array.isArray(pageParam) ? pageParam[0] : String(pageParam || '1'), 10) || 1;
    const limit = parseInt(Array.isArray(limitParam) ? limitParam[0] : String(limitParam || '20'), 10) || 20;
    const result = await kycService.listPendingKyc(page, limit);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/kyc/:id
 * Returns a specific KYC submission by ID. Staff only.
 */
export async function getKycSubmissionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Submission ID is required');
    }
    const submission = await kycService.getKycSubmissionById(id as string);
    res.status(200).json(submission);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/kyc/:id/review
 * Reviews a KYC submission (approve/reject/request resubmission). Staff only.
 */
export async function reviewKycHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.params;
    if (!id || Array.isArray(id)) {
      throw new ApiError(400, 'Submission ID is required');
    }
    const input = req.body as ReviewKycInput;
    await kycService.reviewKyc(req.user.id, id as string, input);
    res.status(200).json({ message: 'KYC review completed successfully' });
  } catch (err) {
    next(err);
  }
}
