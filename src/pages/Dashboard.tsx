import React, { useMemo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign,
  Users,
  Building2,
  ChevronRight,
  Plus,
  ArrowLeftRight,
  History
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';

import { getBusinessInsights } from '../services/geminiService';

export default function Dashboard() {
  const { transactions, parties, banks, settings, items } = useApp();
  const { theme } = useTheme();
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      if (transactions.length > 0) {
        try {
          const insights = await getBusinessInsights(transactions, parties, banks);
          setAiInsights(insights);
          setAiError(null);
        } catch (error: any) {
          const msg = error.message || '';
          if (msg === 'RATE_LIMIT_EXCEEDED' || msg.toLowerCase().includes('quota')) {
            setAiError('AI quota exceeded. Please select your own API key to continue using business insights.');
          } else {
            setAiError('AI insights are currently unavailable.');
            console.error('Gemini Error:', error);
          }
        }
      }
    };
    fetchInsights();
  }, [transactions, parties, banks]);

  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
      await aiStudio.openSelectKey();
      // After selecting a key, try fetching insights again
      if (transactions.length > 0) {
        try {
          const insights = await getBusinessInsights(transactions, parties, banks);
          setAiInsights(insights);
          setAiError(null);
        } catch (e) {
          console.error('Retry after key selection failed:', e);
        }
      }
    }
  };

  const stats = useMemo(() => {
    const totalSales = transactions.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'Expense' || t.type === 'Payment Out').reduce((sum, t) => sum + t.amount, 0);
    const totalPurchases = transactions.filter(t => t.type === 'Purchase').reduce((sum, t) => sum + t.amount, 0);
    const profit = totalSales - totalExpenses;
    const cashInHand = banks.reduce((sum, b) => sum + b.balance, 0);
    const toReceive = parties.filter(p => p.balance > 0).reduce((sum, p) => sum + p.balance, 0);
    const toPay = parties.filter(p => p.balance < 0).reduce((sum, p) => sum + Math.abs(p.balance), 0);
    const stockValue = items.reduce((sum, i) => sum + (i.stock * i.price), 0);
    const lowStocks = items.filter(i => i.stock < 10);

    return { totalSales, totalExpenses, totalPurchases, profit, cashInHand, toReceive, toPay, stockValue, lowStocks };
  }, [transactions, parties, banks, items]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTxs = transactions.filter(t => t.date.startsWith(date));
      const sales = dayTxs.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.amount, 0);
      const expenses = dayTxs.filter(t => t.type === 'Expense').reduce((sum, t) => sum + t.amount, 0);
      return {
        name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        sales,
        expenses
      };
    });
  }, [transactions]);

  const navigateTo = (tab: string) => {
    const event = new CustomEvent('navigate', { detail: tab });
    window.dispatchEvent(event);
  };

  return (
    <div className={cn(
      "space-y-8 min-h-screen -m-8 p-8 transition-colors duration-300",
      theme === 'dark' ? "bg-slate-950" : "bg-slate-50"
    )}>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="xl:col-span-3 space-y-6">
          {/* Top Row: Sale & Expenses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-emerald-600" size={20} />
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">Sale</h3>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalSales, settings.currency)}</p>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-400 mt-4 text-center uppercase tracking-wider">Report: From 01 Apr to 30 Apr</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="text-rose-600" size={20} />
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">Expenses</h3>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalExpenses, settings.currency)}</p>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-400 mt-4 text-center uppercase tracking-wider">Report: From 01 Apr to 30 Apr</p>
            </motion.div>
          </div>

          {/* Middle Row: Cash Flow & Purchase */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600">
                  <ArrowDownLeft size={20} />
                </div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300">You'll Receive</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mb-4 shadow-inner">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.toReceive, settings.currency)}</p>
              </div>
              <div className="space-y-2">
                {parties.filter(p => p.balance > 0).slice(0, 3).map(p => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(p.balance, settings.currency)}</span>
                  </div>
                ))}
                {stats.toReceive > 0 && <button onClick={() => navigateTo('parties')} className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase mt-2 hover:underline">+ View More</button>}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600">
                  <ArrowUpRight size={20} />
                </div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300">You'll Pay</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mb-4 shadow-inner">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.toPay, settings.currency)}</p>
              </div>
              <div className="space-y-2">
                {parties.filter(p => p.balance < 0).slice(0, 3).map(p => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
                    <span className="font-bold text-rose-600">{formatCurrency(Math.abs(p.balance), settings.currency)}</span>
                  </div>
                ))}
                {stats.toPay > 0 && <button onClick={() => navigateTo('parties')} className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase mt-2 hover:underline">+ View More</button>}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
                  <Plus size={20} />
                </div>
                <h3 className="font-bold text-slate-700 dark:text-slate-300">Purchase</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mb-4 shadow-inner">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.totalPurchases, settings.currency)}</p>
              </div>
              <div className="flex flex-col items-center justify-center h-20 text-slate-400">
                <p className="text-[10px] text-center">You have no purchased items entered for selected time.</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Sidebar Area */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Stock Inventory</h3>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
              <p className="text-xs text-slate-500 mb-1">Stock Value</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(stats.stockValue, settings.currency)}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Low Stocks</h3>
            <div className="space-y-3">
              {stats.lowStocks.length > 0 ? stats.lowStocks.slice(0, 5).map(item => (
                <div key={item.id} className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold">{item.stock}</span>
                </div>
              )) : (
                <p className="text-[10px] text-slate-400 text-center py-4">None of your stocks has low value</p>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Cash & Bank</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">Cash In hand</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(stats.cashInHand, settings.currency)}</span>
              </div>
              <div className="pt-4 border-t border-slate-50 dark:border-slate-800 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bank Accounts</p>
                {banks.slice(0, 3).map(bank => (
                  <div key={bank.id} className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{bank.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(bank.balance, settings.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* AI Insights Section */}
          <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-500/20 text-white">
            <h3 className="text-sm font-bold mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History size={16} />
                AI Insights
              </div>
              {aiError && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setAiError(null);
                      // Trigger a re-fetch by toggling a dummy state or just calling the function
                      // For simplicity, we'll just wait for the next effect trigger or manually call it
                      const fetchInsights = async () => {
                        if (transactions.length > 0) {
                          try {
                            const insights = await getBusinessInsights(transactions, parties, banks);
                            setAiInsights(insights);
                            setAiError(null);
                          } catch (error: any) {
                            setAiError(error.message === 'RATE_LIMIT_EXCEEDED' ? 'AI quota exceeded. Please select your own API key.' : 'Failed to fetch insights.');
                          }
                        }
                      };
                      fetchInsights();
                    }}
                    className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    Retry
                  </button>
                  <button 
                    onClick={handleSelectKey}
                    className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    Select API Key
                  </button>
                </div>
              )}
            </h3>
            <div className="space-y-3">
              {aiError ? (
                <div className="bg-white/10 p-3 rounded-2xl text-[10px] leading-relaxed italic">
                  {aiError}
                </div>
              ) : (
                aiInsights.slice(0, 2).map((insight, i) => (
                  <div key={i} className="bg-white/10 p-3 rounded-2xl text-[10px] leading-relaxed">
                    {insight}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

