"use client";

import { useParams } from "next/navigation";
import { MarketBar } from "../../components/trade/MarketBar";
import { Depth } from "../../components/trade/Depth";
import { SwapUI } from "../../components/trade/SwapUI";
import { TradeView } from "../../components/trade/TradeView";
import { BookTradesPanel } from "../../components/trade/BookTrade";
import { useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";


export default function TradePage() {
  const { market } = useParams();
  const router = useRouter();
  const { token } = useAuth();


  useEffect(() => {
    if (!token) {
      router.push("/auth/signin");
    }
  }, [token, router]);
  return (
    <div className="flex w-full h-ful bg-[#0e0f14] text-white justify-center px-8 gap-2">
      <div className="w-full max-w-[90vw] md:max-w-[2100px] h-full mx-auto flex flex-col gap-2">
        {/* ✅ MarketBar at the top */}
        <div className="w-full bg-customGray px-4 py-2 rounded-xl">
          <MarketBar market={market as string} />
        </div>

        {/* ✅ Main Layout: TradeView + Depth (Without Swap UI) */}
        <div className="flex flex-row">
          {/* Chart & Order Book Container */}
          <div className="flex w-full min-h-[500px] space-x-2">
            {/* Chart Area */}
            <div className="flex flex-col w-full min-w-[320px] bg-customGray rounded-xl">
              <TradeView market={market as string} />
            </div>

            {/* Order Book */}
            <div className="flex flex-col w-[350px] min-w-[350px] bg-customGray rounded-xl h-[650px]">
              <BookTradesPanel market={market as string} />
            </div>
          </div>
        </div>

        {/* ✅ Below Chart & Depth: Balances / Orders Section (Now Fixed) */}
        <div className="w-full bg-customGray h-[150px] py-4 px-6 rounded-xl mt-0">
          <div className="flex space-x-6 text-gray-400 text-sm"></div>
        </div>
      </div>

      {/* ✅ Swap UI Separately Positioned on the Right */}
      <div className="w-[400px] min-w-[300px] bg-[#121418] overflow-hidden rounded-md">
        <SwapUI market={market as string} />
      </div>
    </div>
  );
}
