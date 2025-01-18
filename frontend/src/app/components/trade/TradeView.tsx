"use client";
import { useEffect, useRef } from "react";
import { KLine  } from "../../types/types";
import { ChartManager } from "../../utils/ChartManager";

/**
 * Renders a chart with dummy K-Line data.
 */
export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);

  useEffect(() => {
    const init = async () => {
      // Replace real API calls with dummy data:
      const klineData: KLine[] = [
        {
          close: "1.20",
          end: String(Date.now()),
          high: "1.30",
          low: "1.10",
          open: "1.15",
          quoteVolume: "1000",
          start: String(Date.now() - 3600000),
          trades: "50",
          volume: "2000",
        },
        // Add more data if you like
      ];

      if (chartRef.current) {
        // Destroy existing chart if re-initializing:
        if (chartManagerRef.current) {
          chartManagerRef.current.destroy();
        }

        const chartManager = new ChartManager(
          chartRef.current,
          klineData
            .map((x) => ({
              close: parseFloat(x.close),
              high: parseFloat(x.high),
              low: parseFloat(x.low),
              open: parseFloat(x.open),
              timestamp: new Date(Number(x.end)),
            }))
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

  return <div ref={chartRef} style={{ height: "520px", width: "100%", marginTop: 4 }} />;
}
