"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useAppDispatch, useAppSelector } from "../hooks/hooks";
import { fetchTickerData } from "../store/tickerSlice";
import {
  ArrowUpRight,
  Bitcoin,
  DollarSign,
  LineChart,
  TrendingUp,
} from "lucide-react";

export default function Home() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const ticker = useAppSelector((state) => state.ticker);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push("/auth/signin");
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    if (!isLoading) {
      dispatch(fetchTickerData("BTC_USDC"));
    }
  }, [dispatch, isLoading]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white relative">
      {/* Ambient background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="relative mb-16">
          <div className="backdrop-blur-xl bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-8 md:p-12">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Trade with Confidence on Our{" "}
                <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">
                  Advanced Platform
                </span>
              </h1>
              <p className="text-zinc-400 text-lg mb-8">
                Experience seamless trading with real-time data, advanced
                charts, and institutional-grade security.
              </p>
              <Link href="/trade/BTC_USDC">
                <button className="bg-gradient-to-r from-sky-500 to-indigo-600 text-white px-8 py-4 rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 transform hover:-translate-y-0.5 flex items-center gap-2">
                  Start Trading Now
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Market Overview */}
        <section className="mb-16">
          <div className="backdrop-blur-xl bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Market Overview</h2>
              <Link href="/markets">
                <span className="text-sky-500 hover:text-sky-400 transition-colors flex items-center gap-2 cursor-pointer">
                  View All Markets
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-700/50 text-sm">
                    <th className="pb-4 text-left">Asset</th>
                    <th className="pb-4 text-right">Last Price</th>
                    <th className="pb-4 text-right">24h Change</th>
                    <th className="pb-4 text-right">24h Volume</th>
                    <th className="pb-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-700/50 hover:bg-zinc-700/20 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                          <Bitcoin className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Bitcoin</p>
                          <p className="text-zinc-400 text-sm">BTC / USDC</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <p className="text-white font-medium">
                        {ticker.lastPrice ? `$${ticker.lastPrice}` : "--"}
                      </p>
                    </td>
                    <td className="py-4 text-right">
                      <span className="text-emerald-500">+2.4%</span>
                    </td>
                    <td className="py-4 text-right">
                      <p className="text-white">
                        {ticker.volume ? `$${ticker.volume}` : "--"}
                      </p>
                    </td>
                    <td className="py-4 text-right">
                      <Link href="/trade/BTC_USDC">
                        <button className="bg-sky-500/10 text-sky-500 px-4 py-2 rounded-lg hover:bg-sky-500/20 transition-colors">
                          Trade
                        </button>
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
