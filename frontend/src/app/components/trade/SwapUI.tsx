"use client";
import { useState } from "react";

/**
 * Simple Swap UI with local state only. No real calls.
 */
export function SwapUI({ market }: { market: string }) {
  const [amount, setAmount] = useState("");
  const [activeTab, setActiveTab] = useState("buy");
  const [type, setType] = useState("limit");

  return (
    <div>
      <div className="flex flex-col">
        <div className="flex flex-row h-[60px]">
          <BuyButton activeTab={activeTab} setActiveTab={setActiveTab} />
          <SellButton activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="px-3">
            <div className="flex flex-row flex-0 gap-5">
              <LimitButton type={type} setType={setType} />
              <MarketButton type={type} setType={setType} />
            </div>
          </div>
          <div className="flex flex-col px-3">
            <div className="flex flex-col gap-3 text-baseTextHighEmphasis">
              <div className="flex items-center justify-between flex-row">
                <p className="text-xs font-normal text-baseTextMedEmphasis">Available Balance</p>
                <p className="font-medium text-xs">36.94 USDC</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-normal text-baseTextMedEmphasis">Price</p>
                <div className="relative">
                  <input
                    step="0.01"
                    placeholder="0"
                    className="h-12 rounded-lg border-2 border-baseBorderLight bg-[var(--background)] pr-12 text-right text-2xl leading-9 placeholder-baseTextMedEmphasis focus:border-accentBlue"
                    type="text"
                    value="134.38"
                    readOnly
                  />
                  <div className="flex flex-row absolute right-1 top-1 p-2">
                    <img src="/usdc.webp" className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-normal text-baseTextMedEmphasis">Quantity</p>
              <div className="relative">
                <input
                  step="0.01"
                  placeholder="0"
                  className="h-12 rounded-lg border-2 border-baseBorderLight bg-[var(--background)] pr-12 text-right text-2xl leading-9 placeholder-baseTextMedEmphasis focus:border-accentBlue"
                  type="text"
                  value="123"
                  readOnly
                />
                <div className="flex flex-row absolute right-1 top-1 p-2">
                  <img src="/sol.webp" className="w-6 h-6" />
                </div>
              </div>
              <div className="flex justify-end">
                <p className="font-medium pr-2 text-xs text-baseTextMedEmphasis">≈ 0.00 USDC</p>
              </div>
              <div className="flex justify-center flex-row mt-2 gap-3">
                <div className="flex items-center justify-center rounded-full px-4 py-1 text-xs cursor-pointer bg-baseBackgroundL2 hover:bg-baseBackgroundL3">25%</div>
                <div className="flex items-center justify-center rounded-full px-4 py-1 text-xs cursor-pointer bg-baseBackgroundL2 hover:bg-baseBackgroundL3">50%</div>
                <div className="flex items-center justify-center rounded-full px-4 py-1 text-xs cursor-pointer bg-baseBackgroundL2 hover:bg-baseBackgroundL3">75%</div>
                <div className="flex items-center justify-center rounded-full px-4 py-1 text-xs cursor-pointer bg-baseBackgroundL2 hover:bg-baseBackgroundL3">Max</div>
              </div>
            </div>
            <button
              type="button"
              className="font-semibold focus:outline-none h-12 rounded-xl text-base px-4 py-2 my-4 bg-greenPrimaryButtonBackground text-greenPrimaryButtonText"
            >
              Buy
            </button>
            <div className="flex justify-between mt-1">
              <div className="flex items-center gap-2">
                <input className="form-checkbox h-5 w-5" type="checkbox" />
                <label className="text-xs">Post Only</label>
              </div>
              <div className="flex items-center gap-2">
                <input className="form-checkbox h-5 w-5" type="checkbox" />
                <label className="text-xs">IOC</label>
              </div>
            </div>
          </div>
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
