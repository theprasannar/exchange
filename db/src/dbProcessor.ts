import prisma from "./lib/prisma";
import { createClient } from "redis";
import { sleep } from "./utils";

export interface Event {
  id: string;
  type: string; // Event type (e.g., "ORDER_CREATE", "BALANCE_UPDATE", etc.)
  data: any;
  timestamp: number;
  retryCount?: number;
}

/**
 * Process a single event based on its type.
 */
async function processEvent(event: Event): Promise<void> {
  switch (event.type) {
    case "ORDER_CREATE":
      await processOrderCreate(event.data);
      break;
    case "BALANCE_UPDATE":
      await processBalanceUpdate(event.data);
      break;
    case "TRADE_EXECUTED":
      await processTradeExecuted(event.data);
      break;
    case "ORDERBOOK_SNAPSHOT":
      await processOrderbookSnapshot(event.data);
      break;
    case "ORDER_UPDATE":
      await processOrderUpdate(event.data);
      break;
    default:
      console.warn("DB Processor: Unknown event type:", event.type);
  }
}

async function processOrderCreate(data: any): Promise<void> {
  try {
    await prisma.order.create({
      data: {
        id: data.orderId,
        userId: data.userId,
        market: data.market,
        side: data.side,
        price: BigInt(data.price),
        quantity: BigInt(data.quantity),
        filled: 0n,
        status: "PENDING",
      },
    });
    console.log(`DB Processor: Order created ${data.orderId}`);
  } catch (error) {
    throw new Error(
      `DB Processor: Failed to create order ${data.orderId}: ${error}`
    );
  }
}

// dbProcessor.ts (or wherever you have your DB processing logic)

async function processBalanceUpdate(data: any): Promise<void> {
  console.log("Process");
  try {
    // data has { userId, asset, available, locked? }
    // For demonstration, let's handle USDC and BTC.
    if (data.asset === "USDC") {
      await prisma.user.update({
        where: { id: data.userId },
        data: { usdcBalance: BigInt(data.available) },
      });
    } else if (data.asset === "BTC") {
      await prisma.user.update({
        where: { id: data.userId },
        data: { btcBalance: BigInt(data.available) },
      });
    } else {
      // If your schema allows more columns or a dynamic approach:
      console.warn(
        `DB Processor: Balance update for unknown asset ${data.asset}. Skipping.`
      );
      // Alternatively, handle it if your schema has a flexible approach or extra columns
    }

    console.log(
      `DB Processor: Balance updated for user=${data.userId} asset=${data.asset}`
    );
  } catch (error) {
    throw new Error(
      `DB Processor: Failed to update balance for user ${data.userId}, asset ${data.asset}: ${error}`
    );
  }
}

async function processTradeExecuted(data: any): Promise<void> {
  try {
    await prisma.trade.create({
      data: {
        tradeId: Number(data.id),
        market: data.market,
        price: BigInt(data.price),
        quantity: BigInt(data.quantity),
        quoteQuantity: BigInt(data.quoteQuantity),
        isBuyerMaker: data.isBuyerMaker,
        timestamp: new Date(data.timestamp),
        makerOrderId: data.makerOrderId || null,
        takerOrderId: data.takerOrderId || null,
        makerUserId: data.makerUserId || null,
        takerUserId: data.takerUserId || null,
      },
    });
    console.log(`DB Processor: Trade recorded ${data.id}`);
  } catch (error) {
    throw new Error(
      `DB Processor: Failed to record trade ${data.id}: ${error}`
    );
  }
}

/**
 * Process an orderbook snapshot event:
 * - Creates a new record in the database for historical snapshots.
 */
export async function processOrderbookSnapshot(data: any): Promise<void> {
  try {
    // Create a new snapshot record.
    await prisma.orderbookSnapshot.upsert({
      where: { market: data.market },
      update: { snapshot: data.snapshot },
      create: {
        market: data.market,
        snapshot: data.snapshot,
      },
    });

    console.log(
      `DB Processor: Orderbook snapshot persisted for market ${data.market}`
    );
  } catch (error) {
    throw new Error(
      `DB Processor: Failed to process orderbook snapshot for market ${data.market}: ${error}`
    );
  }
}

async function processOrderUpdate(data: any): Promise<void> {
  try {
    // Fetch the existing order
    const existingOrder = await prisma.order.findUnique({
      where: { id: data.orderId },
    });
    if (!existingOrder) {
      console.warn(`DB Processor: Order ${data.orderId} not found`);
      return;
    }
    // Update order details (for simplicity, assume data.executedQty represents the new filled amount)
    await prisma.order.update({
      where: { id: data.orderId },
      data: { filled: BigInt(data.executedQty) },
    });
    console.log(`DB Processor: Order updated ${data.orderId}`);
  } catch (error) {
    throw new Error(
      `DB Processor: Failed to update order ${data.orderId}: ${error}`
    );
  }
}

/**
 * If processing repeatedly fails, push the event to a dead‑letter queue.
 */
async function pushToDeadLetterQueue(event: Event): Promise<void> {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();
  await redisClient.lPush("dead_letter_queue", JSON.stringify(event));
  await redisClient.disconnect();
  console.error(`DB Processor: Event ${event.id} pushed to dead-letter queue`);
}

/**
 * Continuously consumes events from the event store with retries.
 */
async function consumeEvents() {
  const redisClient = createClient({ url: process.env.REDIS_URL });
  await redisClient.connect();
  console.log("DB Processor: Connected to Redis for event consumption.");
  const maxRetries = 5;

  while (true) {
    try {
      // Blocking pop from the "event_store" list
      const result = await redisClient.brPop("event_store", 0);
      console.log(" consumeEvents ~ result:", result);
      if (result) {
        const message = result.element;
        const event: Event = JSON.parse(message);
        let retryCount = event.retryCount || 0;
        let processed = false;

        while (!processed && retryCount < maxRetries) {
          try {
            await processEvent(event);
            processed = true;
          } catch (error) {
            retryCount++;
            console.error(
              `DB Processor: Error processing event ${event.id} (attempt ${retryCount}):`,
              error
            );
            event.retryCount = retryCount;
            await sleep(1000 * retryCount); // exponential backoff
          }
        }
        if (!processed) {
          await pushToDeadLetterQueue(event);
        }
      }
    } catch (error) {
      console.error("DB Processor: Error consuming events:", error);
      await sleep(1000);
    }
  }
}

consumeEvents().catch((error) => {
  console.error("DB Processor: Fatal error:", error);
  process.exit(1);
});
