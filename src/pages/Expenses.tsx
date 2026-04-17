import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Receipt, 
  Trash2,
  X,
  Filter,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Expenses() {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, settings, banks, parties, currentCompany } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Cash');

  const expenses = transactions.filter(t => t.type === 'Expense');
  const filteredExpenses = expenses.filter(e => 
    e.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(225, 29, 72); // Rose-600
    doc.text('Expense Report', 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Total Expenses: ${formatCurrency(totalExpenses, settings.currency)}`, 14, 44);

    const tableData = filteredExpenses.map(e => [
      formatDate(e.date),
      e.description || 'General Expense',
      banks.find(b => b.id === e.bank_id)?.name || 'Cash',
      formatCurrency(e.amount, settings.currency)
    ]);

    autoTable(doc, {
      head: [['Date', 'Description', 'Paid From', 'Amount']],
      body: tableData,
      startY: 50,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] },
      styles: { fontSize: 9 },
      foot: [[
        'Total', '', '', formatCurrency(totalExpenses, settings.currency)
      ]],
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
    });

    doc.save(`Expenses_Report_${new Date().getTime()}.pdf`);
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setPaymentType(expense.payment_type || (expense.bank_id ? 'Bank' : 'Cash'));
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Expenses</h2>
            <p className="text-slate-500 dark:text-slate-400">Track your business overheads and spending</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={exportPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-900 dark:text-white font-medium"
            >
              <Download size={18} />
              PDF
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={20} />
              Add
            </button>
          </div>
        </div>
        <div className="bg-rose-600 p-8 rounded-3xl shadow-xl shadow-rose-500/20 text-white">
          <p className="text-rose-100 text-sm font-medium mb-1">Total Expenses</p>
          <p className="text-3xl font-bold">{formatCurrency(totalExpenses, settings.currency)}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Paid From</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredExpenses.map((expense) => {
                const bank = banks.find(b => b.id === expense.bank_id);
                return (
                  <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-slate-200">{formatDate(expense.date)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{expense.description || 'General Expense'}</td>
                    <td className="px-6 py-4 text-sm">
                      {expense.category ? (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-100 text-slate-600 dark:text-slate-600 rounded text-[10px] font-bold uppercase">
                          {expense.category}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{bank?.name || 'Cash'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-rose-600">
                      {formatCurrency(expense.amount, settings.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Plus size={16} className="rotate-45" />
                        </button>
                        <button 
                          onClick={() => setIsDeleteConfirmOpen(expense.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No expenses found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteConfirmOpen(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-white rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Expense?</h3>
              <p className="text-slate-500 mb-4 text-sm">This action will soft-delete the expense transaction. This cannot be undone easily.</p>
              <div className="flex items-center justify-center gap-2 mb-8">
                <input 
                  type="checkbox" 
                  id="hardDelete" 
                  checked={isHardDelete} 
                  onChange={(e) => setIsHardDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="hardDelete" className="text-sm font-medium text-slate-700 dark:text-slate-700 cursor-pointer">
                  Hard Delete (Permanent)
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-50 transition-all">Cancel</button>
                <button onClick={() => { deleteTransaction(isDeleteConfirmOpen!, isHardDelete); setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsAddModalOpen(false)} 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-md bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Add Expense</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dateStr = formData.get('date') as string;
                addTransaction({
                  company_id: currentCompany?.id,
                  date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                  type: 'Expense',
                  amount: Number(formData.get('amount')),
                  description: formData.get('description') as string,
                  category: formData.get('category') as string,
                  payment_type: paymentType,
                  bank_id: paymentType === 'Bank' ? formData.get('bank_id') as string : undefined,
                  party_id: paymentType === 'Credit' ? formData.get('party_id') as string : undefined,
                });
                setIsAddModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Date</label>
                    <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                    <input name="amount" type="number" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Payment Type</label>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Cash')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                          paymentType === 'Cash' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        )}
                      >
                        Cash
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Bank')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                          paymentType === 'Bank' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        )}
                      >
                        Bank
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Credit')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                          paymentType === 'Credit' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        )}
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  {paymentType === 'Bank' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Paid From (Bank)</label>
                      <select name="bank_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Bank</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {paymentType === 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Party (To Pay)</label>
                      <select name="party_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Party</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Category</label>
                    <div className="relative">
                      <input 
                        name="category" 
                        list="expense-categories"
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="Select or type category" 
                      />
                      <datalist id="expense-categories">
                        <option value="Food" />
                        <option value="Transport" />
                        <option value="Rent" />
                        <option value="Utilities" />
                        <option value="Salaries" />
                        <option value="Marketing" />
                        <option value="Office Supplies" />
                        <option value="Maintenance" />
                        <option value="Taxes" />
                        <option value="Insurance" />
                      </datalist>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                    <textarea name="description" rows={3} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="What was this expense for?"></textarea>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Save Expense</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {isEditModalOpen && editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Expense</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dateStr = formData.get('date') as string;
                updateTransaction(editingExpense.id, {
                  date: dateStr ? new Date(dateStr).toISOString() : editingExpense.date,
                  amount: Number(formData.get('amount')),
                  description: formData.get('description') as string,
                  category: formData.get('category') as string,
                  payment_type: paymentType,
                  bank_id: paymentType === 'Bank' ? formData.get('bank_id') as string : undefined,
                  party_id: paymentType === 'Credit' ? formData.get('party_id') as string : undefined,
                });
                setIsEditModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Date</label>
                    <input name="date" type="date" defaultValue={editingExpense.date.split('T')[0]} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Amount</label>
                    <input name="amount" type="number" defaultValue={editingExpense.amount} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Payment Type</label>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Cash')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                          paymentType === 'Cash' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        )}
                      >
                        Cash
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Bank')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                          paymentType === 'Bank' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        )}
                      >
                        Bank
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Credit')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                          paymentType === 'Credit' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                        )}
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  {paymentType === 'Bank' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Paid From (Bank)</label>
                      <select name="bank_id" defaultValue={editingExpense.bank_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {paymentType === 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Party (To Pay)</label>
                      <select name="party_id" defaultValue={editingExpense.party_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Party</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Category</label>
                    <div className="relative">
                      <input 
                        name="category" 
                        list="edit-expense-categories"
                        defaultValue={editingExpense.category}
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="Select or type category" 
                      />
                      <datalist id="edit-expense-categories">
                        <option value="Food" />
                        <option value="Transport" />
                        <option value="Rent" />
                        <option value="Utilities" />
                        <option value="Salaries" />
                        <option value="Marketing" />
                        <option value="Office Supplies" />
                        <option value="Maintenance" />
                        <option value="Taxes" />
                        <option value="Insurance" />
                      </datalist>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Description</label>
                    <textarea name="description" defaultValue={editingExpense.description} rows={3} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Update Expense</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
