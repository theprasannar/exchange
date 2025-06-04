"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import { fetchTickerData, subscribeTicker } from "../../store/tickerSlice";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";

export const MarketBar = ({ market }: { market: string }) => {
  const dispatch = useAppDispatch();
  const ticker = useAppSelector((state) => state.ticker);
  const [showMarketSelector, setShowMarketSelector] = useState(false);

  const isPositive = true;
  const availableMarkets = ["BTC_USDC", "ETH_USDC", "SOL_USDC", "AVAX_USDC"];
  const [baseCurrency, quoteCurrency] = market.split("_");

  useEffect(() => {
    dispatch(fetchTickerData(market));
    const unsubscribe = dispatch(subscribeTicker(market));
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [market, dispatch]);

  return (
    <div className="bg-zinc-800/50 rounded-xl backdrop-blur-sm border border-zinc-700/50 mt-2">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-4">
        {/* Market Selector */}
        <div className="relative">
          <div className="flex items-center space-x-3 bg-zinc-800 rounded-lg px-4 py-2 border border-zinc-700">
            <div className="flex items-center">
              <div className="relative flex items-center">
                <img
                  src="/images/btc.webp"
                  className="z-10 rounded-full h-6 w-6"
                />
                <img
                  src="/images/usdc.webp"
                  className="h-6 w-6 -ml-2 rounded-full"
                />
              </div>
              <span className="ml-3 font-medium">
                {baseCurrency}/{quoteCurrency}
              </span>
            </div>
          </div>

          {showMarketSelector && (
            <div className="absolute z-10 mt-2 w-full bg-zinc-800 rounded-lg shadow-lg shadow-black/20 border border-zinc-700">
              <div className="py-1">
                {availableMarkets.map((m) => (
                  <button
                    key={m}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      m === market
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    }`}
                    onClick={() => {
                      console.log(`Selected market: ${m}`);
                      setShowMarketSelector(false);
                    }}
                  >
                    {m.replace("_", "/")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Price Info */}
        <div className="flex flex-wrap items-center gap-6 md:gap-8">
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="text-2xl font-bold font-mono tracking-tight">
                ${ticker.lastPrice}
              </span>
              <span
                className={`ml-2 flex items-center text-sm font-medium ${
                  isPositive ? "text-green-500" : "text-red-500"
                }`}
              >
                {isPositive ? (
                  <ArrowUp className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDown className="h-3 w-3 mr-1" />
                )}
                {/* {ticker.change} */}
              </span>
            </div>
            <span className="text-xs text-zinc-400">Last Price</span>
          </div>

          <div className="flex flex-col">
            <span className="font-medium font-mono">${ticker.high}</span>
            <span className="text-xs text-zinc-400">24h High</span>
          </div>

          <div className="flex flex-col">
            <span className="font-medium font-mono">${ticker.low}</span>
            <span className="text-xs text-zinc-400">24h Low</span>
          </div>

          <div className="flex flex-col">
            <span className="font-medium font-mono">
              {ticker.volume} {baseCurrency}
            </span>
            <span className="text-xs text-zinc-400">24h Volume</span>
          </div>
        </div>
      </div>
    </div>
  );
};
