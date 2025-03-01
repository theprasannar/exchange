"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { RootState } from "../../store/store";
import { fetchTradesData, subscribeTrades } from "../../store/tradeSlice";
import { Trade } from "../../types/types";

export function Trades({ market }: { market: string }) {
  const dispatch = useAppDispatch();
  const { trades } = useAppSelector((state: RootState) => state.trade);

  useEffect(() => {
    // 1) Fetch initial trades
    dispatch(fetchTradesData({ market, limit: 50 }));
    // 2) Subscribe to WS for new trades
    const unsubscribe = dispatch(subscribeTrades(market));

    return () => {
      // Cleanup
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [dispatch, market]);

  // if (loading) return <div className="p-2">Loading trades...</div>;
  // if (error) return <div className="p-2 text-red-500">Error: {error}</div>;

  return (
    <div className="flex flex-col w-full h-full overflow-y-auto p-2">
      {/* Table header */}
      <div className="flex justify-between text-sm pb-2 border-b border-gray-700">
        <p>Price</p>
        <p>Quantity</p>
        <p>Time</p>
      </div>

      {/* Trades list */}
      {trades.map((trade: Trade, idx: number) => (
        <TradeRow key={idx} trade={trade} />
      ))}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  // Convert timestamp if needed

  const tradeColor = trade.isBuyerMaker ? 'text-red-500' : 'text-green-500';
  return (
    <div className={`flex justify-between text-xs py-1 border-b border-gray-800`}>
      <span className={tradeColor} >{parseFloat(trade.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className="text-white">{trade.quantity}</span>
      <span className="text-gray-400">{trade.timestamp}</span>
    </div>
  );
}

