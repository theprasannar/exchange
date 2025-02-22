// db/src/dbProcessor.ts

import prisma from "./lib/prisma";
import { createClient } from "redis";
import { DbMessage, TRADE_ADDED, ORDER_UPDATE, TradeAddedData, OrderUpdateData , ORDER_CREATE} from "./types";

/**
 * Initializes Redis connection and starts processing messages.
 */

async function processCreateOrder(data: {
  orderId: string
  userId: string;
  market: string;
  side: "buy" | "sell";
  price: string;
  quantity: string;
}) {
  try {
    const newOrder = await prisma.order.create({
      data: {
        id: data.orderId, // Use the orderId passed from the engine
        userId: data.userId,
        market: data.market,
        side: data.side,
        price: BigInt(data.price),
        quantity: BigInt(data.quantity),
        filled: 0n,
        status: "PENDING",
      },
    });
    console.log(`✅ Order created in DB: ${newOrder.id}`);
    // Optionally, you can send a notification or push an update message
  } catch (error) {
    console.error("❌ Error creating order:", error);
  }
}
async function main() {
  const redisClient = createClient();
  await redisClient.connect();
  console.log("✅ DB Processor connected to Redis...");

  while (true) {
    try {
      // Wait indefinitely until a message is available
      const result = await redisClient.brPop("db_processor", 0);
      if (!result) continue;

      const message: DbMessage = JSON.parse(result.element);
      console.log("main ~ message:", message)

      switch (message.type) {
        case ORDER_CREATE:
          await processCreateOrder(message.data);
          break;
        case TRADE_ADDED:
          await processTradeAdded(message.data);
          break;
        case ORDER_UPDATE:
          await processOrderUpdate(message.data);
          break;
        default:
          console.warn("⚠️ Unknown message type:", (message as any).type);
      }
    } catch (error) {
      console.error("❌ Error processing DB message:", error);
    }
  }
}

/**
 * Inserts a new trade record for each matched fill from the engine.
 */
async function processTradeAdded(data: TradeAddedData) {
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
        makerOrderId: data.makerOrderId ?? null,
        takerOrderId: data.takerOrderId ?? null,
        makerUserId: data.makerUserId ?? null,
        takerUserId: data.takerUserId ?? null,
      },
    });

    console.log(`✅ Trade recorded: ${data.id} (${data.market})`);
  } catch (error) {
    console.error("❌ Error inserting trade:", error);
  }
}

/**
 * Updates an order (partial fill, full fill, or cancel).
 */
async function processOrderUpdate(data: OrderUpdateData) {
  try {
    const orderId = data.orderId;

    // Fetch existing order
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      console.warn(`⚠️ Order not found: ${orderId}`);
      return;
    }

    // Calculate new filled amount
    const updatedFilled = calculateNewFilledAmount(
      existingOrder.filled.toString(),
      data.executedQty,
      data.quantity // If `quantity` exists, assume `executedQty` is the total filled so far.
    );

    // Determine order status (if not explicitly provided)
    const finalStatus = data.status ?? deriveStatus(updatedFilled, existingOrder.quantity.toString());

    // Update order in DB
    await prisma.order.update({
      where: { id: orderId },
      data: {
        filled: BigInt(updatedFilled),
        status: finalStatus,
      },
    });

    console.log(`✅ Order updated: ${orderId} | Status: ${finalStatus} | Filled: ${updatedFilled}`);
  } catch (error) {
    console.error("❌ Error updating order:", error);
  }
}

/**
 * Determines how much of the order has been filled.
 * - If `msgTotalStr` exists, `executedQty` is treated as the total filled so far.
 * - Otherwise, `executedQty` is treated as incremental.
 */
function calculateNewFilledAmount(
    existingFilledStr: string, // Amount already filled in DB
    newFillAmountStr: string,  // Newly filled amount (from trade event)
    totalFilledStr?: string    // Optional: Total filled so far (if provided explicitly)
  ): string {
    const existingFilled = BigInt(existingFilledStr);
    const newFillAmount = BigInt(newFillAmountStr);
  
    // If totalFilledStr is provided, it represents the *actual total* filled so far
    return totalFilledStr !== undefined ? totalFilledStr : (existingFilled + newFillAmount).toString();
  }
  
/**
 * Determines order status based on the filled amount.
 */
function deriveStatus(filledStr: string, totalStr: string): "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED" {
  const filled = BigInt(filledStr);
  const total = BigInt(totalStr);

  return filled === 0n ? "PENDING" : filled >= total ? "FILLED" : "PARTIALLY_FILLED";
}

// Start the processor
main().catch((error) => {
  console.error("🔥 Fatal error in DB processor:", error);
  process.exit(1);
});
