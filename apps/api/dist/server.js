import cors from "cors";
import express from "express";
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map