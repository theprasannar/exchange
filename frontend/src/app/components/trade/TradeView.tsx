"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChartManager } from "../../utils/ChartManager";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { fetchKlineData, subscribeKlines } from "../../store/klineSlice";
import { atomicToUsdc } from "../../utils/currency";

// Define the intervals you want to support
const INTERVALS = ["1m", "5m", "15m", "30m", "1h", "1d"];

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager | null>(null);

  // Local state to store the currently selected interval
  const [interval, setInterval] = useState("1m");

  // Redux
  const dispatch = useAppDispatch();
  const { candles } = useAppSelector((state) => state.kline);

  // 1) Fetch initial klines & subscribe on interval/market change
  useEffect(() => {
    // Fetch historical klines from server
    dispatch(fetchKlineData({ market, interval, limit: 200 }));

    // Subscribe to partial updates via WS
    const unsubscribe = subscribeKlines(market, interval)(dispatch);

    // Cleanup on unmount or if interval changes
    return () => {
      unsubscribe();
    };
  }, [market, interval, dispatch]);

  // 2) Re-initialize chart when `candles` change
  useEffect(() => {
    if (!chartRef.current) return;

    // Destroy any existing chart before re-creating
    if (chartManagerRef.current) {
      chartManagerRef.current.destroy();
    }

    // Prepare data for ChartManager
    // - parseFloat for open/high/low/close
    // - convert endTime => Date
    const chartData = candles
      .map((c) => ({
        open: parseFloat(atomicToUsdc(BigInt(c.open))),
        high: parseFloat(atomicToUsdc(BigInt(c.high))),
        low: parseFloat(atomicToUsdc(BigInt(c.low))),
        close: parseFloat(atomicToUsdc(BigInt(c.close))),
        timestamp: new Date(c.endTime),
      }))
      // Ensure ascending time order
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Initialize ChartManager
    const chartManager = new ChartManager(chartRef.current, chartData, {
      background: "#0e0f14",
      color: "white",
    });

    chartManagerRef.current = chartManager;
  }, [candles]);

  return (
    <div className="h-full w-full p-4">
      {/* Intervals Row */}
      <div className="flex space-x-4 items-center text-sm mb-3">
        {INTERVALS.map((int) => (
          <button
            key={int}
            onClick={() => setInterval(int)}
            className={`transition-colors 
              ${
                interval === int
                  ? // Selected interval style
                    "text-blue-500 border-b-2 border-blue-500"
                  : // Unselected intervals style
                    "text-gray-400 hover:text-gray-200 border-b-2 border-transparent"
              }
              pb-0.5  // small spacing under text
            `}
          >
            {int}
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div
        ref={chartRef}
        className="h-[600px] w-full border border-gray-700 rounded"
      />
    </div>
  );
}