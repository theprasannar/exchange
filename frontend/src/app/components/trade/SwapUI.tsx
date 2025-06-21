"use client";

import { useEffect, useState } from "react";
import { createOrder, getUserBalance } from "../../lib/api";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { Balance } from "../../types/types";
import { useAppSelector } from "../../hooks/hooks";

export function SwapUI({ market }: { market: string }) {
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [slider, setSlider] = useState(0);
  const [ioc, setIoc] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const lastPrice = useAppSelector((state) => state.ticker.lastPrice);

  const [baseAsset, quoteAsset] = market.split("_");

  const calculateTotal = () => {
    const qty = parseFloat(quantity);
    if (!qty) return "0.00";

    const p = type === "limit" ? parseFloat(price) : parseFloat(lastPrice);
    if (!p) return "0.00";

    return (p * qty).toFixed();
  };

  useEffect(() => {
    if (!balance) return;

    const pct = slider / 100;
    if (activeTab == "buy") {
      const quoteBalance = parseFloat(balance?.USDC?.available || "0");
      const p = type === "limit" ? parseFloat(price) : parseFloat(lastPrice);

      if (!p) {
        setQuantity("");
        return;
      }
      const amount = (quoteBalance * pct) / p;
      setQuantity(amount.toFixed(6));
    } else {
      const baseBalance = parseFloat(balance?.BTC?.available || "0");
      const amount = baseBalance * pct;
      setQuantity(amount.toFixed(6));
    }
  }, [slider, price, balance, type, activeTab, lastPrice]);
  const fetchBalance = async () => {
    if (!userId) return;

    try {
      const balanceData = await getUserBalance(userId);
      setBalance(balanceData);
    } catch (error) {
      toast.error("Failed to fetch balance");
      console.error("Balance fetch error:", error);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [userId]);

  const handleCreateOrder = async () => {
    if (!userId) return toast.error("Please login first");
    if (!quantity || (type === "limit" && !price)) {
      return toast.error("Please enter required fields");
    }

    const loadingToast = toast.loading("Creating order...");
    try {
      const order = {
        market,
        price: type === "market" ? undefined : price,
        quantity,
        side: activeTab,
        userId,
        orderType: type,
        ioc,
        postOnly,
      };
      await createOrder(order);
      toast.dismiss(loadingToast);
      toast.success("Order placed!");
      setQuantity("");
      if (type === "limit") setPrice("");
      setSlider(0);
    } catch (err: any) {
      toast.dismiss(loadingToast);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to create order";
      toast.error(errorMsg);
      console.error("Order failed:", err);
    }
  };

  const handleCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "ioc" | "postOnly"
  ) => {
    if (type === "ioc") {
      setIoc(e.target.checked);
      setPostOnly(false);
    }
    if (type === "postOnly") {
      setPostOnly(e.target.checked);
      setIoc(false);
    }
  };

  return (
    <div className="p-4">
      {/* Buy/Sell Tabs */}
      <div className="flex rounded-lg bg-zinc-900/50 p-1 mb-4">
        <button
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            activeTab === "buy"
              ? "bg-green-500/20 text-green-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setActiveTab("buy")}
        >
          Buy {baseAsset}
        </button>
        <button
          className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
            activeTab === "sell"
              ? "bg-red-500/20 text-red-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setActiveTab("sell")}
        >
          Sell {baseAsset}
        </button>
      </div>

      {/* Order Type Tabs */}
      <div className="flex rounded-lg bg-zinc-900/50 p-1 mb-4">
        <button
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
            type === "limit"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setType("limit")}
        >
          Limit
        </button>
        <button
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
            type === "market"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setType("market")}
        >
          Market
        </button>
      </div>

      {/* Price Input (only for Limit) */}
      {type === "limit" && (
        <div className="mb-4">
          <label className="block text-xs text-zinc-400 mb-1">Price</label>
          <div className="relative">
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg py-2 px-3 text-right pr-16 text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
              placeholder="0.00"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
              {quoteAsset}
            </div>
          </div>
        </div>
      )}

      {/* Quantity Input */}
      <div className="mb-8">
        <label className="block text-xs text-zinc-400 mb-1">Amount</label>
        <div className="relative">
          <input
            type="text"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-lg py-2 px-3 text-right pr-16 text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="0.00"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
            {baseAsset}
          </div>
        </div>
      </div>

      {/* Percentage Slider with Floating Tooltip */}
      <div className="relative w-full mb-4">
        {/* Floating Tooltip */}
        <div
          className="absolute text-sm text-blue-400 whitespace-nowrap transition-all"
          style={{
            left: `${slider}%`,
            transform: "translateX(-50%)",
            bottom: `calc(100% + 4px)`,
          }}
        >
          {slider}%
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={slider}
          onChange={(e) => setSlider(parseInt(e.target.value))}
          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
        />

        {/* Quick-Select Buttons */}
        <div className="flex justify-between mt-2">
          {[0, 25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setSlider(pct)}
              className={`text-xs py-1 px-2 rounded ${
                slider === pct
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Total Row */}
      <div className="mb-6">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-400">
            {type === "market"
              ? activeTab === "buy"
                ? "Est. Cost:"
                : "Est. Receive:"
              : "Total:"}
          </span>

          <span className="text-white">
            {calculateTotal()} {quoteAsset}
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleCreateOrder}
        className={`w-full py-3 rounded-lg font-medium transition ${
          activeTab === "buy"
            ? "bg-green-600 hover:bg-green-500"
            : "bg-red-600 hover:bg-red-500"
        } text-white`}
      >
        {activeTab === "buy" ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
      </button>

      {type == "limit" && (
        <div className="mt-5 flex items-center gap-4 text-zinc-400">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ioc}
              onChange={(e) => handleCheckboxChange(e, "ioc")}
              className="appearance-none h-4 w-4 border border-zinc-600 bg-zinc-900 checked:bg-zinc-900 checked:border-zinc-400 rounded-sm checked:after:content-['✔'] checked:after:text-white checked:after:text-xs checked:after:block checked:after:text-center checked:after:leading-4"
            />
            IOC
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={postOnly}
              onChange={(e) => handleCheckboxChange(e, "postOnly")}
              className="appearance-none h-4 w-4 border border-zinc-600 bg-zinc-900 checked:bg-zinc-900 checked:border-zinc-400 rounded-sm checked:after:content-['✔'] checked:after:text-white checked:after:text-xs checked:after:block checked:after:text-center checked:after:leading-4"
            />
            Post Only
          </label>
        </div>
      )}
    </div>
  );
}
