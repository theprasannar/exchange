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
  const eventId = event.id;
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await processEventWithTx(event, tx);

      // mark processed (idempotent safeguard)
      //@ts-ignore
      await tx.processedEvent.createMany({
        data: [{ id: eventId }],
        skipDuplicates: true, // <- Postgres "ON CONFLICT DO NOTHING"
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
      await processOrderCreate(event.data, tx, event.id);
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

async function consumeStreams(): Promise<void> {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();

  const GROUP = "ledger-writer";
  const CONSUMER = process.env.DBW_CONSUMER ?? "lw-1";
  const STREAMS = ["events", "sidefx"];
  const MAX_ATTEMPTS = 5;

  // Ensure groups exist
  for (const s of STREAMS) {
    try {
      await client.xGroupCreate(s, GROUP, "0", { MKSTREAM: true });
    } catch (e: any) {
      if (!String(e.message).includes("BUSYGROUP")) throw e;
    }
  }

  // -------- 1) Drain pending for THIS consumer (id: "0") --------
  for (const s of STREAMS) {
    while (true) {
      const resp = await client.xReadGroup(
        GROUP,
        CONSUMER,
        [{ key: s, id: "0" }],
        { COUNT: 100, BLOCK: 0 }
      );
      if (!resp || resp[0].messages.length === 0) break;

      for (const msg of resp[0].messages) {
        const rawJson = String((msg.message as any).json ?? "{}");
        try {
          const evt: Event = JSON.parse(rawJson);
          evt.id ||= msg.id;
          await safeProcess(evt); // ← write to DB
          await client.xAck(s, GROUP, msg.id); // ← ACK on success
        } catch (err: any) {
          // Idempotency: treat unique violation as success
          if (
            String(err.code) === "P2002" ||
            /unique/i.test(String(err.message))
          ) {
            await client.xAck(s, GROUP, msg.id);
            continue;
          }
          // Count attempts and DLQ if exceeded
          const key = `attempts:${s}`;
          const attempts = await client.hIncrBy(key, msg.id, 1);
          if (attempts >= MAX_ATTEMPTS) {
            await pushToDeadLetterQueue(client, s, msg.id, rawJson);
            await client.xAck(s, GROUP, msg.id); // stop retrying
          } // else: leave un-ACKed to retry on next start
        }
      }
    }
  }

  console.log(`DB-Processor ${CONSUMER} live…`);

  // -------- 2) Live loop (new messages: id: ">") --------
  while (true) {
    const pairs = STREAMS.map((k) => ({ key: k, id: ">" }));
    const resp = await client.xReadGroup(GROUP, CONSUMER, pairs, {
      COUNT: 100,
      BLOCK: 5000,
    });
    if (!resp) continue;

    for (const stream of resp) {
      for (const msg of stream.messages) {
        const rawJson = String((msg.message as any).json ?? "{}");
        try {
          const evt: Event = JSON.parse(rawJson);
          evt.id ||= msg.id;
          await safeProcess(evt);
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

consumeStreams().catch((e) => {
  console.error("DB‑Processor crashed", e);
  process.exit(1);
});
