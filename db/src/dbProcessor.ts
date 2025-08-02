//@ts-nocheck
import { createClient } from "redis";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await processEventWithTx(event, tx);

      // mark processed (idempotent safeguard)
      //@ts-ignore
      await tx.processedEvent.upsert({
        where: { id: event.id },
        update: {},
        create: { id: event.id },
      });
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
      await processOrderCreate(event.data, tx);
      break;
    case "DEPOSIT":
      await processDeposit(event.data, tx);
      break;
    case "TRADE_EXECUTED":
      await processTradeExecuted(event.data, tx);
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

// ---------------------------------------------------------------------------
// Handlers (all use the scoped `tx`)
// ---------------------------------------------------------------------------

async function processOrderCreate(
  d: any,
  tx: Prisma.TransactionClient
): Promise<void> {
  try {
    await tx.order.create({
      data: {
        eventId: d.eventId ?? d.id, // UNIQUE
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
  tx: Prisma.TransactionClient
): Promise<void> {
  try {
    await tx.trade.create({
      data: {
        eventId: d.eventId ?? d.id, // UNIQUE
        tradeId: Number(d.id),
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
    console.log("DB‑Processor: trade exec", d.id);
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

  const executed = BigInt(d.executedQty);
  const quantity = d.quantity ? BigInt(d.quantity) : existing.quantity;

  const status =
    executed === 0n
      ? "PENDING"
      : executed === quantity
      ? "FILLED"
      : "PARTIALLY_FILLED";

  await tx.order.update({
    where: { id: d.orderId },
    data: { filled: executed, status },
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

// ---------------------------------------------------------------------------
// Dead‑letter helper
// ---------------------------------------------------------------------------

async function pushToDeadLetterQueue(event: Event): Promise<void> {
  const r = createClient();
  await r.connect();
  await r.lPush("dead_letter_queue", JSON.stringify(event));
  await r.disconnect();
  console.error("DB‑Processor: event sent to DLQ", event.id);
}

// ---------------------------------------------------------------------------
// Stream consumer (events + sidefx)
// ---------------------------------------------------------------------------

async function consumeStreams(): Promise<void> {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();

  const GROUP = "ledger-writer";
  const CONSUMER = "lw-" + Math.random().toString(36).slice(2, 7);
  const STREAMS = ["events", "sidefx"];

  for (const s of STREAMS) {
    try {
      await client.xGroupCreate(s, GROUP, "0", { MKSTREAM: true });
    } catch (e: any) {
      if (!e.message.includes("BUSYGROUP")) throw e;
    }
  }

  console.log(`DB‑Processor ${CONSUMER} listening…`);

  while (true) {
    const pairs = STREAMS.map((k) => ({ key: k, id: ">" }));
    const resp = await client.xReadGroup(GROUP, CONSUMER, pairs, {
      COUNT: 100,
      BLOCK: 5000,
    });
    if (!resp) continue;

    for (const stream of resp) {
      for (const msg of stream.messages) {
        try {
          const evt: Event = JSON.parse(msg.message.json as string);
          evt.id ||= msg.id;
          await safeProcess(evt);
          await client.xAck(stream.name, GROUP, msg.id);
        } catch (err) {
          console.error("DB‑Processor fail", stream.name, msg.id, err);
          // after 5 retries push to DLQ (pseudo‑code)
          // await pushToDeadLetterQueue(evt);
        }
      }
    }
  }
}

consumeStreams().catch((e) => {
  console.error("DB‑Processor crashed", e);
  process.exit(1);
});
