import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowUpRight, 
  ArrowDownLeft,
  Trash2,
  FileText,
  Download,
  Wallet,
  Users,
  X,
  Sparkles,
  Check
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Party, Transaction, TransactionType } from '../types';
import { generatePartyStatement } from '../lib/pdfGenerator';

export default function Parties() {
  const { parties, transactions, invoices, addParty, updateParty, deleteParty, addTransaction, updateTransaction, deleteTransaction, settings, banks, currentCompany, setSelectedPartyId, isLicensed, getPartyBalance } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [amountFilter, setAmountFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [hideZero, setHideZero] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  
  const partyTypes = useMemo(() => {
    const types = new Set(parties.map(p => p.type));
    return ['All', ...Array.from(types)];
  }, [parties]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);

  React.useEffect(() => {
    setSelectedPartyId(selectedParty?.id || null);
  }, [selectedParty, setSelectedPartyId]);
  
  const currentSelectedParty = useMemo(() => {
    if (!selectedParty) return null;
    return parties.find(p => p.id === selectedParty.id) || selectedParty;
  }, [selectedParty, parties]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      const balance = getPartyBalance(p.id);
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.phone?.includes(searchTerm);
      const matchesType = filterType === 'All' || p.type === filterType;
      
      let matchesAmount = true;
      if (amountFilter === 'positive') matchesAmount = balance > 0;
      else if (amountFilter === 'negative') matchesAmount = balance < 0;

      const matchesZero = hideZero ? Math.abs(balance) > 0.01 : true;
      
      return matchesSearch && matchesType && matchesAmount && matchesZero;
    });
  }, [parties, searchTerm, filterType, amountFilter, hideZero, transactions]);

  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [isLedgerSearchOpen, setIsLedgerSearchOpen] = useState(false);
  const [ledgerDateRange, setLedgerDateRange] = useState<'All' | 'This Month' | '7 Days'>('All');

  const partyLedger = useMemo(() => {
    if (!currentSelectedParty) return [];
    
    // Start with opening balance
    const openingEntry = {
      id: 'opening',
      date: currentSelectedParty.created_at,
      type: 'Opening Balance' as any,
      amount: currentSelectedParty.opening_balance,
      description: 'Initial balance at account creation',
      source: 'opening'
    };

    const partyTransactions = transactions
      .filter(t => t.party_id === currentSelectedParty.id || t.to_party_id === currentSelectedParty.id)
      .map(t => ({ ...t, source: 'transaction' }));
    
    const partyInvoices = invoices
      .filter(i => i.party_id === currentSelectedParty.id)
      .map(i => ({
        id: i.id,
        date: i.date,
        type: i.type as any, // 'Sale' or 'Purchase'
        amount: i.total,
        description: `Invoice #${i.invoice_number}`,
        source: 'invoice'
      }));

    return [openingEntry, ...partyTransactions, ...partyInvoices]
      .filter(entry => {
        // Date Filter
        if (ledgerDateRange === 'This Month') {
          const date = new Date(entry.date);
          const now = new Date();
          if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
        } else if (ledgerDateRange === '7 Days') {
          const date = new Date(entry.date);
          const now = new Date();
          const diff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
          if (diff > 7) return false;
        }

        if (!ledgerSearchTerm) return true;
        const lowSearch = ledgerSearchTerm.toLowerCase();
        return (
          entry.description?.toLowerCase().includes(lowSearch) ||
          entry.type?.toLowerCase().includes(lowSearch) ||
          entry.amount.toString().includes(lowSearch)
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [currentSelectedParty, transactions, invoices, ledgerSearchTerm, ledgerDateRange]);

  const handleExportPDF = () => {
    if (currentCompany && currentSelectedParty) {
      // Filter out the pseudo-entry for opening balance since the PDF generator adds its own
      const transactionsOnly = partyLedger.filter(tx => tx.id !== 'opening');
      generatePartyStatement(currentCompany, currentSelectedParty, transactionsOnly);
    }
  };

  return (
    <div className="space-y-6">
      {!isLicensed() && (
        <div className="bg-amber-500 text-white p-4 rounded-3xl flex items-center justify-between shadow-lg mb-6">
          <div className="flex items-center gap-3">
             <Sparkles size={20} className="animate-pulse" />
             <span className="font-bold text-sm uppercase">Upgrade to Premium for Party Management</span>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }))}
            className="bg-white text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase"
          >
            Upgrade
          </button>
        </div>
      )}
      {currentSelectedParty ? (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-white p-6 rounded-[2rem] border border-slate-100 dark:border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedParty(null)}
                className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all"
              >
                <X size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-black text-slate-900">{currentSelectedParty.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-md">{currentSelectedParty.type}</span>
                  <span className="text-xs text-slate-400">{currentSelectedParty.phone || 'No phone'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => { setEditingParty(currentSelectedParty); setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 border border-slate-100 rounded-xl hover:bg-slate-100 transition-all text-sm font-bold"
              >
                <FileText size={18} />
                Edit
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Payment In' }))}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold"
              >
                <Plus size={18} />
                New Transaction
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-slate-500 dark:text-slate-400 text-sm mb-1">Total Balance</h3>
              <p className={cn(
                "text-2xl font-bold",
                currentSelectedParty.balance >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatCurrency(currentSelectedParty.balance, settings.currency)}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {currentSelectedParty.balance >= 0 ? "You'll receive" : "You'll pay"}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative group">
              <button 
                onClick={() => { setEditingParty(currentSelectedParty); setIsAddModalOpen(true); }}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
              >
                <FileText size={16} />
              </button>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm mb-1">Party Type</h3>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{currentSelectedParty.type}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-slate-500 dark:text-slate-400 text-sm mb-1">Contact Info</h3>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{currentSelectedParty.phone || 'No phone'}</p>
              <p className="text-sm text-slate-400">{currentSelectedParty.email || 'No email'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 border-none">Transaction Ledger</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search ledger..."
                    value={ledgerSearchTerm}
                    onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-40 md:w-56 transition-all"
                  />
                </div>

                <select 
                  value={ledgerDateRange}
                  onChange={(e) => setLedgerDateRange(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                >
                  <option value="All">All Time</option>
                  <option value="This Month">This Month</option>
                  <option value="7 Days">Last 7 Days</option>
                </select>

                <div className="h-6 w-[1px] bg-slate-100 mx-1 secret" />

                <button 
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wider shadow-sm"
                >
                  <Download size={14} />
                  <span>PDF Statement</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold text-right">Debit</th>
                    <th className="px-6 py-4 font-semibold text-right">Credit</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {partyLedger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          tx.type === 'Opening Balance' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          tx.type === 'Sale' || tx.type === 'Payment In' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{tx.description || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                        {tx.type === 'Opening Balance' ? (tx.amount >= 0 ? formatCurrency(tx.amount, settings.currency) : '-') :
                         (tx.party_id === currentSelectedParty.id && (tx.type === 'Payment In' || tx.type === 'Sale' || tx.type === 'Bank To Party')) || (tx.to_party_id === currentSelectedParty.id) ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                        {tx.type === 'Opening Balance' ? (tx.amount < 0 ? formatCurrency(Math.abs(tx.amount), settings.currency) : '-') :
                         (tx.party_id === currentSelectedParty.id && (tx.type === 'Payment Out' || tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Party To Bank' || tx.type === 'Party To Party')) ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.id !== 'opening' && tx.source === 'transaction' && (
                          <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: tx }))}
                            className="flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors text-xs font-bold"
                          >
                            <FileText size={14} />
                            Edit
                          </button>
                          <button 
                            onClick={() => deleteTransaction(tx.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Ledger */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {partyLedger.map((tx) => (
                <div key={tx.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                      <p className="font-bold text-slate-900 dark:text-slate-900">{tx.description || tx.type}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      tx.type === 'Sale' || tx.type === 'Payment In' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                    )}>
                      {tx.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Debit</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-900">
                          {(tx.party_id === currentSelectedParty.id && (tx.type === 'Payment In' || tx.type === 'Sale' || tx.type === 'Bank To Party')) || (tx.to_party_id === currentSelectedParty.id) ? formatCurrency(tx.amount, settings.currency) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Credit</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-900">
                          {(tx.party_id === currentSelectedParty.id && (tx.type === 'Payment Out' || tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Party To Bank' || tx.type === 'Party To Party')) ? formatCurrency(tx.amount, settings.currency) : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => tx.source === 'transaction' && window.dispatchEvent(new CustomEvent('open-tx', { detail: tx }))}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"
                      >
                        <FileText size={16} />
                      </button>
                      <button 
                        onClick={() => tx.source === 'transaction' && deleteTransaction(tx.id)}
                        className="p-2 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {partyLedger.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No transactions found.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search parties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-white border border-slate-200 dark:border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-bold text-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative shrink-0 flex-1 sm:flex-none min-w-[120px]">
                  <button 
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className={cn(
                      "w-full px-4 py-3 bg-white dark:bg-white border text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm whitespace-nowrap",
                      (amountFilter !== 'all' || hideZero) ? "border-indigo-600 text-indigo-600 ring-4 ring-indigo-500/10" : "border-slate-100 text-slate-600"
                    )}
                  >
                    <Filter size={14} />
                    <span>{amountFilter === 'all' ? 'Filter' : amountFilter === 'positive' ? 'Receivable' : 'Payable'}</span>
                  </button>


                  <AnimatePresence>
                    {showFilterMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-2"
                        >
                          {[
                            { id: 'all', label: 'All Balances', icon: Users },
                            { id: 'positive', label: 'Receivable (>0)', icon: ArrowUpRight, color: 'text-emerald-600' },
                            { id: 'negative', label: 'Payable (<0)', icon: ArrowDownLeft, color: 'text-rose-600' },
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => {
                                setAmountFilter(opt.id as any);
                                setShowFilterMenu(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                                amountFilter === opt.id ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50 text-slate-600"
                              )}
                            >
                              <opt.icon size={16} className={opt.color} />
                              <span className="text-xs font-bold">{opt.label}</span>
                            </button>
                          ))}
                          <div className="mt-2 pt-2 border-t border-slate-50">
                            <button
                              onClick={() => {
                                setHideZero(!hideZero);
                                setShowFilterMenu(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                                hideZero ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-50 text-slate-600"
                              )}
                            >
                              <span className="text-xs font-bold text-left">Hide 0 Balance</span>
                              {hideZero && <Check size={14} />}
                            </button>
                          </div>
                   
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-white px-3 py-3 rounded-2xl border border-slate-100 shadow-sm shrink-0">
                  <span className="text-[9px] font-black uppercase text-slate-400">Hide 0</span>
                  <button 
                    onClick={() => setHideZero(!hideZero)}
                    className={cn(
                      "relative w-8 h-4 rounded-full transition-all duration-300 shrink-0",
                      hideZero ? "bg-red-500" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
                      hideZero ? "left-4.5" : "left-0.5"
                    )} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-white dark:bg-white p-1 rounded-xl border border-slate-200 dark:border-slate-200 overflow-x-auto max-w-md">
                {partyTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      filterType === type ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus size={20} />
                Add Party
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredParties.map((party) => (
              <motion.div
                key={party.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedParty(party)}
                className="bg-white dark:bg-white p-6 rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-xl">
                    {party.name.charAt(0)}
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    party.type === 'General' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  )}>
                    {party.type}
                  </span>
                </div>
                <h3 className="text-lg font-bold group-hover:text-indigo-600 transition-colors">{party.name}</h3>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone size={14} />
                    <span>{party.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Wallet size={14} />
                    <span className={cn(
                      "font-bold",
                      party.balance >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {formatCurrency(party.balance, settings.currency)}
                    </span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-end items-center">
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingParty(party); setIsAddModalOpen(true); }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <FileText size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsDeleteConfirmOpen(party.id); }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {filteredParties.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Users size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">No parties found</h3>
                <p className="text-slate-500">Try adjusting your search or add a new party.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteConfirmOpen(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-white rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-rose-600">Delete Party?</h3>
              <p className="text-slate-500 mb-4 text-sm">This action will soft-delete the party. All transaction history will be preserved.</p>
              <div className="flex items-center justify-center gap-2 mb-8">
                <input 
                  type="checkbox" 
                  id="hardDelete" 
                  checked={isHardDelete} 
                  onChange={(e) => setIsHardDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="hardDelete" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Hard Delete (Permanent)
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                <button onClick={() => { deleteParty(isDeleteConfirmOpen!, isHardDelete); setIsDeleteConfirmOpen(null); setIsHardDelete(false); setSelectedParty(null); }} className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Party Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingParty ? 'Edit Party' : 'Add New Party'}</h2>
                <button onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-200 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const partyData = {
                  company_id: currentCompany?.id,
                  name: formData.get('name') as string,
                  phone: formData.get('phone') as string,
                  email: formData.get('email') as string,
                  address: formData.get('address') as string,
                  type: formData.get('type') as any,
                  opening_balance: Number(formData.get('opening_balance')) || 0,
                  balance: Number(formData.get('opening_balance')) || 0,
                };

                if (editingParty) {
                  updateParty(editingParty.id, partyData);
                } else {
                  addParty(partyData);
                }
                setIsAddModalOpen(false);
                setEditingParty(null);
              }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-500 mb-1">Party Name *</label>
                    <input name="name" defaultValue={editingParty?.name} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Phone Number</label>
                    <input name="phone" defaultValue={editingParty?.phone} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. +92 300 1234567" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Party Type</label>
                    <input 
                      name="type" 
                      defaultValue={editingParty?.type || 'General'} 
                      list="party-types"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Supplier, Customer, etc."
                    />
                    <datalist id="party-types">
                      <option value="General" />
                      <option value="Supplier" />
                      <option value="Customer" />
                      {Array.from(new Set(parties.map(p => p.type))).map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Opening Balance</label>
                    <input name="opening_balance" type="number" defaultValue={editingParty?.opening_balance} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Save Party</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

