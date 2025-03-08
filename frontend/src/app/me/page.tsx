"use client"
import { useState } from 'react';
// import { LogOut, Wallet as WalletIcon, TrendingUp, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function Dashboard() {
  const router = useRouter();
  const { email, logout } = useAuth();
  const [addAmount, setAddAmount] = useState('');
  const [addingFunds, setAddingFunds] = useState(false);

  // Simulated wallet data
  const wallet = {
    usdc_balance: 1000.00,
    btc_balance: 0.05,
    eth_balance: 1.5,
    btc_price: 63000,
    eth_price: 3500
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingFunds(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Funds added successfully!');
      setAddAmount('');
    } catch (error) {
      toast.error('Failed to add funds');
    } finally {
      setAddingFunds(false);
    }
  };

  const handleSignOut = async () => {
    logout();
    router.push('/login');
    toast.success('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-[#0e0f14]">
      {/* <nav className="bg-[#1A1F2E] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <WalletIcon className="h-8 w-8 text-[#00D7E7]" />
              <span className="ml-2 text-xl font-bold text-white">Crypto Exchange</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">{email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center text-gray-400 hover:text-white"
              >
                <LogOut className="h-5 w-5 mr-1" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav> */}

      <main className="w-4/5 mx-auto">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-[#0e0f14] rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Portfolio Overview</h2>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-customGray p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-300">USDC Balance</h3>
                  {/* <TrendingUp className="h-5 w-5 text-[#00D7E7]" /> */}
                </div>
                <p className="mt-2 text-3xl font-bold text-white">
                  ${wallet.usdc_balance.toFixed(2)}
                </p>
              </div>
              <div className="bg-customGray p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-300">Bitcoin (BTC)</h3>
                  {/* <ArrowUpRight className="h-5 w-5 text-green-400" /> */}
                </div>
                <p className="mt-2 text-3xl font-bold text-white">
                  {wallet.btc_balance.toFixed(8)} BTC
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  ${(wallet.btc_balance * wallet.btc_price).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-bold text-white mb-4">Add Funds</h3>
              <form onSubmit={handleAddFunds} className="flex gap-4">
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Enter USDC amount"
                  step="0.01"
                  min="0"
                  className="flex-1 px-4 py-3 bg-customGray border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00D7E7] focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={addingFunds}
                  className="px-6 py-3 rounded-xl text-white bg-customGray border border-slate-50/40 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00D7E7] font-medium"
                >
                  {addingFunds ? 'Adding...' : 'Add Funds'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}