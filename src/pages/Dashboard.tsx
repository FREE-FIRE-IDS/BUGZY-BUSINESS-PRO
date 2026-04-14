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
  History,
  ShoppingCart,
  Receipt,
  Package,
  Sparkles,
  Search,
  Download,
  Upload,
  Clock
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { getBusinessInsights } from '../services/geminiService';
import { differenceInDays, addDays } from 'date-fns';

export default function Dashboard() {
  const { transactions, parties, banks, settings, items, invoices, currentCompany, backupData, restoreData, isDeviceLicensed, isLicensed } = useApp();
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const trialInfo = useMemo(() => {
    const isPaid = currentCompany?.is_paid || isLicensed();
    if (!currentCompany || isPaid) return null;
    const start = new Date(currentCompany.trial_start || currentCompany.created_at);
    const end = addDays(start, 20);
    const daysLeft = differenceInDays(end, new Date());
    return { daysLeft: Math.max(0, daysLeft), end };
  }, [currentCompany, isLicensed]);

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          restoreData(e.target.result);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

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
            setAiError('AI quota exceeded. Please select your own API key.');
          } else {
            setAiError('AI insights are currently unavailable.');
          }
        }
      }
    };
    fetchInsights();
  }, [transactions, parties, banks]);

  const stats = useMemo(() => {
    const sales = transactions.filter(t => t.type === 'Sale' || t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'Expense' || t.type === 'Payment Out').reduce((sum, t) => sum + t.amount, 0);
    const toReceive = parties.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
    const toPay = parties.reduce((sum, p) => sum + (p.balance < 0 ? Math.abs(p.balance) : 0), 0);
    const cashInHand = transactions.filter(t => !t.bank_id).reduce((sum, t) => {
      if (t.type === 'Sale' || t.type === 'Income') return sum + t.amount;
      if (t.type === 'Expense' || t.type === 'Payment Out') return sum - t.amount;
      return sum;
    }, 0);
    const bankBalance = banks.reduce((sum, b) => sum + b.balance, 0);

    return {
      sales,
      expenses,
      profit: sales - expenses,
      toReceive,
      toPay,
      cashInHand,
      bankBalance,
      totalParties: parties.length,
      totalItems: items.length,
      totalSales: invoices.filter(i => i.type === 'Sale').length,
      totalPurchases: invoices.filter(i => i.type === 'Purchase').length
    };
  }, [transactions, parties, banks, items, invoices]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTxs = transactions.filter(t => t.date.startsWith(date));
      return {
        name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        sales: dayTxs.filter(t => t.type === 'Sale' || t.type === 'Income').reduce((sum, t) => sum + t.amount, 0),
        expenses: dayTxs.filter(t => t.type === 'Expense' || t.type === 'Payment Out').reduce((sum, t) => sum + t.amount, 0)
      };
    });
  }, [transactions]);

  const navigateTo = (tab: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: tab }));
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      {/* License Status & Backup Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          {isLicensed() ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <Sparkles size={16} />
              <span className="text-sm font-bold">Pro Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-800">
              <Clock size={16} />
              <span className="text-sm font-bold">Trial Mode</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={backupData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-sm font-bold"
          >
            <Download size={16} /> Backup
          </button>
          <button 
            onClick={handleRestore}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-sm font-bold"
          >
            <Upload size={16} /> Restore
          </button>
        </div>
      </div>

      {/* Summary Cards (To Receive / To Pay) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <p className="text-emerald-100 text-sm font-medium mb-1">You'll Receive</p>
            <h3 className="text-4xl font-black mb-4">{formatCurrency(stats.toReceive, settings.currency)}</h3>
            <button 
              onClick={() => navigateTo('parties')}
              className="flex items-center gap-2 text-sm font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-all"
            >
              View Parties <ChevronRight size={16} />
            </button>
          </div>
          <ArrowDownLeft className="absolute -right-4 -bottom-4 text-white/10 w-40 h-40 group-hover:scale-110 transition-transform duration-500" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-rose-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-500/20 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <p className="text-rose-100 text-sm font-medium mb-1">You'll Pay</p>
            <h3 className="text-4xl font-black mb-4">{formatCurrency(stats.toPay, settings.currency)}</h3>
            <button 
              onClick={() => navigateTo('parties')}
              className="flex items-center gap-2 text-sm font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-all"
            >
              View Bills <ChevronRight size={16} />
            </button>
          </div>
          <ArrowUpRight className="absolute -right-4 -bottom-4 text-white/10 w-40 h-40 group-hover:scale-110 transition-transform duration-500" />
        </motion.div>
      </div>

      {/* Grid Cards (Sale, Purchase, Stock, Parties) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {[
          { id: 'invoices', label: 'Sale', icon: ShoppingCart, color: 'bg-blue-500', count: stats.totalSales },
          { id: 'invoices', label: 'Purchase', icon: Receipt, color: 'bg-orange-500', count: stats.totalPurchases },
          { id: 'inventory', label: 'Stock', icon: Package, color: 'bg-indigo-500', count: stats.totalItems },
          { id: 'parties', label: 'Parties', icon: Users, color: 'bg-purple-500', count: stats.totalParties },
        ].map((item, idx) => (
          <motion.button
            key={item.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => navigateTo(item.id)}
            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group active:scale-95"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform", item.color)}>
              <item.icon size={24} />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.label}</span>
            <span className="text-xs text-slate-500 mt-1">{item.count} Entries</span>
          </motion.button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sales Overview Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Sales Overview</h3>
              <p className="text-sm text-slate-500">Last 7 days performance</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="text-xs font-medium text-slate-500">Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-xs font-medium text-slate-500">Expenses</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#f43f5e" 
                  strokeWidth={3}
                  fill="none"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash & Bank Status */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-slate-50">Cash & Bank</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Cash In Hand</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatCurrency(stats.cashInHand, settings.currency)}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
              
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">Bank Balance</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatCurrency(stats.bankBalance, settings.currency)}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            </div>
            
            <button 
              onClick={() => navigateTo('banks')}
              className="w-full mt-6 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all"
            >
              Manage Accounts
            </button>
          </div>

          {/* AI Insights Section */}
          <div className="bg-slate-900 dark:bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={20} className="text-indigo-400 dark:text-indigo-200" />
                <h3 className="text-lg font-bold">AI Insights</h3>
              </div>
              <div className="space-y-3">
                {aiError ? (
                  <p className="text-slate-400 dark:text-indigo-100 text-xs italic">{aiError}</p>
                ) : aiInsights.length > 0 ? (
                  aiInsights.slice(0, 2).map((insight, i) => (
                    <p key={i} className="text-slate-300 dark:text-indigo-50 text-xs leading-relaxed">
                      • {insight}
                    </p>
                  ))
                ) : (
                  <p className="text-slate-400 dark:text-indigo-100 text-xs italic">Analyzing your business data...</p>
                )}
              </div>
              <button 
                onClick={() => navigateTo('settings')}
                className="w-full mt-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
              >
                Configure AI
              </button>
            </div>
            <Sparkles className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 group-hover:rotate-12 transition-transform duration-700" />
          </div>
        </div>
      </div>
    </div>
  );
}

