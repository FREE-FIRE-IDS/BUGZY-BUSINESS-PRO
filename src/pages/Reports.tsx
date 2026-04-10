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
import jsPDF from 'jspdf';
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
  const [dateRange, setDateRange] = useState('This Month');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allColumns: Record<ReportType, string[]> = {
    'All Parties': ['Party Name', 'Type', 'Debit (DR)', 'Credit (CR)', 'Balance'],
    'Single Party': ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    'All Banks': ['Bank Name', 'Account #', 'Debit (DR)', 'Credit (CR)', 'Balance'],
    'Single Bank': ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    'Stock': ['Item Name', 'SKU', 'Stock', 'Value'],
    'Purchase': ['Date', 'Description', 'Amount'],
    'Sale': ['Date', 'Description', 'Amount'],
    'Expense': ['Date', 'Description', 'Amount'],
    'Invoice': ['Invoice #', 'Date', 'Item', 'Qty', 'Unit', 'Price', 'Total']
  };

  useEffect(() => {
    setSelectedColumns(allColumns[activeReport]);
  }, [activeReport]);

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
    let data: any[] = [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const filterByDate = (txs: any[]) => {
      if (dateRange === 'This Month') return txs.filter(t => new Date(t.date) >= startOfMonth);
      return txs;
    };

    const companyTransactions = transactions.filter(t => t.company_id === currentCompany?.id);
    const companyParties = parties.filter(p => p.company_id === currentCompany?.id);
    const companyBanks = banks.filter(b => b.company_id === currentCompany?.id);
    const companyItems = items.filter(i => i.company_id === currentCompany?.id);
    const companyInvoices = invoices.filter(i => i.company_id === currentCompany?.id);

    let result = [];
    switch (activeReport) {
      case 'All Parties':
        result = companyParties.map(p => ({ name: p.name, balance: p.balance, type: p.type }));
        break;
      case 'Single Party':
        const partyTxs = companyTransactions.filter(t => t.party_id === selectedEntity || t.to_party_id === selectedEntity);
        const partyInvoices = companyInvoices.filter(i => i.party_id === selectedEntity).map(i => ({
          id: i.id,
          date: i.date,
          type: i.type,
          description: `Invoice ${i.invoice_number}`,
          amount: i.total,
          party_id: i.party_id
        }));
        result = filterByDate([...partyTxs, ...partyInvoices]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'All Banks':
        result = companyBanks.map(b => ({ name: b.name, balance: b.balance, account: b.account_number }));
        break;
      case 'Single Bank':
        const bankTxs = companyTransactions.filter(t => t.bank_id === selectedEntity || t.to_bank_id === selectedEntity);
        const bankInvoices = companyInvoices.filter(i => i.bank_id === selectedEntity).map(i => ({
          id: i.id,
          date: i.date,
          type: i.type,
          description: `Invoice ${i.invoice_number}`,
          amount: i.total,
          bank_id: i.bank_id
        }));
        result = filterByDate([...bankTxs, ...bankInvoices]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Stock':
        result = companyItems.map(i => ({ name: i.name, sku: i.sku, stock: i.stock, value: i.stock * i.price }));
        break;
      case 'Purchase':
        result = filterByDate([
          ...companyTransactions.filter(t => t.type === 'Purchase'),
          ...companyInvoices.filter(i => i.type === 'Purchase').map(i => ({
            id: i.id,
            date: i.date,
            type: 'Purchase',
            description: `Invoice ${i.invoice_number}`,
            amount: i.total,
            party_id: i.party_id
          }))
        ]);
        break;
      case 'Sale':
        result = filterByDate([
          ...companyTransactions.filter(t => t.type === 'Sale'),
          ...companyInvoices.filter(i => i.type === 'Sale').map(i => ({
            id: i.id,
            date: i.date,
            type: 'Sale',
            description: `Invoice ${i.invoice_number}`,
            amount: i.total,
            party_id: i.party_id
          }))
        ]);
        break;
      case 'Expense':
        result = filterByDate(companyTransactions.filter(t => t.type === 'Expense'));
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
  }, [activeReport, selectedEntity, dateRange, searchQuery, transactions, parties, banks, items, invoices, currentCompany]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(companyName, 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(99, 102, 241);
    doc.text(`${activeReport} Report`, 14, 30);
    
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
        const isDebit = d.type === 'Sale' || d.type === 'Payment In' || d.type === 'Deposit' || d.type === 'Party To Bank' || d.type === 'Bank To Party';
        const amount = d.amount;
        if (isDebit) runningBalance += amount;
        else runningBalance -= amount;
        
        const row: any[] = [];
        if (selectedColumns.includes('Date')) row.push(formatDate(d.date));
        if (selectedColumns.includes('Description')) row.push(d.description || d.type);
        if (selectedColumns.includes('Debit')) row.push(isDebit ? formatCurrency(amount, settings.currency) : '-');
        if (selectedColumns.includes('Credit')) row.push(!isDebit ? formatCurrency(amount, settings.currency) : '-');
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
        startY: 50,
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
        if (selectedColumns.includes('Stock')) row.push(d.stock);
        if (selectedColumns.includes('Value')) row.push(formatCurrency(d.value, settings.currency));
        return row;
      });
      total = filteredData.reduce((sum, d) => sum + d.value, 0);
    } else if (activeReport === 'Purchase' || activeReport === 'Expense' || activeReport === 'Sale') {
      body = filteredData.map(d => {
        const row: any[] = [];
        if (selectedColumns.includes('Date')) row.push(formatDate(d.date));
        if (selectedColumns.includes('Description')) row.push(d.description || '-');
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
              if (col === 'Credit') return 'Total Balance';
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
        `Page ${i} of ${pageCount} - Generated by Bugzy Pro`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`${activeReport.replace(/\s+/g, '_')}_Report_${new Date().getTime()}.pdf`);
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
                  : "bg-white dark:bg-white text-slate-600 dark:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-50 border border-slate-100 dark:border-slate-200"
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
        <div className="bg-white dark:bg-white p-8 rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-900">{activeReport} Report</h2>
              <p className="text-slate-500 dark:text-slate-500">View and export your business data</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Search report..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-50 border-none rounded-xl text-sm font-bold outline-none text-slate-900"
                />
              </div>
              <button 
                onClick={() => setIsColumnModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all border border-slate-100"
              >
                <Filter size={18} />
                Columns
              </button>
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

                        if (col === 'Party Name' || col === 'Bank Name' || col === 'Item Name') {
                          content = row.name;
                          className += " font-bold";
                        } else if (col === 'Type') {
                          content = row.type;
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
                        } else if (col === 'Debit (DR)' || col === 'Debit') {
                          const isDebit = row.type === 'Sale' || row.type === 'Payment In' || row.type === 'Deposit' || row.type === 'Party To Bank' || row.type === 'Bank To Party' || row.balance >= 0;
                          const amount = row.amount || row.total || (row.balance >= 0 ? row.balance : 0);
                          content = isDebit ? formatCurrency(amount, settings.currency) : '-';
                          className += " text-right text-emerald-600 font-bold";
                        } else if (col === 'Credit (CR)' || col === 'Credit') {
                          const isCredit = row.type === 'Purchase' || row.type === 'Payment Out' || row.type === 'Withdraw' || row.type === 'Bank To Party' || row.type === 'Party To Bank' || row.balance < 0;
                          const amount = row.amount || row.total || (row.balance < 0 ? Math.abs(row.balance) : 0);
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
                          content = row.invoice_number;
                        } else if (col === 'Item') {
                          content = row.item_name;
                        } else if (col === 'Qty') {
                          content = row.qty;
                          className += " text-right";
                        } else if (col === 'Unit') {
                          content = row.unit;
                        } else if (col === 'Price') {
                          content = formatCurrency(row.unit_price, settings.currency);
                          className += " text-right";
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
