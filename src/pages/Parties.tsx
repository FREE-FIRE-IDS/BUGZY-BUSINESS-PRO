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
  X
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Party, Transaction, TransactionType } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Parties() {
  const { parties, transactions, addParty, updateParty, deleteParty, addTransaction, updateTransaction, deleteTransaction, settings, banks, currentCompany } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  
  const partyTypes = useMemo(() => {
    const types = new Set(parties.map(p => p.type));
    return ['All', ...Array.from(types)];
  }, [parties]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  
  const currentSelectedParty = useMemo(() => {
    if (!selectedParty) return null;
    return parties.find(p => p.id === selectedParty.id) || selectedParty;
  }, [selectedParty, parties]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const filteredParties = useMemo(() => {
    return parties.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.phone?.includes(searchTerm);
      const matchesType = filterType === 'All' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [parties, searchTerm, filterType]);

  const partyLedger = useMemo(() => {
    if (!currentSelectedParty) return [];
    return transactions
      .filter(t => t.party_id === currentSelectedParty.id || t.to_party_id === currentSelectedParty.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [currentSelectedParty, transactions]);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('Payment In');

  const exportPartyPDF = (party: Party, ledger: Transaction[]) => {
    const doc = new jsPDF();
    const companyName = settings.companyName || 'My Business';
    
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('Party Statement', 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Party: ${party.name}`, 14, 38);
    doc.text(`Phone: ${party.phone || 'N/A'}`, 14, 44);
    doc.text(`Balance: ${formatCurrency(party.balance, settings.currency)}`, 14, 50);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 56);
    
    const tableData = ledger.map(t => [
      formatDate(t.date),
      t.type,
      t.description || '-',
      (t.party_id === party.id && (t.type === 'Payment In' || t.type === 'Sale' || t.type === 'Bank To Party')) || (t.to_party_id === party.id) ? formatCurrency(t.amount, settings.currency) : '-',
      (t.party_id === party.id && (t.type === 'Payment Out' || t.type === 'Purchase' || t.type === 'Expense' || t.type === 'Party To Bank' || t.type === 'Party To Party')) ? formatCurrency(t.amount, settings.currency) : '-',
    ]);

    autoTable(doc, {
      head: [['Date', 'Type', 'Description', 'Debit (In)', 'Credit (Out)']],
      body: tableData,
      startY: 62,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 }
    });

    doc.save(`${party.name.replace(/\s+/g, '_')}_Statement_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-6">
      {currentSelectedParty ? (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSelectedParty(null)}
              className="text-indigo-600 font-medium flex items-center gap-2 hover:underline"
            >
              ← Back to Parties
            </button>
            <div className="flex gap-3">
              <button 
                onClick={() => { setEditingParty(currentSelectedParty); setIsAddModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 transition-all"
              >
                <FileText size={18} />
                Edit Details
              </button>
              <button 
                onClick={() => setIsDeleteConfirmOpen(currentSelectedParty.id)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all"
              >
                <Trash2 size={18} />
                Delete Party
              </button>
              <button 
                onClick={() => setIsTransactionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Plus size={18} />
                New Transaction
              </button>
            </div>
          </div>

          {/* Transaction Modal */}
          <AnimatePresence>
            {(isTransactionModalOpen || editingTransaction) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold">{editingTransaction ? 'Edit Transaction' : `New Transaction for ${currentSelectedParty.name}`}</h2>
                    <button onClick={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <form className="p-8 space-y-6" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const amount = Number(formData.get('amount'));
                    const type = formData.get('type') as TransactionType;
                    const bank_id = formData.get('bank_id') as string;
                    const to_party_id = formData.get('to_party_id') as string;
                    
                    if (editingTransaction) {
                      updateTransaction(editingTransaction.id, {
                        type,
                        amount,
                        description: formData.get('description') as string,
                        bank_id: (type === 'Party To Bank' || type === 'Bank To Party') ? bank_id : undefined,
                        to_party_id: type === 'Party To Party' ? to_party_id : undefined,
                      });
                    } else {
                      addTransaction({
                        company_id: currentCompany?.id || 'default',
                        date: new Date().toISOString(),
                        type,
                        amount,
                        description: formData.get('description') as string,
                        party_id: currentSelectedParty.id,
                        bank_id: (type === 'Party To Bank' || type === 'Bank To Party') ? bank_id : undefined,
                        to_party_id: type === 'Party To Party' ? to_party_id : undefined,
                      });
                    }
                    setIsTransactionModalOpen(false);
                    setEditingTransaction(null);
                  }}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Transaction Type</label>
                        <select 
                          name="type" 
                          defaultValue={editingTransaction?.type || txType}
                          onChange={(e) => setTxType(e.target.value as any)}
                          className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Payment In">Payment IN (Receive)</option>
                          <option value="Payment Out">Payment OUT (Pay)</option>
                          <option value="Party To Party">Party to Party Transfer</option>
                          <option value="Party To Bank">Party to Bank Transfer</option>
                          <option value="Bank To Party">Bank to Party Transfer</option>
                        </select>
                      </div>
                      
                      {(txType === 'Party To Bank' || txType === 'Bank To Party') && (
                        <div>
                          <label className="block text-sm font-medium text-slate-500 mb-1">Select Bank</label>
                          <select name="bank_id" defaultValue={editingTransaction?.bank_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                            {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                      )}

                      {txType === 'Party To Party' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-500 mb-1">Select Destination Party</label>
                          <select name="to_party_id" defaultValue={editingTransaction?.to_party_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500">
                            {parties.filter(p => p.id !== selectedParty.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                        <input name="amount" type="number" defaultValue={editingTransaction?.amount} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                        <input name="description" defaultValue={editingTransaction?.description} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Monthly payment" />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button type="button" onClick={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                      <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Save</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-slate-500 text-sm mb-1">Total Balance</h3>
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
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group">
                      <button 
                        onClick={() => { setEditingParty(currentSelectedParty); setIsAddModalOpen(true); }}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <FileText size={16} />
                      </button>
                      <h3 className="text-slate-500 text-sm mb-1">Party Type</h3>
                      <p className="text-xl font-bold text-black">{currentSelectedParty.type}</p>
                    </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-slate-500 text-sm mb-1">Contact Info</h3>
              <p className="text-sm font-medium text-black">{currentSelectedParty.phone || 'No phone'}</p>
              <p className="text-sm text-slate-400">{currentSelectedParty.email || 'No email'}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-black">Transaction Ledger</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportPartyPDF(currentSelectedParty, partyLedger)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                >
                  <Download size={18} />
                  PDF
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-lg"><Filter size={18} /></button>
                <button className="p-2 hover:bg-slate-100 rounded-lg"><Search size={18} /></button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Type</th>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold text-right">Debit</th>
                    <th className="px-6 py-4 font-semibold text-right">Credit</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partyLedger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-black">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          tx.type === 'Sale' || tx.type === 'Payment In' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{tx.description || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-black">
                        {(tx.party_id === currentSelectedParty.id && (tx.type === 'Payment In' || tx.type === 'Sale' || tx.type === 'Bank To Party')) || (tx.to_party_id === currentSelectedParty.id) ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-black">
                        {(tx.party_id === currentSelectedParty.id && (tx.type === 'Payment Out' || tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Party To Bank' || tx.type === 'Party To Party')) ? formatCurrency(tx.amount, settings.currency) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => { setEditingTransaction(tx); setTxType(tx.type); }}
                            className="flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-bold"
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
                      </td>
                    </tr>
                  ))}
                  {partyLedger.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        No transactions found for this party.
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
            <div className="flex-1 flex gap-3 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search parties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto max-w-md">
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
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
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
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
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
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Party?</h3>
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingParty ? 'Edit Party' : 'Add New Party'}</h2>
                <button onClick={() => { setIsAddModalOpen(false); setEditingParty(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
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
                  balance: Number(formData.get('balance')) || 0,
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
                    <input name="name" defaultValue={editingParty?.name} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Phone Number</label>
                    <input name="phone" defaultValue={editingParty?.phone} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. +92 300 1234567" />
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
                    <input name="balance" type="number" defaultValue={editingParty?.balance} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
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

