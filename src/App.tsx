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
        "fixed left-0 top-0 h-full z-40 transition-all duration-300 border-r hidden md:block",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        isSidebarOpen ? "w-64 translate-x-0" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            B
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold text-lg tracking-tight text-slate-900 dark:text-white"
            >
              Bugzy Pro
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
          theme === 'dark' ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200"
        )}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold capitalize">{activeTab === 'more' ? 'Menu' : activeTab}</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 max-w-[150px] md:max-w-none">
              <Building2 size={16} className="shrink-0" />
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
                        theme === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
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
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around p-2 z-50">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[64px]",
              activeTab === item.id ? "text-indigo-600" : "text-slate-400"
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SetupCompany() {
  const { addCompany, restoreCompany, syncStatus } = useApp();
  const [mode, setMode] = useState<'create' | 'restore'>('create');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
    if (mode === 'create') {
      const words = ['blue', 'fast', 'smart', 'gold', 'cool', 'bold', 'safe', 'rich', 'pure', 'kind'];
      const code = Array.from({ length: 4 }, () => words[Math.floor(Math.random() * words.length)]).join('-');
      setGeneratedCode(code);
    }
  }, [mode]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await addCompany({
      name: name.trim(),
      address: '',
      currency,
      user_id: 'default',
      recovery_code: generatedCode,
    });
  };

  const handleRestore = async () => {
    if (!recoveryCode.trim()) return;
    await restoreCompany(recoveryCode);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-slate-100 dark:border-slate-800">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">
          B
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 dark:text-white">Bugzy Pro</h1>
        
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-8">
          <button 
            onClick={() => setMode('create')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              mode === 'create' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white" : "text-slate-500"
            )}
          >
            Create New
          </button>
          <button 
            onClick={() => setMode('restore')}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
              mode === 'restore' ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-white" : "text-slate-500"
            )}
          >
            Restore
          </button>
        </div>

        {mode === 'create' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Currency</label>
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
              >
                <option value="PKR">Pakistan Rupee (PKR)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="None">None</option>
              </select>
            </div>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
              <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Your Recovery Code</label>
              <p className="text-lg font-mono font-bold text-indigo-900 dark:text-indigo-200">{generatedCode}</p>
              <p className="text-[10px] text-indigo-600/60 dark:text-indigo-400/60 mt-2 italic">Save this code! You'll need it to restore your data if you sign out.</p>
            </div>
            <button 
              onClick={handleCreate}
              disabled={syncStatus.loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {syncStatus.loading ? 'Creating...' : 'Create Company'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Recovery Code</label>
              <input 
                type="text" 
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-mono"
                placeholder="word-word-word-word"
              />
            </div>
            {syncStatus.error && (
              <p className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">{syncStatus.error}</p>
            )}
            <button 
              onClick={handleRestore}
              disabled={syncStatus.loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              {syncStatus.loading ? 'Restoring...' : 'Restore Company'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
