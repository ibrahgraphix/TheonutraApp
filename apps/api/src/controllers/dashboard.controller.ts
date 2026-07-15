/**
 * src/controllers/dashboard.controller.ts
 *
 * Dashboard Controllers for Step 10
 * Handles admin dashboard summary and payment detail requests.
 */

import { Request, Response } from 'express';
import { getAdminDashboardSummary, getPendingPaymentDetail } from '../services/dashboard.service.js';

export async function getDashboardSummaryHandler(req: Request, res: Response) {
  try {
    const summary = await getAdminDashboardSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch dashboard summary' });
  }
}

export async function getPendingPaymentDetailHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const paymentId = Array.isArray(id) ? id[0] : id;
    const detail = await getPendingPaymentDetail(paymentId);
    res.json(detail);
  } catch (error) {
    const status = (error as any)?.status || 500;
    const message = error instanceof Error ? error.message : 'Failed to fetch payment detail';
    res.status(status).json({ error: message });
  }
}
