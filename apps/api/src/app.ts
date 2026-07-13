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
//  app.use('/api/analytics', authMiddleware, analyticsRouter);                // Step 7
//  app.use('/api/account',   authMiddleware, accountRouter);                  // Step 7
//  app.use('/api/articles',  authMiddleware, articlesRouter);                 // Step 8
//  app.use('/api/news',      authMiddleware, newsRouter);                     // Step 8

// ── Centralised error handler (must be last) ──────────────────────────────────

app.use(errorMiddleware);

export default app;
