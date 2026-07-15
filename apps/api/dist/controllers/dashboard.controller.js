/**
 * src/controllers/dashboard.controller.ts
 *
 * Dashboard Controllers for Step 10
 * Handles admin dashboard summary and payment detail requests.
 */
import { getAdminDashboardSummary, getPendingPaymentDetail } from '../services/dashboard.service.js';
export async function getDashboardSummaryHandler(req, res) {
    try {
        const summary = await getAdminDashboardSummary();
        res.json(summary);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch dashboard summary' });
    }
}
export async function getPendingPaymentDetailHandler(req, res) {
    try {
        const { id } = req.params;
        const paymentId = Array.isArray(id) ? id[0] : id;
        const detail = await getPendingPaymentDetail(paymentId);
        res.json(detail);
    }
    catch (error) {
        const status = error?.status || 500;
        const message = error instanceof Error ? error.message : 'Failed to fetch payment detail';
        res.status(status).json({ error: message });
    }
}
//# sourceMappingURL=dashboard.controller.js.map