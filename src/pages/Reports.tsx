import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Filter, 
  Search, 
  Calendar,
  Users,
  Building2,
  Package,
  Receipt,
  FileSpreadsheet,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  X
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportType = 
  | 'Single Party' 
  | 'All Parties' 
  | 'Single Bank' 
  | 'All Banks' 
  | 'Stock' 
  | 'Purchase' 
  | 'Sale'
  | 'Expense' 
  | 'Invoice';

export default function Reports() {
  const { transactions, parties, banks, items, invoices, settings, currentCompany } = useApp();
  const [activeReport, setActiveReport] = useState<ReportType>('All Parties');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dateRange, setDateRange] = useState('This Month');

  const categories = useMemo(() => {
    if (activeReport === 'All Parties') {
      const companyParties = parties.filter(p => p.company_id === currentCompany?.id);
      const types = new Set(companyParties.map(p => p.type));
      return ['All', ...Array.from(types).sort()];
    }
    return ['All'];
  }, [parties, currentCompany, activeReport]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'app' | 'accounting'>('app');
  const [searchQuery, setSearchQuery] = useState('');

  const companyBanks = banks.filter(b => b.company_id === currentCompany?.id);
  const companyItems = items.filter(i => i.company_id === currentCompany?.id);
  const companyInvoices = invoices.filter(i => i.company_id === currentCompany?.id);

  const allColumns: Record<ReportType, string[]> = useMemo(() => ({
    'All Parties': ['Party Name', 'Type', 'Debit (DR)', 'Credit (CR)', 'Balance'],
    'Single Party': ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    'All Banks': ['Bank Name', 'Account #', 'Debit (DR)', 'Credit (CR)', 'Balance'],
    'Single Bank': ['Date', 'Description', viewMode === 'app' ? 'Withdrawal' : 'Credit', viewMode === 'app' ? 'Deposit' : 'Debit', 'Balance'],
    'Stock': ['Item Name', 'SKU', 'Unit', 'Price', 'Stock', 'Value'],
    'Purchase': ['Date', 'Party', 'Item', 'Qty', 'Unit', 'Price', 'Total'],
    'Sale': ['Date', 'Party', 'Item', 'Qty', 'Unit', 'Price', 'Total'],
    'Expense': ['Date', 'Description', 'Category', 'Paid From', 'Amount'],
    'Invoice': ['Invoice #', 'Date', 'Item', 'Qty', 'Unit', 'Price', 'Total']
  }), [viewMode]);

  useEffect(() => {
    setSelectedColumns(allColumns[activeReport]);
  }, [activeReport, allColumns]);

  const reportOptions = [
    { id: 'All Parties', label: 'All Parties Balance', icon: Users },
    { id: 'Single Party', label: 'Party Statement', icon: Users },
    { id: 'All Banks', label: 'All Banks Balance', icon: Building2 },
    { id: 'Single Bank', label: 'Bank Statement', icon: Building2 },
    { id: 'Stock', label: 'Stock Report', icon: Package },
    { id: 'Purchase', label: 'Purchase Report', icon: Receipt },
    { id: 'Sale', label: 'Sale Report', icon: ArrowUpRight },
    { id: 'Expense', label: 'Expense Report', icon: Receipt },
    { id: 'Invoice', label: 'Invoice Report', icon: FileText },
  ];

  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const filterByDate = (txs: any[]) => {
      if (dateRange === 'This Month') return txs.filter(t => new Date(t.date) >= startOfMonth);
      return txs;
    };

    const companyTransactions = transactions.filter(t => t.company_id === currentCompany?.id);
    const companyParties = parties.filter(p => p.company_id === currentCompany?.id);

    const cashInHand = transactions
      .filter(t => t.company_id === currentCompany?.id)
      .reduce((sum, t) => {
        if (t.type === 'Withdraw') return sum + t.amount;
        if (t.type === 'Deposit') return sum - t.amount;
        if (!t.bank_id && !t.to_bank_id) {
          if (['Sale', 'Payment In', 'Stock In', 'Bank To Party'].includes(t.type)) return sum + t.amount;
          if (['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Party To Bank'].includes(t.type)) return sum - t.amount;
        }
        return sum;
      }, 0) + 
      invoices
        .filter(i => i.company_id === currentCompany?.id && i.status === 'Paid' && i.payment_type === 'Cash')
        .reduce((sum, i) => i.type === 'Sale' ? sum + i.total : sum - i.total, 0);
    const totalBankBalance = companyBanks.reduce((sum, b) => sum + b.balance, 0);

    let result = [];
    switch (activeReport) {
      case 'All Parties':
        result = companyParties
          .filter(p => selectedCategory === 'All' || p.type === selectedCategory)
          .map(p => ({ name: p.name, balance: p.balance, type: p.type }));
        break;
      case 'Single Party':
        const selectedParty = parties.find(p => p.id === selectedEntity);
        const partyTxs = companyTransactions.filter(t => t.party_id === selectedEntity || t.to_party_id === selectedEntity);
        const partyInvoices = companyInvoices.filter(i => i.party_id === selectedEntity).map(i => ({
          id: i.id,
          date: i.date,
          type: i.type,
          description: `Invoice ${i.invoice_number}`,
          amount: i.total,
          party_id: i.party_id
        }));
        const baseData = filterByDate([...partyTxs, ...partyInvoices]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        if (selectedParty) {
          result = [
            { id: 'opening', date: selectedParty.created_at, type: 'Opening Balance', description: 'Opening Balance', amount: selectedParty.opening_balance, isOpening: true },
            ...baseData
          ];
        } else {
          result = baseData;
        }
        break;
      case 'All Banks':
        result = companyBanks.map(b => ({ name: b.name, balance: b.balance, account: b.account_number }));
        break;
      case 'Single Bank':
        const selectedBank = banks.find(b => b.id === selectedEntity);
        const bankTxs = companyTransactions.filter(t => t.bank_id === selectedEntity || t.to_bank_id === selectedEntity);
        const bankInvoices = companyInvoices.filter(i => i.bank_id === selectedEntity).map(i => ({
          id: i.id,
          date: i.date,
          type: i.type,
          description: `Invoice ${i.invoice_number}`,
          amount: i.total,
          bank_id: i.bank_id
        }));
        const baseBankData = filterByDate([...bankTxs, ...bankInvoices]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        if (selectedBank) {
          result = [
            { id: 'opening', date: selectedBank.created_at, type: 'Opening Balance', description: 'Opening Balance', amount: selectedBank.opening_balance, isOpening: true },
            ...baseBankData
          ];
        } else {
          result = baseBankData;
        }
        break;
      case 'Stock':
        result = companyItems.map(i => ({ 
          name: i.name, 
          sku: i.sku, 
          unit: (i as any).unit || 'Unit', 
          price: i.price, 
          stock: i.stock, 
          value: i.stock * i.price 
        }));
        break;
      case 'Purchase':
        const purchaseInvoices = companyInvoices.filter(i => i.type === 'Purchase').flatMap(inv => 
          inv.items.map(item => ({
            id: inv.id,
            date: inv.date,
            party_name: parties.find(p => p.id === inv.party_id)?.name || 'Walk-in',
            item_name: item.name,
            qty: item.quantity,
            unit: item.unit || 'Unit',
            price: item.price,
            total: item.total
          }))
        );
        const purchaseTransactions = companyTransactions.filter(t => t.type === 'Purchase').map(t => ({
          id: t.id,
          date: t.date,
          party_name: parties.find(p => p.id === t.party_id)?.name || 'N/A',
          item_name: t.item_id ? companyItems.find(i => i.id === t.item_id)?.name : (t.description || 'General Purchase'),
          qty: t.quantity || 1,
          unit: (companyItems.find(i => i.id === t.item_id) as any)?.unit || 'Unit',
          price: t.quantity ? t.amount / t.quantity : t.amount,
          total: t.amount
        }));
        result = filterByDate([...purchaseInvoices, ...purchaseTransactions]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Sale':
        const saleInvoices = companyInvoices.filter(i => i.type === 'Sale').flatMap(inv => 
          inv.items.map(item => ({
            id: inv.id,
            date: inv.date,
            party_name: parties.find(p => p.id === inv.party_id)?.name || 'Walk-in',
            item_name: item.name,
            qty: item.quantity,
            unit: item.unit || 'Unit',
            price: item.price,
            total: item.total
          }))
        );
        const saleTransactions = companyTransactions.filter(t => t.type === 'Sale').map(t => ({
          id: t.id,
          date: t.date,
          party_name: parties.find(p => p.id === t.party_id)?.name || 'N/A',
          item_name: t.item_id ? companyItems.find(i => i.id === t.item_id)?.name : (t.description || 'General Sale'),
          qty: t.quantity || 1,
          unit: (companyItems.find(i => i.id === t.item_id) as any)?.unit || 'Unit',
          price: t.quantity ? t.amount / t.quantity : t.amount,
          total: t.amount
        }));
        result = filterByDate([...saleInvoices, ...saleTransactions]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Expense':
        result = filterByDate(companyTransactions.filter(t => t.type === 'Expense')).map(t => ({
          ...t,
          paid_from: t.bank_id ? companyBanks.find(b => b.id === t.bank_id)?.name : 'Cash'
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Invoice':
        result = filterByDate(companyInvoices).flatMap(inv => 
          inv.items.map((item: any) => ({
            ...inv,
            item_name: item.name,
            qty: item.quantity,
            unit: item.unit || '-',
            unit_price: item.price,
            item_total: item.total
          }))
        );
        break;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item: any) => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(query)
        )
      );
    }

    return result;
  }, [activeReport, selectedEntity, selectedCategory, dateRange, searchQuery, transactions, parties, banks, items, invoices, currentCompany]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    const titleText = activeReport === 'All Parties' && selectedCategory !== 'All' 
      ? `${selectedCategory} Parties Report` 
      : `${activeReport} Report`;
    doc.text(titleText, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    doc.text(`Period: ${dateRange}`, 14, 44);
    if (selectedEntity) {
      const entityName = (activeReport === 'Single Party' ? parties : banks).find(e => e.id === selectedEntity)?.name;
      doc.text(`For: ${entityName}`, 14, 50);
    }

    let head: string[][] = [];
    let body: any[][] = [];
    let total = 0;

    const getVisibleColumns = (reportType: ReportType) => {
      const all = allColumns[reportType];
      return all.filter(col => selectedColumns.includes(col));
    };

    const visibleCols = getVisibleColumns(activeReport);
    head = [visibleCols];

    if (activeReport === 'All Banks') {
      doc.setFontSize(10);
      doc.text(`Cash in Hand: ${formatCurrency(transactions.filter(t => !t.bank_id && t.company_id === currentCompany?.id).reduce((sum, t) => {
        if (t.type === 'Sale' || (t.type as string) === 'Income') return sum + t.amount;
        if (t.type === 'Expense' || t.type === 'Payment Out') return sum - t.amount;
        return sum;
      }, 0), settings.currency)}`, 14, 55);
      doc.text(`Total Bank Balances: ${formatCurrency(banks.filter(b => b.company_id === currentCompany?.id).reduce((sum, b) => sum + b.balance, 0), settings.currency)}`, 14, 61);
    }

    if (activeReport === 'All Parties') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Party Name')) row.push(d.name);
        if (selectedColumns.includes('Type')) row.push(d.type);
        if (selectedColumns.includes('Debit (DR)')) row.push(d.balance >= 0 ? formatCurrency(d.balance, settings.currency) : '-');
        if (selectedColumns.includes('Credit (CR)')) row.push(d.balance < 0 ? formatCurrency(Math.abs(d.balance), settings.currency) : '-');
        if (selectedColumns.includes('Balance')) row.push(`${formatCurrency(Math.abs(d.balance), settings.currency)} ${d.balance >= 0 ? 'DR' : 'CR'}`);
        return row;
      });
      const totalDebit = filteredData.filter(d => d.balance >= 0).reduce((sum, d) => sum + d.balance, 0);
      const totalCredit = filteredData.filter(d => d.balance < 0).reduce((sum, d) => sum + Math.abs(d.balance), 0);
      const finalBalance = totalDebit - totalCredit;
      
      autoTable(doc, {
        head,
        body,
        startY: 50,
        theme: 'grid',
        foot: [visibleCols.map(col => {
          if (col === 'Party Name') return '';
          if (col === 'Type') return 'Total';
          if (col === 'Debit (DR)') return formatCurrency(totalDebit, settings.currency);
          if (col === 'Credit (CR)') return formatCurrency(totalCredit, settings.currency);
          if (col === 'Balance') return `${formatCurrency(Math.abs(finalBalance), settings.currency)} ${finalBalance >= 0 ? 'DR' : 'CR'}`;
          return '';
        })],
        footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
      });
    } else if (activeReport === 'Single Party' || activeReport === 'Single Bank') {
      let runningBalance = 0;
      body = filteredData.map(d => {
        let isDebit = false;
        let amountValue = d.amount || 0;

        if (d.isOpening) {
          runningBalance = amountValue;
        } else {
          isDebit = d.type === 'Sale' || d.type === 'Payment In' || d.type === 'Deposit' || d.type === 'Party To Bank' || d.type === 'Bank To Party' || d.type === 'Stock Out';
          if (isDebit) runningBalance += amountValue;
          else runningBalance -= amountValue;
        }
        
        const row: any[] = [];
        if (selectedColumns.includes('Date')) row.push(d.isOpening ? '-' : formatDate(d.date));
        if (selectedColumns.includes('Description')) row.push(d.description || d.type);
        if (selectedColumns.includes('Debit') || selectedColumns.includes('Deposit')) row.push((!d.isOpening && isDebit) ? formatCurrency(amountValue, settings.currency) : '-');
        if (selectedColumns.includes('Credit') || selectedColumns.includes('Withdrawal')) row.push((!d.isOpening && !isDebit) ? formatCurrency(amountValue, settings.currency) : '-');
        if (selectedColumns.includes('Balance')) row.push(`${formatCurrency(Math.abs(runningBalance), settings.currency)} ${runningBalance >= 0 ? 'DR' : 'CR'}`);
        return row;
      });
      total = runningBalance;
    } else if (activeReport === 'All Banks') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Bank Name')) row.push(d.name);
        if (selectedColumns.includes('Account #')) row.push(d.account || '-');
        if (selectedColumns.includes('Debit (DR)')) row.push(d.balance >= 0 ? formatCurrency(d.balance, settings.currency) : '-');
        if (selectedColumns.includes('Credit (CR)')) row.push(d.balance < 0 ? formatCurrency(Math.abs(d.balance), settings.currency) : '-');
        if (selectedColumns.includes('Balance')) row.push(`${formatCurrency(Math.abs(d.balance), settings.currency)} ${d.balance >= 0 ? 'DR' : 'CR'}`);
        return row;
      });
      const totalDebit = filteredData.filter(d => d.balance >= 0).reduce((sum, d) => sum + d.balance, 0);
      const totalCredit = filteredData.filter(d => d.balance < 0).reduce((sum, d) => sum + Math.abs(d.balance), 0);
      const finalBalance = totalDebit - totalCredit;

        autoTable(doc, {
          head,
          body,
          startY: 68,
          theme: 'grid',
          foot: [visibleCols.map(col => {
            if (col === 'Bank Name') return '';
            if (col === 'Account #') return 'Total';
            if (col === 'Debit (DR)') return formatCurrency(totalDebit, settings.currency);
            if (col === 'Credit (CR)') return formatCurrency(totalCredit, settings.currency);
            if (col === 'Balance') return `${formatCurrency(Math.abs(finalBalance), settings.currency)} ${finalBalance >= 0 ? 'DR' : 'CR'}`;
            return '';
          })],
          footStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
        });
    } else if (activeReport === 'Stock') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Item Name')) row.push(d.name);
        if (selectedColumns.includes('SKU')) row.push(d.sku || '-');
        if (selectedColumns.includes('Unit')) row.push(d.unit || '-');
        if (selectedColumns.includes('Price')) row.push(formatCurrency(d.price, settings.currency));
        if (selectedColumns.includes('Stock')) row.push(d.stock);
        if (selectedColumns.includes('Value')) row.push(formatCurrency(d.value, settings.currency));
        return row;
      });
      total = filteredData.reduce((sum, d) => sum + d.value, 0);
    } else if (activeReport === 'Purchase' || activeReport === 'Sale') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Date')) row.push(formatDate(d.date));
        if (selectedColumns.includes('Party')) row.push(d.party_name || '-');
        if (selectedColumns.includes('Item')) row.push(d.item_name || '-');
        if (selectedColumns.includes('Qty')) row.push(d.qty || d.quantity || '1');
        if (selectedColumns.includes('Unit')) row.push(d.unit || '-');
        if (selectedColumns.includes('Price')) row.push(formatCurrency(d.unit_price || d.price, settings.currency));
        if (selectedColumns.includes('Total')) row.push(formatCurrency(d.total || d.amount, settings.currency));
        return row;
      });
      total = filteredData.reduce((sum, d) => sum + (d.total || d.amount), 0);
    } else if (activeReport === 'Expense') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Date')) row.push(formatDate(d.date));
        if (selectedColumns.includes('Description')) row.push(d.description || '-');
        if (selectedColumns.includes('Category')) row.push(d.category || '-');
        if (selectedColumns.includes('Paid From')) row.push(d.paid_from || 'Cash');
        if (selectedColumns.includes('Amount')) row.push(formatCurrency(d.amount, settings.currency));
        return row;
      });
      total = filteredData.reduce((sum, d) => sum + d.amount, 0);
    } else if (activeReport === 'Invoice') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Invoice #')) row.push(d.invoice_number);
        if (selectedColumns.includes('Date')) row.push(formatDate(d.date));
        if (selectedColumns.includes('Item')) row.push(d.item_name);
        if (selectedColumns.includes('Qty')) row.push(d.qty);
        if (selectedColumns.includes('Unit')) row.push(d.unit);
        if (selectedColumns.includes('Price')) row.push(formatCurrency(d.unit_price, settings.currency));
        if (selectedColumns.includes('Total')) row.push(formatCurrency(d.item_total, settings.currency));
        return row;
      });
      total = filteredData.reduce((sum, d) => sum + d.item_total, 0);
    }

    if (activeReport !== 'All Parties' && activeReport !== 'All Banks') {
      autoTable(doc, {
        head,
        body,
        startY: selectedEntity ? 55 : 50,
        theme: 'grid',
        headStyles: { 
          fillColor: [99, 102, 241],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        foot: (() => {
          if (activeReport === 'Single Party' || activeReport === 'Single Bank') {
            return [visibleCols.map(col => {
              if (col === 'Balance') return `${formatCurrency(Math.abs(total), settings.currency)} ${total >= 0 ? 'DR' : 'CR'}`;
              if (col === 'Credit' || col === 'Withdrawal') return 'Total Balance';
              return '';
            })];
          }
          return [visibleCols.map(col => {
            if (col === 'Amount' || col === 'Value' || col === 'Total' || col === 'Balance') return formatCurrency(total, settings.currency);
            if (col === 'Description' || col === 'SKU' || col === 'Price') return 'Total';
            return '';
          })];
        })(),
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          fontStyle: 'bold'
        }
      });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`${activeReport.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    console.log(`PDF Generated: ${activeReport}`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="lg:w-72 space-y-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-4">Report Types</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
          {reportOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setActiveReport(opt.id as ReportType);
                setSelectedEntity('');
              }}
              className={cn(
                "w-full flex items-center gap-3 p-4 rounded-2xl transition-all group",
                activeReport === opt.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
              )}
            >
              <opt.icon size={20} />
              <span className="font-bold text-sm">{opt.label}</span>
              <ChevronRight size={16} className={cn("ml-auto transition-transform", activeReport === opt.id ? "rotate-90" : "")} />
            </button>
          ))}
        </div>
      </aside>

      {/* Main Report Area */}
      <div className="flex-1 space-y-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{activeReport} Report</h2>
              <p className="text-slate-500 dark:text-slate-400">View and export your business data</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {activeReport === 'All Parties' && (
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="p-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold outline-none text-slate-900 dark:text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat} {cat === 'All' ? 'Categories' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search report..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold outline-none text-slate-900 dark:text-white"
                />
              </div>
              <button 
                onClick={() => setIsColumnModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all border border-slate-100"
              >
                <Filter size={18} />
                Columns
              </button>
              {activeReport === 'Single Bank' && (
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mr-2">
                  <button 
                    onClick={() => setViewMode('app')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      viewMode === 'app' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                    )}
                  >
                    {viewMode === 'app' ? 'App View' : 'App'}
                  </button>
                  <button 
                    onClick={() => setViewMode('accounting')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      viewMode === 'accounting' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
                    )}
                  >
                    {viewMode === 'accounting' ? 'Accounting View' : 'Accounting'}
                  </button>
                </div>
              )}
              {(activeReport === 'Single Party' || activeReport === 'Single Bank') && (
                <select 
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-slate-900"
                >
                  <option value="">Select {activeReport === 'Single Party' ? 'Party' : 'Bank'}</option>
                  {(activeReport === 'Single Party' ? parties : banks).map(e => (
                    <option key={e.id} value={e.id} className="text-slate-900 dark:text-slate-900">{e.name}</option>
                  ))}
                </select>
              )}
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none text-slate-900 dark:text-slate-900"
              >
                <option className="text-slate-900 dark:text-slate-900">This Month</option>
                <option className="text-slate-900 dark:text-slate-900">All Time</option>
              </select>
              <button 
                onClick={exportPDF}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Download size={18} />
                Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-50 text-slate-500 dark:text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  {selectedColumns.map(col => (
                    <th key={col} className={cn("px-6 py-4 font-semibold", col.includes('Balance') || col.includes('Debit') || col.includes('Credit') || col.includes('Amount') || col.includes('Total') || col.includes('Price') || col.includes('Qty') || col.includes('Stock') || col.includes('Value') ? "text-right" : "")}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredData.map((row, i) => {
                  let currentBalance = 0;
                  if (activeReport === 'Single Party' || activeReport === 'Single Bank') {
                    for (let j = 0; j <= i; j++) {
                      const item = filteredData[j];
                      if (item.isOpening) {
                        currentBalance = item.amount;
                        continue;
                      }
                      const itemIsDebit = item.type === 'Sale' || item.type === 'Payment In' || item.type === 'Deposit' || item.type === 'Party To Bank' || item.type === 'Bank To Party';
                      if (itemIsDebit) currentBalance += (item.amount || item.total || 0);
                      else currentBalance -= (item.amount || item.total || 0);
                    }
                  }

                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {selectedColumns.map(col => {
                        let content: React.ReactNode = '-';
                        let className = "px-6 py-4 text-sm font-medium text-slate-900";

                        if (col === 'Party Name' || col === 'Bank Name' || col === 'Item Name' || col === 'Party') {
                          content = row.name || row.party_name;
                          className += " font-bold";
                        } else if (col === 'Type' || col === 'Category') {
                          content = row.type || row.category || '-';
                        } else if (col === 'Date') {
                          content = formatDate(row.date);
                        } else if (col === 'Description') {
                          content = row.description || row.type || '-';
                          className = "px-6 py-4 text-sm text-slate-500";
                        } else if (col === 'Account #') {
                          content = row.account || '-';
                        } else if (col === 'SKU') {
                          content = row.sku || '-';
                        } else if (col === 'Stock') {
                          content = row.stock;
                          className += " text-right";
                        } else if (col === 'Value') {
                          content = formatCurrency(row.value, settings.currency);
                          className += " text-right text-indigo-600 font-bold";
                        } else if (col === 'Debit (DR)' || col === 'Debit' || col === 'Deposit') {
                          const isDebit = row.type === 'Sale' || row.type === 'Payment In' || row.type === 'Deposit' || row.type === 'Party To Bank' || row.type === 'Bank To Party' || row.to_bank_id === selectedEntity || row.balance >= 0;
                          const amount = row.amount || row.total || (row.balance >= 0 ? row.balance : 0);
                          content = isDebit ? formatCurrency(amount, settings.currency) : '-';
                          className += " text-right text-emerald-600 font-bold";
                        } else if (col === 'Credit (CR)' || col === 'Credit' || col === 'Withdrawal') {
                          const isCredit = row.type === 'Purchase' || row.type === 'Payment Out' || row.type === 'Withdraw' || row.type === 'Bank To Party' || row.type === 'Party To Bank' || row.bank_id === selectedEntity || row.balance < 0;
                          const amount = (row.amount || row.total) || (row.balance < 0 ? Math.abs(row.balance) : 0);
                          content = isCredit ? formatCurrency(amount, settings.currency) : '-';
                          className += " text-right text-rose-600 font-bold";
                        } else if (col === 'Balance') {
                          const balance = activeReport.includes('Single') ? currentBalance : row.balance;
                          content = `${formatCurrency(Math.abs(balance), settings.currency)} ${balance >= 0 ? 'DR' : 'CR'}`;
                          className += cn(" text-right font-bold", balance >= 0 ? "text-emerald-600" : "text-rose-600");
                        } else if (col === 'Amount' || col === 'Total') {
                          content = formatCurrency(row.amount || row.total || row.item_total, settings.currency);
                          className += cn(" text-right font-bold", activeReport === 'Sale' ? "text-emerald-600" : "text-rose-600");
                        } else if (col === 'Invoice #') {
                          content = row.invoice_number || '-';
                        } else if (col === 'Item') {
                          content = row.item_name || '-';
                        } else if (col === 'Qty') {
                          content = row.qty || row.quantity || '1';
                          className += " text-right";
                        } else if (col === 'Unit') {
                          content = row.unit || '-';
                        } else if (col === 'Price') {
                          content = formatCurrency(row.unit_price || row.price, settings.currency);
                          className += " text-right";
                        } else if (col === 'Paid From') {
                          content = row.paid_from || 'Cash';
                        }

                        return <td key={col} className={className}>{content}</td>;
                      })}
                    </tr>
                  );
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={selectedColumns.length} className="px-6 py-12 text-center text-slate-400">
                      No data found for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Column Selection Modal */}
      <AnimatePresence>
        {isColumnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsColumnModalOpen(false)} 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold">Configure Columns</h2>
                <button onClick={() => setIsColumnModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Visible Columns</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedColumns(allColumns[activeReport])}
                      className="text-xs text-indigo-600 font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button 
                      onClick={() => setSelectedColumns([allColumns[activeReport][0]])}
                      className="text-xs text-slate-500 font-bold hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {allColumns[activeReport].map(col => (
                    <label key={col} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                      <input 
                        type="checkbox" 
                        checked={selectedColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedColumns([...selectedColumns, col]);
                          else setSelectedColumns(selectedColumns.filter(c => c !== col));
                        }}
                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-slate-700">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setIsColumnModalOpen(false)}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  Apply Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
