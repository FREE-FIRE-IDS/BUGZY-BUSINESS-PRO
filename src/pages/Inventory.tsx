import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  Trash2, 
  Edit2, 
  X,
  History,
  TrendingUp,
  TrendingDown,
  Download,
  Sparkles
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { InventoryItem as Item } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Inventory() {
  const { items, addItem, updateItem, deleteItem, addTransaction, settings, currentCompany, isLicensed } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<string | null>(null);
  const [isHardDelete, setIsHardDelete] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<{ item: Item; type: 'add' | 'reduce' } | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const lowStockItems = useMemo(() => {
    return items.filter(item => item.stock <= item.low_stock_alert);
  }, [items]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241); // Indigo-600
    doc.text('Inventory Report', 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Total Items: ${items.length}`, 14, 44);
    const totalValue = items.reduce((sum, item) => sum + (item.price * item.stock), 0);
    doc.text(`Total Inventory Value: ${formatCurrency(totalValue, settings.currency)}`, 14, 50);

    const tableData = filteredItems.map(i => [
      i.name,
      i.sku || '-',
      i.unit || 'Unit',
      formatCurrency(i.price, settings.currency),
      i.stock,
      i.stock <= i.low_stock_alert ? 'Low Stock' : 'In Stock'
    ]);

    autoTable(doc, {
      head: [['Item Name', 'SKU', 'Unit', 'Price', 'Stock', 'Status']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 9 },
      foot: [[
        'Total', '', '', '', formatCurrency(totalValue, settings.currency)
      ]],
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
    });

    doc.save(`Inventory_Report_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Package size={24} />
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">Total Items</h3>
              <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">Low Stock</h3>
              <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{lowStockItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">Total Value</h3>
              <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                {formatCurrency(items.reduce((sum, item) => sum + (item.price * item.stock), 0), settings.currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search items by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-900 dark:text-white font-medium"
          >
            <Download size={18} />
            PDF
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Plus size={20} />
            Add Item
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Item Details</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">SKU</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Unit</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Price</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Stock</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Status</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                        <Package size={20} />
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.sku || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.unit || '-'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-slate-50">{formatCurrency(item.price, settings.currency)}</td>
                  <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-slate-50">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                         onClick={() => setAdjustingStock({ item, type: 'reduce' })}
                        className="p-1 rounded-lg bg-rose-50 dark:bg-rose-100 text-rose-600 hover:bg-rose-200 transition-colors"
                      >
                        <TrendingDown size={14} />
                      </button>
                      <span className="min-w-[2rem] text-center">{item.stock}</span>
                      <button 
                        onClick={() => setAdjustingStock({ item, type: 'add' })}
                        className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                      >
                        <TrendingUp size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      item.stock <= item.low_stock_alert ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {item.stock <= item.low_stock_alert ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setEditingItem(item)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setIsDeleteConfirmOpen(item.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                    <Package size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.name}</h4>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{item.sku || 'No SKU'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setEditingItem(item)}
                    className="p-2 text-slate-400 hover:text-indigo-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setIsDeleteConfirmOpen(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Price</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{formatCurrency(item.price, settings.currency)}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Unit</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{item.unit || '-'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl">
                <div>
                  <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black mb-0.5">Current Stock</p>
                  <span className={cn(
                    "text-xs font-bold px-2 py-0.5 rounded-full uppercase",
                    item.stock <= item.low_stock_alert ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {item.stock} - {item.stock <= item.low_stock_alert ? 'Low' : 'OK'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAdjustingStock({ item, type: 'reduce' })}
                    className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-rose-600 shadow-sm border border-slate-100 dark:border-slate-700"
                  >
                    <TrendingDown size={14} />
                  </button>
                  <button 
                    onClick={() => setAdjustingStock({ item, type: 'add' })}
                    className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100 dark:border-slate-700"
                  >
                    <TrendingUp size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">
            No items found in inventory.
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
              <h3 className="text-xl font-bold mb-2">Delete Item?</h3>
              <p className="text-slate-500 mb-4 text-sm">This action will soft-delete the item. All transaction history will be preserved.</p>
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
                <button onClick={() => { deleteItem(isDeleteConfirmOpen!, isHardDelete); setIsDeleteConfirmOpen(null); setIsHardDelete(false); }} className="flex-1 px-4 py-3 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Item Modal */}
      <AnimatePresence>
        {(isAddModalOpen || editingItem) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="p-4 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                <h2 className="text-xl font-bold">{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                <button onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-4 md:p-8 space-y-4 md:space-y-6" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const itemData = {
                  company_id: currentCompany?.id,
                  name: formData.get('name') as string,
                  sku: formData.get('sku') as string,
                  unit: formData.get('unit') as string,
                  price: Number(formData.get('price')),
                  stock: Number(formData.get('stock')),
                  low_stock_alert: Number(formData.get('low_stock_alert')) || 5,
                };

                if (editingItem) {
                  updateItem(editingItem.id, itemData);
                } else {
                  addItem(itemData);
                }
                setIsAddModalOpen(false);
                setEditingItem(null);
              }}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-500 mb-1">Item Name *</label>
                    <input name="name" defaultValue={editingItem?.name} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-50" placeholder="e.g. Wireless Mouse" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">SKU / Barcode</label>
                    <input name="sku" defaultValue={editingItem?.sku} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-50" placeholder="e.g. WM-001" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Unit</label>
                    <input name="unit" defaultValue={editingItem?.unit} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-50" placeholder="e.g. pcs, kg, box" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Price</label>
                    <input name="price" type="number" defaultValue={editingItem?.price} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-50" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Stock</label>
                    <input name="stock" type="number" defaultValue={editingItem?.stock} required className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-50" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Low Stock Alert</label>
                    <input name="low_stock_alert" type="number" defaultValue={editingItem?.low_stock_alert} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-50" placeholder="5" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-50 transition-all">Cancel</button>
                  <button type="submit" className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
                    {editingItem ? 'Update Item' : 'Save Item'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {adjustingStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAdjustingStock(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-sm bg-white dark:bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-100">
              <div className="p-8 border-b border-slate-100 dark:border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {adjustingStock.type === 'add' ? 'Add Stock' : 'Reduce Stock'}
                </h2>
                <button onClick={() => setAdjustingStock(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <form className="p-8 space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const amount = Number(formData.get('amount'));
                
                // Create a transaction instead of direct update to ensure it syncs and recalculates correctly
                await addTransaction({
                  company_id: currentCompany?.id || '',
                  date: new Date().toISOString(),
                  type: adjustingStock.type === 'add' ? 'Stock In' : 'Stock Out',
                  amount: 0, // Stock adjustments usually don't have a direct monetary value in simple ledgers
                  quantity: amount,
                  item_id: adjustingStock.item.id,
                  description: `${adjustingStock.type === 'add' ? 'Manual Addition' : 'Manual Reduction'} of ${adjustingStock.item.name}`,
                });
                
                setAdjustingStock(null);
              }}>
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Adjusting stock for <span className="font-bold text-slate-900 dark:text-slate-900">{adjustingStock.item.name}</span></p>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Quantity</label>
                    <input name="amount" type="number" required min="1" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-200 dark:bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter quantity" autoFocus />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setAdjustingStock(null)} className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-50 transition-all">Cancel</button>
                  <button type="submit" className={cn(
                    "flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg",
                    adjustingStock.type === 'add' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                  )}>
                    Confirm
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
