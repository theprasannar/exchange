"use client";

import {
  Wallet,
  ChevronDown,
  LogOut,
  Menu,
  X,
  LineChart,
  LandmarkIcon,
  ShieldIcon,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useState } from "react";

export const Appbar = () => {
  const { token, email, logout } = useAuth();
  const isAuthenticated = Boolean(token);
  const router = useRouter();

  const userInitial = email ? email.charAt(0).toUpperCase() : "";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <nav className="w-full bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div
            className="flex items-center group cursor-pointer"
            onClick={() => router.push("/home")}
          >
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-1.5 rounded-lg mr-2 group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Nexus
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <a
              href="#"
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-zinc-800/50 transition-all duration-200"
            >
              <LineChart size={16} />
              <span>Trade</span>
            </a>
            <a
              href="#"
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-zinc-800/50 transition-all duration-200"
            >
              <LandmarkIcon size={16} />
              <span>Markets</span>
            </a>
            <a
              href="#"
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-zinc-800/50 transition-all duration-200"
            >
              <ShieldIcon size={16} />
              <span>Wallet</span>
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-medium">
                    {userInitial}
                  </div>
                  <span className="text-sm hidden lg:inline">{email}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg shadow-black/30 border border-zinc-700/50 overflow-hidden z-50">
                    <div className="py-2">
                      <a
                        onClick={() => router.push("/me")}
                        className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white cursor-pointer"
                      >
                        Profile
                      </a>
                      <button
                        onClick={logout}
                        className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => router.push("/auth/signin")}
                  className="px-4 py-2 text-zinc-300 hover:text-white transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden flex items-center">
            {isAuthenticated && (
              <div className="flex items-center mr-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-medium">
                  {userInitial}
                </div>
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-zinc-400 hover:text-white focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-800 border-b border-zinc-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <a
              href="#"
              className="block px-3 py-2 rounded-md text-base font-medium text-white bg-zinc-700"
            >
              Trade
            </a>
            <a
              href="#"
              className="block px-3 py-2 rounded-md text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-700"
            >
              Markets
            </a>
            <a
              href="#"
              className="block px-3 py-2 rounded-md text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-700"
            >
              Wallet
            </a>
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-red-300 hover:bg-zinc-700"
              >
                Sign out
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push("/auth/signin")}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-700"
                >
                  Sign in
                </button>
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-500 mt-2"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
