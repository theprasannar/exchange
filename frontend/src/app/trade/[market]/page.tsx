"use client";

import { useParams } from "next/navigation";
import { MarketBar } from "../../components/trade/MarketBar";
import { Depth } from "../../components/trade/Depth";
import { SwapUI } from "../../components/trade/SwapUI";
import { TradeView } from "../../components/trade/TradeView";

export default function TradePage() {
  const { market } = useParams();

  return (
    <div className="flex flex-col w-full h-screen bg-[#0e0f14] text-white">
      {/* Top bar (Market info) */}
      <MarketBar market={market as string} />

      {/* Main content layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart Area - Expands more to use available space */}
        <div className="flex flex-col w-full lg:w-[calc(100%-600px)] md:w-[calc(100%-500px)] min-w-[320px] border-r border-slate-800">
          <TradeView market={market as string} />
        </div>

        {/* Order Book (pushes to the right edge) */}
        <div className="flex flex-col w-[350px] border-r border-slate-800 overflow-hidden">
          <Depth market={market as string} />
        </div>

        {/* Swap UI Panel (fixed size on large screens) */}
        <div className="flex flex-col w-[400px] overflow-hidden">
          <SwapUI market={market as string} />
        </div>
      </div>
    </div>
  );
}
