"use client";
import { useEffect } from "react";
import { Depth as DepthType } from "../../types/types";
import { fetchDepthData, subscribeDepth } from "../../store/depthSlice";
import { RootState } from "../../store/store";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import AsksTable from "./AsksTable";
import BidsTable from "./BidsTable";
import { SwapUI } from "./SwapUI";

export function Depth({ market }: { market: string }) {
  const dispatch = useAppDispatch();
  const { bids, asks } = useAppSelector((state: RootState) => state.depth);

  useEffect(() => {
    dispatch(fetchDepthData(market));
    const unsubscribe = dispatch(subscribeDepth(market));
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [dispatch, market]);

  return (
    <div className="flex flex-col w-full h-full bg-customGray rounded-lg p-2">
    {/* Book / Trades Tab */}
    <div className="flex space-x-4 pb-2 border-b border-gray-700">
      <button className="text-white text-sm px-3 py-1 rounded bg-gray-800">Book</button>
      <button className="text-gray-400 text-sm px-3 py-1 hover:text-white">Trades</button>
    </div>

    {/* Table Header */}
    <TableHeader />

    {/* 
      Make this inner container take remaining space (flex-1)
      and scroll if content overflows (overflow-y-auto).
    */}
    <div className="flex-1 orderbook-scroll h-full overflow-y-auto custom-scrollbar">
      <AsksTable asks={asks} />
      <BidsTable bids={bids} />
    </div>
  </div>
  );
}


function TableHeader() {
  return (
    <div className="flex justify-between text-sm p-2 rounded-md">
      <p>Price(USDC)</p>
      <p>Size</p>
      <p>Total</p>
    </div>
  );
}
