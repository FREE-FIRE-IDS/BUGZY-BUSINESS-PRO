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
  X
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BankAccount, Transaction, TransactionType } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Banks() {
  const { banks, transactions, addBank, updateBank, deleteBank, addTransaction, updateTransaction, deleteTransaction, settings, parties, currentCompany } = useApp();
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<TransactionType>('Bank To Bank');
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const bankLedger = useMemo(() => {
    if (!selectedBank) return [];
    return transactions
      .filter(t => t.bank_id === selectedBank.id || t.to_bank_id === selectedBank.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedBank, transactions]);

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  const exportBankPDF = (bank: BankAccount, ledger: Transaction[]) => {
    const doc = new jsPDF();
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('Bank Statement', 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Bank: ${bank.name}`, 14, 38);
    doc.text(`Account: ${bank.account_number || 'N/A'}`, 14, 44);
    doc.text(`Current Balance: ${formatCurrency(bank.balance, settings.currency)}`, 14, 50);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 56);
    
    const tableData = ledger.map(t => [
      formatDate(t.date),
      t.type,
      t.description || '-',
      t.bank_id === bank.id ? formatCurrency(t.amount, settings.currency) : '-',
      t.to_bank_id === bank.id ? formatCurrency(t.amount, settings.currency) : '-',
    ]);

    autoTable(doc, {
      head: [['Date', 'Type', 'Description', 'Withdrawal', 'Deposit']],
      body: tableData,
      startY: 62,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      foot: [[
        '', '', 'Total Balance', '', formatCurrency(bank.balance, settings.currency)
      ]],
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
    });

    doc.save(`${bank.name.replace(/\s+/g, '_')}_Statement_${new Date().getTime()}.pdf`);
  };

  const handleEditBank = (bank: BankAccount) => {
    setEditingBank(bank);
    setIsEditModalOpen(true);
  };

  const handleDeleteBank = (id: string) => {
    setIsDeleteConfirmOpen(id);
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setIsEditTxModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {selectedBank ? (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSelectedBank(null)}
              className="text-indigo-600 font-medium flex items-center gap-2 hover:underline"
            >
              ← Back to Banks
            </button>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsDepositModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
              >
                <ArrowDownLeft size={18} />
                Deposit
              </button>
              <button 
                onClick={() => setIsWithdrawModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20"
              >
                <ArrowUpRight size={18} />
                Withdraw
              </button>
              <button 
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <ArrowLeftRight size={18} />
                Transfer
              </button>
            </div>
          </div>

          {/* Deposit Modal */}
          <AnimatePresence>
            {isDepositModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDepositModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Deposit to {selectedBank.name}</h2>
                    <button onClick={() => setIsDepositModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
                  </div>
                  <form className="p-8 space-y-6" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    addTransaction({
                      company_id: currentCompany?.id,
                      date: new Date().toISOString(),
                      type: 'Deposit',
                      amount: Number(formData.get('amount')),
                      description: formData.get('description') as string,
                      to_bank_id: selectedBank.id,
                    });
                    setIsDepositModalOpen(false);
                  }}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                        <input name="amount" type="number" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                        <input name="description" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Cash deposit" />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setIsDepositModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                      <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20">Deposit</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {isWithdrawModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsWithdrawModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Withdraw from {selectedBank.name}</h2>
                    <button onClick={() => setIsWithdrawModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
                  </div>
                  <form className="p-8 space-y-6" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    addTransaction({
                      company_id: currentCompany?.id,
                      date: new Date().toISOString(),
                      type: 'Withdraw',
                      amount: Number(formData.get('amount')),
                      description: formData.get('description') as string,
                      bank_id: selectedBank.id,
                    });
                    setIsWithdrawModalOpen(false);
                  }}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                        <input name="amount" type="number" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                        <input name="description" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Cash withdrawal" />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => setIsWithdrawModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                      <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Withdraw</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-slate-500 text-sm mb-1">Current Balance</h3>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(selectedBank.balance, settings.currency)}
              </p>
              <p className="text-xs text-slate-400 mt-2">Available for withdrawal</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-slate-500 text-sm mb-1">Account Number</h3>
              <p className="text-xl font-bold text-black">{selectedBank.account_number || 'N/A'}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-slate-500 text-sm mb-1">Transactions</h3>
              <p className="text-xl font-bold text-black">{bankLedger.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-black">Bank Ledger</h3>
              <button 
                onClick={() => exportBankPDF(selectedBank, bankLedger)}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
              >
                <Download size={18} />
                PDF
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold text-right">Withdrawal</th>
                    <th className="px-6 py-4 font-semibold text-right">Deposit</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bankLedger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-black">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          tx.to_bank_id === selectedBank.id ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{tx.description || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-rose-600">
                        {tx.bank_id === selectedBank.id ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600">
                        {tx.to_bank_id === selectedBank.id ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                                            <td className="px-6 py-4 text-right">
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
                      </td>
                    </tr>
                  ))}
                  {bankLedger.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No transactions found for this bank.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Bank Accounts</h2>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus size={20} />
                Add Bank
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banks.map((bank) => (
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
                <h3 className="text-lg font-bold group-hover:text-indigo-600 transition-colors">{bank.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{bank.account_number || 'No account number'}</p>
                
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
                    <button className="text-xs font-bold text-indigo-600 hover:underline">View Ledger</button>
                </div>
              </motion.div>
            ))}
            {banks.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Bank?</h3>
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
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Bank</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addBank({
                  company_id: currentCompany?.id,
                  name: formData.get('name') as string,
                  account_number: formData.get('account_number') as string,
                  balance: Number(formData.get('balance')) || 0,
                });
                setIsAddModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Bank Name *</label>
                    <input name="name" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. HBL Bank" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Account Number</label>
                    <input name="account_number" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 1234567890" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Opening Balance</label>
                    <input name="balance" type="number" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
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

        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTransferModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Transfer from {selectedBank.name}</h2>
                <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const type = formData.get('type') as any;
                addTransaction({
                  company_id: currentCompany?.id,
                  date: new Date().toISOString(),
                  type,
                  amount: Number(formData.get('amount')),
                  description: formData.get('description') as string,
                  bank_id: formData.get('bank_id') as string,
                  to_bank_id: formData.get('to_bank_id') as string,
                  party_id: formData.get('party_id') as string,
                  to_party_id: formData.get('to_party_id') as string,
                });
                setIsTransferModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Transfer Type</label>
                    <select 
                      name="type" 
                      value={transferType}
                      onChange={(e) => setTransferType(e.target.value as any)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Bank To Bank">Bank to Bank</option>
                      <option value="Bank To Party">Bank to Party</option>
                      <option value="Party To Bank">Party to Bank</option>
                      <option value="Party To Party">Party to Party</option>
                    </select>
                  </div>

                  {(transferType === 'Bank To Bank' || transferType === 'Bank To Party' || transferType === 'Party To Bank') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Source/Target Bank</label>
                      <select name="bank_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value={selectedBank.id}>{selectedBank.name} (Current)</option>
                        {banks.filter(b => b.id !== selectedBank.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}

                  {transferType === 'Bank To Bank' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Destination Bank</label>
                      <select name="to_bank_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                        {banks.filter(b => b.id !== selectedBank.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}

                  {(transferType === 'Bank To Party' || transferType === 'Party To Bank' || transferType === 'Party To Party') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Source/Target Party</label>
                      <select name="party_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  {transferType === 'Party To Party' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Destination Party</label>
                      <select name="to_party_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                    <input name="amount" type="number" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                    <input name="description" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Internal transfer" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsTransferModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Confirm Transfer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEditModalOpen && editingBank && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Bank</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateBank(editingBank.id, {
                  name: formData.get('name') as string,
                  account_number: formData.get('account_number') as string,
                  balance: Number(formData.get('balance')) || 0,
                });
                setIsEditModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Bank Name *</label>
                    <input name="name" defaultValue={editingBank.name} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Account Number</label>
                    <input name="account_number" defaultValue={editingBank.account_number} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Balance</label>
                    <input name="balance" type="number" defaultValue={editingBank.balance} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
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

        {isEditTxModalOpen && editingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditTxModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Transaction</h2>
                <button onClick={() => setIsEditTxModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateTransaction(editingTx.id, {
                  amount: Number(formData.get('amount')),
                  description: formData.get('description') as string,
                  date: formData.get('date') as string,
                });
                setIsEditTxModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Date</label>
                    <input name="date" type="date" defaultValue={editingTx.date.split('T')[0]} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                    <input name="amount" type="number" defaultValue={editingTx.amount} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                    <input name="description" defaultValue={editingTx.description} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditTxModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Update Transaction</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
