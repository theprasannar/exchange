"use client";

import React, { useEffect, useState } from "react";
import { XCircleIcon } from "lucide-react";
import { Order } from "../../types/types";
import { cancelOrder, getOpenOrders } from "../../lib/api";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import { useAppSelector } from "../../hooks/hooks";
import { useDispatch } from "react-redux";
import {
  fetchOpenOrders,
  subscribeToOpenOrder,
} from "../../store/openOrderSlice";
import { AnyAction, ThunkDispatch } from "@reduxjs/toolkit";

const OpenOrders = ({ market }: { market: string }) => {
  const openOrders = useAppSelector((state) => state.openOrder.openOrders);
  console.log(openOrders);
  const dispatch: ThunkDispatch<any, any, AnyAction> = useDispatch();

  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<
    string | null
  >(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { userId } = useAuth();
  const payload = { market, userId };

  useEffect(() => {
    //@ts-ignore
    dispatch(fetchOpenOrders(payload));

    const unsubscribe = dispatch(subscribeToOpenOrder(market, userId!));

    return () => {
      unsubscribe();
    };
  }, [market, userId]);

  const handleCancel = async (orderId: string) => {
    setCancelingId(orderId);
    try {
      await cancelOrder(orderId, market, userId);
      toast.success("Order cancelled successfully");
      //@ts-ignore
      dispatch(fetchOpenOrders(payload));
    } catch (error) {
      setError(error as string);
      toast.error("Error cancelling order");
    } finally {
      setCancelingId(null);
    }
  };

  const formatTime = (timestamp: string) => {
    console.log(timestamp);
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
              {openOrders?.map((order) => (
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
                      onClick={() => setConfirmCancelOrderId(order.orderId)}
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
          {confirmCancelOrderId && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl p-6 max-w-sm w-full">
                <h2 className="text-lg font-medium text-zinc-100 mb-2">
                  Cancel Order?
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  Are you sure you want to cancel this order?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmCancelOrderId(null)}
                    className="px-4 py-1 text-sm bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
                  >
                    No
                  </button>
                  <button
                    onClick={() => {
                      handleCancel(confirmCancelOrderId);
                      setConfirmCancelOrderId(null);
                    }}
                    className="px-4 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-500"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OpenOrders;
