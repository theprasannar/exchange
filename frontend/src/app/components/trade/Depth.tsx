"use client";
import { useEffect } from "react";
import { Depth as DepthType } from "../../types/types";
import { fetchDepthData, subscribeDepth } from "../../store/depthSlice";
import { RootState } from "../../store/store";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
import AsksTable from "./AsksTable";
import BidsTable from "./BidsTable";

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
    <div className="p-2 text-white bg-customGray">
      <TableHeader />
      <AsksTable asks={asks} />
      <BidsTable bids={bids} />
    </div>
  );
}


function TableHeader() {
  return (
    <div className="flex justify-between text-sm p-2">
    <p>Price(USDC)</p>
    <p>Size</p>
    <p>Total</p>

  </div>
  )
}