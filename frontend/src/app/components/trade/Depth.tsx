"use client";
import { useEffect, useState } from "react";
import { Depth as DepthType  } from "../../types/types";
import { fetchDepthData, updateDepth } from "../../store/depthSlice";
import { RootState } from "../../store/store";
import { useAppDispatch, useAppSelector } from "../../hooks/hooks";

export function Depth({ market }: { market: string }) {
  const [depth, setDepth] = useState<DepthType | null>(null);
  const dispatch = useAppDispatch();

  const {bids, asks, price} = useAppSelector((state : RootState)=> state.depth)

  useEffect(() => {
      dispatch(fetchDepthData(market));
  }, [market]);

  return (
    <div className="p-2 text-white bg-customGray">
      <h2>Depth for {market}</h2>
      <div className="flex">
        <div className="mr-4">
          <h3>Bids</h3>
          {depth?.bids.map((bid, i) => (
            <div key={i}>
              Price: {bid[0]}, Qty: {bid[1]}
            </div>
          ))}
        </div>
        <div>
          <h3>Asks</h3>
          {depth?.asks.map((ask, i) => (
            <div key={i}>
              Price: {ask[0]}, Qty: {ask[1]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/*
"use client";

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../store/store";
import { fetchDepthData, subscribeDepth, unsubscribeDepth } from "../../store/depthSlice";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";

export function Depth({ market }: { market: string }) {
    const dispatch = useDispatch();

    // Select data from Redux store
    const { bids, asks, price } = useSelector((state: RootState) => state.depth);

    useEffect(() => {
        // Subscribe to WebSocket updates and fetch initial data
        dispatch(subscribeDepth(market));
        dispatch(fetchDepthData(market));

        return () => {
            // Unsubscribe from WebSocket updates on cleanup
            dispatch(unsubscribeDepth(market));
        };
    }, [dispatch, market]);

    return (
        <div>
            <TableHeader />
            {asks && <AskTable asks={asks} />}
            {price && <div>{price}</div>}
            {bids && <BidTable bids={bids} />}
        </div>
    );
}

function TableHeader() {
    return (
        <div className="flex justify-between text-xs">
            <div className="text-white">Price</div>
            <div className="text-slate-500">Size</div>
            <div className="text-slate-500">Total</div>
        </div>
    );
}

 */