// Load & validate env vars FIRST — before any other import that might use them.
import './config/env.js';
import app from './app.js';
import { env } from './config/env.js';
const port = env.PORT;
app.listen(port, () => {
    console.log(`[api] 🚀  Server running on http://localhost:${port}`);
    console.log(`[api]     Environment: ${env.NODE_ENV}`);
    console.log(`[api]     Health: http://localhost:${port}/health`);
});
//# sourceMappingURL=server.js.map