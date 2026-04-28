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
  Clock,
  FileText
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
import { motion, AnimatePresence } from 'motion/react';
import { getBusinessInsights } from '../services/geminiService';
import { differenceInDays, addDays } from 'date-fns';

export default function Dashboard() {
  const app = useApp();
  
  if (!app) {
    return (
      <div className="p-8 text-center animate-pulse">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Loading Dashboard...</p>
      </div>
    );
  }

  const { 
    transactions = [], 
    parties = [], 
    banks = [], 
    settings = { currency: 'PKR' }, 
    items = [], 
    invoices = [], 
    currentCompany = null, 
    backupData, 
    restoreData, 
    isLicensed = () => false, 
    isTrialExpired = false 
  } = app;
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const trialInfo = useMemo(() => {
    const isPaid = currentCompany?.is_paid || isLicensed();
    if (!currentCompany || isPaid) return null;
    const start = new Date(currentCompany.trial_start || currentCompany.created_at);
    // Even if isTrialExpired is true, we still want to show the days for UI
    const end = addDays(start, 7);
    const daysLeft = differenceInDays(end, new Date());
    return { daysLeft: Math.max(0, daysLeft), end, expired: isTrialExpired };
  }, [currentCompany, isLicensed, isTrialExpired]);

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
    const cashInHand = transactions
      .filter(t => t.company_id === currentCompany?.id)
      .reduce((sum, t) => {
        if (t.type === 'Withdraw') return sum + t.amount;
        if (t.type === 'Deposit') return sum - t.amount;
        if (!t.bank_id && !t.to_bank_id) {
          if (['Sale', 'Income', 'Payment In', 'Stock In', 'Bank To Party'].includes(t.type)) return sum + t.amount;
          if (['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Party To Bank'].includes(t.type)) return sum - t.amount;
        }
        return sum;
      }, 0) + 
      invoices
        .filter(i => i.company_id === currentCompany?.id && i.status === 'Paid' && i.payment_type === 'Cash')
        .reduce((sum, i) => i.type === 'Sale' ? sum + i.total : sum - i.total, 0);
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

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    
    return {
      parties: parties.filter(p => p.name.toLowerCase().includes(query) || p.phone?.includes(query)),
      banks: banks.filter(b => b.name.toLowerCase().includes(query) || b.account_number.toLowerCase().includes(query) || b.bank_name?.toLowerCase().includes(query)),
      transactions: transactions.filter(t => 
        (t.description?.toLowerCase().includes(query)) || 
        (t.type.toLowerCase().includes(query)) ||
        (t.amount.toString().includes(query))
      ).slice(0, 5),
      invoices: invoices.filter(i => 
        i.invoice_number.toLowerCase().includes(query) || 
        i.party_name?.toLowerCase().includes(query) ||
        (parties.find(p => p.id === i.party_id)?.name.toLowerCase().includes(query)) ||
        i.total.toString().includes(query)
      ).slice(0, 5),
      items: items.filter(i => i.name.toLowerCase().includes(query) || i.sku?.toLowerCase().includes(query))
    };
  }, [searchQuery, parties, banks, transactions, items, invoices]);

  const navigateTo = (tab: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: tab }));
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      {/* Header with Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 font-medium mt-1">Welcome back to your business overview</p>
        </div>

        <div className="relative flex-1 max-w-md w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Search transactions, parties..."
            value={searchQuery}
            onFocus={() => setIsSearching(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
          />
          
          <AnimatePresence>
            {isSearching && searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl z-50 overflow-hidden"
              >
                <div className="max-h-[400px] overflow-y-auto p-2">
                  {searchResults && (Object.values(searchResults) as any[]).some(arr => arr.length > 0) ? (
                    <>
                      {searchResults.parties.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Parties</p>
                          {searchResults.parties.map(p => (
                            <button key={p.id} onClick={() => navigateTo('parties')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                                  <Users size={16} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.name}</span>
                              </div>
                              <span className={cn("text-xs font-black", p.balance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {formatCurrency(Math.abs(p.balance), settings.currency)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.banks.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Banks</p>
                          {searchResults.banks.map(b => (
                            <button key={b.id} onClick={() => navigateTo('banks')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                                  <Building2 size={16} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{b.name}</span>
                              </div>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {formatCurrency(b.balance, settings.currency)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.invoices.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Invoices</p>
                          {searchResults.invoices.map(i => (
                            <button key={i.id} onClick={() => navigateTo('invoices')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
                                  <FileText size={16} />
                                </div>
                                <div className="text-left">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block">#{i.invoice_number}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{parties.find(p => p.id === i.party_id)?.name || i.party_name}</span>
                                </div>
                              </div>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {formatCurrency(i.total, settings.currency)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.items.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Inventory</p>
                          {searchResults.items.map(i => (
                            <button key={i.id} onClick={() => navigateTo('inventory')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                                  <Package size={16} />
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{i.name}</span>
                              </div>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {i.stock} {i.unit}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.transactions.length > 0 && (
                        <div className="mb-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Recent Transactions</p>
                          {searchResults.transactions.map(t => (
                            <button key={t.id} onClick={() => navigateTo('reports')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", t.amount >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                  {t.amount >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                </div>
                                <div className="text-left">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block">{t.description || t.type}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">{new Date(t.date).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                {formatCurrency(t.amount, settings.currency)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-sm text-slate-500 font-medium">No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setIsSearching(false)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 hover:text-slate-900 transition-all"
                >
                  Close Search
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* License Status & Backup Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          {isLicensed() ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800">
              <Sparkles size={16} />
              <span className="text-sm font-bold">Pro Active</span>
            </div>
          ) : (
            <button 
              onClick={() => navigateTo('settings')}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl border border-amber-400 shadow-lg shadow-amber-500/20 animate-pulse active:scale-95 transition-all"
            >
              <Sparkles size={16} />
              <span className="text-sm font-black uppercase tracking-wider">Buy Premium</span>
            </button>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <p className="text-emerald-100 text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">You'll Receive</p>
            <h3 className="text-2xl md:text-4xl font-black mb-4">{formatCurrency(stats.toReceive, settings.currency)}</h3>
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
          className="bg-rose-500 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] text-white shadow-xl shadow-rose-500/20 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <p className="text-rose-100 text-xs md:text-sm font-medium mb-1 uppercase tracking-wider">You'll Pay</p>
            <h3 className="text-2xl md:text-4xl font-black mb-4">{formatCurrency(stats.toPay, settings.currency)}</h3>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* Sales Overview Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Sales Overview</h3>
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
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-base md:text-lg font-bold mb-6 text-slate-900 dark:text-white uppercase tracking-tight">Cash & Bank</h3>
            <div className="space-y-3">
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
              
              <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
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
          <div className="bg-slate-900 dark:bg-indigo-600 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
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

