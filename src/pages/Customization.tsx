import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Settings as SettingsIcon,
  Check,
  RotateCcw,
  Save,
  Layout
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

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

export default function Customization() {
  const { settings, updateSettings } = useApp();
  const [localCustomization, setLocalCustomization] = useState<Record<string, string[]>>(
    settings.report_customization || {}
  );
  const [pdfSettings, setPdfSettings] = useState({
    hideContact: false,
    hideDate: false,
    smallFont: false,
    ...((settings as any).pdf_settings || {})
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const allColumns: Record<ReportType, string[]> = {
    'Cash in Hand': ['Date', 'Description', 'In (+)', 'Out (-)', 'Balance'],
    'Single Party': ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
    'All Parties': ['#', 'Name', 'Receivable Balance', 'Payable Balance'],
    'Single Bank': ['Date', 'Description', 'Deposit', 'Withdrawal', 'Balance'],
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
  };

  const handleToggleColumn = (report: string, col: string) => {
    const currentCols = localCustomization[report] || allColumns[report as ReportType];
    let newCols;
    if (currentCols.includes(col)) {
      newCols = currentCols.filter(c => c !== col);
    } else {
      // Keep order from allColumns
      newCols = allColumns[report as ReportType].filter(c => currentCols.includes(c) || c === col);
    }
    setLocalCustomization({
      ...localCustomization,
      [report]: newCols
    });
    setSaveStatus('idle');
  };

  const handleSave = () => {
    setSaveStatus('saving');
    updateSettings({ 
      report_customization: localCustomization,
      pdf_settings: pdfSettings 
    } as any);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all report settings to default?')) {
      setLocalCustomization({});
      setPdfSettings({ hideContact: false, hideDate: false, smallFont: false });
      updateSettings({ 
        report_customization: undefined,
        pdf_settings: undefined
      } as any);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'reports' }))}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-4 transition-all group"
          >
            <div className="p-1.5 rounded-lg group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-all">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm font-bold tracking-tight">Back to Reports</span>
          </button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Layout className="text-indigo-600" size={32} />
            Report Customization
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Customize your PDFs and reports</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold bg-white dark:bg-slate-900 text-rose-600 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all shadow-sm"
          >
            <RotateCcw size={18} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus !== 'idle'}
            className={cn(
              "flex items-center gap-2 px-7 py-3 rounded-2xl font-black transition-all shadow-lg",
              saveStatus === 'saved' 
                ? "bg-emerald-600 text-white shadow-emerald-500/20"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20 active:scale-95 disabled:opacity-70"
            )}
          >
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-2">
                <SettingsIcon size={18} className="animate-spin" />
                Saving...
              </span>
            ) : saveStatus === 'saved' ? (
              <span className="flex items-center gap-2">
                <Check size={18} />
                Saved!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={18} />
                Save Changes
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl p-6 space-y-6">
        <h3 className="font-black text-slate-900 dark:text-white tracking-tight text-lg">General PDF Preferences</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button 
            onClick={() => { setPdfSettings({...pdfSettings, hideContact: !pdfSettings.hideContact}); setSaveStatus('idle'); }}
            className={cn(
              "p-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-between",
              pdfSettings.hideContact ? "bg-slate-900 border-slate-900 text-white" : "border-slate-100 dark:border-slate-800 text-slate-600"
            )}
          >
            Hide Phone Number
            {pdfSettings.hideContact ? <Check size={16} /> : <div className="w-4 h-4 rounded border border-slate-300" />}
          </button>
          <button 
            onClick={() => { setPdfSettings({...pdfSettings, hideDate: !pdfSettings.hideDate}); setSaveStatus('idle'); }}
            className={cn(
              "p-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-between",
              pdfSettings.hideDate ? "bg-slate-900 border-slate-900 text-white" : "border-slate-100 dark:border-slate-800 text-slate-600"
            )}
          >
            Hide Header Date
            {pdfSettings.hideDate ? <Check size={16} /> : <div className="w-4 h-4 rounded border border-slate-300" />}
          </button>
          <button 
            onClick={() => { setPdfSettings({...pdfSettings, smallFont: !pdfSettings.smallFont}); setSaveStatus('idle'); }}
            className={cn(
              "p-4 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-between",
              pdfSettings.smallFont ? "bg-slate-900 border-slate-900 text-white" : "border-slate-100 dark:border-slate-800 text-slate-600"
            )}
          >
            Use Smaller Font
            {pdfSettings.smallFont ? <Check size={16} /> : <div className="w-4 h-4 rounded border border-slate-300" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {(Object.keys(allColumns) as ReportType[]).map((report) => {
          const enabledCols = localCustomization[report] || allColumns[report];
          return (
            <motion.div
              layout
              key={report}
              className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none p-6 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-50 dark:border-slate-800/50">
                <h3 className="font-black text-slate-900 dark:text-white tracking-tight">{report}</h3>
                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  {enabledCols.length} Columns
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {allColumns[report].map((col) => {
                  const isEnabled = enabledCols.includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => handleToggleColumn(report, col)}
                      className={cn(
                        "px-4 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 text-xs font-bold",
                        isEnabled 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10" 
                          : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      {isEnabled && <Check size={14} className="animate-in fade-in zoom-in" />}
                      {col}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
