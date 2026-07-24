import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requireStaff } from '../middleware/requireStaff.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { RequestWithdrawalSchema } from '../schemas/wallet.schema.js';
import { getMyWalletHandler, getMyTransactionsHandler, requestWithdrawalHandler, getMyWithdrawalsHandler, getAllWithdrawalsHandler, approveWithdrawalHandler, rejectWithdrawalHandler, markWithdrawalPaidHandler, } from '../controllers/wallet.controller.js';
const router = Router();
// Base wallet routes for authenticated users
router.use(authMiddleware);
// GET /api/wallet/me — my balance + recent transactions
router.get('/me', getMyWalletHandler);
// GET /api/wallet/transactions — my paginated transactions ledger
router.get('/transactions', getMyTransactionsHandler);
// POST /api/wallet/withdrawals — request a withdrawal
router.post('/withdrawals', validate(RequestWithdrawalSchema), requestWithdrawalHandler);
// GET /api/wallet/withdrawals — my own withdrawal requests history
router.get('/withdrawals', getMyWithdrawalsHandler);
// Staff-only routes
// GET /api/wallet/withdrawals/all — list all requests (optional status filter)
router.get('/withdrawals/all', requireStaff, getAllWithdrawalsHandler);
// PUT /api/wallet/withdrawals/:id/approve — approve request
router.put('/withdrawals/:id/approve', requireStaff, approveWithdrawalHandler);
// PUT /api/wallet/withdrawals/:id/reject — reject request
router.put('/withdrawals/:id/reject', requireStaff, rejectWithdrawalHandler);
// PUT /api/wallet/withdrawals/:id/mark-paid — mark approved request as paid
router.put('/withdrawals/:id/mark-paid', requireStaff, markWithdrawalPaidHandler);
export default router;
//# sourceMappingURL=wallet.routes.js.map