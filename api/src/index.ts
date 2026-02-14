import "dotenv/config";
import express from "express";
import cors from "cors";
import orderRoutes from "./routes/orderRoutes";
import tickerRoutes from "./routes/tickerRoutes";
import tradeRoutes from "./routes/tradeRoutes";
import klineRoutes from "./routes/klineRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import balanceRoutes from "./routes/balanceRoutes";
import { RedisManager } from "./RedisManager";

// Unhandled promise rejection handler — crash to avoid running in a corrupt state
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();

app.use(
  cors({
    origin: "*", // Allows requests from any origin, change '*' to specific domains for security
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
    allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"], // Allowed headers
  })
);

app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/health", async (_req: any, res: any) => {
  try {
    const redisHealthy = await RedisManager.getInstance().isHealthy();
    if (redisHealthy) {
      res.send({ status: "ok", redis: "connected" });
    } else {
      res.status(503).send({ status: "degraded", redis: "disconnected" });
    }
  } catch {
    res.status(503).send({ status: "error" });
  }
});

app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/ticker", tickerRoutes);
app.use("/api/v1/trades", tradeRoutes);
app.use("/api/v1/klines", klineRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/balance", balanceRoutes);

const server = app.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 API Server: Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    console.log('👋 API Server: Shutdown complete');
    process.exit(0);
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('API Server: Force shutdown after timeout');
    process.exit(0);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
