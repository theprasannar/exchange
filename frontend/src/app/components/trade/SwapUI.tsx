"use client";
import { useState } from "react";

/**
 * Simple Swap UI with local state only. No real calls.
 */

export function SwapUI({ market }: { market: string }) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");

  return (
    <div className="p-4 bg-[#0e0f14] h-full">
      {/* Buy/Sell Tabs */}
      <div className="flex">
        <button
          className={`flex-1 text-center py-3 ${
            activeTab === "buy" ? "bg-green-900 text-green-500 border-b-2 border-green-500" : "text-gray-400 border-b border-gray-600"
          }`}
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </button>
        <button
          className={`flex-1 text-center py-3 ${
            activeTab === "sell" ? "bg-red-900 text-red-500 border-b-2 border-red-500" : "text-gray-400 border-b border-gray-600"
          }`}
          onClick={() => setActiveTab("sell")}
        >
          Sell
        </button>
      </div>

      {/* Limit/Market Selection */}
      <div className="mt-4 flex gap-4">
        <button
          className={`py-2 px-6 rounded-lg ${
            type === "limit" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"
          }`}
          onClick={() => setType("limit")}
        >
          Limit
        </button>
        <button
          className={`py-2 px-6 rounded-lg ${
            type === "market" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"
          }`}
          onClick={() => setType("market")}
        >
          Market
        </button>
      </div>

      {/* Price Input */}
      <div className="mt-4">
        <label className="text-gray-400 text-sm">Price</label>
        <div className="relative">
          <input
            type="text"
            className="w-full h-12 bg-gray-900 border border-gray-700 rounded-lg text-right pr-12 text-xl text-white"
            value="104,579.1"
            readOnly
          />
          <div className="absolute right-3 top-3">
            <img src="/images/usdc.webp" className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quantity Input */}
      <div className="mt-4">
        <label className="text-gray-400 text-sm">Quantity</label>
        <div className="relative">
          <input
            type="text"
            className="w-full h-12 bg-gray-900 border border-gray-700 rounded-lg text-right pr-12 text-xl text-white"
            value="0"
            readOnly
          />
          <div className="absolute right-3 top-3">
            <img src="/images/btc.webp" className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Buy/Sell Button */}
      <div className="mt-6">
        <button
          className={`w-full py-3 rounded-lg text-white font-bold ${
            activeTab === "buy" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {activeTab === "buy" ? "Buy" : "Sell"}
        </button>
      </div>

      {/* Options */}
      <div className="flex justify-between mt-4 text-gray-400 text-sm">
        <div>
          <input type="checkbox" id="postOnly" className="mr-2" />
          <label htmlFor="postOnly">Post Only</label>
        </div>
        <div>
          <input type="checkbox" id="ioc" className="mr-2" />
          <label htmlFor="ioc">IOC</label>
        </div>
      </div>
    </div>
  );
}



function LimitButton({ type, setType }: { type: string; setType: any }) {
  return (
    <div className="flex flex-col cursor-pointer justify-center py-2" onClick={() => setType("limit")}>
      <div
        className={`text-sm font-medium py-1 border-b-2 ${
          type === "limit"
            ? "border-accentBlue text-baseTextHighEmphasis"
            : "border-transparent text-baseTextMedEmphasis hover:border-baseTextHighEmphasis"
        }`}
      >
        Limit
      </div>
    </div>
  );
}

function MarketButton({ type, setType }: { type: string; setType: any }) {
  return (
    <div className="flex flex-col cursor-pointer justify-center py-2" onClick={() => setType("market")}>
      <div
        className={`text-sm font-medium py-1 border-b-2 ${
          type === "market"
            ? "border-accentBlue text-baseTextHighEmphasis"
            : "border-transparent text-baseTextMedEmphasis hover:border-baseTextHighEmphasis"
        }`}
      >
        Market
      </div>
    </div>
  );
}

function BuyButton({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: any }) {
  return (
    <div
      className={`flex flex-col mb-[-2px] flex-1 cursor-pointer justify-center border-b-2 p-4 ${
        activeTab === "buy" ? "border-b-greenBorder bg-greenBackgroundTransparent" : "border-b-baseBorderMed hover:border-b-baseBorderFocus"
      }`}
      onClick={() => setActiveTab("buy")}
    >
      <p className="text-center text-sm font-semibold text-greenText">Buy</p>
    </div>
  );
}

function SellButton({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: any }) {
  return (
    <div
      className={`flex flex-col mb-[-2px] flex-1 cursor-pointer justify-center border-b-2 p-4 ${
        activeTab === "sell" ? "border-b-redBorder bg-redBackgroundTransparent" : "border-b-baseBorderMed hover:border-b-baseBorderFocus"
      }`}
      onClick={() => setActiveTab("sell")}
    >
      <p className="text-center text-sm font-semibold text-redText">Sell</p>
    </div>
  );
}
