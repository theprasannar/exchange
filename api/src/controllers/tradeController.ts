//@ts-nocheck
import { Request, Response } from "express";
import prisma from '@exchange/db/src/lib/prisma';
import { atomicToBtc, atomicToUsdc } from "../utils/currency";

const formatTime = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString("en-US", { hour12: false });
};

export const getTrades = async (req: Request, res: Response): Promise<any> => {
  // Extract the query parameters:
  const symbol = req.query.symbol as string;
  const limit = req.query.limit ? Number(req.query.limit) : 50; // default to 50 if not provided

  if (!symbol) {
    return res.status(400).json({ error: "Symbol query parameter is required." });
  }

  try {
    // Query trades for the given market (symbol) ordered by timestamp descending
    const trades = await prisma.trade.findMany({
      where: { market: symbol },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    // Format BigInt values as strings for JSON serialization
    const formattedTrades = trades.map((trade) => ({
      id: trade.id,
      tradeId: trade.tradeId,
      market: trade.market,
      price: atomicToUsdc(trade.price),
      quantity: atomicToBtc(trade.quantity),
      quoteQuantity: atomicToBtc(trade.quoteQuantity),
      isBuyerMaker: trade.isBuyerMaker,
      timestamp: trade.timestamp,
      makerOrderId: trade.makerOrderId,
      takerOrderId: trade.takerOrderId,
      makerUserId: trade.makerUserId,
      takerUserId: trade.takerUserId,
    }));

    return res.status(200).json({ trades: formattedTrades });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};
