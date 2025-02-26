"use client";
import { useEffect, useRef } from "react";
import { ChartManager } from "../../utils/ChartManager";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { fetchKlineData, subscribeKlines } from "../../store/klineSlice";

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);

  // Redux
  const dispatch = useAppDispatch();
  const { candles } = useAppSelector((state) => state.kline);

  useEffect(() => {
    // 1) Fetch historical klines from server
    dispatch(fetchKlineData({ market, interval: "1m", limit: 200 }));

    // 2) Subscribe to partial updates (if you have a WS feed for klines)
    const unsubscribe = subscribeKlines(market, "1m")(dispatch);

    // cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [market, dispatch]);

  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing chart if re-initializing
    if (chartManagerRef.current) {
      chartManagerRef.current.destroy();
    }

    // Prepare data for ChartManager
    // parseFloat() for open/high/low/close
    // convert endTime (ms) => Date
    const chartData = candles
      .map((c) => ({
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        timestamp: new Date(c.endTime),
      }))
      // Sort by time ascending if needed
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Initialize Chart
    const chartManager = new ChartManager(chartRef.current, chartData, {
      background: "#0e0f14",
      color: "white",
    });

    chartManagerRef.current = chartManager;
  }, [candles]);

  return <div ref={chartRef} className="h-full w-full p-4" />;
}
