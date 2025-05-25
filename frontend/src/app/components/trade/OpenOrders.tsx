"use client";

import React, { useEffect, useState } from "react";
import { XCircleIcon } from "lucide-react";
import { Order } from "../../types/types";
import { cancelOrder, getOpenOrders } from "../../lib/api";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";

const OpenOrders = ({ market }: { market: string }) => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useAuth();

  const fetchOpenOrders = async () => {
    const dummyOrders: Order[] = [
      {
        orderId: "ORD-001",
        side: "buy",
        price: "45800.00",
        quantity: "0.1000",
        filled: "0.0500",
        status: "PARTIALLY_FILLED",
        createdAt: new Date().toISOString(),
      },
      {
        orderId: "ORD-002",
        side: "sell",
        price: "46000.00",
        quantity: "0.2000",
        filled: "0.0000",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
      {
        orderId: "ORD-003",
        side: "buy",
        price: "45750.00",
        quantity: "0.1500",
        filled: "0.1500",
        status: "FILLED",
        createdAt: new Date().toISOString(),
      },
      {
        orderId: "ORD-004",
        side: "sell",
        price: "46100.00",
        quantity: "0.3000",
        filled: "0.0500",
        status: "PARTIALLY_FILLED",
        createdAt: new Date().toISOString(),
      },
      {
        orderId: "ORD-005",
        side: "buy",
        price: "45600.00",
        quantity: "0.5000",
        filled: "0.0000",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
      {
        orderId: "ORD-006",
        side: "sell",
        price: "46200.00",
        quantity: "0.2500",
        filled: "0.2500",
        status: "FILLED",
        createdAt: new Date().toISOString(),
      },
    ];

    setOpenOrders(dummyOrders);
  };

  // ✅ Moved OUTSIDE and runs on load
  useEffect(() => {
    fetchOpenOrders();
  }, [market]);
  const handleCancel = async (orderId: string) => {
    setCancelingId(orderId);
    try {
      await cancelOrder(orderId);
      toast.success("Order cancelled successfully");
      fetchOpenOrders();
    } catch (error) {
      setError(error as string);
      toast.error("Error cancelling order");
    } finally {
      setCancelingId(null);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getFillPercent = (order: Order) => {
    const filled = parseFloat(order.filled || "0");
    const qty = parseFloat(order.quantity || "1");
    return ((filled / qty) * 100).toFixed(0);
  };

  // if (loading) return <div className="p-4 text-zinc-400">Loading...</div>;
  if (error) return <div className="p-4 text-red-400">Error: {error}</div>;

  return (
    <div className="w-full">
      {openOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
          <p>No open orders</p>
          <p className="text-xs mt-1">Your active orders will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Filled</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map((order) => (
                <tr
                  key={order.orderId}
                  className="border-b border-zinc-800/30 hover:bg-zinc-800/30"
                >
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs ${
                        order.side === "buy"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {order.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{order.price}</td>
                  <td className="px-3 py-2 font-mono">{order.quantity}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-zinc-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            order.side === "buy" ? "bg-green-500" : "bg-red-500"
                          }`}
                          style={{ width: `${getFillPercent(order)}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {getFillPercent(order)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">
                    {formatTime(order.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleCancel(order.orderId)}
                      disabled={cancelingId === order.orderId}
                      className="text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <XCircleIcon size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OpenOrders;
