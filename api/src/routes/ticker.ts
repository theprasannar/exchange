import { OrderBook } from './../../../engine/src/trade/orderBook';

import { Router } from "express";

export const tickersRouter = Router();

tickersRouter.get("/", async (req, res) => {    
    const { market } = req.query;

    if (!market) {
        return res.status(400).json({ error: "Market parameter is required" });
    }
    try {
        const tickerData = await 

        if (!tickerData) {
            return res.status(404).json({ error: "Market not found" });
        }
        res.json({
            market,
            lastPrice: tickerData.lastPrice,
            bidPrice: tickerData.bid,
            askPrice: tickerData.ask,
            volume24h: tickerData.volume,
            high24h: tickerData.high,
            low24h: tickerData.low,
        });
    } catch (error) {
        console.error("Error fetching ticker:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});