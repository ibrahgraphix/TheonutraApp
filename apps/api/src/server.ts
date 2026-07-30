// Load & validate env vars FIRST — before any other import that might use them.
import './config/env.js';

import app from './app.js';
import { env } from './config/env.js';
import cron from 'node-cron';
import { runMonthlyRequalification } from './services/compensationPlan.service.js';

const port = env.PORT;

app.listen(port, () => {
  console.log(`[api] 🚀  Server running on http://localhost:${port}`);
  console.log(`[api]     Environment: ${env.NODE_ENV}`);
  console.log(`[api]     Health: http://localhost:${port}/health`);
});

// Runs at 00:05 on the 1st of every month (server timezone — confirm this
// matches your target timezone, e.g. set TZ=Africa/Dar_es_Salaam in Render's
// environment variables if needed).
cron.schedule('5 0 1 * *', async () => {
  const now = new Date();
  const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  console.log(`[Cron] Running monthly requalification for period ${period}`);
  try {
    const result = await runMonthlyRequalification(period);
    console.log(`[Cron] Requalification complete:`, result);
  } catch (err) {
    console.error(`[Cron] Requalification failed:`, err);
  }
});

// ── Keep-alive self-ping (production only) ────────────────────────────────────
// Render's free tier sleeps after 15 min of inactivity, which would silently
// kill the monthly cron above. This pings /health every 10 min to stay awake.
if (env.NODE_ENV === 'production') {
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
  cron.schedule('*/10 * * * *', async () => {
    try {
      const res = await fetch(`${RENDER_URL}/health`);
      console.log(`[KeepAlive] Pinged ${RENDER_URL}/health — ${res.status}`);
    } catch (err) {
      console.error(`[KeepAlive] Ping failed:`, err);
    }
  });
  console.log(`[api] ⏰  Keep-alive ping scheduled every 10 min → ${RENDER_URL}/health`);
}
