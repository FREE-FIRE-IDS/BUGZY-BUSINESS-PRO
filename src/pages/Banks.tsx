import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Building2, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft,
  ArrowLeftRight,
  Trash2,
  Download,
  ArrowLeft,
  X,
  FileText,
  Filter,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, formatBalance, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { BankAccount as Bank, Transaction, TransactionType } from '../types';
import { generateBankStatement } from '../lib/pdfGenerator';

const DrCrToggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: (val: boolean) => void }) => (
  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-auto">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">DR/CR</span>
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!enabled);
      }}
      className={cn(
        "relative w-8 h-4 rounded-full transition-all duration-300",
        enabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
        enabled ? "left-4.5" : "left-0.5"
      )} />
    </button>
  </div>
);

export default function Banks() {
  const { banks, transactions, invoices, addBank, updateBank, deleteBank, addTransaction, updateTransaction, deleteTransaction, settings, updateSettings, parties, currentCompany, setSelectedBankId, refreshData } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshData(undefined, true);
    } catch (e) {
      console.error('Sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [viewMode, setViewMode] = useState<'app' | 'accounting'>('app');

  const stats = useMemo(() => {
    const cashInHand = transactions
      .filter(t => t.company_id === currentCompany?.id)
      .reduce((sum, t) => {
        if (t.type === 'Withdraw') return sum + t.amount;
        if (t.type === 'Deposit') return sum - t.amount;
        if (!t.bank_id && !t.to_bank_id) {
          if (['Sale', 'Income', 'Payment In', 'Stock In', 'Bank To Party', 'Cash Adjustment In'].includes(t.type)) return sum + t.amount;
          if (['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Party To Bank', 'Cash Adjustment Out'].includes(t.type)) return sum - t.amount;
        }
        return sum;
      }, 0) + 
      invoices
        .filter(i => i.company_id === currentCompany?.id && i.status === 'Paid' && i.payment_type === 'Cash')
        .reduce((sum, i) => i.type === 'Sale' ? sum + i.total : sum - i.total, 0);
    const totalBankBalance = banks.reduce((sum, b) => sum + b.balance, 0);
    return { cashInHand, totalBankBalance };
  }, [transactions, banks, invoices, currentCompany]);

  React.useEffect(() => {
    setSelectedBankId(selectedBank?.id || null);
  }, [selectedBank, setSelectedBankId]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [showCashTransactions, setShowCashTransactions] = useState(false);

  const cashTransactions = useMemo(() => {
    const txs = transactions.filter(t => {
      // Direct cash transactions
      if (!t.bank_id && !t.to_bank_id) return true;
      // Withdrawals bring cash in
      if (t.type === 'Withdraw') return true;
      // Deposits take cash out
      if (t.type === 'Deposit') return true;
      return false;
    });

    const invs = invoices.filter(i => i.status === 'Paid' && i.payment_type === 'Cash').map(i => ({
      id: i.id,
      date: i.date,
      type: i.type === 'Sale' ? 'Sale' : 'Purchase',
      amount: i.total,
      description: `Invoice #${i.invoice_number}`,
      company_id: i.company_id,
      isInvoice: true
    }));

    return [...txs, ...invs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, invoices]);

  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [amountFilter, setAmountFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [isLedgerSearchOpen, setIsLedgerSearchOpen] = useState(false);
  const [ledgerDateRange, setLedgerDateRange] = useState<'All' | 'This Month' | '7 Days'>('All');

  const filteredBanks = useMemo(() => {
    return banks.filter(bank => {
      const matchesSearch = bank.name.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
                          bank.account_number?.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
                          bank.bank_name?.toLowerCase().includes(bankSearchTerm.toLowerCase());
      
      let matchesAmount = true;
      if (amountFilter === 'positive') matchesAmount = bank.balance > 0;
      else if (amountFilter === 'negative') matchesAmount = bank.balance < 0;

      return matchesSearch && matchesAmount;
    });
  }, [banks, bankSearchTerm, amountFilter]);

  const bankLedger = useMemo(() => {
    if (!selectedBank) return [];
    
    // Start with opening balance
    const openingEntry = {
      id: 'opening',
      date: selectedBank.created_at,
      type: 'Opening Balance' as any,
      amount: selectedBank.opening_balance,
      description: 'Opening Balance',
      source: 'opening',
      company_id: selectedBank.company_id,
      created_at: selectedBank.created_at
    } as any;

    const filtered = transactions
      .filter(t => t.bank_id === selectedBank.id || t.to_bank_id === selectedBank.id);
      
    return [openingEntry, ...filtered]
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
  }, [selectedBank, transactions, ledgerSearchTerm, ledgerDateRange]);

  const handleExportPDF = () => {
    if (currentCompany && selectedBank) {
      // Filter out pseudo-entry for opening balance
      const transactionsOnly = bankLedger.filter(tx => tx.id !== 'opening');
      generateBankStatement(currentCompany, selectedBank, transactionsOnly, stats, viewMode);
    }
  };

  const handleEditBank = (bank: Bank) => {
    setEditingBank(bank);
    setIsEditModalOpen(true);
  };

  const handleDeleteBank = (id: string) => {
    setIsDeleteConfirmOpen(id);
  };

  const handleEditTx = (tx: Transaction) => {
    window.dispatchEvent(new CustomEvent('open-tx', { detail: tx }));
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      {showCashTransactions ? (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={() => setShowCashTransactions(false)}
                className="p-2 md:p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl md:rounded-2xl text-slate-500 transition-all shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white truncate">Cash Transactions</h2>
                <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                  <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] md:text-[10px] font-bold uppercase rounded shrink-0">Cash in Hand</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4">
               <div className="flex items-center gap-2">
                 <button 
                   onClick={handleSync}
                   disabled={isSyncing}
                   className={cn(
                     "p-2 md:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 transition-all shadow-sm",
                     isSyncing && "animate-spin text-indigo-600"
                   )}
                   title="Sync Data"
                 >
                   <RefreshCw size={18} />
                 </button>
                 <DrCrToggle 
                   enabled={settings.show_dr_cr || false} 
                   onToggle={(val) => updateSettings({ show_dr_cr: val })} 
                 />
               </div>
               
               <div className="flex gap-2">
                 <button 
                   onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Cash Adjustment In' }))}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 font-bold text-xs"
                 >
                   <Plus size={14} />
                   Adjust Cash
                 </button>
                 <button 
                   onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Cash Adjustment Out' }))}
                   className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 font-bold text-xs"
                 >
                   <ArrowDownLeft size={14} className="rotate-45" />
                   Reduce Cash
                 </button>
               </div>

               <div className="bg-emerald-50 dark:bg-emerald-900/20 px-6 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex flex-col justify-center min-w-[120px]">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center sm:text-left">Balance</p>
                  <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight text-center sm:text-left">{formatBalance(stats.cashInHand, settings.currency, settings.show_dr_cr)}</p>
               </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
               <h3 className="font-bold text-slate-900 dark:text-white">Cash Ledger</h3>
            </div>
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold text-right">In (+)</th>
                    <th className="px-6 py-4 font-semibold text-right">Out (-)</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cashTransactions.map((tx) => {
                    const isIncome = ['Sale', 'Income', 'Payment In', 'Stock In', 'Withdraw', 'Bank To Party', 'Cash Adjustment In'].includes(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-300">{formatDate(tx.date)}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            isIncome ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          )}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{tx.description || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600 dark:text-emerald-400">
                          {isIncome ? formatCurrency(tx.amount, settings.currency) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-rose-600 dark:text-rose-400">
                          {!isIncome ? formatCurrency(tx.amount, settings.currency) : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!(tx as any).isInvoice && (
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: tx }))} 
                                className="p-2 text-slate-400 hover:text-indigo-600"
                              >
                                <FileText size={16} />
                              </button>
                              <button onClick={() => deleteTransaction(tx.id)} className="p-2 text-slate-400 hover:text-rose-600">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Mobile View for Cash Ledger */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
               {cashTransactions.map((tx) => {
                 const isIncome = ['Sale', 'Income', 'Payment In', 'Stock In', 'Withdraw', 'Bank To Party', 'Cash Adjustment In'].includes(tx.type);
                 return (
                   <div key={tx.id} className="p-4 space-y-3">
                     <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-slate-500">{formatDate(tx.date)}</p>
                          <p className="font-bold text-slate-900 dark:text-white truncate">{tx.description || tx.type}</p>
                        </div>
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          isIncome ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                          {tx.type}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <p className={cn("text-lg font-black", isIncome ? "text-emerald-600" : "text-rose-600")}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount, settings.currency)}
                        </p>
                        {!(tx as any).isInvoice && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: tx }))} 
                              className="p-2 text-slate-400 hover:text-indigo-600"
                            >
                              <FileText size={16} />
                            </button>
                            <button onClick={() => deleteTransaction(tx.id)} className="p-2 text-slate-400 hover:text-rose-600">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                     </div>
                   </div>
                 );
               })}
            </div>
          </div>
        </motion.div>
      ) : selectedBank ? (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={() => setSelectedBank(null)}
                className="p-2 md:p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl md:rounded-2xl text-slate-500 transition-all shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white truncate">{selectedBank.name}</h2>
                <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                  <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[8px] md:text-[10px] font-bold uppercase rounded shrink-0">Bank</span>
                  <span className="text-[10px] md:text-xs text-slate-400 truncate">{selectedBank.account_number || 'No account number'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2 mr-2">
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className={cn(
                    "p-2 md:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 transition-all shadow-sm",
                    isSyncing && "animate-spin text-indigo-600"
                  )}
                  title="Sync Data"
                >
                  <RefreshCw size={18} />
                </button>
                <DrCrToggle 
                  enabled={settings.show_dr_cr || false} 
                  onToggle={(val) => updateSettings({ show_dr_cr: val })} 
                />
              </div>
              <div className="grid grid-cols-2 md:flex gap-2 md:gap-3">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Deposit' }))}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 font-bold text-sm"
              >
                <ArrowDownLeft size={16} />
                Receive
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Withdraw' }))}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 font-bold text-sm"
              >
                <ArrowUpRight size={16} />
                Pay Out
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Bank To Bank' }))}
                className="col-span-2 md:col-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold text-sm"
              >
                <ArrowLeftRight size={16} />
                Transfer
              </button>
            </div>
          </div>
        </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
            <div className="bg-white dark:bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-[10px] md:text-sm mb-1 uppercase tracking-wider font-bold">Balance</h3>
              <p className="text-lg md:text-2xl font-bold text-indigo-600 truncate">
                {formatCurrency(selectedBank.balance, settings.currency)}
              </p>
            </div>
            <div className="bg-white dark:bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-[10px] md:text-sm mb-1 uppercase tracking-wider font-bold">A/C No</h3>
              <p className="text-sm md:text-xl font-bold text-slate-900 truncate">{selectedBank.account_number || 'N/A'}</p>
            </div>
            <div className="col-span-2 md:col-auto bg-white dark:bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm flex items-center justify-between md:block">
              <h3 className="text-slate-500 text-[10px] md:text-sm mb-0 md:mb-1 uppercase tracking-wider font-bold">Transactions</h3>
              <p className="text-sm md:text-xl font-bold text-slate-900">{bankLedger.length}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="font-bold text-slate-900 dark:text-white">Bank Ledger</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={ledgerSearchTerm}
                    onChange={(e) => setLedgerSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-40 transition-all"
                  />
                </div>

                <select 
                  value={ledgerDateRange}
                  onChange={(e) => setLedgerDateRange(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All">All Time</option>
                  <option value="This Month">This Month</option>
                  <option value="7 Days">Last 7 Days</option>
                </select>

                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button 
                    onClick={() => setViewMode('app')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      viewMode === 'app' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                    )}
                  >
                    App
                  </button>
                  <button 
                    onClick={() => setViewMode('accounting')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                      viewMode === 'accounting' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-400"
                    )}
                  >
                    Accounting
                  </button>
                </div>
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
                <thead className="bg-slate-50 dark:bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold text-right">
                      {viewMode === 'app' ? 'Withdrawal' : 'Credit (-)'}
                    </th>
                    <th className="px-6 py-4 font-semibold text-right">
                      {viewMode === 'app' ? 'Deposit' : 'Debit (+)'}
                    </th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bankLedger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-900">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          tx.type === 'Opening Balance' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          tx.to_bank_id === selectedBank.id ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-500">{tx.description || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-rose-600 dark:text-rose-400">
                        {tx.type === 'Opening Balance' ? (tx.amount < 0 ? formatCurrency(Math.abs(tx.amount), settings.currency) : '-') :
                         tx.bank_id === selectedBank.id ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600 dark:text-emerald-400">
                        {tx.type === 'Opening Balance' ? (tx.amount >= 0 ? formatCurrency(tx.amount, settings.currency) : '-') :
                         tx.to_bank_id === selectedBank.id ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {tx.id !== 'opening' && (
                          <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleEditTx(tx)}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            <Plus size={16} className="rotate-45" />
                          </button>
                          <button 
                            onClick={() => deleteTransaction(tx.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Bank Ledger */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {bankLedger.map((tx) => (
                <div key={tx.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                      <p className="font-bold text-slate-900 dark:text-slate-900">{tx.description || tx.type}</p>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      tx.to_bank_id === selectedBank.id ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                    )}>
                      {tx.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                          {viewMode === 'app' ? 'Withdrawal' : 'Credit'}
                        </p>
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                          {tx.bank_id === selectedBank.id ? formatCurrency(tx.amount, settings.currency) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                          {viewMode === 'app' ? 'Deposit' : 'Debit'}
                        </p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {tx.to_bank_id === selectedBank.id ? formatCurrency(tx.amount, settings.currency) : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEditTx(tx)}
                        className="p-2 text-slate-400 hover:text-indigo-600"
                      >
                        <Plus size={16} className="rotate-45" />
                      </button>
                      <button 
                        onClick={() => deleteTransaction(tx.id)}
                        className="p-2 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {bankLedger.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  No transactions found.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setShowCashTransactions(true)}
              className="bg-emerald-500 p-6 rounded-[2rem] text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all"
            >
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mb-1 text-left">Cash in Hand</p>
                  <h3 className="text-3xl font-black">{formatBalance(stats.cashInHand, settings.currency, settings.show_dr_cr)}</h3>
                </div>
                <DrCrToggle 
                  enabled={!!settings.show_dr_cr} 
                  onToggle={(val) => updateSettings({ show_dr_cr: val })} 
                />
              </div>
              <ArrowDownLeft className="absolute -right-4 -bottom-4 text-white/10 w-24 h-24" />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden"
            >
              <div className="relative z-10 flex justify-between items-start text-left">
                <div>
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-1">Total Bank Balance</p>
                  <h3 className="text-3xl font-black">{formatBalance(stats.totalBankBalance, settings.currency, settings.show_dr_cr)}</h3>
                </div>
                <DrCrToggle 
                  enabled={!!settings.show_dr_cr} 
                  onToggle={(val) => updateSettings({ show_dr_cr: val })} 
                />
              </div>
              <Building2 className="absolute -right-4 -bottom-4 text-white/10 w-24 h-24" />
            </motion.div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bank Accounts</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search banks..."
                  value={bankSearchTerm}
                  onChange={(e) => setBankSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64 transition-all"
                />
              </div>

              <div className="relative w-full sm:w-auto">
                <button 
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className={cn(
                    "w-full px-4 py-2 bg-white dark:bg-slate-800 border rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                    amountFilter !== 'all' ? "border-indigo-600 text-indigo-600 shadow-sm" : "border-slate-200 dark:border-slate-700 text-slate-500"
                  )}
                >
                  <Filter size={14} />
                  <span>{amountFilter === 'all' ? 'All' : amountFilter === 'positive' ? 'Positive' : 'Negative'}</span>
                </button>
                <AnimatePresence>
                  {showFilterMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2"
                      >
                        {[
                          { id: 'all', label: 'All Balances', icon: Building2 },
                          { id: 'positive', label: 'Positive (>0)', icon: ArrowUpRight, color: 'text-emerald-600' },
                          { id: 'negative', label: 'Negative (<0)', icon: ArrowDownLeft, color: 'text-rose-600' },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => {
                              setAmountFilter(opt.id as any);
                              setShowFilterMenu(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                              amountFilter === opt.id ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                            )}
                          >
                            <opt.icon size={16} className={opt.color} />
                            <span className="text-xs font-bold">{opt.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg text-sm h-[38px]"
              >
                <Plus size={18} />
                <span>Add Bank</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBanks.map((bank) => (
              <motion.div
                key={bank.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setSelectedBank(bank)}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Building2 size={24} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Balance</span>
                    <span className="text-lg font-bold text-indigo-600">{formatCurrency(bank.balance, settings.currency)}</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold group-hover:text-indigo-600 transition-colors text-slate-900 dark:text-white">{bank.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{bank.account_number || 'No account number'}</p>
                
                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                      <ArrowDownLeft size={16} />
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBank(bank);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <Plus size={16} className="rotate-45" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBank(bank.id);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {banks.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Building2 size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">No bank accounts found</h3>
                <p className="text-slate-500">Add your first bank account to start tracking cash flow.</p>
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-rose-600">Delete Bank?</h3>
              <p className="text-slate-500 mb-4 text-sm">This action will soft-delete the bank account. All transaction history will be preserved.</p>
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
                <button onClick={() => { deleteBank(isDeleteConfirmOpen!, isHardDelete); if (selectedBank?.id === isDeleteConfirmOpen) setSelectedBank(null); setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Bank Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Bank</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-200 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addBank({
                  company_id: currentCompany?.id,
                  name: formData.get('name') as string,
                  account_number: formData.get('account_number') as string,
                  opening_balance: Number(formData.get('opening_balance')) || 0,
                  balance: Number(formData.get('opening_balance')) || 0,
                });
                setIsAddModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Bank Name *</label>
                    <input name="name" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. HBL Bank" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Account Number</label>
                    <input name="account_number" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 1234567890" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Opening Balance</label>
                    <input name="opening_balance" type="number" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Save Bank</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && editingBank && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Bank</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-200 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateBank(editingBank.id, {
                  name: formData.get('name') as string,
                  account_number: formData.get('account_number') as string,
                  opening_balance: Number(formData.get('opening_balance')) || 0,
                  balance: Number(formData.get('opening_balance')) || 0,
                });
                setIsEditModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Bank Name *</label>
                    <input name="name" defaultValue={editingBank.name} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Account Number</label>
                    <input name="account_number" defaultValue={editingBank.account_number} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Opening Balance</label>
                    <input name="opening_balance" type="number" defaultValue={editingBank.opening_balance} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Update Bank</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
