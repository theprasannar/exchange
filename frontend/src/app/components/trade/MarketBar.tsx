"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { fetchTickerData, subscribeTicker } from "../../store/tickerSlice";

export const MarketBar = ({ market }: { market: string }) => {
  const dispatch = useAppDispatch();
  const ticker = useAppSelector((state) => state.ticker);

  useEffect(() => {
    console.log('useEffect')
    // Fetch initial ticker data
    dispatch(fetchTickerData(market));
    // Subscribe to real-time ticker updates
    const unsubscribe = dispatch(subscribeTicker(market));
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [market, dispatch]);

  return (
    <div>
      <div className="flex items-center flex-row relative w-full overflow-hidden bg-customGray m-2">
        <div className="flex items-center justify-between flex-row no-scrollbar overflow-x-auto pr-4">
          <TickerSymbol market={market} />
          <div className="flex items-center flex-row space-x-8 pl-4">
            <div className="flex flex-col h-full justify-center">
              <p className="font-medium tabular-nums text-green-500 text-md">
                ${ticker.lastPrice}
              </p>
              <p className="font-medium text-sm tabular-nums">
                ${ticker.lastPrice}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400">24H High</p>
              <p className="text-sm font-medium">{ticker.high}</p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400">24H Low</p>
              <p className="text-sm font-medium">{ticker.low}</p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400">Volume</p>
              <p className="text-sm font-medium">{ticker.volume}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function TickerSymbol({ market }: { market: string }) {
  return (
    <div className="flex h-[60px] shrink-0 space-x-4">
      <div className="flex flex-row relative ml-2 -mr-4">
        <img
          alt="SOL Logo"
          loading="lazy"
          decoding="async"
          className="z-10 rounded-full h-6 w-6 mt-4"
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVvBqZC_Q1TSYObZaMvK0DRFeHZDUtVMh08Q&s"
        />
        <img
          alt="USDC Logo"
          loading="lazy"
          decoding="async"
          className="h-6 w-6 -ml-2 mt-4 rounded-full"
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTVvBqZC_Q1TSYObZaMvK0DRFeHZDUtVMh08Q&s"
        />
      </div>
      <button type="button" className="react-aria-Button">
        <div className="flex items-center justify-between flex-row cursor-pointer rounded-lg p-3 hover:opacity-80">
          <div className="flex items-center flex-row gap-2">
            <p className="font-medium text-sm">
              {market.replace("_", " / ")}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
