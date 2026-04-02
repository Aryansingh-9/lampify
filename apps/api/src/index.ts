import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import mockRoutes from "./routes/mockInterviews.js";
import pathwayRoutes from "./routes/pathways.js";
import wizardRoutes from "./routes/wizard.js";
import adminRoutes from "./routes/admin.js";
import paymentRoutes, { paymentsWebhookHandler, paymentsWebhookMiddleware } from "./routes/payments.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowed = process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? ["http://localhost:3000"];

// ✅ CORS FIRST - MOST IMPORTANT
app.use(
  cors({
    origin: allowed,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use(userRoutes);
app.use(mockRoutes);
app.use(pathwayRoutes);
app.use(wizardRoutes);
app.use(adminRoutes);

app.post("/payments/webhook", paymentsWebhookMiddleware, paymentsWebhookHandler);
app.use(paymentRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});
