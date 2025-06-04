import { Request, Response } from "express";
import { RedisManager } from "../RedisManager";
import {
  CANCEL_ORDER,
  CREATE_ORDER,
  GET_DEPTH,
  GET_OPEN_ORDERS,
} from "../types";
import { btcToAtomic, usdcToAtomic } from "../utils/currency";
import prisma from "../../../db/src/lib/prisma";

export const createOrderController = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { market, price, quantity, side, userId, orderType, ioc, postOnly } =
    req.body;

  if (!market || !side || !quantity) {
    return res.status(400).json({ error: "Invalid order parameters" });
  }

  if (price && price < 0) {
    return res.status(400).json({ error: "Price must be greater than 0" });
  }

  const finalOrderType = orderType || "limit";

  if (finalOrderType === "limit" && !price) {
    return res
      .status(400)
      .json({ error: "Price is required for limit orders" });
  }

  try {
    const quantityAtomic = btcToAtomic(quantity);
    const priceAtomic =
      finalOrderType === "limit" ? usdcToAtomic(price).toString() : "0";

    const response = await RedisManager.getInstance().sendAndAwait(
      {
        type: CREATE_ORDER,
        data: {
          market,
          price: priceAtomic.toString(),
          quantity: quantityAtomic.toString(),
          side,
          userId,
          orderType: finalOrderType, // 'market' or 'limit'
          ioc,
          postOnly,
        },
      },
      0
    );

    // Check if response indicates an error
    //@ts-ignore
    if (response.type === "ORDER_REJECTED") {
      return res.status(400).json({
        //@ts-ignore
        error: response.payload.reason || "Order rejected",
      });
    }

    //@ts-ignore
    res.json(response.payload);
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create order",
    });
  }
};

export const getDepthController = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { market } = req.params;

  if (!market) {
    return res.status(400).json({ error: "Market parameter is required" });
  }

  try {
    const response = await RedisManager.getInstance().sendAndAwait(
      {
        type: GET_DEPTH,
        data: { market },
      },
      5000
    ); // 5 second timeout

    //@ts-ignore
    res.json(response.payload);
  } catch (error) {
    console.error("Error fetching market depth:", error);
    res.status(500).json({ error: "Failed to fetch market depth" });
  }
};

export const getOpenOrdersController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // 1) Pull both market and userId from query params
    const market = req.query.market as string;
    const userId = req.query.userId as string;

    // 2) Basic validation
    if (!market) {
      res.status(400).json({ error: "Market parameter is required" });
      return;
    }
    if (!userId) {
      res.status(400).json({ error: "User ID parameter is required" });
      return;
    }
    // 3) Fetch only PENDING or PARTIALLY_FILLED orders for that user & market
    const response = await RedisManager.getInstance().sendAndAwait(
      {
        type: GET_OPEN_ORDERS,
        data: {
          market,
          userId,
        },
      },
      5000
    );

    //@ts-ignore
    const openOrders = response.payload;
    console.log("test");
    // 4) Map to the shape your frontend expects (including status!)
    //@ts-ignore
    const orders = openOrders.map((o) => ({
      orderId: o.orderId,
      side: o.side,
      price: o.price.toString(),
      quantity: o.quantity.toString(),
      filled: o.filled.toString(),
      userId: o.userId,
      // createdAt: o.createdAt.toISOString(),
    }));

    // 5) Send JSON array back
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching open orders:", error);
    res.status(500).json({ error: "Failed to fetch open orders" });
  }
};
export const cancelOrderController = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { orderId } = req.params;
  const market = req.query.market;
  const userId = req.query.userId;

  if (!market || typeof market !== "string") {
    return res.status(400).json({ error: "Market parameter is required" });
  }
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "UserId parameter is required" });
  }
  console.log(market);
  if (!orderId) {
    return res.status(400).json({ error: "Order ID parameter is required" });
  }

  try {
    const response = await RedisManager.getInstance().sendAndAwait(
      {
        type: CANCEL_ORDER,
        data: { orderId, market, userId },
      },
      5000
    );

    //@ts-ignore
    res.json(response.payload);
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
};
