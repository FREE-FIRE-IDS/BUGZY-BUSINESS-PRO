import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../contexts/AppContext';
import { TransactionType } from '../types';

export default function GlobalTransactionModal() {
  const { parties, banks, addTransaction, updateTransaction, currentCompany, selectedPartyId, selectedBankId } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>('Payment In');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyId, setPartyId] = useState('');
  const [bankId, setBankId] = useState('');
  const [toPartyId, setToPartyId] = useState('');
  const [toBankId, setToBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen && !editingId) {
      if (selectedPartyId) setPartyId(selectedPartyId);
      if (selectedBankId) setBankId(selectedBankId);
    }
  }, [isOpen, selectedPartyId, selectedBankId, editingId]);

  useEffect(() => {
    const handleOpen = (e: any) => {
      const data = e.detail;
      if (data && typeof data === 'object' && data.id) {
        // We are editing
        const tx = data;
        setEditingId(tx.id);
        setType(tx.type);
        setDate(tx.date.split('T')[0]);
        setPartyId(tx.party_id || '');
        setBankId(tx.bank_id || '');
        setToPartyId(tx.to_party_id || '');
        setToBankId(tx.to_bank_id || '');
        setAmount(String(tx.amount));
        setDescription(tx.description || '');
      } else {
        setEditingId(null);
        setType(data || 'Payment In');
        setDate(new Date().toISOString().split('T')[0]);
        resetForm();
      }
      setIsOpen(true);
    };
    window.addEventListener('open-tx', handleOpen);
    return () => window.removeEventListener('open-tx', handleOpen);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    const txData = {
      company_id: currentCompany?.id || 'default',
      date: new Date(date).toISOString(),
      type,
      amount: Number(amount),
      description,
      party_id: partyId || undefined,
      bank_id: bankId || undefined,
      to_party_id: toPartyId || undefined,
      to_bank_id: toBankId || undefined,
    };

    if (editingId) {
      updateTransaction(editingId, txData);
    } else {
      addTransaction(txData);
    }

    setIsOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setPartyId('');
    setBankId('');
    setToPartyId('');
    setToBankId('');
    setAmount('');
    setDescription('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={() => setIsOpen(false)} 
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }} 
          className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
        >
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              {editingId ? 'Edit Transaction' : type}
            </h2>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500">
              <X size={20} />
            </button>
          </div>
          
          <form className="p-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 max-h-[100%] overflow-y-auto">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Transaction Type</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value as TransactionType)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Payment In">Payment In</option>
                  <option value="Payment Out">Payment Out</option>
                  <option value="Sale">Sale (Cash/Credit)</option>
                  <option value="Purchase">Purchase (Cash/Credit)</option>
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Cash Adjustment In">Adjust Cash (In)</option>
                  <option value="Cash Adjustment Out">Reduce Cash (Out)</option>
                  <option value="Deposit">Deposit (To Bank)</option>
                  <option value="Withdraw">Withdraw (From Bank)</option>
                  <option value="Bank To Bank">Bank to Bank</option>
                  <option value="Bank To Party">Bank to Party</option>
                  <option value="Party To Bank">Party to Bank</option>
                  <option value="Party To Party">Party to Party</option>
                </select>
              </div>

              {/* Date Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Date</label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Party Selection */}
              {(type.includes('Party') || ['Payment In', 'Payment Out', 'Sale', 'Purchase', 'Income'].includes(type)) && (
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {type.startsWith('Bank To') ? 'To Party' : (type === 'Party To Party' || type === 'Party To Bank' ? 'From Party' : 'Party')}
                  </label>
                  <select 
                    value={partyId} 
                    onChange={(e) => setPartyId(e.target.value)}
                    required={!['Sale', 'Purchase', 'Income'].includes(type)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{['Sale', 'Purchase', 'Income'].includes(type) ? 'Walk-in (No Party)' : 'Select Party'}</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Bank Selection */}
              {(type.includes('Bank') || ['Payment In', 'Payment Out', 'Expense', 'Sale', 'Purchase', 'Income', 'Cash Adjustment In', 'Cash Adjustment Out'].includes(type)) && (
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    {type === 'Deposit' || type === 'Bank To Bank' ? 'From Bank' : (type === 'Withdraw' ? 'From Bank' : 'Bank (Optional for Cash)')}
                  </label>
                  <select 
                    value={bankId} 
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Cash</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {/* Destination Party */}
              {type === 'Party To Party' && (
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">To Party</label>
                  <select 
                    value={toPartyId} 
                    onChange={(e) => setToPartyId(e.target.value)}
                    required 
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Destination Party</option>
                    {parties.filter(p => p.id !== partyId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Destination Bank */}
              {(type === 'Bank To Bank' || type === 'Deposit' || type === 'Party To Bank') && (
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">To Bank</label>
                  <select 
                    value={toBankId} 
                    onChange={(e) => setToBankId(e.target.value)}
                    required 
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Destination Bank</option>
                    {banks.filter(b => b.id !== bankId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Amount</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  required 
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="0.00" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="e.g. Monthly payment" 
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setIsOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
              <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Save Transaction</button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
