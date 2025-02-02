"use client";
import { useEffect, useRef } from "react";
import { KLine } from "../../types/types";
import { ChartManager } from "../../utils/ChartManager";

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);

  useEffect(() => {
    const init = async () => {
      // Number of data points (candles) you want to see on the chart
      const DATA_POINTS = 300; 
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      // Let's create a random walk:
      // - We start at a "base" price
      // - Each new candle’s open starts at the previous candle's close
      // - Then we randomly move up/down for the new close
      let currentPrice = 20000 + Math.random() * 500; // example base (e.g. BTC)
      const klineData: KLine[] = [];

      for (let i = 0; i < DATA_POINTS; i++) {
        const startTime = now - ONE_HOUR * (DATA_POINTS - i);
        const open = currentPrice;
        // Introduce a random amount by which price might move
        const priceFluctuation = (Math.random() - 0.5) * 300;
        const close = open + priceFluctuation;
        // High/low around the open/close
        const high = Math.max(open, close) + Math.random() * 80;
        const low = Math.min(open, close) - Math.random() * 80;

        // Move currentPrice to the new close
        currentPrice = close;

        klineData.push({
          open: open.toFixed(2),
          close: close.toFixed(2),
          high: high.toFixed(2),
          low: low.toFixed(2),
          start: String(startTime),
          end: String(startTime + ONE_HOUR),
          quoteVolume: "1000",
          trades: "50",
          volume: "2000",
        });
      }

      // Initialize chart
      if (chartRef.current) {
        // Destroy existing chart if re-initializing
        if (chartManagerRef.current) {
          chartManagerRef.current.destroy();
        }

        const chartManager = new ChartManager(
          chartRef.current,
          klineData
            .map((k) => ({
              close: parseFloat(k.close),
              high: parseFloat(k.high),
              low: parseFloat(k.low),
              open: parseFloat(k.open),
              timestamp: new Date(Number(k.end)),
            }))
            // Sort by time to ensure correct order on the chart
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
          {
            background: "#0e0f14",
            color: "white",
          }
        );

        chartManagerRef.current = chartManager;
      }
    };
    init();
  }, [market]);

  return (
    <div
      ref={chartRef}
      style={{ height: "520px", width: "100%", marginTop: 4 }}
    />
  );
}
