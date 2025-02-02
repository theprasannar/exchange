"use client";
import { useState } from "react";
import { createOrder } from "../../lib/api";
import toast from "react-hot-toast";

/**
 * Simple Swap UI with local state only. No real calls.
 */

export function SwapUI({ market }: { market: string }) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");


  const handleCreateorder = async () => {
    const loadingToast = toast.loading('Creating order...');
    try {
      const order = {
        market,
        price,
        quantity,
        side: activeTab,
        userId: "user11",
      };
      const response = await createOrder(order);
      toast.dismiss(loadingToast);
      toast.success("Order created successfully!");
      console.log(response);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to create order. Please try again.');
      console.error("Error creating order:", error);
    }
  }
  return (
    <div className="p-4 bg-[#0e0f14] h-full">
      {/* Buy/Sell Tabs */}
      <div className="flex bg-gray-800 rounded-lg">
        <button
          className={`flex-1 text-center py-3 ${
            activeTab === "buy" ? "bg-green-900/30 text-green-500 rounded-lg " : "text-gray-400"
          }`}
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </button>
        <button
          className={`flex-1 text-center py-3 ${
            activeTab === "sell" ? "bg-red-900/30 text-red-500" : "text-gray-400"
          }`}
          onClick={() => setActiveTab("sell")}
        >
          Sell
        </button>
      </div>

      {/* Limit/Market Selection */}
      <div className="mt-4 flex gap-4 text-sm">
        <button
          className={`py-1 px-2 rounded-md ${
            type === "limit" ? "bg-slate-800 text-white" : "text-gray-400"
          }`}
          onClick={() => setType("limit")}
        >
          Limit
        </button>
        <button
          className={`py-2 px-6 rounded-md ${
            type === "market" ? "bg-slate-800 text-white" : "text-gray-400"
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
            value={price}
            onChange={(e) => setPrice(e.target.value)}
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
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
            activeTab === "buy" ? "bg-green-600/70" : "bg-red-600/70"
          }`}
          onClick={handleCreateorder}
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
