import React, { useMemo, useState } from 'react';
import { 
  Users, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  FileText,
  BarChart3,
  Download
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFPreviewModal from '../components/PDFPreviewModal';

// Extend jsPDF with autotable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function BusinessStatus() {
  const { 
    transactions, 
    parties, 
    banks, 
    items, 
    invoices, 
    currentCompany, 
    settings 
  } = useApp();

  // PDF Preview State
  const [pdfPreview, setPdfPreview] = useState<{ isOpen: boolean, url: string, title: string, fileName: string }>({
    isOpen: false,
    url: '',
    title: '',
    fileName: ''
  });

  const companyId = currentCompany?.id;

  const stats = useMemo(() => {
    const companyParties = parties.filter(p => p.company_id === companyId);
    const companyBanks = banks.filter(b => b.company_id === companyId);
    const companyItems = items.filter(i => i.company_id === companyId);
    const companyTransactions = transactions.filter(t => t.company_id === companyId);
    const companyInvoices = invoices.filter(i => i.company_id === companyId);

    // Party Balances
    const receivables = companyParties.filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0);
    const payables = companyParties.filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0);

    // Bank Balances
    const totalBankBalance = companyBanks.reduce((s, b) => s + b.balance, 0);

    // Cash in Hand (Simplified calculation from transactions)
    const cashInHand = companyTransactions.reduce((sum, t) => {
      if (t.type === 'Withdraw') return sum + t.amount;
      if (t.type === 'Deposit') return sum - t.amount;
      if (!t.bank_id && !t.to_bank_id) {
        if (['Sale', 'Payment In', 'Stock In', 'Bank To Party', 'Cash Adjustment In', 'Income'].includes(t.type)) return sum + t.amount;
        if (['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Party To Bank', 'Cash Adjustment Out'].includes(t.type)) return sum - t.amount;
      }
      return sum;
    }, 0);

    // Totals
    const totalPurchase = companyInvoices.filter(i => i.type === 'Purchase').reduce((s, i) => s + i.total, 0) + 
                          companyTransactions.filter(t => t.type === 'Purchase').reduce((s, t) => s + t.amount, 0);
    const totalSale = companyInvoices.filter(i => i.type === 'Sale').reduce((s, i) => s + i.total, 0) + 
                       companyTransactions.filter(t => t.type === 'Sale').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = companyTransactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
    const totalStockValue = companyItems.reduce((s, i) => s + (i.stock * i.price), 0);

    return {
      receivables,
      payables,
      totalBankBalance,
      cashInHand,
      totalPurchase,
      totalSale,
      totalExpenses,
      totalStockValue,
      netWorth: (cashInHand + totalBankBalance + totalStockValue + receivables) - payables
    };
  }, [companyId, transactions, parties, banks, items, invoices]);

  const exportPDF = () => {
    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text(currentCompany?.name || 'Business Status', 14, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(99, 102, 241);
      doc.text('Business Status Report', 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);

      autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Value']],
        body: [
          ['Total Receivables', formatCurrency(stats.receivables, settings.currency)],
          ['Total Payables', formatCurrency(stats.payables, settings.currency)],
          ['Bank Balances', formatCurrency(stats.totalBankBalance, settings.currency)],
          ['Cash in Hand', formatCurrency(stats.cashInHand, settings.currency)],
          ['Stock Value', formatCurrency(stats.totalStockValue, settings.currency)],
          ['Total Sales', formatCurrency(stats.totalSale, settings.currency)],
          ['Total Purchases', formatCurrency(stats.totalPurchase, settings.currency)],
          ['Total Expenses', formatCurrency(stats.totalExpenses, settings.currency)],
          ['Net Worth', formatCurrency(stats.netWorth, settings.currency)],
        ],
        headStyles: { fillColor: [99, 102, 241] }
      });

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreview({
        isOpen: true,
        url: url,
        title: 'Business Status Report',
        fileName: `Business_Status_${new Date().toISOString().split('T')[0]}.pdf`
      });
    } catch (error) {
      console.error('Business Status PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };
  const cards = [
    { title: 'Parties Receivable', value: stats.receivables, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { title: 'Parties Payable', value: stats.payables, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
    { title: 'Total Bank Balance', value: stats.totalBankBalance, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { title: 'Cash in Hand', value: stats.cashInHand, icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { title: 'Total Sales', value: stats.totalSale, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { title: 'Total Purchases', value: stats.totalPurchase, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { title: 'Stock Value', value: stats.totalStockValue, icon: Package, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
    { title: 'Total Expenses', value: stats.totalExpenses, icon: Receipt, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Business Status</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time overview of your business health</p>
        </div>
        <div className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] shadow-xl shadow-indigo-500/20 flex items-center gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Company Net Worth</p>
            <div className="text-2xl font-black">{formatCurrency(stats.netWorth, settings.currency)}</div>
          </div>
          <button 
            onClick={exportPDF}
            className="ml-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors cursor-pointer"
            title="Download PDF Report"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group overflow-hidden relative"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all group-hover:scale-110", card.bg, card.color)}>
              <card.icon size={24} />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{card.title}</p>
            <h3 className={cn("text-xl font-black", card.color)}>
              {formatCurrency(card.value, settings.currency)}
            </h3>
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50/50 dark:bg-slate-800/20 rounded-full -translate-y-16 translate-x-16 -z-10 group-hover:scale-150 transition-transform duration-700" />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-xl font-black">Performance Matrix</h3>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-500">Sales vs Purchase</span>
                <span className="text-xs font-black text-indigo-600">{((stats.totalSale / (stats.totalPurchase || 1)) * 100).toFixed(1)}% Ratio</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-1000" 
                  style={{ width: `${(stats.totalSale / (stats.totalSale + stats.totalPurchase || 1)) * 100}%` }} 
                />
                <div 
                  className="bg-amber-500 h-full transition-all duration-1000" 
                  style={{ width: `${(stats.totalPurchase / (stats.totalSale + stats.totalPurchase || 1)) * 100}%` }} 
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span>Sales</span>
                <span>Purchases</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-500">Expense vs Revenue</span>
                <span className="text-xs font-black text-rose-600">{((stats.totalExpenses / (stats.totalSale || 1)) * 100).toFixed(1)}% Cost</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="bg-rose-500 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(244,63,94,0.3)]" 
                  style={{ width: `${Math.min(100, (stats.totalExpenses / (stats.totalSale || 1)) * 100)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/10 text-indigo-400 rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <h3 className="text-xl font-black">Net Worth Assets</h3>
              <p className="ml-auto text-xs font-bold text-slate-400 bg-white/5 px-3 py-1 rounded-full">Composition</p>
            </div>
            
            <div className="space-y-4">
              {[
                { label: 'Bank & Cash', value: stats.totalBankBalance + stats.cashInHand, color: 'bg-blue-500' },
                { label: 'Inventory', value: stats.totalStockValue, color: 'bg-violet-500' },
                { label: 'Receivables', value: stats.receivables, color: 'bg-emerald-500' },
                { label: 'Payables (Debt)', value: -stats.payables, color: 'bg-rose-500' },
              ].map(item => (
                <div key={item.label} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", item.color)} />
                      <span className="text-xs font-bold text-slate-300">{item.label}</span>
                    </div>
                    <span className={cn("text-sm font-black", item.value < 0 ? "text-rose-400" : "text-white")}>
                      {formatCurrency(item.value, settings.currency)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-1000", item.color)} 
                      style={{ width: `${Math.min(100, (Math.abs(item.value) / (stats.netWorth + stats.payables || 1)) * 100)}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
        {/* All Bank Balances */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Building2 size={24} />
              </div>
              <h3 className="text-xl font-black">All Bank Accounts</h3>
            </div>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black">{banks.length} Accounts</span>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
            {banks.map(bank => (
              <div key={bank.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm text-blue-600 font-bold border border-slate-100 dark:border-slate-700">
                    {bank.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-50">{bank.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{bank.account_number || 'No Account #'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-black", bank.balance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {formatCurrency(bank.balance, settings.currency)}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Balance</p>
                </div>
              </div>
            ))}
            {banks.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-medium">No bank accounts linked</div>
            )}
          </div>
        </div>

        {/* Top Party Balances */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Users size={24} />
              </div>
              <h3 className="text-xl font-black">Party Balances</h3>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-black rounded-full">Dr: {parties.filter(p => p.balance > 0).length}</span>
              <span className="px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-[10px] font-black rounded-full">Cr: {parties.filter(p => p.balance < 0).length}</span>
            </div>
          </div>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
            {parties.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)).map(party => (
              <div key={party.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm text-indigo-600 font-bold border border-slate-100 dark:border-slate-700">
                    {party.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-50">{party.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{party.phone || 'No Phone'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-black", party.balance >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {formatCurrency(party.balance, settings.currency)}
                    <span className="text-[10px] ml-1 uppercase">{party.balance >= 0 ? 'Dr' : 'Cr'}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Statement Balance</p>
                </div>
              </div>
            ))}
            {parties.length === 0 && (
              <div className="text-center py-12 text-slate-400 font-medium">No parties added yet</div>
            )}
          </div>
        </div>
      </div>

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
