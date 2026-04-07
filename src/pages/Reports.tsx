import React, { useState, useMemo } from 'react';
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
  ArrowLeftRight
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

    switch (activeReport) {
      case 'All Parties':
        data = companyParties.map(p => ({ name: p.name, balance: p.balance, type: p.type }));
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
        data = filterByDate([...partyTxs, ...partyInvoices]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'All Banks':
        data = companyBanks.map(b => ({ name: b.name, balance: b.balance, account: b.account_number }));
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
        data = filterByDate([...bankTxs, ...bankInvoices]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Stock':
        data = companyItems.map(i => ({ name: i.name, sku: i.sku, stock: i.stock, value: i.stock * i.price }));
        break;
      case 'Purchase':
        data = filterByDate([
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
        data = filterByDate([
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
        data = filterByDate(companyTransactions.filter(t => t.type === 'Expense'));
        break;
      case 'Invoice':
        data = filterByDate(companyInvoices);
        break;
    }
    return data;
  }, [activeReport, selectedEntity, dateRange, transactions, parties, banks, items, invoices, currentCompany]);

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

    if (activeReport === 'All Parties') {
      head = [['Party Name', 'Type', 'Balance']];
      body = filteredData.map(d => [d.name, d.type, formatCurrency(d.balance, settings.currency)]);
      total = filteredData.reduce((sum, d) => sum + d.balance, 0);
    } else if (activeReport === 'Single Party' || activeReport === 'Single Bank') {
      head = [['Date', 'Description', 'Debit', 'Credit', 'Balance']];
      let runningBalance = 0;
      body = filteredData.map(d => {
        const isDebit = d.type === 'Sale' || d.type === 'Payment In' || d.type === 'Deposit' || d.type === 'Party To Bank' || d.type === 'Bank To Party';
        const amount = d.amount;
        if (isDebit) runningBalance += amount;
        else runningBalance -= amount;
        
        return [
          formatDate(d.date),
          d.description || d.type,
          isDebit ? formatCurrency(amount, settings.currency) : '-',
          !isDebit ? formatCurrency(amount, settings.currency) : '-',
          `${formatCurrency(Math.abs(runningBalance), settings.currency)} ${runningBalance >= 0 ? 'DR' : 'CR'}`
        ];
      });
      total = runningBalance;
    } else if (activeReport === 'All Banks') {
      head = [['Bank Name', 'Account #', 'Balance']];
      body = filteredData.map(d => [d.name, d.account || '-', formatCurrency(d.balance, settings.currency)]);
      total = filteredData.reduce((sum, d) => sum + d.balance, 0);
    } else if (activeReport === 'Stock') {
      head = [['Item Name', 'SKU', 'Stock', 'Value']];
      body = filteredData.map(d => [d.name, d.sku || '-', d.stock, formatCurrency(d.value, settings.currency)]);
      total = filteredData.reduce((sum, d) => sum + d.value, 0);
    } else if (activeReport === 'Purchase' || activeReport === 'Expense' || activeReport === 'Sale') {
      head = [['Date', 'Description', 'Amount']];
      body = filteredData.map(d => [formatDate(d.date), d.description || '-', formatCurrency(d.amount, settings.currency)]);
      total = filteredData.reduce((sum, d) => sum + d.amount, 0);
    } else if (activeReport === 'Invoice') {
      head = [['Invoice #', 'Date', 'Party', 'Total']];
      body = filteredData.map(d => [d.invoice_number, formatDate(d.date), parties.find(p => p.id === d.party_id)?.name || '-', formatCurrency(d.total, settings.currency)]);
      total = filteredData.reduce((sum, d) => sum + d.total, 0);
    }

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
          return [['', '', '', 'Total Balance', `${formatCurrency(Math.abs(total), settings.currency)} ${total >= 0 ? 'DR' : 'CR'}`]];
        }
        if (activeReport === 'All Parties' || activeReport === 'All Banks' || activeReport === 'Purchase' || activeReport === 'Expense' || activeReport === 'Sale') {
          return [['', 'Total', formatCurrency(total, settings.currency)]];
        }
        return [['', '', 'Total', formatCurrency(total, settings.currency)]];
      })(),
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold'
      }
    });

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
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-100"
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
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-black">{activeReport} Report</h2>
              <p className="text-slate-500">View and export your business data</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {(activeReport === 'Single Party' || activeReport === 'Single Bank') && (
                <select 
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none text-black"
                >
                  <option value="">Select {activeReport === 'Single Party' ? 'Party' : 'Bank'}</option>
                  {(activeReport === 'Single Party' ? parties : banks).map(e => (
                    <option key={e.id} value={e.id} className="text-black">{e.name}</option>
                  ))}
                </select>
              )}
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none text-black"
              >
                <option className="text-black">This Month</option>
                <option className="text-black">All Time</option>
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
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  {activeReport === 'All Parties' && (
                    <>
                      <th className="px-6 py-4 font-semibold">Party Name</th>
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold text-right">Balance</th>
                    </>
                  )}
                  {(activeReport === 'Single Party' || activeReport === 'Single Bank') && (
                    <>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Description</th>
                      <th className="px-6 py-4 font-semibold text-right">Debit</th>
                      <th className="px-6 py-4 font-semibold text-right">Credit</th>
                      <th className="px-6 py-4 font-semibold text-right">Balance</th>
                    </>
                  )}
                  {activeReport === 'All Banks' && (
                    <>
                      <th className="px-6 py-4 font-semibold">Bank Name</th>
                      <th className="px-6 py-4 font-semibold">Account #</th>
                      <th className="px-6 py-4 font-semibold text-right">Balance</th>
                    </>
                  )}
                  {activeReport === 'Stock' && (
                    <>
                      <th className="px-6 py-4 font-semibold">Item Name</th>
                      <th className="px-6 py-4 font-semibold">SKU</th>
                      <th className="px-6 py-4 font-semibold text-right">Stock</th>
                      <th className="px-6 py-4 font-semibold text-right">Value</th>
                    </>
                  )}
                  {(activeReport === 'Purchase' || activeReport === 'Expense' || activeReport === 'Sale') && (
                    <>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Description</th>
                      <th className="px-6 py-4 font-semibold text-right">Amount</th>
                    </>
                  )}
                  {activeReport === 'Invoice' && (
                    <>
                      <th className="px-6 py-4 font-semibold">Invoice #</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Party</th>
                      <th className="px-6 py-4 font-semibold text-right">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    {activeReport === 'All Parties' && (
                      <>
                        <td className="px-6 py-4 text-sm font-bold text-black">{row.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.type}</td>
                        <td className={cn("px-6 py-4 text-sm font-bold text-right", row.balance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {formatCurrency(row.balance, settings.currency)}
                        </td>
                      </>
                    )}
                    {(activeReport === 'Single Party' || activeReport === 'Single Bank') && (() => {
                      const isDebit = row.type === 'Sale' || row.type === 'Payment In' || row.type === 'Deposit' || row.type === 'Party To Bank' || row.type === 'Bank To Party';
                      // Calculate running balance for UI (this is a bit tricky in a map, but we can do it)
                      let currentBalance = 0;
                      for (let j = 0; j <= i; j++) {
                        const item = filteredData[j];
                        const itemIsDebit = item.type === 'Sale' || item.type === 'Payment In' || item.type === 'Deposit' || item.type === 'Party To Bank' || item.type === 'Bank To Party';
                        if (itemIsDebit) currentBalance += item.amount;
                        else currentBalance -= item.amount;
                      }

                      return (
                        <>
                          <td className="px-6 py-4 text-sm text-black">{formatDate(row.date)}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{row.description || row.type}</td>
                          <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600">
                            {isDebit ? formatCurrency(row.amount, settings.currency) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-right text-rose-600">
                            {!isDebit ? formatCurrency(row.amount, settings.currency) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-right text-black">
                            {formatCurrency(Math.abs(currentBalance), settings.currency)} {currentBalance >= 0 ? 'DR' : 'CR'}
                          </td>
                        </>
                      );
                    })()}
                    {activeReport === 'All Banks' && (
                      <>
                        <td className="px-6 py-4 text-sm font-bold text-black">{row.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.account || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-indigo-600">
                          {formatCurrency(row.balance, settings.currency)}
                        </td>
                      </>
                    )}
                    {activeReport === 'Stock' && (
                      <>
                        <td className="px-6 py-4 text-sm font-bold text-black">{row.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.sku || '-'}</td>
                        <td className="px-6 py-4 text-sm text-right text-black">{row.stock}</td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-indigo-600">
                          {formatCurrency(row.value, settings.currency)}
                        </td>
                      </>
                    )}
                    {(activeReport === 'Purchase' || activeReport === 'Expense' || activeReport === 'Sale') && (
                      <>
                        <td className="px-6 py-4 text-sm text-black">{formatDate(row.date)}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{row.description || '-'}</td>
                        <td className={cn("px-6 py-4 text-sm font-bold text-right", activeReport === 'Sale' ? "text-emerald-600" : "text-rose-600")}>
                          {formatCurrency(row.amount, settings.currency)}
                        </td>
                      </>
                    )}
                    {activeReport === 'Invoice' && (
                      <>
                        <td className="px-6 py-4 text-sm font-bold text-black">{row.invoice_number}</td>
                        <td className="px-6 py-4 text-sm text-black">{formatDate(row.date)}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{parties.find(p => p.id === row.party_id)?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-right text-indigo-600">
                          {formatCurrency(row.total, settings.currency)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      No data found for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
