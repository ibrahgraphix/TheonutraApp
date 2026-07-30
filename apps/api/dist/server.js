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
    }
    catch (err) {
        console.error(`[Cron] Requalification failed:`, err);
    }
});
//# sourceMappingURL=server.js.map