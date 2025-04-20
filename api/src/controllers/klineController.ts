import { Request, Response } from "express";
import prisma from "@exchange/db/dist/lib/prisma";

export const getKlineData = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {
      symbol: market,
      interval,
      limit = "100",
    } = req.query as {
      symbol: string;
      interval: string;
      limit: string;
    };

    if (!market || !interval) {
      return res
        .status(400)
        .json({ error: "market and interval are required" });
    }

    // For simplicity: fetch by market + interval, order by startTime desc
    const klines = await prisma.kline.findMany({
      where: {
        market,
        interval,
      },
      orderBy: {
        startTime: "desc",
      },
      take: Number(limit),
    });

    // transform BigInt -> string
    const response = klines.map((k: any) => ({
      market: k.market,
      interval: k.interval,
      open: k.open.toString(),
      high: k.high.toString(),
      low: k.low.toString(),
      close: k.close.toString(),
      volume: k.volume.toString(),
      trades: k.trades,
      startTime: k.startTime.getTime(),
      endTime: k.endTime.getTime(),
    }));

    res.json(response);
  } catch (error) {
    console.error("Error fetching klines:", error);
    res.status(500).json({ error: "Failed to fetch klines" });
  }
};
