import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Receipt, 
  Trash2,
  X,
  Filter,
  ArrowUpRight,
  Download,
  Package,
  Calculator,
  Type
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { Transaction } from '../types';
import autoTable from 'jspdf-autotable';
import PDFPreviewModal from '../components/PDFPreviewModal';

// Extend jsPDF with autotable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function Expenses() {
  const { transactions, addTransaction, addTransactions, updateTransaction, deleteTransaction, settings, banks, parties, currentCompany, items, isSharedCompany, isAdmin } = useApp();
  const isShared = currentCompany ? isSharedCompany(currentCompany) : false;
  // Enable editing for all members
  const canModify = true;
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'All' | 'This Month' | '7 Days'>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Cash');

  // Multi-item Support
  const [expenseItems, setExpenseItems] = useState<{
    description: string;
    category: string;
    amount: number;
    quantity?: number;
    unit?: string;
    price?: number;
  }[]>([{ description: '', category: '', amount: 0 }]);

  const categories = React.useMemo(() => {
    return Array.from(new Set(transactions.filter(t => t.type === 'Expense' && t.category).map(t => t.category as string)));
  }, [transactions]);

  const handleAddExpenseItem = () => {
    setExpenseItems([...expenseItems, { description: '', category: '', amount: 0 }]);
  };

  const removeExpenseItem = (idx: number) => {
    if (expenseItems.length > 1) {
       setExpenseItems(expenseItems.filter((_, i) => i !== idx));
    }
  };

  const updateExpenseItem = (idx: number, field: string, value: any) => {
    const updated = [...expenseItems];
    updated[idx] = { ...updated[idx], [field]: value };
    
    // Auto calculate amount if qty/price changed
    if (field === 'quantity' || field === 'price') {
       const qty = Number(field === 'quantity' ? value : (updated[idx].quantity || 0));
       const p = Number(field === 'price' ? value : (updated[idx].price || 0));
       if (qty > 0 && p > 0) {
         updated[idx].amount = qty * p;
       }
    }
    
    setExpenseItems(updated);
  };

  // PDF Preview State
  const [pdfPreview, setPdfPreview] = useState<{ isOpen: boolean, url: string, title: string, fileName: string }>({
    isOpen: false,
    url: '',
    title: '',
    fileName: ''
  });

  const filteredExpenses = React.useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'Expense');
    return expenses.filter(e => {
      const matchesSearch = (e.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (e.category?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (e.amount?.toString() || '').includes(searchTerm);
      
      const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;

      let matchesDate = true;
      if (dateRange === 'This Month' && e.date) {
        const date = new Date(e.date);
        const now = new Date();
        matchesDate = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      } else if (dateRange === '7 Days' && e.date) {
        const date = new Date(e.date);
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
        matchesDate = diff <= 7;
      }

      return matchesSearch && matchesDate && matchesCategory;
    });
  }, [transactions, searchTerm, selectedCategory, dateRange]);

  const totalFilteredExpenses = React.useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  const exportPDF = () => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    try {
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text(companyName, 14, 20);
      
      doc.setFontSize(16);
      doc.setTextColor(225, 29, 72); // Rose-600
      doc.text('Expense Report', 14, 30);
      
      if (selectedCategory !== 'All') {
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text(`Category: ${selectedCategory}`, 14, 38);
      }
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const statsY = selectedCategory !== 'All' ? 46 : 38;
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, statsY);
      doc.text(`Total Amount: ${formatCurrency(totalFilteredExpenses, settings.currency)}`, 14, statsY + 6);

      const tableData = filteredExpenses.map(e => [
        formatDate(e.date),
        e.category || '-',
        e.description || 'General Expense',
        e.quantity ? `${e.quantity} ${e.unit || ''}` : '-',
        e.price ? formatCurrency(e.price, settings.currency) : '-',
        e.payment_type === 'Bank' 
          ? (banks.find(b => b.id === e.bank_id)?.name || 'Bank')
          : e.payment_type === 'Credit'
            ? (parties.find(p => p.id === e.party_id)?.name || 'Credit Account')
            : 'Cash',
        formatCurrency(e.amount, settings.currency)
      ]);

      autoTable(doc, {
        head: [['Date', 'Category', 'Description', 'Qty', 'Price', 'Paid Via', 'Amount']],
        body: tableData,
        startY: statsY + 12,
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          4: { halign: 'right' },
          6: { halign: 'right' }
        },
        foot: [[
          'Total', '', '', '', '', '', formatCurrency(totalFilteredExpenses, settings.currency)
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
      });

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreview({
        isOpen: true,
        url: url,
        title: 'Expense Report',
        fileName: `Expenses_Report_${new Date().getTime()}.pdf`
      });
    } catch (error) {
      console.error('Expense PDF failed:', error);
      alert('Failed to generate Expense PDF. Please try again.');
    }
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setPaymentType(expense.payment_type || (expense.bank_id ? 'Bank' : 'Cash'));
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Expenses</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Track your business overheads and spending</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={exportPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-900 dark:text-white font-bold text-sm"
            >
              <Download size={18} />
              PDF
            </button>
            <button 
              onClick={() => {
                setExpenseItems([{ description: '', category: '', amount: 0 }]);
                setIsAddModalOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 text-sm"
            >
              <Plus size={20} />
              Add
            </button>
          </div>
        </div>
        <div className="bg-rose-600 p-6 md:p-8 rounded-3xl shadow-xl shadow-rose-500/20 text-white flex flex-col justify-center">
          <p className="text-rose-100 text-[10px] md:text-sm font-black uppercase tracking-widest mb-1">Total Expenses</p>
          <p className="text-2xl md:text-3xl font-black">{formatCurrency(totalFilteredExpenses, settings.currency)}</p>
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
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white font-bold text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-[120px]">
            <Filter size={14} className="text-slate-400" />
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-[120px]">
            <Calendar size={14} className="text-slate-400" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="All">All Time</option>
              <option value="This Month">This Month</option>
              <option value="7 Days">Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Description</th>
                <th className="px-6 py-4 font-semibold text-right">Qty</th>
                <th className="px-6 py-4 font-semibold text-right">Price</th>
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
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                      <div className="flex flex-col">
                        <span>{expense.description || 'General Expense'}</span>
                        {expense.category && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {expense.category}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-slate-900 dark:text-slate-300">
                      {expense.quantity ? `${expense.quantity} ${expense.unit || ''}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-slate-500 dark:text-slate-400">
                      {expense.price ? formatCurrency(expense.price, settings.currency) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{bank?.name || 'Cash'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-right text-rose-600 dark:text-rose-400">
                      {formatCurrency(expense.amount, settings.currency)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditExpense(expense)}
                          className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredExpenses.map((expense) => {
            const bank = banks.find(b => b.id === expense.bank_id);
            return (
              <div key={expense.id} className="p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{expense.description || 'General Expense'}</h4>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(expense.date)}</p>
                  </div>
                  <p className="text-lg font-black text-rose-600">{formatCurrency(expense.amount, settings.currency)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Category</p>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {expense.category || '-'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Paid From</p>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {bank?.name || 'Cash'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={() => handleEditExpense(expense)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-indigo-600 font-bold text-xs"
                  >
                    <Plus size={14} className="rotate-45" /> Edit
                  </button>
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(expense.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-rose-600 font-bold text-xs"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredExpenses.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">
            No expenses found.
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteConfirmOpen(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 text-center border border-slate-100 dark:border-slate-800">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600 dark:text-rose-400">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Delete Expense?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">This action will soft-delete the expense transaction. This cannot be undone easily.</p>
              <div className="flex items-center justify-center gap-2 mb-8">
                <input 
                  type="checkbox" 
                  id="hardDelete" 
                  checked={isHardDelete} 
                  onChange={(e) => setIsHardDelete(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-rose-600 focus:ring-rose-500 bg-white dark:bg-slate-800"
                />
                <label htmlFor="hardDelete" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  Hard Delete (Permanent)
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-900 dark:text-white">Cancel</button>
                <button onClick={() => { deleteTransaction(isDeleteConfirmOpen!, isHardDelete); setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col border border-slate-100 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Record Expense</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Keep track of your spending patterns</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
              
              <form className="p-6 space-y-6 overflow-y-auto pb-24" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dateStr = formData.get('date') as string;
                const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
                
                // Add each item as a transaction
                const transactionsToAdd = expenseItems
                  .filter(item => item.amount > 0)
                  .map(item => ({
                    company_id: currentCompany?.id || '',
                    date,
                    type: 'Expense' as const,
                    amount: item.amount,
                    description: item.description,
                    category: item.category,
                    quantity: item.quantity,
                    price: item.price,
                    unit: item.unit,
                    payment_type: paymentType,
                    bank_id: paymentType === 'Bank' ? formData.get('bank_id') as string : undefined,
                    party_id: paymentType === 'Credit' ? formData.get('party_id') as string : undefined,
                  }));

                if (transactionsToAdd.length > 0) {
                  addTransactions(transactionsToAdd);
                }
                setIsAddModalOpen(false);
              }}>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Expense Date</label>
                      <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold" />
                    </div>
                    <div className="space-y-1.5 flex flex-col justify-end">
                       <button 
                         type="button" 
                         onClick={handleAddExpenseItem}
                         className="flex items-center justify-center gap-2 p-3.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/20 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all"
                       >
                         <Plus size={16} /> Add Multiple Items
                       </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {expenseItems.map((item, idx) => (
                      <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4 relative group">
                        {expenseItems.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeExpenseItem(idx)}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-slate-900 shadow-md border border-slate-100 dark:border-slate-800 rounded-full flex items-center justify-center text-rose-500 hover:scale-110 transition-all"
                          >
                            <X size={14} />
                          </button>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                            <input 
                              required 
                              value={item.description}
                              onChange={(e) => updateExpenseItem(idx, 'description', e.target.value)}
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold" 
                              placeholder="e.g. Office Supplies" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Category</label>
                            <input 
                              list="expense-categories"
                              value={item.category}
                              onChange={(e) => updateExpenseItem(idx, 'category', e.target.value)}
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold" 
                              placeholder="e.g. Utilities" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Qty</label>
                            <input 
                              type="number" 
                              step="any"
                              value={item.quantity || ''}
                              onChange={(e) => updateExpenseItem(idx, 'quantity', e.target.value)}
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Price</label>
                            <input 
                              type="number" 
                              step="any"
                              value={item.price || ''}
                              onChange={(e) => updateExpenseItem(idx, 'price', e.target.value)}
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 text-sm font-bold" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Total</label>
                            <input 
                              type="number" 
                              step="any"
                              required
                              value={item.amount || ''}
                              onChange={(e) => updateExpenseItem(idx, 'amount', Number(e.target.value))}
                              className="w-full p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500 text-sm font-black" 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-slate-100/50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500 uppercase">Grand Total</span>
                    <span className="text-2xl font-black text-rose-600">
                      {formatCurrency(expenseItems.reduce((sum, item) => sum + (item.amount || 0), 0), settings.currency)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Payment Method</label>
                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl">
                      {(['Cash', 'Bank', 'Credit'] as const).map((type) => (
                        <button 
                          key={type}
                          type="button"
                          onClick={() => setPaymentType(type)}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            paymentType === type 
                              ? "bg-white dark:bg-slate-700 shadow-md text-rose-600 dark:text-rose-400" 
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {paymentType === 'Bank' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Paid From (Bank Account)</label>
                        <select name="bank_id" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500 appearance-none transition-all">
                          <option value="">Choose bank account...</option>
                          {banks.filter(b => b?.id).map(b => (
                            <option key={b.id} value={b.id}>{b.name || 'Unnamed'}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}

                    {paymentType === 'Credit' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Party / Creditor (To Pay Later)</label>
                        <select name="party_id" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500 appearance-none transition-all">
                          <option value="">Select party...</option>
                          {parties.filter(p => p?.id).map(p => (
                            <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <datalist id="expense-categories">
                   {['Utilities', 'Rent', 'Salaries', 'Travel', 'Food', 'Marketing', 'Inventory', 'Maintenance'].map(c => <option key={c} value={c} />)}
                </datalist>

                <div className="flex gap-3 pt-8 shrink-0">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-500 dark:text-slate-400">Cancel</button>
                  <button type="submit" className="flex-2 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-xl shadow-rose-500/20 active:scale-95">Record Transaction</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {isEditModalOpen && editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100 dark:border-slate-800"
            >
              <div className="p-5 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Expense</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <form className="p-5 md:p-8 space-y-4 md:space-y-6 overflow-y-auto" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const dateStr = formData.get('date') as string;
                updateTransaction(editingExpense.id, {
                  date: dateStr ? new Date(dateStr).toISOString() : editingExpense.date,
                  amount: Number(formData.get('amount')),
                  description: formData.get('description') as string,
                  category: formData.get('category') as string,
                  quantity: Number(formData.get('quantity')) || undefined,
                  price: Number(formData.get('price')) || undefined,
                  unit: formData.get('unit') as string || undefined,
                  payment_type: paymentType,
                  bank_id: paymentType === 'Bank' ? formData.get('bank_id') as string : undefined,
                  party_id: paymentType === 'Credit' ? formData.get('party_id') as string : undefined,
                });
                setIsEditModalOpen(false);
              }}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Date</label>
                      <input name="date" type="date" defaultValue={editingExpense.date.split('T')[0]} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Category</label>
                      <input 
                        name="category" 
                        defaultValue={editingExpense.category}
                        list="edit-expense-categories"
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Description / Item</label>
                    <div className="relative">
                      <Type size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        name="description" 
                        required 
                        defaultValue={editingExpense.description}
                        className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Qty</label>
                      <input 
                        name="quantity" 
                        type="number" 
                        step="any"
                        defaultValue={editingExpense.quantity}
                        onChange={(e) => {
                          const form = e.target.form!;
                          const qty = Number(e.target.value);
                          const price = Number((form.elements.namedItem('price') as HTMLInputElement).value);
                          if (qty && price) {
                            (form.elements.namedItem('amount') as HTMLInputElement).value = (qty * price).toFixed(2);
                          }
                        }}
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Unit</label>
                      <input name="unit" list="expense-units" defaultValue={editingExpense.unit} className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Price</label>
                      <input 
                        name="price" 
                        type="number" 
                        step="any"
                        defaultValue={editingExpense.price}
                        onChange={(e) => {
                          const form = e.target.form!;
                          const price = Number(e.target.value);
                          const qty = Number((form.elements.namedItem('quantity') as HTMLInputElement).value);
                          if (qty && price) {
                            (form.elements.namedItem('amount') as HTMLInputElement).value = (qty * price).toFixed(2);
                          }
                        }}
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm" 
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <label className="block text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">Total Amount</label>
                    <div className="relative">
                      <Calculator size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                      <input 
                        name="amount" 
                        type="number" 
                        required 
                        step="any"
                        defaultValue={editingExpense.amount}
                        className="w-full pl-10 pr-3 py-3 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-black text-indigo-600 dark:text-indigo-400 shadow-sm" 
                        placeholder="0.00" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Payment Type</label>
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Cash')}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                          paymentType === 'Cash' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        Cash
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Bank')}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                          paymentType === 'Bank' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        Bank
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentType('Credit')}
                        className={cn(
                          "flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                          paymentType === 'Credit' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        Credit
                      </button>
                    </div>
                  </div>
                  {paymentType === 'Bank' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Paid From (Bank)</label>
                      <select name="bank_id" defaultValue={editingExpense.bank_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                        {banks.filter(b => b?.id).map(b => (
                          <option key={b.id} value={b.id}>{b.name || 'Unnamed'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {paymentType === 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Party (To Pay)</label>
                      <select name="party_id" defaultValue={editingExpense.party_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Party</option>
                        {parties.filter(p => p?.id).map(p => (
                          <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <datalist id="edit-expense-categories">
                  <option value="Food" />
                  <option value="Transport" />
                  <option value="Rent" />
                  <option value="Utilities" />
                  <option value="Salaries" />
                  <option value="Marketing" />
                </datalist>

                <div className="flex gap-3 pt-6 sticky bottom-0 bg-white dark:bg-slate-900 z-10 shrink-0">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-900 dark:text-white">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Update Expense</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PDFPreviewModal 
        isOpen={pdfPreview.isOpen}
        onClose={() => setPdfPreview({ ...pdfPreview, isOpen: false })}
        pdfUrl={pdfPreview.url}
        title={pdfPreview.title}
        fileName={pdfPreview.fileName}
      />
    </div>
  );
}
