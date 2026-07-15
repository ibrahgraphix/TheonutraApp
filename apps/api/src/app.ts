import express, { Request, Response } from 'express';
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

const app = express();

// ── Core middleware ────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Health check (unauthenticated — used by load balancers / CI smoke tests) ──

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/sellers', authMiddleware, requireStaff, sellersRouter);
app.use('/api/countries', countriesRouter);   // per-route auth inside the router
app.use('/api/products',  productsRouter);    // per-route auth inside the router

app.use('/api/team',      authMiddleware, teamRouter);      // Step 5
app.use('/api/orders',    ordersRouter);                   // Step 6 — auth inside router
app.use('/api/payments',  paymentsRouter);                 // Step 6 — auth inside router
app.use('/api/commissions', commissionsRouter);             // Step 7 — auth inside router
app.use('/api/analytics', analyticsRouter);                 // Step 8 — auth inside router
app.use('/api/account',   accountRouter);                   // Step 8 — auth inside router
app.use('/api/articles',  articlesRouter);                  // Step 9 — auth inside router
app.use('/api/news',      newsRouter);                      // Step 9 — auth inside router
app.use('/api/uploads',   uploadsRouter);                   // Step 9 — auth inside router
app.use('/api/dashboard',  dashboardRouter);                 // Step 10 — auth inside router

// ── Centralised error handler (must be last) ──────────────────────────────────

app.use(errorMiddleware);

export default app;
