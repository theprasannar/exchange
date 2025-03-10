import React from 'react';
import { Wallet, ChevronDown, LogOut } from 'lucide-react';

interface NavbarProps {
  isAuthenticated?: boolean;
  email?: string;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onLogout?: () => void;
}

export function Navbar({ 
  isAuthenticated = false, 
  email = '', 
  onSignIn = () => {}, 
  onSignUp = () => {}, 
  onLogout = () => {} 
}: NavbarProps) {
  const userInitial = email ? email.charAt(0).toUpperCase() : '';

  return (
    <nav className="w-full bg-[#12131A] border-b border-[#1E2027]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center cursor-pointer">
            <Wallet className="w-6 h-6 text-[#4A9C6D]" />
            <span className="ml-2 text-lg font-medium text-white">Nexus</span>
          </div>

          {/* Navigation Links - Add more as needed */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-[#808191] hover:text-white transition-colors">Trade</a>
            <a href="#" className="text-[#808191] hover:text-white transition-colors">Markets</a>
            <a href="#" className="text-[#808191] hover:text-white transition-colors">Wallet</a>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* User Menu */}
                <div className="flex items-center space-x-3 cursor-pointer px-3 py-2 rounded-lg hover:bg-[#1E2027] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#1E2027] flex items-center justify-center text-sm font-medium">
                    {userInitial}
                  </div>
                  <span className="text-[#808191]">{email}</span>
                  <ChevronDown className="w-4 h-4 text-[#808191]" />
                </div>
                {/* Logout Button */}
                <button 
                  onClick={onLogout}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onSignIn}
                  className="px-4 py-2 text-[#808191] hover:text-white transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={onSignUp}
                  className="px-4 py-2 bg-[#4A9C6D] text-white rounded-lg hover:bg-[#3D815A] transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}