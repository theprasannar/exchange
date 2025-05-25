"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { fetchDepthData, subscribeDepth } from "../../store/depthSlice";

export default function OrderBook({ market }: { market: string }) {
  const dispatch = useAppDispatch();
  const { asks, bids } = useAppSelector((state) => state.depth);

  useEffect(() => {
    dispatch(fetchDepthData(market));
    const unsub = dispatch(subscribeDepth(market));
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [market]);

  const computeDepth = (entries: [string, string][]) => {
    let total = 0;
    return entries.map(([price, size]) => {
      const sizeNum = parseFloat(size);
      total += sizeNum;
      return {
        price,
        size,
        total: total.toFixed(4),
        depth: Math.random() * 80 + 20, // Simulate depth %
      };
    });
  };

  const asksData = computeDepth(asks.slice(0, 12)).reverse();
  const bidsData = computeDepth(bids.slice(0, 12));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between px-4 py-2 text-xs text-zinc-400 border-b border-zinc-700/50">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {/* Asks */}
        {asksData.map((ask, i) => (
          <div
            key={`ask-${i}`}
            className="relative px-4 py-1 text-xs border-b border-zinc-800/30 hover:bg-red-500/5"
          >
            <div
              className="absolute top-0 right-0 h-full bg-red-500/10"
              style={{ width: `${ask.depth}%` }}
            />
            <div className="relative flex justify-between z-10 font-mono">
              <span className="text-red-400">{ask.price}</span>
              <span>{ask.size}</span>
              <span className="text-zinc-500">{ask.total}</span>
            </div>
          </div>
        ))}

        {/* Spread Indicator */}
        {asksData[0] && bidsData[0] && (
          <div className="px-4 py-2 bg-zinc-800/70 text-center text-xs text-zinc-400">
            Spread:{" "}
            {(
              parseFloat(asksData[0].price) - parseFloat(bidsData[0].price)
            ).toFixed(2)}{" "}
            (
            {(
              ((parseFloat(asksData[0].price) - parseFloat(bidsData[0].price)) /
                parseFloat(bidsData[0].price)) *
              100
            ).toFixed(2)}
            %)
          </div>
        )}

        {/* Bids */}
        {bidsData.map((bid, i) => (
          <div
            key={`bid-${i}`}
            className="relative px-4 py-1 text-xs border-b border-zinc-800/30 hover:bg-green-500/5"
          >
            <div
              className="absolute top-0 right-0 h-full bg-green-500/10"
              style={{ width: `${bid.depth}%` }}
            />
            <div className="relative flex justify-between z-10 font-mono">
              <span className="text-green-400">{bid.price}</span>
              <span>{bid.size}</span>
              <span className="text-zinc-500">{bid.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
