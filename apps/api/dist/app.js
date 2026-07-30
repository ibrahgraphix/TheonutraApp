import express from 'express';
import cors from 'cors';
import { errorMiddleware } from './middleware/error.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { requireStaff } from './middleware/requireStaff.middleware.js';
import authRouter from './routes/auth.routes.js';
import sellersRouter from './routes/sellers.routes.js';
import countriesRouter from './routes/countries.routes.js';
import productsRouter from './routes/products.routes.js';
import teamRouter from './routes/team.routes.js';
import ordersRouter from './routes/orders.routes.js';
import paymentsRouter from './routes/payments.routes.js';
import commissionsRouter from './routes/commissions.routes.js';
import analyticsRouter from './routes/analytics.routes.js';
import accountRouter from './routes/account.routes.js';
import articlesRouter from './routes/articles.routes.js';
import newsRouter from './routes/news.routes.js';
import uploadsRouter from './routes/uploads.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import ranksRouter from './routes/ranks.routes.js';
import customerSalesRouter from './routes/customerSales.routes.js';
import teamBonusRouter from './routes/teamBonus.routes.js';
import walletRouter from './routes/wallet.routes.js';
import manualBonusRouter from './routes/manualBonus.routes.js';
import kycRouter from './routes/kyc.routes.js';
import referralRouter from './routes/referral.routes.js';
import notificationRouter from './routes/notification.routes.js';
import trainingRouter from './routes/training.routes.js';
import eventsRouter from './routes/events.routes.js';
import loyaltyRouter from './routes/loyalty.routes.js';
import auditLogRouter from './routes/auditLog.routes.js';
import analyticsAdminRoutes from './routes/analyticsAdmin.routes.js';
const app = express();
// ── Core middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
// ── Health check (unauthenticated — used by load balancers / CI smoke tests) ──
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/sellers', authMiddleware, requireStaff, sellersRouter);
app.use('/api/countries', countriesRouter); // per-route auth inside the router
app.use('/api/products', productsRouter); // per-route auth inside the router
app.use('/api/team', authMiddleware, teamRouter); // Step 5
app.use('/api/orders', ordersRouter); // Step 6 — auth inside router
app.use('/api/payments', paymentsRouter); // Step 6 — auth inside router
app.use('/api/commissions', commissionsRouter); // Step 7 — auth inside router
app.use('/api/analytics', analyticsRouter); // Step 8 — auth inside router
app.use('/api/account', accountRouter); // Step 8 — auth inside router
app.use('/api/articles', articlesRouter); // Step 9 — auth inside router
app.use('/api/news', newsRouter); // Step 9 — auth inside router
app.use('/api/uploads', uploadsRouter); // Step 9 — auth inside router
app.use('/api/dashboard', dashboardRouter); // Step 10 — auth inside router
app.use('/api/ranks', ranksRouter); // Step 12 — auth inside router
app.use('/api/customer-sales', customerSalesRouter); // Step 13 — auth inside router
app.use('/api/team-bonus', teamBonusRouter); // Step 14 — auth inside router
app.use('/api/wallet', walletRouter); // Step 15 — auth inside router
app.use('/api/manual-bonuses', manualBonusRouter); // Step 16 — auth inside router
app.use('/api/kyc', kycRouter); // Step 17 — auth inside router
app.use('/api/referral', referralRouter); // Step 18 — auth inside router
app.use('/api/notifications', notificationRouter); // Step 19 — auth inside router
app.use('/api/training', trainingRouter); // Step 20 — auth inside router
app.use('/api/events', eventsRouter); // Step 21 — auth inside router
app.use('/api/loyalty', loyaltyRouter); // Step 22 — auth inside router
app.use('/api/audit-log', auditLogRouter); // Step 22 — auth inside router
app.use('/api/analytics/admin', analyticsAdminRoutes); //More steps
// ── Centralised error handler (must be last) ──────────────────────────────────
app.use(errorMiddleware);
export default app;
//# sourceMappingURL=app.js.map