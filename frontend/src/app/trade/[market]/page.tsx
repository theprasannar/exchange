"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";

import { MarketBar } from "../../components/trade/MarketBar";
import { TradeView } from "../../components/trade/TradeView"; // TradingView stays the same
import { SwapUI } from "../../components/trade/SwapUI";
import { BookTradesPanel } from "../../components/trade/BookTrade";
import OpenOrders from "../../components/trade/OpenOrders";
import { Depth } from "../../components/trade/Depth";

export default function TradePage() {
  const { market } = useParams();
  const router = useRouter();
  const { token, isLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<"orderbook" | "trades">(
    "orderbook"
  );

  useEffect(() => {
    if (!isLoading && !token) router.push("/auth/signin");
  }, [token, isLoading, router]);

  if (isLoading) return null;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-900 text-white">
      {/* HEADER / MARKET BAR */}
      <div className="p-4 border-b border-zinc-800">
        <MarketBar market={market as string} />
      </div>

      <div className="flex flex-col flex-1 p-3 md:p-4 lg:p-6 gap-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Chart */}
          <div className="col-span-12 lg:col-span-6 bg-zinc-800/50 rounded-xl backdrop-blur-sm border border-zinc-700/50">
            <TradeView market={market as string} />
          </div>

          {/* Order Book & Trades Tabbed View */}
          <div className="col-span-12 lg:col-span-3 bg-zinc-800/50 rounded-xl backdrop-blur-sm border border-zinc-700/50 h-[600px]">
            <div className="h-[calc(100%-44px)] overflow-y-auto">
              <BookTradesPanel market={market as string} />
            </div>
          </div>

          {/* Trading Panel */}
          <div className="col-span-12 lg:col-span-3 bg-zinc-800/50 rounded-xl backdrop-blur-sm border border-zinc-700/50">
            <SwapUI market={market as string} />
          </div>
        </div>

        {/* Open Orders */}
        <div className="bg-zinc-800/50 rounded-xl backdrop-blur-sm border border-zinc-700/50 p-4">
          <h3 className="text-sm font-medium text-blue-400 border-b-1 border-blue-400 mb-3">
            Open Orders
          </h3>
          <OpenOrders market={market as string} />
        </div>
      </div>

      {/* Footer */}
      <footer className="p-4 text-center text-zinc-500 text-xs border-t border-zinc-800">
        <span>Nexus Exchange• {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
