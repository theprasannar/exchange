"use client";


import { useParams } from "next/navigation";
import { MarketBar } from "../../components/trade/MarketBar";
import { Depth } from "../../components/trade/Depth";
import { SwapUI } from "../../components/trade/SwapUI";
import { TradeView } from "../../components/trade/TradeView";


/**
 * Layout for individual market trades, now using static data in the child components.
 */
export default function TradePage() {
  const { market } = useParams();

  return (
    <div className="flex flex-row flex-1">
      <div className="flex flex-col flex-1">
        <MarketBar market={market as string} />
        <div className="flex flex-row border-y border-slate-800">
        <div className="flex flex-col flex-1 min-w-0 max-w-[calc(100% - 250px)]">
  <TradeView market={market as string} />
</div>

          <div className="flex flex-col w-[250px] overflow-hidden">
            <Depth market={market as string} />
          </div>
        </div>
      </div>
      <div className="w-[10px] flex-col border-slate-800 border-l"></div>
      <div>
        <div className="flex flex-col">
          <SwapUI market={market as string} />
        </div>
      </div>
    </div>
  );
}
