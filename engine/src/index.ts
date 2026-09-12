import "dotenv/config";
import * as http from "http";
import { createClient } from "redis";
import { Engine } from "./trade/engine";

// Render's free tier only offers "web service" instances (background workers
// require a paid plan), and a web service must bind to $PORT and answer
// health checks. The engine itself has no HTTP API — this listener exists
// solely to satisfy that requirement so it can run as a free web service.
const HEALTH_PORT = process.env.PORT;
if (HEALTH_PORT) {
  http
    .createServer((_req, res) => res.writeHead(200).end("ok"))
    .listen(Number(HEALTH_PORT), () => {
      console.log(`🩺 Health check listener on port ${HEALTH_PORT}`);
    });
}

// --- configuration ----------------------------------------------------------

const ORDERS_STREAM = process.env.ORDERS_STREAM ?? "orders"; // stream key
const GROUP_NAME = "engine"; // consumer‑group
const CONSUMER_NAME = process.env.ENGINE_CONSUMER ?? "worker-1"; // this process
const CLAIM_IDLE_MS = 60_000; // Claim messages idle for 60 seconds
const DELAY_BEFORE_ACK_MS = Number(process.env.CRASH_TEST_DELAY_BEFORE_ACK_MS ?? 0);

// --- helpers ----------------------------------------------------------------

/**
 * Claim orphaned messages from dead consumers.
 * This ensures messages from crashed consumers are not lost.
 */
async function claimOrphanedMessages(
  client: ReturnType<typeof createClient>,
  stream: string,
  group: string,
  consumer: string
): Promise<number> {
  let claimed = 0;
  try {
    // Get pending messages for all consumers
    const pendingDetails = await client.xPendingRange(
      stream,
      group,
      "-",
      "+",
      100
    );

    for (const entry of pendingDetails) {
      // If message has been idle too long and belongs to a different consumer
      if (
        entry.millisecondsSinceLastDelivery > CLAIM_IDLE_MS &&
        entry.owner !== consumer
      ) {
        try {
          const result = await client.xClaim(
            stream,
            group,
            consumer,
            CLAIM_IDLE_MS,
            [entry.id]
          );
          if (result && result.length > 0) {
            console.log(`📥 Claimed orphaned message ${entry.id} from ${entry.owner}`);
            claimed++;
          }
        } catch (e) {
          // Message may have been ACKed or claimed by another consumer
        }
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("NOGROUP")) {
      console.error("Error claiming orphaned messages:", e);
    }
  }
  return claimed;
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const engine = new Engine();
  
  // Wait for engine to be fully recovered before processing any messages
  console.log("⏳ Waiting for engine to complete initialization...");
  await engine.waitUntilReady();
  
  const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  await redisClient.connect();
  console.log("🔌  Engine connected to Redis");

  // ensure consumer‑group exists (idempotent)
  await redisClient
    .xGroupCreate(ORDERS_STREAM, GROUP_NAME, "0", { MKSTREAM: true })
    .catch((e: any) => {
      if (!e.message.includes("BUSYGROUP")) throw e;
    });

  // Claim any orphaned messages from crashed consumers
  const orphansClaimed = await claimOrphanedMessages(
    redisClient,
    ORDERS_STREAM,
    GROUP_NAME,
    CONSUMER_NAME
  );
  if (orphansClaimed > 0) {
    console.log(`📥 Claimed ${orphansClaimed} orphaned messages`);
  }

  console.log("🔁 Draining pending (if any) for consumer:", CONSUMER_NAME);

  while (true) {
    const resp = await redisClient.xReadGroup(
      GROUP_NAME,
      CONSUMER_NAME,
      [{ key: ORDERS_STREAM, id: "0" }],
      { COUNT: 100, BLOCK: 0 }
    );
    if (!resp || resp[0].messages.length === 0) break;

    for (const msg of resp[0].messages) {
      const entryId = msg.id;
      try {
        const payload = JSON.parse(msg.message.json);
        // Pass entryId for idempotency tracking
        await engine.process({ ...payload, entryId });
        await redisClient.xAck(ORDERS_STREAM, GROUP_NAME, entryId);
      } catch (err) {
        console.error("Failed while draining pending", entryId, err);
      }
    }
  }

  console.log("✅ Engine live and processing new orders...");

  let lastOrphanCheck = Date.now();
  const ORPHAN_CHECK_INTERVAL = 30_000; // 30 seconds

  while (!isShuttingDown) {
    const response = await redisClient.xReadGroup(
      GROUP_NAME,
      CONSUMER_NAME,
      [{ key: ORDERS_STREAM, id: ">" }],
      { COUNT: 1, BLOCK: 5000 } // 5 second timeout to allow for periodic orphan claiming
    );

    // Check shutdown flag after blocking call returns
    if (isShuttingDown) break;

    // Time-based orphan check — runs even under constant load
    const now = Date.now();
    if (now - lastOrphanCheck >= ORPHAN_CHECK_INTERVAL) {
      await claimOrphanedMessages(
        redisClient,
        ORDERS_STREAM,
        GROUP_NAME,
        CONSUMER_NAME
      );
      lastOrphanCheck = now;
    }

    if (!response) continue;

    // xReadGroup always returns this nested shape:
    // [ [ streamKey, [ [ entryId, { field: value, ... } ] ] ] ]
    for (const stream of response) {
      for (const msg of stream.messages) {
        const entryId = msg.id;
        const fields = msg.message; // { json: '…' }

        try {
          const payload = JSON.parse(fields.json);

          // Pass entryId for idempotency tracking
          await engine.process({ ...payload, entryId });
          if (DELAY_BEFORE_ACK_MS > 0) {
            console.log(`⏳ CRASH_TEST: Delaying ${DELAY_BEFORE_ACK_MS}ms before ACK...`);
            await new Promise((r) => setTimeout(r, DELAY_BEFORE_ACK_MS));
          }
          await redisClient.xAck(ORDERS_STREAM, GROUP_NAME, entryId);
        } catch (err) {
          console.error("❌  Failed to handle entry", entryId, err);
          // Don't ACK - will be retried on next restart or claimed by another consumer
        }
      }
    }
  }
}

// Unhandled promise rejection handler — crash to avoid running in a corrupt state
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown handling
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  // Allow in-flight messages to complete (max 5 seconds)
  await new Promise((r) => setTimeout(r, 5000));
  console.log('👋 Engine shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  console.error("Engine crashed", err);
  process.exit(1);
});
