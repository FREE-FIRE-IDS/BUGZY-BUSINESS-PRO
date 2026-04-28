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
  X,
  Settings as SettingsIcon,
  RefreshCw,
  Clock,
  BarChart3
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatCurrency, formatDate, formatBalance, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PDFPreviewModal from '../components/PDFPreviewModal';
import { format } from 'date-fns';

// Extend jsPDF with autotable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const DrCrToggle = ({ enabled, onToggle }: { enabled: boolean, onToggle: (val: boolean) => void }) => (
  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-auto shrink-0">
    <span className="text-[10px] font-black uppercase text-slate-500 ml-1">DR/CR</span>
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onToggle(!enabled);
      }}
      className={cn(
        "relative w-8 h-4 rounded-full transition-all duration-300",
        enabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-600"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
        enabled ? "left-4.5" : "left-0.5"
      )} />
    </button>
  </div>
);

type ReportType = 
  | 'Cash in Hand'
  | 'Single Party' 
  | 'All Parties' 
  | 'Single Bank' 
  | 'All Banks' 
  | 'Combined Statement'
  | 'Stock' 
  | 'Purchase' 
  | 'Sale'
  | 'Expense' 
  | 'Invoice'
  | 'Day Book'
  | 'Balance Sheet'
  | 'Cash Flow';

export default function Reports() {
  const { transactions, parties, banks, items, invoices, settings, updateSettings, currentCompany, refreshData, pullCompanies } = useApp();
  const [isSyncing, setIsSyncing] = useState(false);

  // PDF Preview State
  const [pdfPreview, setPdfPreview] = useState<{ isOpen: boolean, url: string, title: string, fileName: string }>({
    isOpen: false,
    url: '',
    title: '',
    fileName: ''
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshData(undefined, true);
    } catch (e) {
      console.error('Sync failed', e);
    } finally {
      setIsSyncing(false);
    }
  };
  const [activeReport, setActiveReport] = useState<ReportType>('All Parties');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dateRange, setDateRange] = useState('This Month');
  const [amountFilter, setAmountFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

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
  const [hideZeroBalances, setHideZeroBalances] = useState(false);

  const companyBanks = banks.filter(b => b.company_id === currentCompany?.id);
  const companyItems = items.filter(i => i.company_id === currentCompany?.id);
  const companyInvoices = invoices.filter(i => i.company_id === currentCompany?.id);

  const allColumns: Record<ReportType, string[]> = useMemo(() => ({
    'Cash in Hand': ['Date', 'Description', 'In (+)', 'Out (-)', 'Balance'],
    'Single Party': ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    'All Parties': viewMode === 'app' 
      ? ['#', 'Name', 'Receivable Balance', 'Payable Balance', 'Net Balance'] 
      : ['#', 'Name', 'Debit', 'Credit', 'Balance'],
    'Single Bank': ['Date', 'Description', viewMode === 'app' ? 'Deposit' : 'Debit', viewMode === 'app' ? 'Withdrawal' : 'Credit', 'Balance'],
    'All Banks': ['Bank Name', 'Account #', 'Debit (DR)', 'Credit (CR)', 'Balance'],
    'Combined Statement': ['Date', 'Account/Party', 'In (+)', 'Out (-)', 'Balance'],
    'Stock': ['Item Name', 'SKU', 'Unit', 'Price', 'Stock', 'Value'],
    'Purchase': ['Date', 'Party', 'Shipping Mark', 'Item', 'Qty', 'Total Wt', 'Shortage', 'Net Wt', 'Price', 'Total'],
    'Sale': ['Date', 'Party', 'Shipping Mark', 'Item', 'Qty', 'Total Wt', 'Shortage', 'Net Wt', 'Price', 'Total'],
    'Expense': ['Date', 'Category', 'Description', 'Qty', 'Price', 'Paid From', 'Amount'],
    'Invoice': ['Invoice #', 'Date', 'Shipping Mark', 'Item', 'Qty', 'Total Wt', 'Shortage', 'Net Wt', 'Price', 'Total'],
    'Day Book': ['Time', 'Description', 'Type', 'Account/Party', 'In (+)', 'Out (-)'],
    'Balance Sheet': ['#', 'Account Name', 'Amount'],
    'Cash Flow': ['Date', 'Category', 'Description', 'Cash In', 'Cash Out', 'Net Flow']
  }), [viewMode]);

  useEffect(() => {
    if (settings.report_customization?.[activeReport]) {
      setSelectedColumns(settings.report_customization[activeReport]);
    } else {
      setSelectedColumns(allColumns[activeReport]);
    }
  }, [activeReport, allColumns, settings.report_customization]);

  const reportOptions = [
    { id: 'Cash in Hand', label: 'Cash in Hand Report', icon: Building2 },
    { id: 'Single Party', label: 'Party Statement', icon: Users },
    { id: 'All Parties', label: 'All Parties Balance', icon: Users },
    { id: 'Single Bank', label: 'Bank Statement', icon: Building2 },
    { id: 'All Banks', label: 'All Banks Balance', icon: Building2 },
    { id: 'Combined Statement', label: 'Combined Statement', icon: FileSpreadsheet },
    { id: 'Stock', label: 'Stock Report', icon: Package },
    { id: 'Purchase', label: 'Purchase Report', icon: Receipt },
    { id: 'Sale', label: 'Sale Report', icon: ArrowUpRight },
    { id: 'Expense', label: 'Expense Report', icon: Receipt },
    { id: 'Invoice', label: 'Invoice Report', icon: FileText },
    { id: 'Day Book', label: 'Day Book', icon: Clock },
    { id: 'Balance Sheet', label: 'Balance Sheet', icon: FileSpreadsheet },
    { id: 'Cash Flow', label: 'Cash Flow', icon: ArrowLeftRight },
  ];

  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const filterByDate = (txs: any[]) => {
      if (dateRange === 'This Month') return txs.filter(t => new Date(t.date) >= startOfMonth);
      if (dateRange === 'Custom' && customStartDate && customEndDate) {
        return txs.filter(t => {
          const d = new Date(t.date);
          return d >= new Date(customStartDate) && d <= new Date(customEndDate);
        });
      }
      return txs;
    };

    const applyAmountFilter = (items: any[]) => {
      if (amountFilter === 'positive') return items.filter(i => (i.Balance || i.balance || 0) > 0);
      if (amountFilter === 'negative') return items.filter(i => (i.Balance || i.balance || 0) < 0);
      return items;
    };

    const companyTransactions = transactions.filter(t => t.company_id === currentCompany?.id);
    const companyParties = parties.filter(p => p.company_id === currentCompany?.id);

    const cashInHand = transactions
      .filter(t => t.company_id === currentCompany?.id)
      .reduce((sum, t) => {
        if (t.type === 'Withdraw') return sum + t.amount;
        if (t.type === 'Deposit') return sum - t.amount;
        if (!t.bank_id && !t.to_bank_id) {
          if (['Sale', 'Payment In', 'Stock In', 'Bank To Party', 'Cash Adjustment In'].includes(t.type)) return sum + t.amount;
          if (['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Party To Bank', 'Cash Adjustment Out'].includes(t.type)) return sum - t.amount;
        }
        return sum;
      }, 0) + 
      invoices
        .filter(i => i.company_id === currentCompany?.id && i.status === 'Paid' && i.payment_type === 'Cash')
        .reduce((sum, i) => i.type === 'Sale' ? sum + i.total : sum - i.total, 0);
    const totalBankBalance = companyBanks.reduce((sum, b) => sum + b.balance, 0);

    let result = [];
    switch (activeReport) {
      case 'Cash in Hand':
        const cashTxs = companyTransactions.filter(t => !t.bank_id && !t.to_bank_id || t.type === 'Withdraw' || t.type === 'Deposit');
        const cashInvs = companyInvoices.filter(i => i.status === 'Paid' && i.payment_type === 'Cash').map(i => ({
          ...i,
          isInvoice: true,
          amount_val: i.total,
          is_in: i.type === 'Sale'
        }));
        
        const sortedCash = [...cashTxs, ...cashInvs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let cashBal = 0;
        result = sortedCash.map(item => {
          const is_in = (item as any).isInvoice ? (item as any).is_in : ['Sale', 'Income', 'Payment In', 'Stock In', 'Withdraw', 'Bank To Party', 'Cash Adjustment In'].includes(item.type);
          const amount = (item as any).amount || (item as any).total || 0;
          if (is_in) cashBal += amount;
          else cashBal -= amount;
          return {
            ...item,
            'Date': item.date,
            'Description': item.description || (item as any).type,
            'In (+)': is_in ? amount : 0,
            'Out (-)': !is_in ? amount : 0,
            'Balance': cashBal
          };
        });
        break;
      case 'All Parties':
        result = companyParties
          .filter(p => selectedCategory === 'All' || p.type === selectedCategory)
          .filter(p => !hideZeroBalances || p.balance !== 0)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p, index) => ({ 
            '#': index + 1,
            'Name': p.name, 
            'Receivable Balance': p.balance > 0 ? p.balance : 0,
            'Payable Balance': p.balance < 0 ? Math.abs(p.balance) : 0,
            'Debit': p.balance > 0 ? p.balance : 0,
            'Credit': p.balance < 0 ? Math.abs(p.balance) : 0,
            'Net Balance': p.balance,
            'Balance': p.balance
          }));
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
        
        let pBal = selectedParty?.opening_balance || 0;
        const mappedPartyData = baseData.map(item => {
          let d = 0, c = 0;
          if (['Sale', 'Payment Out', 'Stock Out'].includes(item.type)) d = item.amount || item.total || 0;
          else if (['Purchase', 'Payment In', 'Stock In'].includes(item.type)) c = item.amount || item.total || 0;
          pBal += (d - c);
          return {
            ...item,
            'Date': item.date,
            'Description': item.description || item.type,
            'Debit': d,
            'Credit': c,
            'Balance': pBal
          };
        });

        if (selectedParty) {
          result = [
            { 
              id: 'opening', 
              date: selectedParty.created_at, 
              type: 'Opening Balance', 
              'Date': selectedParty.created_at,
              'Description': 'Opening Balance', 
              'Debit': selectedParty.opening_balance >= 0 ? selectedParty.opening_balance : 0,
              'Credit': selectedParty.opening_balance < 0 ? Math.abs(selectedParty.opening_balance) : 0,
              'Balance': selectedParty.opening_balance,
              amount: selectedParty.opening_balance, 
              isOpening: true 
            },
            ...mappedPartyData
          ];
        } else {
          result = mappedPartyData;
        }
        break;
      case 'All Banks':
        result = companyBanks
          .filter(b => !hideZeroBalances || b.balance !== 0)
          .map(b => ({ 
          name: b.name, 
          balance: b.balance, 
          account: b.account_number,
          'Bank Name': b.name,
          'Account #': b.account_number,
          'Debit (DR)': b.balance >= 0 ? b.balance : 0,
          'Credit (CR)': b.balance < 0 ? Math.abs(b.balance) : 0,
          'Balance': b.balance
        }));
        break;
      case 'Combined Statement':
        const allTransactionsForComb = companyTransactions;
        const allInvoicesForComb = companyInvoices.filter(i => i.status === 'Paid');
        
        const combined = [...allTransactionsForComb, ...allInvoicesForComb].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let combBal = 0;
        result = combined.map(item => {
          const amount = (item as any).amount || (item as any).total || 0;
          // Simple heuristic: everything that increases company wealth is "In"
          const is_in = ['Sale', 'Income', 'Payment In', 'Stock In', 'Deposit', 'Bank To Party'].includes(item.type);
          if (is_in) combBal += amount;
          else combBal -= amount;
          
          return {
            ...item,
            'Date': item.date,
            'Account/Party': (item as any).party_id ? parties.find(p => p.id === (item as any).party_id)?.name : (item as any).bank_id ? banks.find(b => b.id === (item as any).bank_id)?.name : 'Cash',
            'In (+)': is_in ? amount : 0,
            'Out (-)': !is_in ? amount : 0,
            'Balance': combBal
          };
        });
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
        
        let bBal = selectedBank?.opening_balance || 0;
        const mappedBankData = baseBankData.map(item => {
          let d = 0, c = 0;
          if (viewMode === 'app') {
            if (['Deposit', 'Payment In', 'Sale'].includes(item.type)) d = item.amount || item.total || 0;
            else if (['Withdraw', 'Payment Out', 'Purchase', 'Expense'].includes(item.type)) c = item.amount || item.total || 0;
          } else {
             // Accounting mode swap
             if (['Deposit', 'Payment In', 'Sale'].includes(item.type)) c = item.amount || item.total || 0;
             else if (['Withdraw', 'Payment Out', 'Purchase', 'Expense'].includes(item.type)) d = item.amount || item.total || 0;
          }
          bBal += (d - c);
          return {
            ...item,
            'Date': item.date,
            'Description': item.description || item.type,
            [viewMode === 'app' ? 'Withdrawal' : 'Credit']: c,
            [viewMode === 'app' ? 'Deposit' : 'Debit']: d,
            'Balance': bBal
          };
        });

        if (selectedBank) {
          result = [
            { 
              id: 'opening', 
              date: selectedBank.created_at, 
              type: 'Opening Balance', 
              'Date': selectedBank.created_at,
              'Description': 'Opening Balance',
              [viewMode === 'app' ? 'Withdrawal' : 'Credit']: selectedBank.opening_balance < 0 ? Math.abs(selectedBank.opening_balance) : 0,
              [viewMode === 'app' ? 'Deposit' : 'Debit']: selectedBank.opening_balance >= 0 ? selectedBank.opening_balance : 0,
              'Balance': selectedBank.opening_balance,
              amount: selectedBank.opening_balance, 
              isOpening: true 
            },
            ...mappedBankData
          ];
        } else {
          result = mappedBankData;
        }
        break;
      case 'Stock':
        result = companyItems.map(i => ({ 
          name: i.name, 
          sku: i.sku, 
          unit: (i as any).unit || 'Unit', 
          price: i.price, 
          stock: i.stock, 
          value: i.stock * i.price,
          'Item Name': i.name,
          'SKU': i.sku || '-',
          'Unit': (i as any).unit || 'Unit',
          'Price': i.price,
          'Stock': i.stock,
          'Value': i.stock * i.price
        })).sort((a, b) => b.Value - a.Value);
        break;
      case 'Purchase':
        const purchaseInvoices = companyInvoices.filter(i => i.type === 'Purchase').flatMap(inv => 
          inv.items.map(item => ({
            id: inv.id,
            date: inv.date,
            party_name: parties.find(p => p.id === inv.party_id)?.name || 'Walk-in',
            item_name: item.name,
            qty: item.quantity,
            shipping_mark: item.shipping_mark || '-',
            total_weight: item.total_weight || 0,
            shortage: item.shortage || 0,
            net_weight: item.net_weight || 0,
            unit: item.unit || 'Unit',
            price: item.price,
            total: item.total,
            'Date': inv.date,
            'Party': parties.find(p => p.id === inv.party_id)?.name || 'Walk-in',
            'Shipping Mark': item.shipping_mark || '-',
            'Item': item.name,
            'Qty': item.quantity,
            'Total Wt': item.total_weight || 0,
            'Shortage': item.shortage || 0,
            'Net Wt': item.net_weight || 0,
            'Price': item.price,
            'Total': item.total
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
          total: t.amount,
          'Date': t.date,
          'Party': parties.find(p => p.id === t.party_id)?.name || 'N/A',
          'Item': t.item_id ? companyItems.find(i => i.id === t.item_id)?.name : (t.description || 'General Purchase'),
          'Qty': t.quantity || 1,
          'Unit': (companyItems.find(i => i.id === t.item_id) as any)?.unit || 'Unit',
          'Price': t.quantity ? t.amount / t.quantity : t.amount,
          'Total': t.amount
        }));
        result = filterByDate([...purchaseInvoices, ...purchaseTransactions]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'Sale':
        const saleInvoices = companyInvoices.filter(i => i.type === 'Sale').flatMap(inv => 
          inv.items.map(item => ({
            id: inv.id,
            date: inv.date,
            party_name: parties.find(p => p.id === inv.party_id)?.name || 'Walk-in',
            item_name: item.name,
            qty: item.quantity,
            shipping_mark: item.shipping_mark || '-',
            total_weight: item.total_weight || 0,
            shortage: item.shortage || 0,
            net_weight: item.net_weight || 0,
            unit: item.unit || 'Unit',
            price: item.price,
            total: item.total,
            'Date': inv.date,
            'Party': parties.find(p => p.id === inv.party_id)?.name || 'Walk-in',
            'Shipping Mark': item.shipping_mark || '-',
            'Item': item.name,
            'Qty': item.quantity,
            'Total Wt': item.total_weight || 0,
            'Shortage': item.shortage || 0,
            'Net Wt': item.net_weight || 0,
            'Price': item.price,
            'Total': item.total
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
          total: t.amount,
          'Date': t.date,
          'Party': parties.find(p => p.id === t.party_id)?.name || 'N/A',
          'Item': t.item_id ? companyItems.find(i => i.id === t.item_id)?.name : (t.description || 'General Sale'),
          'Qty': t.quantity || 1,
          'Unit': (companyItems.find(i => i.id === t.item_id) as any)?.unit || 'Unit',
          'Price': t.quantity ? t.amount / t.quantity : t.amount,
          'Total': t.amount
        }));
        result = filterByDate([...saleInvoices, ...saleTransactions]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'Expense':
        result = filterByDate(companyTransactions.filter(t => t.type === 'Expense')).map(t => ({
          ...t,
          paid_from: t.bank_id ? companyBanks.find(b => b.id === t.bank_id)?.name : 'Cash',
          'Date': t.date,
          'Description': t.description || '-',
          'Category': t.category || '-',
          'Qty': (t as any).quantity || 1,
          'Price': (t as any).price || t.amount,
          'Paid From': t.bank_id ? banks.find(b => b.id === t.bank_id)?.name || 'Bank' : 
                      t.party_id ? parties.find(p => p.id === t.party_id)?.name || 'Credit Account' : 'Cash',
          'Amount': t.amount
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Invoice':
        result = filterByDate(companyInvoices).flatMap(inv => 
          inv.items.map((item: any) => ({
            ...inv,
            item_name: item.name,
            qty: item.quantity,
            shipping_mark: item.shipping_mark || '-',
            total_weight: item.total_weight || 0,
            shortage: item.shortage || 0,
            net_weight: item.net_weight || 0,
            unit: item.unit || '-',
            unit_price: item.price,
            item_total: item.total,
            'Invoice #': inv.invoice_number,
            'Date': inv.date,
            'Shipping Mark': item.shipping_mark || '-',
            'Item': item.name,
            'Qty': item.quantity,
            'Total Wt': item.total_weight || 0,
            'Shortage': item.shortage || 0,
            'Net Wt': item.net_weight || 0,
            'Price': item.price,
            'Total': item.total
          }))
        ).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
        break;
      case 'Day Book':
        const dbTxs = companyTransactions.map(t => ({
          ...t,
          isInvoice: false,
          'Time': new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          'Description': t.description || t.type,
          'Type': t.type,
          'Account/Party': t.party_id ? parties.find(p => p.id === t.party_id)?.name : (t.bank_id ? banks.find(b => b.id === t.bank_id)?.name : 'Cash'),
          'In (+)': ['Sale', 'Payment In', 'Stock In', 'Deposit', 'Income', 'Cash Adjustment In'].includes(t.type) ? t.amount : 0,
          'Out (-)': ['Purchase', 'Payment Out', 'Stock Out', 'Withdraw', 'Expense', 'Cash Adjustment Out'].includes(t.type) ? t.amount : 0
        }));
        const dbInvs = companyInvoices.map(i => ({
          ...i,
          isInvoice: true,
          'Time': new Date(i.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          'Description': `Invoice ${i.invoice_number}`,
          'Type': i.type,
          'Account/Party': parties.find(p => p.id === i.party_id)?.name || 'Direct',
          'In (+)': i.type === 'Sale' ? i.total : 0,
          'Out (-)': i.type === 'Purchase' ? i.total : 0
        }));
        result = filterByDate([...dbTxs, ...dbInvs]).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'Balance Sheet':
        const cashBalance = transactions
          .filter(t => t.company_id === currentCompany?.id)
          .reduce((sum, t) => {
            if (t.type === 'Withdraw') return sum + t.amount;
            if (t.type === 'Deposit') return sum - t.amount;
            if (!t.bank_id && !t.to_bank_id) {
              if (['Sale', 'Payment In', 'Stock In', 'Bank To Party', 'Cash Adjustment In'].includes(t.type)) return sum + t.amount;
              if (['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Party To Bank', 'Cash Adjustment Out'].includes(t.type)) return sum - t.amount;
            }
            return sum;
          }, 0);
        
        const bankBalancesTotal = companyBanks.reduce((sum, b) => sum + b.balance, 0);
        const receivables = companyParties.filter(p => p.balance > 0).reduce((sum, p) => sum + p.balance, 0);
        const payables = companyParties.filter(p => p.balance < 0).reduce((sum, p) => sum + Math.abs(p.balance), 0);
        const stockValue = companyItems.reduce((sum, i) => sum + (i.stock * i.price), 0);

        // Owner's equity calculations
        const addCash = transactions.filter(t => 
          !t.bank_id && !t.to_bank_id && 
          ['Sale', 'Payment In', 'Stock In', 'Cash Adjustment In'].includes(t.type)
        ).reduce((sum, t) => sum + t.amount, 0);

        const reduceCash = transactions.filter(t => 
          !t.bank_id && !t.to_bank_id && 
          ['Expense', 'Payment Out', 'Purchase', 'Stock Out', 'Cash Adjustment Out'].includes(t.type)
        ).reduce((sum, t) => sum + t.amount, 0);

        // This is a complex structure, we'll flatten it for the table view but keep metadata for PDF
        result = [
          // Assets Side
          { type: 'asset', label: 'Current Assets', amount: null, isHeader: true },
          { type: 'asset', label: 'Cash in hand', amount: cashBalance },
          { type: 'asset', label: 'Bank Accounts', amount: bankBalancesTotal, isSubHeader: true },
          ...companyBanks.filter(b => !hideZeroBalances || b.balance !== 0).map(b => ({ type: 'asset', label: b.name, amount: b.balance, isSubItem: true })),
          { type: 'asset', label: 'Accounts receivable / Sundry Debtors', amount: receivables },
          { type: 'asset', label: 'Inventory on hand/ Closing stock', amount: stockValue },
          { type: 'asset', label: 'Tax Receivable', amount: 0, isSubHeader: true },
          { type: 'asset', label: 'GST Receivable', amount: 0, isSubItem: true },
          { type: 'asset', label: 'TCS Receivable', amount: 0, isSubItem: true },

          // Liabilities Side
          { type: 'liability', label: 'Current Liabilities', amount: null, isHeader: true },
          { type: 'liability', label: 'Accounts Payable / Sundry Creditors', amount: payables },
          { type: 'liability', label: 'Loan Accounts', amount: 0, isHeader: true },
          { type: 'liability', label: 'Tax payable', amount: 0, isHeader: true },
          { type: 'liability', label: 'GST payable', amount: 0, isSubItem: true },
          { type: 'liability', label: 'TCS payable', amount: 0, isSubItem: true },
          
          // Equity Side
          { type: 'liability', label: 'Equity/Capital', amount: null, isHeader: true },
          { type: 'liability', label: 'Opening balance equity', amount: (currentCompany?.opening_balance || 0), isSubHeader: true },
          { type: 'liability', label: 'Opening bank balance', amount: 0, isSubItem: true },
          { type: 'liability', label: 'Opening party balance', amount: 0, isSubItem: true },
          { type: 'liability', label: 'Owner\'s equity', amount: addCash - reduceCash, isSubHeader: true },
          { type: 'liability', label: 'Add cash', amount: addCash, isSubItem: true },
          { type: 'liability', label: 'Reduce cash', amount: -reduceCash, isSubItem: true },
          { type: 'liability', label: 'Retained Earnings', amount: 0 },
          { type: 'liability', label: 'Net Income (profit)', amount: 0 }
        ].map((item, idx) => ({
          '#': idx + 1,
          'Account Name': item.label,
          'Amount': item.amount,
          ...item
        }));
        break;
      case 'Cash Flow':
        const cfTxs = companyTransactions.filter(t => !t.bank_id && !t.to_bank_id || t.type === 'Withdraw' || t.type === 'Deposit');
        result = filterByDate(cfTxs).map(t => {
          const is_in = ['Sale', 'Payment In', 'Withdraw', 'Income', 'Cash Adjustment In'].includes(t.type);
          return {
            ...t,
            'Date': t.date,
            'Category': t.category || t.type,
            'Description': t.description || '-',
            'Cash In': is_in ? t.amount : 0,
            'Cash Out': !is_in ? t.amount : 0,
            'Net Flow': is_in ? t.amount : -t.amount
          };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
    }

    if (['All Parties', 'Single Party', 'All Banks', 'Single Bank'].includes(activeReport)) {
      result = applyAmountFilter(result);
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

  const activeColumns = useMemo(() => {
    return allColumns[activeReport].filter(col => selectedColumns.includes(col));
  }, [activeReport, selectedColumns, allColumns]);

  const tableTotals = useMemo(() => {
    if (!filteredData.length) return null;
    
    if (activeReport === 'Single Bank') {
      const dep = filteredData.reduce((s, d) => s + (d[viewMode === 'app' ? 'Deposit' : 'Debit'] || 0), 0);
      const wit = filteredData.reduce((s, d) => s + (d[viewMode === 'app' ? 'Withdrawal' : 'Credit'] || 0), 0);
      const last = filteredData[filteredData.length - 1];
      return { 
        [viewMode === 'app' ? 'Deposit' : 'Debit']: dep, 
        [viewMode === 'app' ? 'Withdrawal' : 'Credit']: wit,
        'Balance': (last as any).Balance || (last as any).balance || 0 
      };
    }

    if (activeReport === 'Cash in Hand') {
      const inVal = filteredData.reduce((s, d) => s + (d['In (+)'] || 0), 0);
      const outVal = filteredData.reduce((s, d) => s + (d['Out (-)'] || 0), 0);
      const last = filteredData[filteredData.length - 1];
      return { 'In (+)': inVal, 'Out (-)': outVal, 'Balance': (last as any).Balance || (last as any).balance || 0 };
    }

    if (activeReport === 'Single Party') {
      const debVal = filteredData.reduce((s, d) => s + (d['Debit'] || 0), 0);
      const creVal = filteredData.reduce((s, d) => s + (d['Credit'] || 0), 0);
      const last = filteredData[filteredData.length - 1];
      return { 'Debit': debVal, 'Credit': creVal, 'Balance': (last as any).Balance || (last as any).balance || 0 };
    }

    if (activeReport === 'All Parties') {
      const recLimit = filteredData.reduce((s, d) => s + (d['Receivable Balance'] || d['Debit'] || 0), 0);
      const payLimit = filteredData.reduce((s, d) => s + (d['Payable Balance'] || d['Credit'] || 0), 0);
      const netLimit = filteredData.reduce((s, d) => s + (d['Net Balance'] || d['Balance'] || 0), 0);
      return { 
        [viewMode === 'app' ? 'Receivable Balance' : 'Debit']: recLimit, 
        [viewMode === 'app' ? 'Payable Balance' : 'Credit']: payLimit,
        [viewMode === 'app' ? 'Net Balance' : 'Balance']: netLimit
      };
    }
    
    if (activeReport === 'All Banks') {
      const dr = filteredData.filter(d => d.balance >= 0).reduce((s, d) => s + d.balance, 0);
      const cr = filteredData.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
      return { 'Debit (DR)': dr, 'Credit (CR)': cr, 'Balance': dr - cr };
    }
    
    if (activeReport === 'Single Party' || activeReport === 'Single Bank' || activeReport === 'Cash in Hand') {
      const last = filteredData[filteredData.length - 1];
      return { 'Balance': (last as any).Balance || (last as any).balance || 0 };
    }

    if (activeReport === 'Stock') return { 'Value': filteredData.reduce((s, d) => s + d.value, 0) };
    if (activeReport === 'Expense') return { 'Amount': filteredData.reduce((s, d) => s + d.amount, 0) };
    if (activeReport === 'Purchase' || activeReport === 'Sale' || activeReport === 'Invoice') {
      return { 
        'Qty': filteredData.reduce((s, d) => s + (d.qty || 0), 0),
        'Total Wt': filteredData.reduce((s, d) => s + (d.total_weight || 0), 0),
        'Shortage': filteredData.reduce((s, d) => s + (d.shortage || 0), 0),
        'Net Wt': filteredData.reduce((s, d) => s + (d.net_weight || 0), 0),
        'Total': filteredData.reduce((s, d) => s + (d.total || d.amount || d.item_total || 0), 0)
      };
    }

    if (activeReport === 'Day Book') {
      return {
        'In (+)': filteredData.reduce((s, d) => s + (d['In (+)'] || 0), 0),
        'Out (-)': filteredData.reduce((s, d) => s + (d['Out (-)'] || 0), 0)
      };
    }

    if (activeReport === 'Cash Flow') {
      return {
        'Cash In': filteredData.reduce((s, d) => s + (d['Cash In'] || 0), 0),
        'Cash Out': filteredData.reduce((s, d) => s + (d['Cash Out'] || 0), 0),
        'Net Flow': filteredData.reduce((s, d) => s + (d['Net Flow'] || 0), 0)
      };
    }
    
    return null;
  }, [filteredData, activeReport]);

  const formatValue = (col: string, val: any, isTotal: boolean = false) => {
    if (val === undefined || val === null) return isTotal ? '' : '-';
    if (col === 'Date') return formatDate(val);
    if (col === 'Qty' || col === 'Total Wt' || col === 'Shortage' || col === 'Net Wt') {
      return val.toLocaleString(undefined, { minimumFractionDigits: col === 'Qty' ? 0 : 2 });
    }
    if (col.includes('Balance') || col === 'Amount' || col === 'Total') {
      // Force DR/CR if it's a total row balance, otherwise follow setting
      const showDrCr = (col.includes('Balance') && isTotal) ? true : settings.show_dr_cr;
      return formatBalance(val, settings.currency, showDrCr);
    }
    if (col === 'Receivable Balance' || col === 'Payable Balance' || col.includes('Debit') || col.includes('Credit') || col.includes('Price') || col.includes('Value') || col === 'Qty' || col.includes('In (+)') || col.includes('Out (-)') || col === 'Cash In' || col === 'Cash Out' || col === 'Net Flow' || col === 'Deposit' || col === 'Withdrawal') {
      return formatCurrency(val, settings.currency);
    }
    return String(val);
  };

  const exportPDF = () => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const companyName = currentCompany?.name || settings.companyName || 'My Business';
    const pdfSettings = (settings as any).pdf_settings || {};
    
    if (activeReport === 'All Parties') {
      // Professional 2-Column Header for All Parties
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 10, pageWidth - 28, 30, 'F');

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 20, 25);
      
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      const title = 'All Parties Balance';
      doc.text(title, pageWidth - doc.getTextWidth(title) - 20, 25);
      
      const genText = `Generated: ${format(new Date(), 'dd MMM yyyy')}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(genText, pageWidth - doc.getTextWidth(genText) - 20, 33);

      const col1 = viewMode === 'app' ? 'Receivable Balance' : 'Debit';
      const col2 = viewMode === 'app' ? 'Payable Balance' : 'Credit';
      const col3 = viewMode === 'app' ? 'Net Balance' : 'Balance';

      const body = filteredData.map((d, index) => [
        index + 1,
        d.Name,
        formatCurrency(d[col1], settings.currency).replace('Rs. ', '').replace('Rs.', ''),
        formatCurrency(d[col2], settings.currency).replace('Rs. ', '').replace('Rs.', ''),
        formatCurrency(d[col3], settings.currency).replace('Rs. ', '').replace('Rs.', '')
      ]);

      const totals = tableTotals as any;

      autoTable(doc, {
        head: [['#', 'Name', col1, col2, col3]],
        body,
        startY: 45,
        theme: 'grid',
        headStyles: { 
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: pdfSettings.smallFont ? 8 : 9,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 12 },
          1: { halign: 'left' },
          2: { halign: 'right', cellWidth: 35 },
          3: { halign: 'right', cellWidth: 35 },
          4: { halign: 'right', cellWidth: 35 }
        },
        styles: {
          fontSize: pdfSettings.smallFont ? 7 : 8,
          cellPadding: 3,
          valign: 'middle',
          textColor: [0, 0, 0],
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
          overflow: 'linebreak'
        },
        foot: [[
          '',
          'Total Balance Summary',
          formatCurrency(totals[col1], settings.currency).replace('Rs. ', '').replace('Rs.', ''),
          formatCurrency(totals[col2], settings.currency).replace('Rs. ', '').replace('Rs.', ''),
          formatCurrency(totals[col3], settings.currency).replace('Rs. ', '').replace('Rs.', '')
        ]],
        footStyles: {
          fillColor: [248, 250, 252],
          textColor: [79, 70, 229],
          fontStyle: 'bold',
          fontSize: pdfSettings.smallFont ? 8 : 9,
          halign: 'right',
          lineColor: [79, 70, 229],
          lineWidth: 0.2
        }
      });
    } else if (activeReport === 'Balance Sheet') {
      // Professional 2-Column Header for Balance Sheet
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 10, pageWidth - 28, 30, 'F');

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 20, 25);
      
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      const titleLabel = `Balance Sheet`;
      doc.text(titleLabel, pageWidth - doc.getTextWidth(titleLabel) - 20, 25);
      
      const dateStr = pdfSettings.hideDate ? '' : `As on ${formatDate(new Date().toISOString())}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(dateStr, pageWidth - doc.getTextWidth(dateStr) - 20, 33);

      const assetRows = filteredData.filter(d => d.type === 'asset');
      const liabilityRows = filteredData.filter(d => d.type === 'liability');

      const maxRows = Math.max(assetRows.length, liabilityRows.length);
      const tableBody = [];

      for (let i = 0; i < maxRows; i++) {
        const a = assetRows[i];
        const l = liabilityRows[i];
        
        const formatAmt = (row: any) => {
          if (!row || row.amount === null) return '';
          return Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        };

        tableBody.push([
          a ? a.label : '',
          a ? formatAmt(a) : '',
          l ? l.label : '',
          l ? formatAmt(l) : ''
        ]);
      }

      // Calculate totals
      const totalAssets = assetRows.reduce((s, r) => s + (r.amount || 0), 0);
      const totalLiabilitiesEquity = liabilityRows.reduce((s, r) => s + (r.amount || 0), 0);

      autoTable(doc, {
        head: [['Assets', 'Amount', 'Liabilities', 'Amount']],
        body: tableBody,
        startY: 30,
        theme: 'grid',
        headStyles: { 
          fillColor: [220, 235, 245], 
          textColor: [0, 0, 0], 
          fontSize: pdfSettings.smallFont ? 7 : 8, 
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          1: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
          2: { halign: 'left', fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
        },
        styles: {
          fontSize: pdfSettings.smallFont ? 6 : 7,
          cellPadding: 1,
          valign: 'middle',
          textColor: [0, 0, 0],
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        didParseCell: (data) => {
          const rowIndex = data.row.index;
          const a = assetRows[rowIndex];
          const l = liabilityRows[rowIndex];

          // Assets column handling
          if (data.column.index < 2 && a) {
            if (a.isHeader) {
               data.cell.styles.fillColor = [240, 245, 250];
               data.cell.styles.fontStyle = 'bold';
            } else if (a.isSubHeader) {
               data.cell.styles.fontStyle = 'bold';
            } else if (a.isSubItem) {
               data.cell.styles.fontStyle = 'normal';
               if (data.column.index === 0) data.cell.text = [`    ${a.label}`];
            } else {
               data.cell.styles.fontStyle = 'bold';
            }
          }
          // Liabilities column handling
          if (data.column.index >= 2 && l) {
            if (l.isHeader) {
               data.cell.styles.fillColor = [240, 245, 250];
               data.cell.styles.fontStyle = 'bold';
            } else if (l.isSubHeader) {
               data.cell.styles.fontStyle = 'bold';
            } else if (l.isSubItem) {
               data.cell.styles.fontStyle = 'normal';
               if (data.column.index === 2) data.cell.text = [`    ${l.label}`];
            } else {
               data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      // Grand total footer row
      const finalY = (doc as any).lastAutoTable.finalY;
      autoTable(doc, {
        body: [[
          '', 
          totalAssets.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
          '', 
          totalLiabilitiesEquity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        ]],
        startY: finalY,
        theme: 'grid',
        styles: { fontSize: pdfSettings.smallFont ? 7 : 8, fontStyle: 'bold', cellPadding: 1, textColor: [0, 0, 0] },
        columnStyles: {
          1: { halign: 'right', cellWidth: 30, fillColor: [230, 240, 255] },
          3: { halign: 'right', cellWidth: 30, fillColor: [230, 240, 255] }
        }
      });
    } else {
      // Professional 2-Column Header for General Reports
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Top Rectangle for Header
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 10, pageWidth - 28, 30, 'F');

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, 20, 25);
      
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      const title = `${activeReport} Report`;
      doc.text(title, pageWidth - doc.getTextWidth(title) - 20, 25);
      
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      if (!pdfSettings.hideDate) {
        doc.text(`Period: ${dateRange}`, 20, 33);
      }
      
      const genText = `Generated: ${format(new Date(), 'dd MMM yyyy')}`;
      doc.text(genText, pageWidth - doc.getTextWidth(genText) - 20, 33);

      if (selectedEntity && !pdfSettings.hideContact) {
        const entityName = (activeReport === 'Single Party' ? parties : banks).find(e => e.id === selectedEntity)?.name;
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.text(`For: ${entityName}`, 20, 48);
      }

      let head = [selectedColumns];
      const body = filteredData.map((d, index) => 
        selectedColumns.map(col => {
          if (col === '#') return index + 1;
          const val = d[col];
          return formatValue(col, val, false);
        })
      );

      autoTable(doc, {
        head,
        body,
        startY: selectedEntity ? 55 : 45,
        theme: 'grid',
        headStyles: { 
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontSize: pdfSettings.smallFont ? 8 : 9,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: pdfSettings.smallFont ? 7 : 8,
          cellPadding: 2,
          valign: 'middle',
          textColor: [0, 0, 0]
        },
        columnStyles: selectedColumns.reduce((acc: any, col, idx) => {
          if (col === 'Debit' || col === 'Credit' || col === 'Balance' || col === 'Amount' || col === 'Total' || col === 'Value' || col === 'In (+)' || col === 'Out (-)' || col === 'Deposit' || col === 'Withdrawal') {
            acc[idx] = { halign: 'right' };
          }
          return acc;
        }, {}),
        foot: tableTotals ? [
          selectedColumns.map(col => {
            const val = (tableTotals as any)[col];
            if (val !== undefined) return formatValue(col, val, true);
            if (col === selectedColumns[0]) return 'TOTAL';
            return '';
          })
        ] : undefined,
        footStyles: {
          fillColor: [248, 250, 252],
          textColor: [79, 70, 229],
          fontStyle: 'bold',
          fontSize: pdfSettings.smallFont ? 8 : 9,
          halign: 'right'
        },
        didDrawPage: (data) => {
          const str = "Page " + (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
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

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    setPdfPreview({
      isOpen: true,
      url: url,
      title: `${activeReport} Report`,
      fileName: `${activeReport.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`
    });
    console.log(`PDF Generated: ${activeReport}`);
  };

  return (
    <div className="w-full max-w-full overflow-hidden p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-8">
        {/* Sidebar Navigation - Fixed Wrap Grid for Mobile */}
        <aside className="w-full lg:w-72 shrink-0">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Report Types</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
          {reportOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setActiveReport(opt.id as ReportType);
                setSelectedEntity('');
              }}
              className={cn(
                "flex items-center gap-2 lg:gap-3 p-3 lg:p-4 rounded-xl lg:rounded-2xl transition-all group border",
                activeReport === opt.id 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20" 
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800"
              )}
            >
              <opt.icon size={16} className="shrink-0" />
              <span className="font-bold text-[10px] sm:text-xs lg:text-sm truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Content Area */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Responsive Header */}
          <div className="p-4 sm:p-6 border-b border-slate-50 dark:border-slate-800">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{activeReport}</h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">Export professional business statements</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'customization' }))}
                    className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 hover:text-indigo-600 transition-all shadow-sm"
                    title="Customize Report Columns"
                  >
                    <SettingsIcon size={18} />
                  </button>
                  {(activeReport === 'Single Bank' || activeReport === 'Single Party' || activeReport === 'All Parties') && (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-auto shrink-0 mr-2">
                      <button 
                        onClick={() => setViewMode('app')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                          viewMode === 'app' ? "bg-white dark:bg-slate-600 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        App
                      </button>
                      <button 
                        onClick={() => setViewMode('accounting')}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                          viewMode === 'accounting' ? "bg-white dark:bg-slate-600 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        Acc
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={cn(
                      "p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 transition-all",
                      isSyncing && "animate-spin"
                    )}
                    title="Sync Data"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <DrCrToggle 
                    enabled={settings.show_dr_cr || false} 
                    onToggle={(val) => updateSettings({ show_dr_cr: val })} 
                  />
                  {(activeReport === 'All Parties' || activeReport === 'All Banks' || activeReport === 'Balance Sheet') && (
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 pointer-events-auto shrink-0 transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                      <span className="text-[9px] font-black uppercase text-slate-500 ml-1">Hide 0</span>
                      <button 
                        onClick={() => setHideZeroBalances(!hideZeroBalances)}
                        className={cn(
                          "relative w-8 h-4 rounded-full transition-all duration-300",
                          hideZeroBalances ? "bg-red-500" : "bg-slate-300 dark:bg-slate-600"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm",
                          hideZeroBalances ? "left-4.5" : "left-0.5"
                        )} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* Primary Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(activeReport === 'Single Party' || activeReport === 'Single Bank') && (
                    <div className="relative group w-full">
                      <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select 
                        value={selectedEntity}
                        onChange={(e) => setSelectedEntity(e.target.value)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                      >
                        <option value="">Select {activeReport === 'Single Party' ? 'Party' : 'Bank'}</option>
                        {(activeReport === 'Single Party' ? parties : banks).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeReport === 'All Parties' && (
                    <div className="relative group w-full">
                      <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat} {cat === 'All' ? 'Categories' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="relative group w-full">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select 
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                    >
                      <option>This Month</option>
                      <option>All Time</option>
                      <option>Custom</option>
                    </select>
                  </div>
                </div>

                {/* Custom Date Row */}
                {dateRange === 'Custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="date" 
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    <input 
                      type="date" 
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                )}

                {/* Secondary Filters Row */}
                <div className="flex flex-col sm:flex-row gap-2 relative">
                  <div className="relative group flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    <input 
                      type="text"
                      placeholder="Search reports..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-[11px] font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <div className="relative">
                      <button 
                        onClick={() => setShowFilterMenu(!showFilterMenu)}
                        className={cn(
                          "flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-bold border text-[10px] uppercase tracking-wider transition-all",
                          amountFilter !== 'all' ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800"
                        )}
                      >
                        <Filter size={14} />
                        <span>Filter</span>
                      </button>
                      
                      <AnimatePresence>
                        {showFilterMenu && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
                          >
                            <div className="p-2 space-y-1">
                              {[
                                { id: 'all', label: 'All Balances', icon: BarChart3 },
                                { id: 'positive', label: 'Positive (> 0)', icon: ArrowUpRight, color: 'text-emerald-600' },
                                { id: 'negative', label: 'Negative (< 0)', icon: ArrowDownLeft, color: 'text-rose-600' },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => {
                                    setAmountFilter(opt.id as any);
                                    setShowFilterMenu(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                                    amountFilter === opt.id ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                  )}
                                >
                                  <opt.icon size={16} className={opt.color} />
                                  <span className="text-xs font-bold">{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button 
                      onClick={() => setIsColumnModalOpen(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl font-bold border border-slate-100 dark:border-slate-800 text-[10px] uppercase tracking-wider"
                    >
                      <SettingsIcon size={14} />
                      <span className="hidden sm:inline">Columns</span>
                    </button>
                    
                    <button 
                      onClick={exportPDF}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 text-[10px] uppercase tracking-wider"
                    >
                      <Download size={14} />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card View - Optimized for anything smaller than large desktops */}
          <div className="lg:hidden divide-y divide-slate-50 dark:divide-slate-800">
            {filteredData.map((row, idx) => (
              <div key={idx} className="p-4 space-y-3 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {activeColumns.map(colId => (
                    <div key={colId} className={cn(
                      "flex flex-col gap-1 w-full",
                      (colId === 'Party Name' || colId === 'Description' || colId === 'Bank Name') ? "sm:col-span-2" : "col-span-1"
                    )}>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{colId.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 break-words leading-tight">
                        {formatValue(colId, row[colId])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <div className="px-6 py-16 text-center">
                <Search size={40} className="mx-auto mb-4 text-slate-200 opacity-40 shrink-0" />
                <p className="text-sm font-bold text-slate-400 italic">No records found.</p>
              </div>
            )}
            
            {/* Total Summary Card for Mobile */}
            {tableTotals && filteredData.length > 0 && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t-4 border-indigo-500/20 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Report Totals</span>
                  <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold uppercase rounded">Final Summary</div>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  {Object.entries(tableTotals).map(([key, val]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{key}</span>
                      <span className={cn(
                        "text-sm font-black",
                        key.includes('Debit') || key.includes('In (+)') || key.includes('Receivable') ? "text-emerald-600 dark:text-emerald-400" : (key.includes('Credit') || key.includes('Out (-)') || key.includes('Payable') ? "text-rose-600 dark:text-rose-400" : "text-indigo-600 dark:text-indigo-400")
                      )}>
                        {formatValue(key, val, true)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Table View - Desktop and Tablet */}
          <div className="hidden lg:block overflow-x-auto no-scrollbar">
            <div className="inline-block min-w-full align-middle">
              <div className="p-0">
                <table className="min-w-full divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  <thead className={cn(
                    "text-left",
                    activeReport === 'All Parties' ? "bg-indigo-50/50 dark:bg-indigo-900/20" : "bg-slate-50/50 dark:bg-slate-800/50"
                  )}>
                    <tr>
                      {activeColumns.map(colId => (
                        <th key={colId} className="px-6 py-4 text-[10px] uppercase tracking-wider font-black text-slate-400 whitespace-nowrap">
                          {colId.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                        {activeColumns.map(colId => (
                          <td key={colId} className={cn(
                            "px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap",
                            (colId === 'Party Name' || colId === 'Description' || colId === 'Item Name') && "truncate max-w-[200px]"
                          )}>
                            {formatValue(colId, row[colId])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={activeColumns.length} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center justify-center opacity-40">
                             <Search size={48} className="mb-4 text-slate-200 shrink-0" />
                             <p className="text-sm font-bold text-slate-400 italic">No records matching filters.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {tableTotals && filteredData.length > 0 && (
                    <tfoot className="bg-slate-100/80 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700 backdrop-blur-sm sticky bottom-0">
                      <tr>
                        {activeColumns.map(colId => {
                          const totalVal = (tableTotals as any)[colId];
                          return (
                            <td key={colId} className="px-6 py-5">
                              {totalVal !== undefined ? (
                                <div className="flex flex-col">
                                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{colId}</span>
                                  <span className={cn(
                                    "text-[13px] font-black",
                                    colId.includes('Debit') || colId.includes('In (+)') || colId.includes('Receivable') ? "text-emerald-700 dark:text-emerald-400" : (colId.includes('Credit') || colId.includes('Out (-)') || colId.includes('Payable') ? "text-rose-700 dark:text-rose-400" : "text-indigo-700 dark:text-indigo-400")
                                  )}>
                                    {formatValue(colId, totalVal, true)}
                                  </span>
                                </div>
                              ) : colId === activeColumns[0] ? (
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Totals</span>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
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

      <PDFPreviewModal 
        isOpen={pdfPreview.isOpen}
        onClose={() => setPdfPreview({ ...pdfPreview, isOpen: false })}
        pdfUrl={pdfPreview.url}
        title={pdfPreview.title}
        fileName={pdfPreview.fileName}
      />
    </div>
    </div>
  );
}
