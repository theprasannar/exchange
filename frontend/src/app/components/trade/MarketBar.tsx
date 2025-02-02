"use client";
import { useEffect, useState } from "react";
import { Ticker } from "../../types/types";

/**
 * Renders market ticker data in the top bar.
 * Now uses static data instead of real API/WebSocket calls.
 */
export const MarketBar = ({ market }: { market: string }) => {
  const [ticker, setTicker] = useState<Ticker | null>(null);

  useEffect(() => {
    // Replace real API calls & socket logic with dummy data:
    const dummyTicker: Ticker = {
      firstPrice: "1.23",
      high: "1.45",
      lastPrice: "1.30",
      low: "1.10",
      priceChange: "0.07",
      priceChangePercent: "5.6",
      quoteVolume: "1000.00",
      symbol: market,
      trades: "45",
      volume: "2000.00",
    };
    setTicker(dummyTicker);
  }, [market]);

  return (
    <div>
      <div className="flex items-center flex-row relative w-full overflow-hidden bg-customGray m-2">
        <div className="flex items-center justify-between flex-row no-scrollbar overflow-x-auto pr-4">
          <TickerSymbol market={market} />
          <div className="flex items-center flex-row space-x-8 pl-4">
            <div className="flex flex-col h-full justify-center">
              <p className={`font-medium tabular-nums text-green-500 text-md`}>
                ${ticker?.lastPrice}
              </p>
              <p className="font-medium text-sm tabular-nums">
                ${ticker?.lastPrice}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400">24H Change</p>
              <p
                className={`text-sm font-medium tabular-nums leading-5 ${
                  Number(ticker?.priceChange) > 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {Number(ticker?.priceChange) > 0 ? "+" : ""}
                {ticker?.priceChange} ({Number(ticker?.priceChangePercent)?.toFixed(2)}%)
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400">24H High</p>
              <p className="text-sm font-medium tabular-nums leading-5 ">
                {ticker?.high}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="font-medium text-xs text-slate-400">24H Low</p>
              <p className="text-sm font-medium tabular-nums leading-5 ">
                {ticker?.low}
              </p>
            </div>
            <button
              type="button"
              className="font-medium transition-opacity hover:opacity-80 hover:cursor-pointer text-base text-left"
            >
              <div className="flex flex-col">
                <p className="font-medium text-xs text-slate-400">24H Volume</p>
                <p className="mt-1 text-sm font-medium tabular-nums leading-5 ">
                  {ticker?.volume}
                </p>
              </div>
            </button>
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
          className="z-10 rounded-full h-6 w-6 mt-4 outline-baseBackgroundL1"
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
            <div className="flex flex-row relative">
              <p className="font-medium text-sm">
                {market.replace("_", " / ")}
              </p>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
