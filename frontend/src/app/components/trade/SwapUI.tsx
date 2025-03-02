"use client";
import { useState } from "react";
import { createOrder } from "../../lib/api";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";

export function SwapUI({ market }: { market: string }) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const { userId } = useAuth();

  const handleCreateOrder = async () => {
    if (!userId) {
      toast.error("Please login first");
      return;
    }
    if (!quantity || (type === "limit" && !price)) {
      toast.error("Please enter required fields.");
      return;
    }

    const loadingToast = toast.loading("Creating order...");
    try {
      const order = {
        market,
        price: type === "market" ? undefined : price, // Remove price for market orders
        quantity,
        side: activeTab,
        userId: userId,
        orderType: type, // Explicitly add the order type
      };

      const response = await createOrder(order);
      toast.dismiss(loadingToast);
      toast.success("Order created successfully!");
      console.log(response);
    } catch (error) {
      console.log(error);
      toast.dismiss(loadingToast);
      toast.error("Failed to create order. Please try again.");
    }
  };

  return (
    <div className="p-4 rounded-lg">
      {/* Buy/Sell Tabs */}
      <div className="flex rounded-lg">
        <button
          className={`flex-1 text-center py-3 ${
            activeTab === "buy" ? "bg-green-900/30 text-green-500 rounded-lg" : "text-gray-400"
          }`}
          onClick={() => setActiveTab("buy")}
        >
          Buy
        </button>
        <button
          className={`flex-1 text-center py-3 ${
            activeTab === "sell" ? "bg-red-900/30 text-red-500 rounded-lg" : "text-gray-400"
          }`}
          onClick={() => setActiveTab("sell")}
        >
          Sell
        </button>
      </div>

      {/* Limit/Market Selection */}
      <div className="mt-4 flex gap-4 text-sm">
        <button
          className={`py-1 px-2 rounded-md ${type === "limit" ? "bg-slate-800 text-white" : "text-gray-400"}`}
          onClick={() => setType("limit")}
        >
          Limit
        </button>
        <button
          className={`py-2 px-6 rounded-md ${type === "market" ? "bg-slate-800 text-white" : "text-gray-400"}`}
          onClick={() => setType("market")}
        >
          Market
        </button>
      </div>

      {/* Price Input (Hidden in Market Order) */}
      {type === "limit" && (
        <div className="mt-4">
          <label className="text-gray-400 text-sm">Price</label>
          <div className="relative">
            <input
              type="text"
              className="w-full h-12 bg-[#202127] bg-opacity-75 border border-gray-700 rounded-lg text-right pr-12 text-xl text-white"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <div className="absolute right-3 top-3">
              <img src="/images/usdc.webp" className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Quantity Input */}
      <div className="mt-4">
        <label className="text-gray-400 text-sm">Quantity</label>
        <div className="relative">
          <input
            type="text"
            className="w-full h-12 bg-[#202127] bg-opacity-75 border border-gray-700 rounded-lg text-right pr-12 text-xl text-white"
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
          onClick={handleCreateOrder}
        >
          {activeTab === "buy" ? "Buy" : "Sell"}
        </button>
      </div>
    </div>
  );
}
