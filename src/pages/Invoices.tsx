import React, { useState, useEffect, useRef } from 'react';
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
  const [selectedItems, setSelectedItems] = useState<{ 
    item_id: string, 
    quantity: number, 
    unit: string, 
    price: number,
    shipping_mark?: string,
    total_weight?: number,
    shortage?: number,
    net_weight?: number
  }[]>([]);
  const [paymentType, setPaymentType] = useState<'Cash' | 'Bank' | 'Credit'>('Cash');
  const [manualTax, setManualTax] = useState<number>(0);

  const scrollRef = React.useRef<HTMLFormElement>(null);
  const editScrollRef = React.useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    const addContainer = scrollRef.current;
    if (addContainer) addContainer.addEventListener('focusin', handleFocus);
    
    const editContainer = editScrollRef.current;
    if (editContainer) editContainer.addEventListener('focusin', handleFocus);
    
    const handleResize = () => {
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (addContainer) addContainer.removeEventListener('focusin', handleFocus);
      if (editContainer) editContainer.removeEventListener('focusin', handleFocus);
      window.removeEventListener('resize', handleResize);
    };
  }, [isAddModalOpen, isEditModalOpen]);

  const commonUnits = ['pcs', 'kg', 'liter', 'dozen', 'box', 'meter', 'sqft', 'bag', 'bundle'];

  const filteredInvoices = invoices.filter(i => 
    i.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    parties.find(p => p.id === i.party_id)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { item_id: '', quantity: 1, unit: 'pcs', price: 0, total_weight: 0, shortage: 0, net_weight: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'item_id') {
      const item = items.find(i => i.id === value);
      if (item) {
        updated[index].price = item.price;
        if ((item as any).unit) updated[index].unit = (item as any).unit;
      }
    }

    if (field === 'total_weight' || field === 'shortage') {
      const tw = field === 'total_weight' ? Number(value) : (updated[index].total_weight || 0);
      const sh = field === 'shortage' ? Number(value) : (updated[index].shortage || 0);
      updated[index].net_weight = Math.max(0, tw - sh);
    }

    setSelectedItems(updated);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const numberToWords = (num: number) => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const formatShort = (n: number) => {
      if (n < 20) return a[n];
      const digit = n % 10;
      return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
    };

    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 100) return formatShort(n);
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 === 0 ? '' : ' and ' + convert(n % 100));
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 === 0 ? '' : ' ' + convert(n % 1000));
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' lakh' + (n % 100000 === 0 ? '' : ' ' + convert(n % 100000));
      return convert(Math.floor(n / 10000000)) + ' crore' + (n % 10000000 === 0 ? '' : ' ' + convert(n % 10000000));
    };

    return num === 0 ? 'Zero' : convert(Math.floor(num));
  };

  const exportInvoicePDF = (invoice: any) => {
    try {
      const doc = new jsPDF();
      const party = parties.find(p => p.id === invoice.party_id);
      
      // Header - Blue Border Box
      doc.setDrawColor(59, 130, 246); // Blue-500
      doc.setLineWidth(0.8);
      doc.rect(14, 10, 182, 10);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('SALE INVOICE', 105, 17, { align: 'center' });

      // Info Section
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      // Bill To Row
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To.', 14, 30);
      doc.setFont('helvetica', 'normal');
      doc.text(party?.name || 'Cash Customer', 40, 30);
      
      // Invoice No Row
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice No.', 150, 30);
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.invoice_number || '-', 196, 30, { align: 'right' });

      // Contact Row
      doc.setFont('helvetica', 'bold');
      doc.text('Contact.', 14, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(party?.phone || '-', 40, 40);

      // Date Row
      doc.setFont('helvetica', 'bold');
      doc.text('Date', 150, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(invoice.date), 196, 40, { align: 'right' });

      // Table
      const tableData = invoice.items.map((item: any, idx: number) => [
        idx + 1,
        item.shipping_mark || '-',
        item.name,
        item.quantity,
        item.total_weight ? Number(item.total_weight).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
        item.shortage ? Number(item.shortage).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
        item.net_weight ? Number(item.net_weight).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
        Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]);

      autoTable(doc, {
        head: [['No.', 'Shipping Mark', 'Item Name', 'Qty', 'Total Wt', 'Shortage', 'NetWt', 'Price / Kg', 'Total']],
        body: tableData,
        startY: 48,
        theme: 'grid',
        headStyles: { 
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle'
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          valign: 'middle',
          textColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { halign: 'center', cellWidth: 10 },
          4: { halign: 'right', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 15 },
          6: { halign: 'right', cellWidth: 20 },
          7: { halign: 'right', cellWidth: 20 },
          8: { halign: 'right', cellWidth: 25 }
        }
      });

      const finalY = ((doc as any).lastAutoTable?.finalY || 150) + 5;

      // Amount in Words Header
      doc.setFillColor(59, 130, 246);
      doc.rect(14, finalY + 5, 120, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Amount in Words', 16, finalY + 11);

      // Amount text
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Rupees ${numberToWords(invoice.total)} Only`, 14, finalY + 22);

      // Totals Section
      const totalsX = 135;
      doc.setFillColor(59, 130, 246);
      doc.rect(totalsX, finalY + 5, 61, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Amount', totalsX + 2, finalY + 11);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      
      let currentY = finalY + 22;
      const drawTotalLine = (label: string, value: number, isBold: boolean = false) => {
        if (isBold) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        
        doc.text(label, totalsX, currentY);
        doc.text(value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 196, currentY, { align: 'right' });
        
        doc.setDrawColor(200, 200, 200);
        doc.line(totalsX, currentY + 2, 196, currentY + 2);
        currentY += 8;
      };

      drawTotalLine('Sub Total', invoice.subtotal);
      drawTotalLine('Total', invoice.total, true);
      drawTotalLine('Received', 0);
      drawTotalLine('Balance', invoice.total, true);
      
      const prevBalance = party?.balance ? (party.balance - invoice.total) : 0;
      drawTotalLine('Previous Balance', prevBalance);
      drawTotalLine('Current Balance', party?.balance || 0, true);

      doc.save(`Invoice_${invoice.invoice_number}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Could not generate PDF. Please check data and try again.');
    }
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice);
    setSelectedItems(invoice.items.map((i: any) => ({
      item_id: i.item_id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit || 'pcs',
      price: i.price,
      shipping_mark: i.shipping_mark,
      total_weight: i.total_weight,
      shortage: i.shortage,
      net_weight: i.net_weight
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
              
              <form 
                ref={scrollRef}
                className="p-8 space-y-8 overflow-y-auto pb-[250px] scroll-smooth" 
                onSubmit={(e) => {
                  e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const subtotal = selectedItems.reduce((sum, si) => {
                  const lineTotal = (si.net_weight && si.net_weight > 0) 
                    ? (si.net_weight * si.price) 
                    : (si.quantity * si.price);
                  return sum + lineTotal;
                }, 0);
                const tax = manualTax;
                const total = subtotal + tax;

                const dateStr = formData.get('date') as string;
                const dueDateStr = formData.get('due_date') as string;

                // Generate numeric invoice number
                const nextInvoiceNum = invoices.reduce((max, inv) => {
                  const num = parseInt(inv.invoice_number.replace(/\D/g, ''));
                  return isNaN(num) ? max : Math.max(max, num);
                }, 0) + 1;

                addInvoice({
                  company_id: currentCompany?.id,
                  invoice_number: nextInvoiceNum.toString(),
                  date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                  due_date: dueDateStr ? new Date(dueDateStr).toISOString() : undefined,
                  party_id: formData.get('party_id') as string,
                  type: formData.get('type') as 'Sale' | 'Purchase',
                  payment_type: formData.get('payment_type') as 'Cash' | 'Bank',
                  bank_id: (formData.get('bank_id') as string) || undefined,
                  items: selectedItems.map(si => {
                    const lineTotal = (si.net_weight && si.net_weight > 0) 
                      ? (si.net_weight * si.price) 
                      : (si.quantity * si.price);
                    
                    return {
                      item_id: si.item_id,
                      name: items.find(i => i.id === si.item_id)?.name || 'Unknown',
                      quantity: si.quantity,
                      shipping_mark: si.shipping_mark,
                      total_weight: si.total_weight,
                      shortage: si.shortage,
                      net_weight: si.net_weight,
                      unit: si.unit,
                      price: si.price,
                      total: lineTotal
                    };
                  }),
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
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mark</label>
                          <input 
                            type="text" 
                            placeholder="Ship Mark"
                            value={si.shipping_mark || ''}
                            onChange={(e) => updateItem(index, 'shipping_mark', e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                          <input 
                            type="number" 
                            placeholder="Qty"
                            value={si.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Wt</label>
                          <input 
                            type="number" 
                            placeholder="Total Wt"
                            value={si.total_weight || 0}
                            onChange={(e) => updateItem(index, 'total_weight', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Shortage</label>
                          <input 
                            type="number" 
                            placeholder="Short"
                            value={si.shortage || 0}
                            onChange={(e) => updateItem(index, 'shortage', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-24 text-center">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net Wt</label>
                          <div className="py-2.5 text-sm font-bold text-slate-600">{(si.net_weight || 0).toFixed(2)}</div>
                        </div>
                        <div className="w-28">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                          <input 
                            type="number" 
                            placeholder="Price"
                            value={si.price}
                            onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-28 text-right">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total</label>
                          <div className="py-2.5 font-bold text-sm">
                            {formatCurrency(((si.net_weight && si.net_weight > 0) ? (si.net_weight * si.price) : (si.quantity * si.price)), settings.currency)}
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
              
              <form 
                ref={editScrollRef}
                className="p-8 space-y-8 overflow-y-auto pb-[250px] scroll-smooth"
                onSubmit={(e) => {
                  e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const subtotal = selectedItems.reduce((sum, si) => {
                  const lineTotal = (si.net_weight && si.net_weight > 0) 
                    ? (si.net_weight * si.price) 
                    : (si.quantity * si.price);
                  return sum + lineTotal;
                }, 0);
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
                  items: selectedItems.map(si => {
                    const lineTotal = (si.net_weight && si.net_weight > 0) 
                      ? (si.net_weight * si.price) 
                      : (si.quantity * si.price);
                      
                    return {
                      item_id: si.item_id,
                      name: items.find(i => i.id === si.item_id)?.name || 'Unknown',
                      quantity: si.quantity,
                      shipping_mark: si.shipping_mark,
                      total_weight: si.total_weight,
                      shortage: si.shortage,
                      net_weight: si.net_weight,
                      unit: si.unit,
                      price: si.price,
                      total: lineTotal
                    };
                  }),
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
                        <div className="w-32">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mark</label>
                          <input 
                            type="text" 
                            placeholder="Ship Mark"
                            value={si.shipping_mark || ''}
                            onChange={(e) => updateItem(index, 'shipping_mark', e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qty</label>
                          <input 
                            type="number" 
                            value={si.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tot Wt</label>
                          <input 
                            type="number" 
                            value={si.total_weight || 0}
                            onChange={(e) => updateItem(index, 'total_weight', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Short</label>
                          <input 
                            type="number" 
                            value={si.shortage || 0}
                            onChange={(e) => updateItem(index, 'shortage', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-24 text-center">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net Wt</label>
                          <div className="py-2.5 text-sm font-bold text-slate-600">{(si.net_weight || 0).toFixed(2)}</div>
                        </div>
                        <div className="w-28">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price</label>
                          <input 
                            type="number" 
                            value={si.price}
                            onChange={(e) => updateItem(index, 'price', Number(e.target.value))}
                            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                        </div>
                        <div className="w-28 text-right px-2">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total</label>
                          <div className="py-2.5 font-bold text-sm">
                            {formatCurrency(((si.net_weight && si.net_weight > 0) ? (si.net_weight * si.price) : (si.quantity * si.price)), settings.currency)}
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
