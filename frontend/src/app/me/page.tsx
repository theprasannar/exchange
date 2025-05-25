"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getUserBalance, addBalance } from "../lib/api";
import { Wallet, TrendingUp, LogOut, Plus, ArrowUpRight } from "lucide-react";

interface Balance {
  USDC: {
    available: string;
    locked: string;
  };
  BTC: {
    available: string;
    locked: string;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const { userId, email, logout } = useAuth();
  const [addAmount, setAddAmount] = useState("");
  const [addingFunds, setAddingFunds] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, [userId]);

  const fetchBalance = async () => {
    if (!userId) return;

    try {
      const balanceData = await getUserBalance(userId);
      setBalance(balanceData);
    } catch (error) {
      toast.error("Failed to fetch balance");
      console.error("Balance fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !addAmount) return;

    setAddingFunds(true);

    try {
      await addBalance(userId, addAmount);
      toast.success("Funds added successfully!");
      setAddAmount("");
      await fetchBalance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add funds");
      console.error("Add funds error:", error);
    } finally {
      setAddingFunds(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        <div className="w-4/5 mx-auto pt-20">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-zinc-700/50 backdrop-blur-xl bg-zinc-800/40">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-3"></div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Balance Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="backdrop-blur-xl bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-zinc-400 font-medium">USDC Balance</h3>
                <p className="text-3xl font-medium mt-2 text-white">
                  ${balance?.USDC.available}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-sky-500/10">
                <TrendingUp className="w-5 h-5 text-sky-500" />
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-zinc-400">
              <span>Locked:</span>
              <span className="font-medium text-zinc-300">
                ${balance?.USDC.locked}
              </span>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-zinc-400 font-medium">Bitcoin (BTC)</h3>
                <p className="text-3xl font-medium mt-2 text-white">
                  {balance?.BTC.available}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-sky-500/10">
                <TrendingUp className="w-5 h-5 text-sky-500" />
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-zinc-400">
              <span>Locked:</span>
              <span className="font-medium text-zinc-300">
                {balance?.BTC.locked} BTC
              </span>
            </div>
          </div>
        </div>

        {/* Add Funds */}
        <div className="backdrop-blur-xl bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-6">
          <h2 className="text-xl font-medium text-white mb-6">
            Add USDC Funds
          </h2>
          <form onSubmit={handleAddFunds} className="flex gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-zinc-400">$</span>
              </div>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
                min="0"
                step="0.01"
              />
            </div>
            <button
              type="submit"
              disabled={!addAmount || addingFunds}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-xl font-medium text-white transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
            >
              {addingFunds ? (
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Add Funds</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
