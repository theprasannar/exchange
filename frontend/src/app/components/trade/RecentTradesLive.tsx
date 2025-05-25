"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { fetchTradesData, subscribeTrades } from "../../store/tradeSlice";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function RecentTrades({ market }: { market: string }) {
  const dispatch = useAppDispatch();
  const { trades } = useAppSelector((state) => state.trade);

  useEffect(() => {
    dispatch(fetchTradesData({ market, limit: 50 }));
    const unsub = dispatch(subscribeTrades(market));
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [market]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between px-4 py-2 text-xs text-zinc-400 border-b border-zinc-700/50">
        <span>Price</span>
        <span>Size</span>
        <span>Time</span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {trades.map((trade, i) => {
          const isBuy = !trade.isBuyerMaker;
          return (
            <div
              key={i}
              className={`px-4 py-1.5 text-xs border-b border-zinc-800/30 ${
                isBuy ? "hover:bg-green-500/5" : "hover:bg-red-500/5"
              }`}
            >
              <div className="flex justify-between items-center font-mono">
                <div
                  className={`flex items-center ${
                    isBuy ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isBuy ? (
                    <ArrowUp className="w-3 h-3 mr-1" />
                  ) : (
                    <ArrowDown className="w-3 h-3 mr-1" />
                  )}
                  {parseFloat(trade.price).toFixed(2)}
                </div>
                <span>{trade.quantity}</span>
                <span className="text-zinc-500">
                  {formatTime(trade.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
