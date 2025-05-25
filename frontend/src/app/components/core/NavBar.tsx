import React, { useState } from "react";
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

interface NavbarProps {
  isAuthenticated?: boolean;
  email?: string;
  onSignIn?: () => void;
  onSignUp?: () => void;
  onLogout?: () => void;
}

export function Navbar({
  isAuthenticated = false,
  email = "",
  onSignIn = () => {},
  onSignUp = () => {},
  onLogout = () => {},
}: NavbarProps) {
  const userInitial = email ? email.charAt(0).toUpperCase() : "";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <nav className="w-full bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center group cursor-pointer">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-1.5 rounded-lg mr-2 group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                Nexus
              </span>
            </div>
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
                {/* User Profile Button */}
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-medium">
                    {email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm hidden lg:inline">{email}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </button>

                {/* User Menu Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg shadow-black/30 border border-zinc-700/50 overflow-hidden z-50">
                    <div className="py-2">
                      <a
                        href="#"
                        className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"
                      >
                        Profile
                      </a>
                      <a
                        href="#"
                        className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"
                      >
                        Settings
                      </a>
                      <a
                        href="#"
                        className="block px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white"
                      >
                        Activity
                      </a>
                      <div className="border-t border-zinc-700 my-1"></div>
                      <button
                        onClick={onLogout}
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
                  onClick={onSignIn}
                  className="px-4 py-2 text-zinc-300 hover:text-white transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={onSignIn}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            {isAuthenticated && (
              <div className="flex items-center mr-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-medium">
                  {email.charAt(0).toUpperCase()}
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

      {/* Mobile menu */}
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
                onClick={onLogout}
                className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-400 hover:text-red-300 hover:bg-zinc-700"
              >
                Sign out
              </button>
            ) : (
              <>
                <button
                  onClick={onSignIn}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-zinc-300 hover:text-white hover:bg-zinc-700"
                >
                  Sign in
                </button>
                <button
                  onClick={onSignIn}
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
}

{
  /* <nav className="w-full bg-[#12131A] border-b border-[#1E2027]"> */
}
//   <div className="max-w-7xl mx-auto px-4 sm:px-6">
//     <div className="flex justify-between items-center h-16">
//       {/* Logo */}
//       <div className="flex items-center cursor-pointer">
//         <Wallet className="w-6 h-6 text-[#4A9C6D]" />
//         <span className="ml-2 text-lg font-medium text-white">Nexus</span>
//       </div>

//       {/* Navigation Links - Add more as needed */}
//       <div className="hidden md:flex items-center space-x-8">
//         <a href="#" className="text-[#808191] hover:text-white transition-colors">Trade</a>
//         <a href="#" className="text-[#808191] hover:text-white transition-colors">Markets</a>
//         <a href="#" className="text-[#808191] hover:text-white transition-colors">Wallet</a>
//       </div>

//       {/* Auth Buttons */}
//       <div className="flex items-center space-x-4">
//         {isAuthenticated ? (
//           <>
//             {/* User Menu */}
//             <div className="flex items-center space-x-3 cursor-pointer px-3 py-2 rounded-lg hover:bg-[#1E2027] transition-colors">
//               <div className="w-8 h-8 rounded-full bg-[#1E2027] flex items-center justify-center text-sm font-medium">
//                 {userInitial}
//               </div>
//               <span className="text-[#808191]">{email}</span>
//               <ChevronDown className="w-4 h-4 text-[#808191]" />
//             </div>
//             {/* Logout Button */}
//             <button
//               onClick={onLogout}
//               className="flex items-center space-x-2 px-4 py-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
//             >
//               <LogOut className="w-4 h-4" />
//               <span>Logout</span>
//             </button>
//           </>
//         ) : (
//           <>
//             <button
//               onClick={onSignIn}
//               className="px-4 py-2 text-[#808191] hover:text-white transition-colors"
//             >
//               Sign in
//             </button>
//             <button
//               onClick={onSignUp}
//               className="px-4 py-2 bg-[#4A9C6D] text-white rounded-lg hover:bg-[#3D815A] transition-colors"
//             >
//               Sign up
//             </button>
//           </>
//         )}
//       </div>
//     </div>
//   </div>
// </nav>
