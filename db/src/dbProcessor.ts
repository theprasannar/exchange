//@ts-nocheck
import { createClient } from "redis";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Unhandled promise rejection handler — crash to avoid running in a corrupt state
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLAIM_IDLE_MS = 60_000; // Claim messages idle for 60 seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Event {
  id: string; // stream entry ID (1690…‑0)
  type: string; // ORDER_CREATE | TRADE_EXECUTED | …
  data: any; // payload from the engine
  timestamp: number; // millis
  retryCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUnique(e: unknown): boolean {
  return (
    //@ts-ignore
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// Per‑event transaction wrapper
// ---------------------------------------------------------------------------

async function safeProcess(event: Event): Promise<void> {
  const eventId = event.id;
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      // ── Idempotency guard: skip if already processed ──────────
      // This MUST be checked BEFORE any balance mutations.
      // Without this early-return, a crash between "commit" and "ACK"
      // causes the PEL replay to re-apply balance changes (double-decrement).
      //@ts-ignore
      const already = await tx.processedEvent.findUnique({
        where: { id: eventId },
      });
      if (already) {
        console.log(`DB-Processor: skipping already-processed event ${eventId}`);
        return; // nothing to do — previous run committed this event
      }

      await processEventWithTx(event, tx);

      // mark processed
      //@ts-ignore
      await tx.processedEvent.create({ data: { id: eventId } });
    },
    { isolationLevel: "Serializable" }
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

async function processEventWithTx(
  event: Event,
  tx: Prisma.TransactionClient
): Promise<void> {
  switch (event.type) {
    case "ORDER_CREATE":
      await processOrderCreate(event.data, tx, event.id);
      break;
    case "DEPOSIT":
      await processDeposit(event.data, tx);
      break;
    case "TRADE_EXECUTED":
      await processTradeExecuted(event.data, tx, event.id);
      break;
    case "TRADE_FILL":
      await processTradeFill(event.data, tx);
      break;
    case "ORDER_UPDATE":
      await processOrderUpdate(event.data, tx);
      break;
    case "ORDERBOOK_SNAPSHOT":
      // snapshots are ignored by DB writer
      break;
    case "BALANCE_LOCK":
      await processBalanceLock(event.data, tx);
      break;
    case "BALANCE_UNLOCK":
      await processBalanceUnlock(event.data, tx);
      break;
    case "ORDER_CANCEL":
      await processOrderCancel(event.data, tx);
      break;
    case "BALANCE_MISMATCH":
      //@ts-ignore
      await tx.balanceMismatch.create({
        data: {
          eventId: event.id,
          userId: event.data.userId,
          asset: event.data.asset,
          ledgerAvail: BigInt(event.data.ledgerAvail),
          walletAvail: BigInt(event.data.walletAvail),
          diffAvail: BigInt(event.data.diffAvail),
          ledgerLocked: BigInt(event.data.ledgerLocked),
          walletLocked: BigInt(event.data.walletLocked),
          diffLocked: BigInt(event.data.diffLocked),
        },
      });
      break;
    default:
      console.warn("DB‑Processor: Unknown event type", event.type);
  }
}

async function processOrderCancel(
  d: any,
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.order.update({
    where: { id: d.orderId },
    data: { status: "CANCELLED" },
  });
  console.log("DB‑Processor: order cancelled", d.orderId);
}

// ---------------------------------------------------------------------------
// Handlers (all use the scoped `tx`)
// ---------------------------------------------------------------------------

async function processOrderCreate(
  d: any,
  tx: Prisma.TransactionClient,
  eventId: string
): Promise<void> {
  try {
    await tx.order.create({
      data: {
        eventId: eventId, // UNIQUE
        id: d.orderId,
        userId: d.userId,
        market: d.market,
        side: d.side,
        price: BigInt(d.price),
        quantity: BigInt(d.quantity),
        filled: 0n,
        status: "PENDING",
      },
    });
    console.log("DB‑Processor: order created", d.orderId);
  } catch (e) {
    if (isUnique(e)) return; // idempotent replay
    throw e;
  }
}

async function processDeposit(
  d: any,
  tx: Prisma.TransactionClient
): Promise<void> {
  if (d.asset !== "USDC") {
    console.warn("DB‑Processor: unsupported asset", d.asset);
    return;
  }
  await tx.user.update({
    where: { id: d.userId },
    data: { usdcBalance: { increment: BigInt(d.amount) } },
  });
  console.log("DB‑Processor: deposit", d.userId, d.amount);
}

async function processTradeExecuted(
  d: any,
  tx: Prisma.TransactionClient,
  eventId: string
): Promise<void> {
  const tradeId = Number(d.tradeId ?? d.id);

  try {
    await tx.trade.create({
      data: {
        eventId: d.eventId ?? eventId, // UNIQUE per stream message
        tradeId,
        market: d.market,
        price: BigInt(d.price),
        quantity: BigInt(d.quantity),
        quoteQuantity: BigInt(d.quoteQuantity),
        isBuyerMaker: d.isBuyerMaker,
        timestamp: new Date(d.timestamp),
        makerOrderId: d.makerOrderId ?? null,
        takerOrderId: d.takerOrderId ?? null,
        makerUserId: d.makerUserId ?? null,
        takerUserId: d.takerUserId ?? null,
      },
    });
    console.log("DB‑Processor: trade exec", tradeId);
  } catch (e) {
    if (isUnique(e)) return;
    throw e;
  }
}

async function processOrderUpdate(
  d: any,
  tx: Prisma.TransactionClient
): Promise<void> {
  const existing = await tx.order.findUnique({ where: { id: d.orderId } });
  if (!existing) {
    console.warn("DB‑Processor: order not found", d.orderId);
    return;
  }

  const delta = BigInt(d.executedQty);
  const newFilled = existing.filled + delta;

  const status =
    newFilled === 0n
      ? "PENDING"
      : newFilled === existing.quantity
      ? "FILLED"
      : "PARTIALLY_FILLED";

  await tx.order.update({
    where: { id: d.orderId },
    data: { filled: newFilled, status },
  });

  console.log("DB‑Processor: order updated", d.orderId);
}

async function processTradeFill(
  d: any,
  tx: Prisma.TransactionClient
): Promise<void> {
  const buyId = d.buyUserId;
  const sellId = d.sellUserId;
  const qty = BigInt(d.qty);
  const quote = BigInt(d.quote);

  await Promise.all([
    tx.user.update({
      where: { id: buyId },
      data: {
        usdcLocked: { decrement: quote },
        btcBalance: { increment: qty },
      },
    }),
    tx.user.update({
      where: { id: sellId },
      data: {
        btcLocked: { decrement: qty },
        usdcBalance: { increment: quote },
      },
    }),
  ]);
  console.log("DB‑Processor: TRADE_FILL", buyId, sellId, qty.toString());
}

async function processBalanceLock(d: any, tx: Prisma.TransactionClient) {
  const amt = BigInt(d.amount);
  const col = d.asset.toLowerCase();
  await tx.user.update({
    where: { id: d.userId },
    data: {
      [`${col}Locked`]: { increment: amt },
      [`${col}Balance`]: { decrement: amt },
    },
  });
}

async function processBalanceUnlock(d: any, tx: Prisma.TransactionClient) {
  const amt = BigInt(d.amount);
  const col = d.asset.toLowerCase();
  await tx.user.update({
    where: { id: d.userId },
    data: {
      [`${col}Locked`]: { decrement: amt },
      [`${col}Balance`]: { increment: amt },
    },
  });
}

async function pushToDeadLetterQueue(
  client: ReturnType<typeof createClient>,
  stream: string,
  msgId: string,
  rawJson: string
): Promise<void> {
  // Use a stream for DLQ to keep IDs & timestamps (can be a list if you prefer)
  await client.xAdd("dead:ledger", "*", { stream, id: msgId, json: rawJson });
  console.error("DB-Processor: sent to DLQ", stream, msgId);
}

/**
 * Claim orphaned messages from dead consumers.
 * This ensures messages from crashed DB processor instances are not lost.
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
      // node-redis types: entry.owner (not entry.consumer)
      const entryOwner = (entry as any).owner ?? (entry as any).consumer ?? 'unknown';
      if (
        entry.millisecondsSinceLastDelivery > CLAIM_IDLE_MS &&
        entryOwner !== consumer
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
            console.log(`📥 DB-Processor: Claimed orphaned message ${entry.id} from ${entryOwner}`);
            claimed++;
          }
        } catch (e) {
          // Message may have been ACKed or claimed by another consumer
        }
      }
    }
  } catch (e: any) {
    if (!e.message?.includes("NOGROUP")) {
      console.error("DB-Processor: Error claiming orphaned messages:", e);
    }
  }
  return claimed;
}

async function consumeStreams(): Promise<void> {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();

  const GROUP = "ledger-writer";
  const CONSUMER = process.env.DBW_CONSUMER ?? "lw-1";
  const STREAMS = ["events", "sidefx"];
  const MAX_ATTEMPTS = 5;
  const DELAY_BEFORE_ACK_MS = Number(process.env.CRASH_TEST_DELAY_BEFORE_ACK_MS ?? 0);

  // Ensure groups exist
  for (const s of STREAMS) {
    try {
      await client.xGroupCreate(s, GROUP, "0", { MKSTREAM: true });
    } catch (e: any) {
      if (!String(e.message).includes("BUSYGROUP")) throw e;
    }
  }

  // Claim orphaned messages from dead consumers BEFORE draining
  console.log(`DB-Processor ${CONSUMER}: Checking for orphaned messages...`);
  for (const s of STREAMS) {
    const claimed = await claimOrphanedMessages(client, s, GROUP, CONSUMER);
    if (claimed > 0) {
      console.log(`📥 DB-Processor: Claimed ${claimed} orphaned messages from ${s}`);
    }
  }

  // Helper: drain all pending messages for THIS consumer on a given stream
  async function drainPending(stream: string): Promise<number> {
    let processed = 0;
    while (true) {
      const resp = await client.xReadGroup(
        GROUP,
        CONSUMER,
        [{ key: stream, id: "0" }],
        { COUNT: 100, BLOCK: 0 }
      );
      if (!resp || resp[0].messages.length === 0) break;

      for (const msg of resp[0].messages) {
        const rawJson = String((msg.message as any).json ?? "{}");
        try {
          const evt: Event = JSON.parse(rawJson);
          evt.id ||= msg.id;
          await safeProcess(evt); // ← write to DB
          await client.xAck(stream, GROUP, msg.id); // ← ACK on success
          processed++;
        } catch (err: any) {
          // Idempotency: treat unique violation as success
          if (
            String(err.code) === "P2002" ||
            /unique/i.test(String(err.message))
          ) {
            await client.xAck(stream, GROUP, msg.id);
            processed++;
            continue;
          }
          // Count attempts and DLQ if exceeded
          const key = `attempts:${stream}`;
          const attempts = await client.hIncrBy(key, msg.id, 1);
          if (attempts >= MAX_ATTEMPTS) {
            await pushToDeadLetterQueue(client, stream, msg.id, rawJson);
            await client.xAck(stream, GROUP, msg.id); // stop retrying
            processed++;
          } // else: leave un-ACKed to retry on next start
        }
      }
    }
    return processed;
  }

  // -------- 1) Drain pending for THIS consumer (id: "0") --------
  for (const s of STREAMS) {
    const n = await drainPending(s);
    if (n > 0) console.log(`DB-Processor: Drained ${n} pending messages from ${s}`);
  }

  console.log(`DB-Processor ${CONSUMER} live…`);

  // Track when we last checked for orphans
  let lastOrphanCheck = Date.now();
  const ORPHAN_CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

  // -------- 2) Live loop (new messages: id: ">") --------
  while (!isShuttingDown) {
    const pairs = STREAMS.map((k) => ({ key: k, id: ">" }));
    const resp = await client.xReadGroup(GROUP, CONSUMER, pairs, {
      COUNT: 100,
      BLOCK: 5000,
    });
    
    // Check shutdown flag after blocking call
    if (isShuttingDown) break;
    
    // Periodically check for orphaned messages and process them
    const now = Date.now();
    if (now - lastOrphanCheck >= ORPHAN_CHECK_INTERVAL_MS) {
      let totalClaimed = 0;
      for (const s of STREAMS) {
        totalClaimed += await claimOrphanedMessages(client, s, GROUP, CONSUMER);
      }
      // If we claimed any messages, drain them now (they're in our pending list)
      if (totalClaimed > 0) {
        for (const s of STREAMS) {
          const n = await drainPending(s);
          if (n > 0) console.log(`DB-Processor: Processed ${n} claimed messages from ${s}`);
        }
      }
      lastOrphanCheck = now;
    }

    if (!resp) continue;

    for (const stream of resp) {
      for (const msg of stream.messages) {
        const rawJson = String((msg.message as any).json ?? "{}");
        try {
          const evt: Event = JSON.parse(rawJson);
          evt.id ||= msg.id;
          await safeProcess(evt);
          if (DELAY_BEFORE_ACK_MS > 0) {
            console.log(`⏳ CRASH_TEST: Delaying ${DELAY_BEFORE_ACK_MS}ms before ACK...`);
            await new Promise((r) => setTimeout(r, DELAY_BEFORE_ACK_MS));
          }
          await client.xAck(stream.name, GROUP, msg.id);
        } catch (err: any) {
          if (
            String(err.code) === "P2002" ||
            /unique/i.test(String(err.message))
          ) {
            await client.xAck(stream.name, GROUP, msg.id);
            continue;
          }
          const key = `attempts:${stream.name}`;
          const attempts = await client.hIncrBy(key, msg.id, 1);
          if (attempts >= MAX_ATTEMPTS) {
            await pushToDeadLetterQueue(client, stream.name, msg.id, rawJson);
            await client.xAck(stream.name, GROUP, msg.id);
          }
          // else: leave un-ACKed; will be picked up on next restart's drain
        }
      }
    }
  }
}
// Graceful shutdown handling
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 DB-Processor: Received ${signal}, shutting down gracefully...`);
  // Allow in-flight DB transactions to complete before disconnecting
  await new Promise((r) => setTimeout(r, 3000));
  await prisma.$disconnect();
  console.log('👋 DB-Processor: Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
consumeStreams().catch((e) => {
  console.error("DB‑Processor crashed", e);
  process.exit(1);
});
