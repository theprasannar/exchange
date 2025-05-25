// "use client";
// import { useState, useEffect } from "react";
// import { Depth as DepthType } from "../../types/types";
// import { fetchDepthData, subscribeDepth } from "../../store/depthSlice";
// import { useAppDispatch, useAppSelector } from "../../hooks/hooks";
// import AsksTable from "./AsksTable";
// import BidsTable from "./BidsTable";
// import { Trades } from "./Trade";
// export function BookTradesPanel({ market }: { market: string }) {
//   const dispatch = useAppDispatch();
//   // Depth slice data
//   const { bids, asks } = useAppSelector((state) => state.depth);

//   // local state to toggle between "book" or "trades"
//   const [activeTab, setActiveTab] = useState<"book" | "trades">("book");

//   // Fetch Depth & subscribe
//   useEffect(() => {
//     dispatch(fetchDepthData(market));
//     const unsubscribe = dispatch(subscribeDepth(market));
//     return () => {
//       if (typeof unsubscribe === "function") {
//         unsubscribe();
//       }
//     };
//   }, [dispatch, market]);

//   return (
//     <div className="flex flex-col w-full h-full bg-customGray rounded-lg p-2">
//       {/* Tab Buttons */}
//       <div className="flex space-x-4 pb-2 border-b border-gray-700">
//         <button
//           className={`text-sm px-3 py-1 rounded ${
//             activeTab === "book" ? "bg-gray-800 text-white" : "text-gray-400"
//           }`}
//           onClick={() => setActiveTab("book")}
//         >
//           Book
//         </button>
//         <button
//           className={`text-sm px-3 py-1 rounded ${
//             activeTab === "trades" ? "bg-gray-800 text-white" : "text-gray-400"
//           }`}
//           onClick={() => setActiveTab("trades")}
//         >
//           Trades
//         </button>
//       </div>

//       {activeTab === "book" ? (
//         <>
//           <TableHeader />
//           <div className="flex-1 orderbook-scroll overflow-y-auto custom-scrollbar">
//             <AsksTable asks={asks} />
//             <BidsTable bids={bids} />
//           </div>
//         </>
//       ) : (
//         // Show the Trades component
//         <div className="flex-1 overflow-y-auto">
//           <Trades market={market} />
//         </div>
//       )}
//     </div>
//   );
// }

// function TableHeader() {
//   return (
//     <div className="flex justify-between text-sm p-2 rounded-md">
//       <p>Price(USDC)</p>
//       <p>Size</p>
//       <p>Total</p>
//     </div>
//   );
// }

"use client";
import { useState } from "react";
import OrderBook from "./OrderBookLive";
import RecentTrades from "./RecentTradesLive";

export function BookTradesPanel({ market }: { market: string }) {
  const [activeTab, setActiveTab] = useState<"book" | "trades">("book");

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-zinc-700/50">
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === "book"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setActiveTab("book")}
        >
          Order Book
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === "trades"
              ? "text-blue-400 border-b-2 border-blue-400"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
          onClick={() => setActiveTab("trades")}
        >
          Recent Trades
        </button>
      </div>

      <div className="h-[calc(100%-44px)] overflow-y-auto">
        {activeTab === "book" ? (
          <OrderBook market={market} />
        ) : (
          <RecentTrades market={market} />
        )}
      </div>
    </div>
  );
}
