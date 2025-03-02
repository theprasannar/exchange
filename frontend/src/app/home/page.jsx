"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {useAuth} from "../../context/AuthContext"
import { useRouter } from "next/navigation";


// If you're using Redux for ticker data:
import { fetchTickerData } from "../store/tickerSlice";
import { useAppDispatch, useAppSelector } from "../hooks/hooks";

export default function Home() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const ticker = useAppSelector((state) => state.ticker);

  // Always call the hook for auth redirection
  useEffect(() => {
    if (!isLoading && !token) {
      router.push("/auth/signin");
    }
  }, [token, isLoading, router]);

  // Always call this effect, but conditionally dispatch
  useEffect(() => {
    if (!isLoading) {
      dispatch(fetchTickerData("BTC_USDC"));
    }
  }, [dispatch, isLoading]);

  // Conditionally render your UI based on isLoading
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-[#0e0f14] min-h-screen text-white">
      {/* ====== Banner Section ====== */}
      {/* ====== Banner Section ====== */}
      <section className="relative w-full p-8 flex justify-center">
        <div className="relative max-w-[1200px] w-full bg-[#121418] rounded-lg overflow-hidden">
          {/* Background Image */}
          <Image
            src="/images/banner.webp" // Replace with your actual image path
            alt="Trading Banner"
            layout="fill"
            objectFit="cover"
            className="opacity-40"
          />

          {/* Text Content */}
          <div className="relative p-8 z-10 text-left">
            <h1 className="text-4xl font-bold mb-4 text-white">
              Start Trading
            </h1>
            <p className="text-gray-300 mb-6 text-lg">
              Trade Bitcoin, Ethereum, and your favorite assets instantly.
            </p>
            <button className="bg-green-500 text-[#121418] px-6 py-3 rounded-md text-lg font-semibold transition-colors">
              Trade Now
            </button>
          </div>
        </div>
      </section>

      {/* ====== Single BTC Market Section ====== */}
      <section className="w-full p-8 flex flex-col items-center">
        <div className="max-w-[1200px] w-full bg-[#121418] rounded-lg p-8">
          <h2 className="text-xl font-semibold mb-4">Spot Markets</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700 text-sm">
                  <th className="py-2">Market</th>
                  <th className="py-2">Last Price</th>
                  <th className="py-2">24h Change</th>
                  <th className="py-2">24h Volume</th>
                </tr>
              </thead>
              <tbody>
                {/* Single BTC/USDC row */}
                <tr className="border-b border-gray-700 hover:bg-gray-800/30 transition-colors text-sm">
                  <td className="py-2 flex items-center space-x-2">
                    {/* Coin Icons */}
                    <Image
                      src="/images/btc.webp"
                      alt="BTC"
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                    <Link
                      href="/trade/BTC_USDC"
                      className="hover:underline underline-offset-2"
                    >
                      BTC / USDC
                    </Link>
                  </td>
                  <td className="py-2">
                    {ticker.lastPrice ? `$${ticker.lastPrice}` : "--"}
                  </td>
                  <td className="py-2">
                    {/* If you track price change in ticker, you can display it. Otherwise static */}
                    +2.4%
                  </td>
                  <td className="py-2">
                    {ticker.volume ? ticker.volume : "--"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
