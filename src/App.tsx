import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Package, 
  Receipt, 
  History, 
  Settings as SettingsIcon,
  Menu,
  X,
  Plus,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  FileText,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './contexts/AppContext';
import { useTheme } from './contexts/ThemeContext';
import { cn } from './lib/utils';
import { differenceInDays, addDays, isAfter } from 'date-fns';

// Pages
import Dashboard from './pages/Dashboard';
import Parties from './pages/Parties';
import Banks from './pages/Banks';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

import GlobalTransactionModal from './components/GlobalTransactionModal';

function SplashScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20 mb-8"
      >
        <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 25 L50 75 M35 45 L35 75 M65 45 L65 75" stroke="white" strokeWidth="8" strokeLinecap="round"/>
          <path d="M30 75 L70 75" stroke="white" strokeWidth="4"/>
          <path d="M40 45 L50 35 L60 45" fill="#fbbf24"/>
        </svg>
      </motion.div>
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-black text-white tracking-tighter"
      >
        Bugzy Business Pro
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-slate-500 mt-4 font-medium uppercase tracking-[0.3em] text-[10px]"
      >
        Offline First Accounting
      </motion.p>
    </div>
  );
}

function PaymentScreen({ company, onPaid }: { company: any, onPaid: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 text-center">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Wallet size={40} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 mb-4 tracking-tight">Trial Expired</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
          Your 20-day free trial for <span className="font-bold text-slate-900 dark:text-slate-50">{company.name}</span> has ended. Please pay to continue using full features.
        </p>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 mb-10 border border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Payment Details</p>
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">EasyPaisa / JazzCash</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">0300-1234567</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Account Name</span>
              <span className="font-bold text-slate-900 dark:text-slate-50">Bugzy Business</span>
            </div>
          </div>
        </div>

        <button 
          onClick={onPaid}
          className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
        >
          I Have Paid
        </button>
        <p className="mt-6 text-xs text-slate-400">After payment, click the button to unlock instantly.</p>
      </div>
    </div>
  );
}

function ShortcutHelper({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none"
    >
      <div className="bg-slate-900/90 backdrop-blur-md text-white p-8 rounded-[2.5rem] shadow-2xl border border-white/10 max-w-lg w-full">
        <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
          <Plus size={24} className="text-indigo-400" />
          Global Shortcuts
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          {[
            { key: 'ALT + I', label: 'Pay In' },
            { key: 'ALT + O', label: 'Pay Out' },
            { key: 'ALT + J', label: 'Party to Party' },
            { key: 'ALT + Y', label: 'Party to Bank' },
            { key: 'ALT + B', label: 'Bank to Party' },
            { key: 'ALT + U', label: 'Bank to Bank' },
            { key: 'ALT + D', label: 'Dashboard' },
            { key: 'ALT + P', label: 'Parties' },
          ].map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">{s.label}</span>
              <kbd className="px-2 py-1 bg-white/10 rounded-lg border border-white/20 text-[10px] font-black text-indigo-300">{s.key}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-10 text-[10px] text-slate-500 text-center uppercase tracking-[0.2em] font-bold">Hold CTRL to show this panel</p>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentCompany, companies, setCurrentCompany, addCompany, updateCompany } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      setActiveTab(e.detail);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'banks', label: 'Banks', icon: Building2 },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'more', label: 'More', icon: Menu },
  ];

  const moreItems = [
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: History },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const renderPage = () => {
    const tab = activeTab === 'more' ? 'settings' : activeTab;
    switch (tab) {
      case 'dashboard': return <Dashboard />;
      case 'parties': return <Parties />;
      case 'banks': return <Banks />;
      case 'inventory': return <Inventory />;
      case 'expenses': return <Expenses />;
      case 'invoices': return <Invoices />;
      case 'reports': return <Reports />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  const [isShortcutPopupOpen, setIsShortcutPopupOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsShortcutPopupOpen(true);
      }
      if (e.altKey) {
        e.preventDefault();
        switch (e.key.toLowerCase()) {
          case 'i': window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Payment In' })); break;
          case 'o': window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Payment Out' })); break;
          case 'j': window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Party To Party' })); break;
          case 'y': window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Party To Bank' })); break;
          case 'b': window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Bank To Party' })); break;
          case 'u': window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Bank To Bank' })); break;
          case 'd': setActiveTab('dashboard'); break;
          case 'p': setActiveTab('parties'); break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsShortcutPopupOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  if (!currentCompany && companies.length === 0) {
    return <SetupCompany />;
  }

  // Trial Check
  if (currentCompany && !currentCompany.is_paid) {
    const trialStart = new Date(currentCompany.trial_start || currentCompany.created_at);
    const trialEnd = addDays(trialStart, 20);
    const isExpired = isAfter(new Date(), trialEnd);

    if (isExpired) {
      return <PaymentScreen company={currentCompany} onPaid={() => updateCompany(currentCompany.id, { is_paid: true })} />;
    }
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      theme === 'dark' ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
    )}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full z-40 transition-all duration-300 border-r hidden md:block",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        isSidebarOpen ? "w-64 translate-x-0" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          {currentCompany?.logo_url ? (
            <img src={currentCompany.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-xl" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-800 opacity-90" />
              <svg className="relative z-10 w-6 h-6" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 25 L50 75 M35 45 L35 75 M65 45 L65 75" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                <path d="M30 75 L70 75" stroke="white" strokeWidth="4"/>
                <path d="M40 45 L50 35 L60 45" fill="#fbbf24"/>
              </svg>
            </div>
          )}
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-50 truncate max-w-[150px]"
            >
              {currentCompany?.name || 'Bugzy Pro'}
            </motion.span>
          )}
        </div>

        <nav className="mt-6 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
          {[...menuItems.slice(0, 4), ...moreItems].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : theme === 'dark' ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <item.icon size={22} />
              {isSidebarOpen && <span>{item.label}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen pb-20 md:pb-0",
        isSidebarOpen ? "md:pl-64" : "md:pl-20"
      )}>
        {/* Topbar */}
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 backdrop-blur-md",
          theme === 'dark' ? "bg-slate-900/80 border-slate-800" : "bg-white/80 border-slate-200"
        )}>
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3">
              {currentCompany?.logo_url ? (
                <img src={currentCompany.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded-lg md:hidden" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-sm md:hidden relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-800 opacity-90" />
                  <svg className="relative z-10 w-5 h-5" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 25 L50 75 M35 45 L35 75 M65 45 L65 75" stroke="white" strokeWidth="8" strokeLinecap="round"/>
                    <path d="M30 75 L70 75" stroke="white" strokeWidth="4"/>
                    <path d="M40 45 L50 35 L60 45" fill="#fbbf24"/>
                  </svg>
                </div>
              )}
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 capitalize truncate max-w-[120px] md:max-w-none hidden lg:block">
                {activeTab === 'more' ? 'Menu' : activeTab}
              </h2>
            </div>

            {/* Top Search Bar */}
            <div className="relative flex-1 max-w-md ml-4 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search transactions, parties..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 max-w-[150px] md:max-w-none">
              {currentCompany?.logo_url ? (
                <img src={currentCompany.logo_url} alt="Logo" className="w-5 h-5 object-contain rounded-sm" referrerPolicy="no-referrer" />
              ) : (
                <Building2 size={16} className="shrink-0" />
              )}
              <span className="text-sm font-medium truncate">{currentCompany?.name}</span>
            </div>
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'more' ? (
                <div className="grid grid-cols-2 gap-4">
                  {moreItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "flex flex-col items-center justify-center p-6 rounded-2xl border transition-all gap-3",
                        theme === 'dark' ? "bg-white border-slate-200 hover:bg-slate-50" : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="p-3 bg-indigo-100 dark:bg-indigo-100 text-indigo-600 dark:text-indigo-600 rounded-xl">
                        <item.icon size={24} />
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-center justify-around p-2 border-t backdrop-blur-md",
        theme === 'dark' ? "bg-slate-900/90 border-slate-800" : "bg-white/90 border-slate-200"
      )}>
        {menuItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
              activeTab === item.id 
                ? "text-indigo-600" 
                : theme === 'dark' ? "text-slate-400" : "text-slate-400"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setActiveTab('more')}
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
            activeTab === 'more' 
              ? "text-indigo-600" 
              : theme === 'dark' ? "text-slate-400" : "text-slate-400"
          )}
        >
          <Menu size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Menu</span>
        </button>
      </nav>

      <GlobalTransactionModal />
      <ShortcutHelper show={isShortcutPopupOpen} />
    </div>
  );
}

function SetupCompany() {
  const { addCompany, restoreCompany, syncStatus } = useApp();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PKR');

  const handleCreate = async () => {
    if (!name.trim()) return;
    await addCompany({
      name: name.trim(),
      address: '',
      currency,
      user_id: 'default',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
        <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-indigo-800 opacity-90" />
          <svg className="relative z-10 w-10 h-10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 25 L50 75 M35 45 L35 75 M65 45 L65 75" stroke="white" strokeWidth="8" strokeLinecap="round"/>
            <path d="M30 75 L70 75" stroke="white" strokeWidth="4"/>
            <path d="M40 45 L50 35 L60 45" fill="#fbbf24"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 text-slate-900 dark:text-slate-50">Bugzy Pro</h1>
        
        <div className="space-y-4 mt-8">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Company Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-50"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Currency</label>
            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-50"
            >
              <option value="PKR">Pakistan Rupee (PKR)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="None">None</option>
            </select>
          </div>
          
          {syncStatus.error && (
            <p className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">{syncStatus.error}</p>
          )}

          <button 
            onClick={handleCreate}
            disabled={syncStatus.loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {syncStatus.loading ? 'Creating...' : 'Create Company'}
          </button>
        </div>
      </div>
    </div>
  );
}
