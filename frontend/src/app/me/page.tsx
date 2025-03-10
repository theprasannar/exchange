"use client"
import { useState, useEffect } from 'react';
// import { LogOut, Wallet as WalletIcon, TrendingUp, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getUserBalance, addBalance } from '../lib/api';
import { Wallet, TrendingUp, LogOut, Plus } from 'lucide-react';


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
  const [addAmount, setAddAmount] = useState('');
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
      toast.error('Failed to fetch balance');
      console.error('Balance fetch error:', error);
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
      toast.success('Funds added successfully!');
      setAddAmount('');
      await fetchBalance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add funds');
      console.error('Add funds error:', error);
    } finally {
      setAddingFunds(false);
    }
  };

  const handleSignOut = async () => {
    logout();
    router.push('/login');
    toast.success('Signed out successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0f] text-white">
        <div className="w-4/5 mx-auto pt-20">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-white">
    {/* Header */}
    <header className="w-full px-6 py-4 bg-[#12131A] border-b border-[#1E2027]">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Wallet className="w-6 h-6 text-[#4A9C6D]" />
          <h1 className="text-xl font-medium">Crypto Dashboard</h1>
        </div>
      </div>
    </header>

    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Portfolio Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* USDC Card */}
        <div className="p-6 rounded-xl bg-[#12131A] border border-[#1E2027]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-[#808191] font-medium">USDC Balance</h3>
              <p className="text-3xl font-medium mt-2">${balance?.USDC.available}</p>
            </div>
            <div className="p-2 rounded-lg bg-[#1E2027]">
              <TrendingUp className="w-5 h-5 text-[#4A9C6D]" />
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-[#808191]">
            <span>Locked:</span>
            <span className="font-medium">${balance?.USDC.locked}</span>
          </div>
        </div>

        {/* BTC Card */}
        <div className="p-6 rounded-xl bg-[#12131A] border border-[#1E2027]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-[#808191] font-medium">Bitcoin (BTC)</h3>
              <p className="text-3xl font-medium mt-2">{balance?.BTC.available}</p>
            </div>
            <div className="p-2 rounded-lg bg-[#1E2027]">
              <TrendingUp className="w-5 h-5 text-[#4A9C6D]" />
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-[#808191]">
            <span>Locked:</span>
            <span className="font-medium">{balance?.BTC.locked} BTC</span>
          </div>
        </div>
      </div>

      {/* Add Funds Section */}
      <div className="mt-12">
        <h2 className="text-xl font-medium mb-6">Add USDC Funds</h2>
        <form onSubmit={handleAddFunds} className="flex gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-[#808191]">$</span>
            </div>
            <input
              type="number"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full pl-8 pr-4 py-3 bg-[#12131A] border border-[#1E2027] rounded-lg text-white placeholder-[#808191] focus:outline-none focus:border-[#4A9C6D] transition-colors"
              min="0"
              step="0.01"
            />
          </div>
          <button
            type="submit"
            disabled={!addAmount}
            className="flex items-center space-x-2 px-6 py-3 bg-[#4A9C6D] rounded-lg font-medium hover:bg-[#3D815A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#4A9C6D]"
          >
            <Plus className="w-5 h-5" />
            <span>Add Funds</span>
          </button>
        </form>
      </div>
    </main>
  </div>
);
}