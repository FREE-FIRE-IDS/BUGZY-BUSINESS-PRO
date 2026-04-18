import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2,
  X,
  Download,
  Calendar,
  User,
  Package,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Invoices() {
  const { invoices, addInvoice, updateInvoice, deleteInvoice, settings, parties, items, currentCompany, banks } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ item_id: string, quantity: number, unit: string, price: number }[]>([]);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Cash');
  const [manualTax, setManualTax] = useState<number>(0);

  const commonUnits = ['pcs', 'kg', 'liter', 'dozen', 'box', 'meter', 'sqft', 'bag', 'bundle'];

  const filteredInvoices = invoices.filter(i => 
    i.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    parties.find(p => p.id === i.party_id)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { item_id: '', quantity: 1, unit: 'pcs', price: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'item_id') {
      const item = items.find(i => i.id === value);
      if (item) updated[index].price = item.price;
    }
    setSelectedItems(updated);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const exportInvoicePDF = (invoice: any) => {
    const doc = new jsPDF();
    const party = parties.find(p => p.id === invoice.party_id);
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    // Company Header
    doc.setFontSize(24);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(companyName, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(currentCompany?.address || settings.companyAddress || '', 14, 28);
    
    // Invoice Title & Details
    doc.setFontSize(32);
    doc.setTextColor(99, 102, 241); // Indigo-600
    doc.text('INVOICE', 140, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Date: ${formatDate(invoice.date)}`, 140, 35);
    if (invoice.due_date) doc.text(`Due Date: ${formatDate(invoice.due_date)}`, 140, 41);

    // Bill To
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text('BILL TO:', 14, 55);
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(party?.name || 'Unknown Party', 14, 63);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(party?.address || '', 14, 69);

    const tableData = invoice.items.map((item: any) => [
      item.name,
      item.quantity,
      item.unit || '',
      formatCurrency(item.price, settings.currency),
      formatCurrency(item.total, settings.currency)
    ]);

    autoTable(doc, {
      head: [['Item Name', 'Qty', 'Unit', 'Unit Price', 'Total']],
      body: tableData,
      startY: 80,
      theme: 'grid',
      headStyles: { 
        fillColor: [99, 102, 241],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Totals
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Subtotal:', 130, finalY);
    doc.setTextColor(30, 41, 59);
    doc.text(formatCurrency(invoice.subtotal, settings.currency), 196, finalY, { align: 'right' });
    
    doc.setTextColor(100, 116, 139);
    doc.text('Tax:', 130, finalY + 7);
    doc.setTextColor(30, 41, 59);
    doc.text(formatCurrency(invoice.tax || 0, settings.currency), 196, finalY + 7, { align: 'right' });
    
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(130, finalY + 11, 196, finalY + 11);
    
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text('Total Amount:', 130, finalY + 20);
    doc.text(formatCurrency(invoice.total, settings.currency), 196, finalY + 20, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for your business!', 105, 285, { align: 'center' });
    doc.text(`Generated by Bugzy Pro - ${new Date().toLocaleString()}`, 105, 290, { align: 'center' });

    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setSelectedItems(invoice.items.map((i: any) => ({
      item_id: i.item_id,
      quantity: i.quantity,
      unit: i.unit || 'pcs',
      price: i.price
    })));
    setManualTax(invoice.tax || 0);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage and generate professional invoices</p>
        </div>
        <button 
          onClick={() => {
            setIsAddModalOpen(true);
            setSelectedItems([{ item_id: '', quantity: 1, price: 0 }]);
          }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 w-full md:w-auto"
        >
          <Plus size={20} />
          Create Invoice
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search by invoice # or party..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInvoices.map((invoice) => {
          const party = parties.find(p => p.id === invoice.party_id);
          return (
            <motion.div 
              key={invoice.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <FileText size={24} />
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    invoice.type === 'Sale' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                  )}>
                    {invoice.type}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportInvoicePDF(invoice)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Download size={18} />
                  </button>
                  <button onClick={() => handleEditInvoice(invoice)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                    <Plus size={18} className="rotate-45" />
                  </button>
                  <button onClick={() => setIsDeleteConfirmOpen(invoice.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg mb-1 text-slate-900 dark:text-white">{invoice.invoice_number}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{party?.name || 'Unknown Party'}</p>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Total Amount</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(invoice.total, settings.currency)}</p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                  invoice.status === 'Paid' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                )}>
                  {invoice.status}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleteConfirmOpen(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-sm bg-white dark:bg-white rounded-3xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Invoice?</h3>
              <p className="text-slate-500 mb-4 text-sm">This action will soft-delete the invoice. This cannot be undone easily.</p>
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
                <button onClick={() => { deleteInvoice(isDeleteConfirmOpen!, isHardDelete); setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Invoice Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Create New Invoice</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              
              <form className="p-8 space-y-8 overflow-y-auto" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const subtotal = selectedItems.reduce((sum, si) => sum + (si.quantity * si.price), 0);
                const tax = manualTax;
                const total = subtotal + tax;

                const dateStr = formData.get('date') as string;
                const dueDateStr = formData.get('due_date') as string;

                addInvoice({
                  company_id: currentCompany?.id,
                  invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                  date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                  due_date: dueDateStr ? new Date(dueDateStr).toISOString() : undefined,
                  party_id: formData.get('party_id') as string,
                  type: formData.get('type') as 'Sale' | 'Purchase',
                  payment_type: formData.get('payment_type') as 'Cash' | 'Bank',
                  bank_id: (formData.get('bank_id') as string) || undefined,
                  items: selectedItems.map(si => ({
                    item_id: si.item_id,
                    name: items.find(i => i.id === si.item_id)?.name || 'Unknown',
                    quantity: si.quantity,
                    unit: si.unit,
                    price: si.price,
                    total: si.quantity * si.price
                  })),
                  subtotal,
                  tax,
                  total,
                  status: 'Unpaid',
                });
                setIsAddModalOpen(false);
              }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Invoice Type</label>
                    <select name="type" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Sale">Sale</option>
                      <option value="Purchase">Purchase</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Payment Type</label>
                    <select 
                      name="payment_type" 
                      required 
                      value={paymentType}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      onChange={(e) => setPaymentType(e.target.value as 'Cash' | 'Bank' | 'Credit')}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>
                  {paymentType === 'Bank' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Bank</label>
                      <select name="bank_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Bank</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {paymentType === 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Party</label>
                      <select name="party_id" required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Party</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {paymentType !== 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Party (Optional)</label>
                      <select name="party_id" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Walk-in Customer</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Invoice Date</label>
                    <input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Due Date</label>
                    <input name="due_date" type="date" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Items</h3>
                    <button type="button" onClick={handleAddItem} className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline">
                      <Plus size={16} /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {selectedItems.map((si, index) => (
                      <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item</label>
                          <select 
                            value={si.item_id}
                            onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          >
                            <option value="">Select Item</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                          <input 
                            type="number" 
                            placeholder="Qty"
                            value={si.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit</label>
                          <div className="relative">
                            <input 
                              list={`units-${index}`}
                              value={si.unit}
                              onChange={(e) => updateItem(index, 'unit', e.target.value)}
                              placeholder="Unit"
                              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                            <datalist id={`units-${index}`}>
                              {commonUnits.map(u => <option key={u} value={u} />)}
                            </datalist>
                          </div>
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                          <input 
                            type="number" 
                            placeholder="Price"
                            value={si.price}
                            onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total</label>
                          <div className="p-2.5 font-bold text-sm">
                            {formatCurrency(si.quantity * si.price, settings.currency)}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-8">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold">{formatCurrency(selectedItems.reduce((sum, si) => sum + (si.quantity * si.price), 0), settings.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Manual Tax</span>
                      <input 
                        type="number" 
                        value={manualTax}
                        onChange={(e) => setManualTax(Number(e.target.value))}
                        className="w-24 p-1 rounded border border-slate-200 text-right font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex justify-between text-xl pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-indigo-600">{formatCurrency(selectedItems.reduce((sum, si) => sum + (si.quantity * si.price), 0) + manualTax, settings.currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 px-6 py-4 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Generate Invoice</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {isEditModalOpen && editingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit Invoice</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              
              <form className="p-8 space-y-8 overflow-y-auto" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const subtotal = selectedItems.reduce((sum, si) => sum + (si.quantity * si.price), 0);
                const tax = manualTax;
                const total = subtotal + tax;

                const dateStr = formData.get('date') as string;
                const dueDateStr = formData.get('due_date') as string;

                updateInvoice(editingInvoice.id, {
                  date: dateStr ? new Date(dateStr).toISOString() : editingInvoice.date,
                  due_date: dueDateStr ? new Date(dueDateStr).toISOString() : undefined,
                  party_id: formData.get('party_id') as string,
                  type: formData.get('type') as 'Sale' | 'Purchase',
                  payment_type: paymentType,
                  bank_id: paymentType === 'Bank' ? formData.get('bank_id') as string : undefined,
                  items: selectedItems.map(si => ({
                    item_id: si.item_id,
                    name: items.find(i => i.id === si.item_id)?.name || 'Unknown',
                    quantity: si.quantity,
                    unit: si.unit,
                    price: si.price,
                    total: si.quantity * si.price
                  })),
                  subtotal,
                  tax,
                  total,
                  status: formData.get('status') as any,
                });
                setIsEditModalOpen(false);
              }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Invoice Type</label>
                    <select name="type" defaultValue={editingInvoice.type} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Sale">Sale</option>
                      <option value="Purchase">Purchase</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Payment Type</label>
                    <select 
                      name="payment_type" 
                      defaultValue={editingInvoice.payment_type}
                      required 
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                      onChange={(e) => setPaymentType(e.target.value as 'Cash' | 'Bank' | 'Credit')}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>
                  {(paymentType === 'Bank') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Bank</label>
                      <select name="bank_id" defaultValue={editingInvoice.bank_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Bank</option>
                        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  )}
                  {paymentType === 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Party</label>
                      <select name="party_id" defaultValue={editingInvoice.party_id} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Select Party</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {paymentType !== 'Credit' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Party (Optional)</label>
                      <select name="party_id" defaultValue={editingInvoice.party_id} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">Walk-in Customer</option>
                        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Invoice Date</label>
                    <input name="date" type="date" required defaultValue={editingInvoice.date.split('T')[0]} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Due Date</label>
                    <input name="due_date" type="date" defaultValue={editingInvoice.due_date?.split('T')[0]} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Status</label>
                    <select name="status" defaultValue={editingInvoice.status} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="Unpaid">Unpaid</option>
                      <option value="Paid">Paid</option>
                      <option value="Partial">Partial</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">Items</h3>
                    <button type="button" onClick={handleAddItem} className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:underline">
                      <Plus size={16} /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {selectedItems.map((si, index) => (
                      <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item</label>
                          <select 
                            value={si.item_id}
                            onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                            required
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          >
                            <option value="">Select Item</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                          <input 
                            type="number" 
                            value={si.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit</label>
                          <div className="relative">
                            <input 
                              list={`edit-units-${index}`}
                              value={si.unit}
                              onChange={(e) => updateItem(index, 'unit', e.target.value)}
                              placeholder="Unit"
                              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                            <datalist id={`edit-units-${index}`}>
                              {commonUnits.map(u => <option key={u} value={u} />)}
                            </datalist>
                          </div>
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                          <input 
                            type="number" 
                            value={si.price}
                            onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total</label>
                          <div className="p-2.5 font-bold text-sm">
                            {formatCurrency(si.quantity * si.price, settings.currency)}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-8">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-bold">{formatCurrency(selectedItems.reduce((sum, si) => sum + (si.quantity * si.price), 0), settings.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Manual Tax</span>
                      <input 
                        type="number" 
                        value={manualTax}
                        onChange={(e) => setManualTax(Number(e.target.value))}
                        className="w-24 p-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-right font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex justify-between text-xl pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-indigo-600">{formatCurrency(selectedItems.reduce((sum, si) => sum + (si.quantity * si.price), 0) + manualTax, settings.currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 px-6 py-4 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-4 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Update Invoice</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
