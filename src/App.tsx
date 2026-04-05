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
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './contexts/AppContext';
import { useTheme } from './contexts/ThemeContext';
import { cn } from './lib/utils';

// Pages
import Dashboard from './pages/Dashboard';
import Parties from './pages/Parties';
import Banks from './pages/Banks';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { currentCompany, companies, setCurrentCompany, addCompany } = useApp();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleNavigate = (e: any) => {
      setActiveTab(e.detail);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'banks', label: 'Banks', icon: Building2 },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'reports', label: 'Reports', icon: History },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const renderPage = () => {
    switch (activeTab) {
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
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setIsShortcutPopupOpen(true);
      }
      if (e.altKey) {
        if (e.key === 'i') { setActiveTab('parties'); }
        if (e.key === 'o') { setActiveTab('parties'); }
        if (e.key === 'j') { setActiveTab('parties'); }
        if (e.key === 'e') { setActiveTab('dashboard'); }
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

  if (!currentCompany && companies.length === 0) {
    return <SetupCompany />;
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full z-40 transition-all duration-300 border-r",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        isSidebarOpen ? "w-64 translate-x-0" : "w-20 -translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            B
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-lg tracking-tight text-black dark:text-white"
            >
              Bugzy Pro
            </motion.span>
          )}
        </div>

        <nav className="mt-6 px-3 space-y-1 overflow-y-auto max-h-[calc(100vh-120px)]">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
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
        "transition-all duration-300 min-h-screen",
        isSidebarOpen ? "md:pl-64" : "md:pl-20"
      )}>
        {/* Topbar */}
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-8 sticky top-0 z-30 backdrop-blur-md",
          theme === 'dark' ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200"
        )}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
              <Building2 size={16} />
              <span className="text-sm font-medium">{currentCompany?.name}</span>
            </div>
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <Plus size={20} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Shortcut Popup */}
      <AnimatePresence>
        {isShortcutPopupOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="bg-slate-900/90 backdrop-blur-md text-white p-8 rounded-3xl shadow-2xl border border-white/10 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <History size={24} className="text-indigo-400" />
                Quick Shortcuts
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Payment In</span>
                  <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20 text-xs font-bold">ALT + I</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Payment Out</span>
                  <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20 text-xs font-bold">ALT + O</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Party Transfer</span>
                  <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20 text-xs font-bold">ALT + J</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expense</span>
                  <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20 text-xs font-bold">ALT + E</kbd>
                </div>
              </div>
              <p className="mt-8 text-[10px] text-slate-500 text-center uppercase tracking-widest">Hold CTRL to show this popup</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around p-3 z-50">
        {menuItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              activeTab === item.id ? "text-indigo-600" : "text-slate-400"
            )}
          >
            <item.icon size={24} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupCompany() {
  const { addCompany } = useApp();
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
    // No reload needed if context state updates correctly
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">
          B
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Welcome to Bugzy Pro</h1>
        <p className="text-slate-500 text-center mb-8">Let's set up your first company to get started.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="PKR">Pakistan Rupee (PKR)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="None">None</option>
            </select>
          </div>
          <button 
            onClick={handleCreate}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
          >
            Create Company
          </button>
        </div>
      </div>
    </div>
  );
}
