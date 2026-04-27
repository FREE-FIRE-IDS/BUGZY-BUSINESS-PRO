import React, { useMemo, useState } from 'react';
import { 
  Search, 
  Bell, 
  Share2, 
  Menu,
  FileText,
  ShoppingCart,
  LayoutList,
  Users,
  Plus
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function Dashboard() {
  const { transactions, parties, items, settings, currentCompany } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const toReceive = parties.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
    const toPay = parties.reduce((sum, p) => sum + (p.balance < 0 ? Math.abs(p.balance) : 0), 0);

    return {
      toReceive,
      toPay
    };
  }, [parties]);

  const navigateTo = (tab: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: tab }));
  };

  const actionCards = [
    { id: 'invoices-sale', label: 'Sale list', icon: FileText, color: 'text-[#008ba3]' },
    { id: 'invoices-purchase', label: 'Purchase List', icon: ShoppingCart, color: 'text-[#008ba3]' },
    { id: 'inventory', label: 'Stock Items', icon: LayoutList, color: 'text-[#008ba3]' },
    { id: 'parties', label: 'Parties', icon: Users, color: 'text-[#008ba3]' },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Custom Header from Image */}
      <div className="bg-[#008ba3] p-4 pt-6 pb-12">
        <div className="flex items-center gap-4 mb-6">
          <button className="text-white hover:bg-white/10 p-1 rounded-lg transition-colors">
            <Menu size={28} />
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="text"
              placeholder="Search Transactions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#007a8f] text-white placeholder:text-white/70 pl-4 pr-12 py-3 rounded-md border border-[#009bb3] focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70" size={20} />
          </div>

          <div className="flex items-center gap-2">
            <button className="text-white hover:bg-white/10 p-2 rounded-full transition-colors relative">
              <Bell size={24} />
              <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-[#008ba3]" />
            </button>
            <button className="text-white hover:bg-white/10 p-2 rounded-full transition-colors">
              <Share2 size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content (Shifted up to overlap header slightly if needed, but the image shows them below) */}
      <div className="px-4 -mt-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#e9f7ef] p-4 py-6 rounded-lg border border-[#d4edda] text-center shadow-sm">
            <p className="text-[#155724] text-xs font-semibold mb-2">To Receive</p>
            <p className="text-[#28a745] text-xl font-bold tracking-tight">
              {formatCurrency(stats.toReceive, settings.currency)}
            </p>
          </div>
          <div className="bg-[#fdf2f2] p-4 py-6 rounded-lg border border-[#f8d7da] text-center shadow-sm">
            <p className="text-[#721c24] text-xs font-semibold mb-2">To Pay</p>
            <p className="text-[#f39c12] text-xl font-bold tracking-tight">
              {formatCurrency(stats.toPay, settings.currency)}
            </p>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
          {actionCards.map((card) => (
            <button
              key={card.label}
              onClick={() => navigateTo(card.id)}
              className="bg-white p-8 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-slate-50 flex flex-col items-center justify-center gap-4 active:scale-95 transition-all"
            >
              <card.icon size={48} className={card.color} strokeWidth={1.5} />
              <span className="text-[#008ba3] font-semibold text-base">{card.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
