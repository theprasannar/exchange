"use client";

import { usePathname, useRouter } from "next/navigation";
import { PrimaryButton, SuccessButton, DangerButton } from "../core/Button";
import { useAuth } from "../../../context/AuthContext";
import Image from "next/image";
import { ChevronDown, LogOut, Wallet } from "lucide-react";

export const Appbar = () => {
  const route = usePathname();
  const router = useRouter();
  const { token, email, logout } = useAuth();
  const isAuthenticated = Boolean(token);
  const userInitial = email ? email : null;

  const handleLogout = () => {
    logout();
    router.push("/auth/signin");
  };

  const handleNavigation = () => {
    if (isAuthenticated) {
      router.push("/home");
    }
  };

  return (
    <div className="text-white border-slate-800">
      <div className="flex justify-between items-center p-2">
        <div
          onClick={() => router.push("/home")}
          className="flex items-center cursor-pointer"
        >
          <Wallet className="w-6 h-6 text-[#4A9C6D]" />
          <span className="ml-2 text-lg font-medium text-white">Nexus</span>
        </div>
{/* 
        {isAuthenticated && (
          <div className="hidden md:flex items-center space-x-8">
            <a
              href="#"
              className="text-[#808191] hover:text-white transition-colors"
            >
              Trade
            </a>
            <a
              href="#"
              className="text-[#808191] hover:text-white transition-colors"
            >
              Markets
            </a>
            <a
              href="#"
              className="text-[#808191] hover:text-white transition-colors"
            >
              Wallet
            </a>
          </div>
        )} */}
        <div className="flex">
          {isAuthenticated ? (
            // Show User Initial & Logout if logged in
            <>
              {/* User Menu */}
              <div className="flex items-center space-x-3 cursor-pointer px-3 py-2 rounded-lg hover:bg-[#1E2027] transition-colors">
                <span
                  onClick={() => router.push("/me")}
                  className="text-[#808191]"
                >
                  {email}
                </span>
                <ChevronDown className="w-4 h-4 text-[#808191]" />
              </div>
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </>
          ) : (
            // Show Sign up & Sign in if not logged in
            <div className="p-2 mr-2">
              <SuccessButton onClick={() => router.push("/auth/signup")}>
                Sign up
              </SuccessButton>
              <PrimaryButton onClick={() => router.push("/auth/signin")}>
                Sign in
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
