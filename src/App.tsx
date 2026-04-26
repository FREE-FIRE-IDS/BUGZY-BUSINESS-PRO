import React, { useState, useEffect } from 'react';
import { Company } from './types';
import { supabase } from './lib/supabase';
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
  Cloud,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  FileText,
  Search,
  Sparkles,
  Clock,
  Loader2,
  Check,
  ArrowLeft,
  ShieldCheck,
  Upload,
  Crown,
  BarChart3,
  Wifi,
  WifiOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './contexts/AppContext';
import { useTheme } from './contexts/ThemeContext';
import { cn } from './lib/utils';
import { differenceInDays, addDays, isAfter, format } from 'date-fns';

// Pages
import Dashboard from './pages/Dashboard';
import Parties from './pages/Parties';
import Banks from './pages/Banks';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import BusinessStatus from './pages/BusinessStatus';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Activation from './pages/Activation';
import Customization from './pages/Customization';
import SyncCenter from './pages/SyncCenter';

import GlobalTransactionModal from './components/GlobalTransactionModal';

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  
  const slides = [
    {
      title: "Welcome to Bugzy Pro",
      desc: "Professional business management and accounting, designed to work offline first.",
      icon: <Sparkles size={48} className="text-indigo-500" />
    },
    {
      title: "Powerful Features",
      desc: "Manage invoices, parties, inventory, and expenses with ease on any device.",
      icon: <LayoutDashboard size={48} className="text-indigo-500" />
    },
    {
      title: "Secure & Private",
      desc: "Your data stays on your device. Use our Vyapar-style backup to keep your records safe.",
      icon: <Receipt size={48} className="text-indigo-500" />
    },
    {
      title: "Ready to Grow?",
      desc: "Set up your company in seconds and start your 7-day free trial today.",
      icon: <Building2 size={48} className="text-indigo-500" />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
              {slides[step].icon}
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">{slides[step].title}</h1>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{slides[step].desc}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-2 mt-10 mb-10">
          {slides.map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-8 bg-indigo-600" : "w-2 bg-slate-200 dark:bg-slate-800")} />
          ))}
        </div>

        <button 
          onClick={() => {
            if (step < slides.length - 1) setStep(step + 1);
            else onComplete();
          }}
          className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
        >
          {step === slides.length - 1 ? "Get Started" : "Next"}
        </button>
      </div>
    </div>
  );
}

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

function PaymentScreen({ company, onClose }: { company: Company, onClose?: () => void }) {
  const { submitPaymentRequest, activateLicense, isLicensed } = useApp();
  const isLicensedUser = isLicensed();
  const [step, setStep] = useState<'plan' | 'payment' | 'form' | 'success'>('plan');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    screenshot: ''
  });
  const [licenseKey, setLicenseKey] = useState('');
  const isExpired = !isLicensedUser;
  const version = "v2.5.0-PRO";

  const plans = {
    monthly: { name: 'Monthly Plan', price: 599, duration: '30 Days' },
    yearly: { name: 'Yearly Plan', price: 1499, duration: '365 Days' }
  };

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      setFormData({ ...formData, screenshot: publicUrl });
    } catch (err: any) {
      console.error('Upload error:', err);
      alert('Failed to upload image. Please try again or use a URL.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.screenshot) {
      alert('Please upload a payment screenshot ❌');
      return;
    }
    setStatus('loading');
    try {
      await submitPaymentRequest({
        ...formData,
        amount: plans[selectedPlan].price,
        plan: selectedPlan
      });
      setStep('success');
    } catch (err: any) {
      console.error('Submit Error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Failed to submit request. Please try again.');
    }
  };

  const handleActivate = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      await activateLicense(licenseKey);
      window.location.reload();
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800"
        >
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Sparkles size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 mb-4 tracking-tight">Request Sent!</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
            Your payment request for the <span className="font-bold text-indigo-600">{plans[selectedPlan].name}</span> has been submitted. 
            Admin will verify your payment and activate your subscription shortly.
          </p>
          <button 
            onClick={() => {
              if (onClose) onClose();
              else window.location.reload();
            }}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 relative focus-within:ring-2 focus-within:ring-indigo-500/20">
        {(step !== 'plan' && step !== 'success') ? (
          <button 
            type="button"
            onClick={() => setStep(step === 'payment' ? 'plan' : 'payment')}
            className="absolute top-8 left-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all z-20"
          >
            <ArrowLeft size={24} />
          </button>
        ) : (step === 'plan' && !isExpired) ? (
          <button 
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else window.location.reload();
            }}
            className="absolute top-8 left-8 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all z-20"
          >
            <X size={24} />
          </button>
        ) : null}
        <div className="p-10 relative">
          <div className="absolute top-4 right-10 opacity-20 text-[8px] font-black pointer-events-none">{version}</div>
          <AnimatePresence mode="wait">
            {step === 'plan' && (
              <motion.div
                key="plan"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Package size={32} />
                </div>
                <h2 className="text-3xl font-black mb-2">Choose Your Plan</h2>
                <p className="text-slate-500 mb-8">
                  {!isLicensedUser ? 'Your trial has expired. Please upgrade to continue using all features. ❌' : 'Select a subscription plan that fits your business needs.'}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {(['monthly', 'yearly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setSelectedPlan(p)}
                      className={cn(
                        "p-6 rounded-3xl border-2 transition-all text-left group",
                        selectedPlan === p 
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20" 
                          : "border-slate-100 dark:border-slate-800 hover:border-indigo-200"
                      )}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          selectedPlan === p ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                        )}>
                          {plans[p].duration}
                        </span>
                        {selectedPlan === p && <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white"><Plus size={12} className="rotate-45" /></div>}
                      </div>
                      <h3 className="font-black text-xl mb-1 text-slate-900 dark:text-white">{plans[p].name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-indigo-600">{plans[p].price}</span>
                        <span className="text-sm text-slate-500 font-bold">PKR</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mb-8">
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-3">Already have a License?</p>
                   <div className="flex gap-2">
                    <input 
                      type="text"
                      value={licenseKey}
                      onChange={e => {
                        setLicenseKey(e.target.value);
                        setErrorMsg('');
                      }}
                      placeholder="Enter License Key"
                      className={cn(
                        "flex-1 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl px-5 py-4 outline-none transition-all font-mono text-sm",
                        status === 'error' && errorMsg.includes('License') ? "border-rose-500" : "border-slate-100 dark:border-slate-700 focus:border-indigo-600"
                      )}
                    />
                    <button 
                      onClick={handleActivate}
                      disabled={!licenseKey || status === 'loading'}
                      className="bg-slate-900 text-white px-6 rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {status === 'loading' ? '...' : 'Activate'}
                    </button>
                  </div>
                  {status === 'error' && errorMsg && (
                    <p className="text-rose-500 text-[10px] font-bold text-center mt-2">{errorMsg}</p>
                  )}
                </div>

                <button 
                  onClick={() => setStep('payment')}
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
                >
                  Continue to Payment
                </button>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Wallet size={32} />
                  </div>
                  <h2 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">Make Payment</h2>
                  <p className="text-slate-500">Please send the exact amount to one of the accounts below.</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">JazzCash Only</span>
                      <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase">Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-50">0332-7373104</p>
                        <p className="text-sm text-slate-500 font-bold">Account Name: Bugzy Business</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-indigo-600">{plans[selectedPlan].price}</p>
                        <p className="text-sm text-slate-500 font-bold">PKR Total</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex gap-3">
                    <Clock size={20} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      <strong>Important:</strong> After sending the payment, please take a screenshot of the confirmation message. You will need to upload it in the next step.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setStep('plan')}
                    className="py-5 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => setStep('form')}
                    className="bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
                  >
                    I Have Paid
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">Payment Details</h2>
                  <p className="text-slate-500">Fill in the details to verify your payment.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Your Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3.5 focus:border-indigo-600 outline-none transition-all font-bold"
                      placeholder="Full Name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-3.5 focus:border-indigo-600 outline-none transition-all font-bold"
                      placeholder="03xx-xxxxxxx"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Payment Screenshot</label>
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <div className="flex-1 relative">
                          <input 
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            disabled={uploading}
                          />
                          <div className={cn(
                            "w-full bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3.5 flex items-center justify-center gap-2 transition-all",
                            uploading ? "opacity-50" : "hover:border-indigo-400"
                          )}>
                            {uploading ? (
                              <Loader2 className="animate-spin text-indigo-600" size={20} />
                            ) : formData.screenshot ? (
                              <Check className="text-emerald-600" size={20} />
                            ) : (
                              <Plus className="text-slate-400" size={20} />
                            )}
                            <span className="text-sm font-bold text-slate-500">
                              {uploading ? 'Uploading...' : formData.screenshot ? 'Image Uploaded' : 'Upload Screenshot'}
                            </span>
                          </div>
                        </div>
                        {formData.screenshot && (
                          <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shrink-0">
                            <img src={formData.screenshot} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                      
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FileText size={16} className="text-slate-400" />
                        </div>
                        <input 
                          type="url"
                          value={formData.screenshot}
                          onChange={e => setFormData({...formData, screenshot: e.target.value})}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl pl-11 pr-5 py-3 focus:border-indigo-600 outline-none transition-all text-sm"
                          placeholder="Or paste image URL here..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setStep('payment')}
                      className="py-5 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={status === 'loading'}
                      className="bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                    >
                      {status === 'loading' ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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

function TrialBanner({ company, onUpgrade, isLicensed }: { company: Company, onUpgrade: () => void, isLicensed?: boolean }) {
  const expiryStr = localStorage.getItem('license_expiry');
  const buildTag = "v2.5.0-PRO";
  
  if (isLicensed) {
    if (!expiryStr) return null;
    const expiryDate = new Date(expiryStr);
    const daysLeft = Math.max(0, differenceInDays(expiryDate, new Date()));
    
    return (
      <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-sm font-bold sticky top-0 z-[45] shadow-md">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} />
          <span>Pro License: {daysLeft} days remaining ({format(expiryDate, 'dd MMM yyyy')})</span>
          <span className="ml-2 opacity-50 px-1 border border-white/30 rounded text-[8px]">{buildTag}</span>
        </div>
        <div className="text-[10px] uppercase font-black opacity-80">Device Authorized</div>
      </div>
    );
  }
  
  const trialStartRaw = company.trial_start || company.created_at;
  const trialStart = trialStartRaw ? new Date(trialStartRaw) : new Date(0); 
  const trialEnd = addDays(trialStart, 7);
  const daysLeft = Math.max(0, differenceInDays(trialEnd, new Date()));

  const isExpired = daysLeft <= 0;

  return (
    <div className={cn(
      "text-white px-4 py-2 flex items-center justify-between text-sm font-bold sticky top-0 z-[45] shadow-md transition-colors",
      isExpired ? "bg-rose-600" : "bg-indigo-600"
    )}>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className={isExpired ? "" : "animate-pulse"} />
        <span className="hidden sm:inline">
          {isExpired ? "Package Expired - Upgrade to Pro" : `Trial Mode: ${daysLeft} days remaining`}
        </span>
        <span className="sm:hidden">{isExpired ? "Expired" : `${daysLeft}d left`}</span>
        <span className="opacity-50 text-[8px] bg-black/10 px-1 rounded ml-1">{buildTag}</span>
      </div>
      <button 
        onClick={onUpgrade}
        className="bg-white text-rose-600 px-4 py-1 rounded-full text-[10px] font-black hover:bg-white/90 transition-all shadow-lg active:scale-95 uppercase tracking-wider"
      >
        {isExpired ? "Upgrade Now" : "Get Pro"}
      </button>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { 
    currentCompany, 
    companies, 
    setCurrentCompany, 
    addCompany, 
    updateCompany, 
    settings, 
    updateSettings, 
    isAdmin, 
    isDeviceLicensed,
    isLicensed,
    licenseExpiry,
    isTrialExpired,
    paymentStatus,
    isOnline,
    session,
    syncStatus
  } = useApp();
  const { theme, toggleTheme } = useTheme();

  const isOwner = !currentCompany || !currentCompany.owner_email || (session?.user?.email && currentCompany.owner_email === session.user.email);
  const [showSplash, setShowSplash] = useState(true);
  const [forceUpgrade, setForceUpgrade] = useState(false);
  const [dismissedPayment, setDismissedPayment] = useState(false);

  useEffect(() => {
    if (!currentCompany && companies.length > 0) {
      setCurrentCompany(companies[0]);
    }
  }, [currentCompany, companies, setCurrentCompany]);

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
    
    const handleForceUpgrade = () => {
      setForceUpgrade(true);
      setDismissedPayment(false);
    };
    window.addEventListener('forceUpgrade', handleForceUpgrade);

    return () => {
      window.removeEventListener('navigate', handleNavigate);
      window.removeEventListener('forceUpgrade', handleForceUpgrade);
    };
  }, []);

  useEffect(() => {
    if (syncStatus.error === 'LICENSE_REQUIRED') {
      setActiveTab('activation');
    }
  }, [syncStatus.error]);

  const isLicensedUser = isLicensed();
  
  // License expiry for header
  const daysLeftLicense = licenseExpiry ? Math.max(0, differenceInDays(new Date(licenseExpiry), new Date())) : null;

  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'parties', label: 'Parties', icon: Users, premium: true },
    { id: 'banks', label: 'Banks', icon: Building2, premium: true },
    { id: 'invoices', label: 'Invoices', icon: FileText, premium: true },
    ...(isOwner ? [{ id: 'sync', label: 'Sync Center', icon: Cloud, premium: false }] : []),
    { id: 'more', label: 'More', icon: Menu },
  ];

  const moreItems = [
    { id: 'inventory', label: 'Inventory', icon: Package, premium: true },
    { id: 'expenses', label: 'Expenses', icon: Receipt, premium: true },
    { id: 'business-status', label: 'Business Status', icon: BarChart3, premium: true },
    { id: 'reports', label: 'Reports', icon: History, premium: true },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, premium: true },
    ...(currentCompany && !currentCompany.is_paid && !isLicensed() ? [{ id: 'upgrade', label: 'Premium Status', icon: Sparkles, premium: true }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Building2, premium: true }] : []),
  ];

  const renderPage = () => {
    const tab = activeTab === 'more' ? 'settings' : activeTab;
    
    // Check if user is on a premium tab
    const isPremiumTab = [...menuItems, ...moreItems].find(i => i.id === tab)?.premium;

    if (tab === 'sync' && !isOwner) {
       return <Dashboard />;
    }
    switch (tab) {
      case 'dashboard': return <Dashboard />;
      case 'sync': return <SyncCenter />;
      case 'activation': return <Activation />;
      case 'parties': return <Parties />;
      case 'banks': return <Banks />;
      case 'inventory': return <Inventory />;
      case 'expenses': return <Expenses />;
      case 'invoices': return <Invoices />;
      case 'reports': return <Reports />;
      case 'business-status': return <BusinessStatus />;
      case 'settings': return <Settings />;
      case 'admin': return <Admin />;
      case 'customization': return <Customization />;
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
        if (isTrialExpired && !isLicensedUser) {
          setForceUpgrade(true);
          return;
        }
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

  if (!settings.onboarding_completed) {
    return <Onboarding onComplete={() => updateSettings({ onboarding_completed: true })} />;
  }

  if (!currentCompany && companies.length === 0) {
    return <SetupCompany />;
  }

  // IF TRIAL OR LICENSE EXPIRED: Block entire app
  if (isTrialExpired && !isLicensedUser && currentCompany) {
    return (
      <div className="h-screen w-screen bg-slate-950 overflow-y-auto flex items-center justify-center p-4">
        <div className="w-full max-w-xl">
          <PaymentScreen 
            company={currentCompany} 
          />
        </div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-[0.2em] text-[10px]">Initializing workspace</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-screen flex overflow-hidden transition-colors duration-300",
      theme === 'dark' ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
    )}>
      {/* PC Sidebar */}
      <aside className={cn(
        "h-full shrink-0 border-r hidden md:flex flex-col transition-all duration-300 relative z-30",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-transparent shrink-0">
          <div className="flex items-center gap-3">
            {currentCompany?.logo_url ? (
              <img src={currentCompany.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-xl" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xl relative overflow-hidden group shrink-0">
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
                className="font-bold text-lg tracking-tight text-slate-900 dark:text-white truncate"
              >
                {currentCompany?.name || 'Bugzy Pro'}
              </motion.span>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto no-scrollbar">
          {[...menuItems.slice(0, 4), ...moreItems].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if ((item as any).premium && !isLicensed() && isTrialExpired) {
                  setForceUpgrade(true);
                  setDismissedPayment(false);
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                  : theme === 'dark' ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <item.icon size={22} className="shrink-0" />
              {isSidebarOpen && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  {item.premium && isTrialExpired && !isLicensedUser && (
                    <Crown size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                  )}
                </div>
              )}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
          
          {currentCompany && !currentCompany.is_paid && !isLicensed() && (
            <button
              onClick={() => {
                setForceUpgrade(true);
                setDismissedPayment(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl transition-all group relative mt-6 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40",
                !isSidebarOpen && "justify-center"
              )}
            >
              <Sparkles size={22} className="animate-pulse shrink-0" />
              {isSidebarOpen && <span className="truncate">Buy Now</span>}
            </button>
          )}
        </nav>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Topbar */}
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0 z-20",
          theme === 'dark' ? "border-slate-800" : "border-slate-200"
        )}>
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:block"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              {currentCompany?.logo_url ? (
                <img src={currentCompany.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded-lg md:hidden" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-sm md:hidden relative overflow-hidden shrink-0">
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

            <div className="relative flex-1 max-w-md ml-4 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search transactions, parties..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {(isTrialExpired && !isLicensedUser) && (
              <button 
                onClick={() => setForceUpgrade(true)}
                className="group relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95 border border-white/20"
              >
                <Crown size={14} className="fill-white animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider">Premium Lock</span>
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white shadow-sm" />
              </button>
            )}
            {isLicensedUser && daysLeftLicense !== null && (
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 text-[8px] sm:text-[10px] font-black uppercase tracking-wider truncate">
                  <Clock size={10} className="shrink-0" />
                  <span>{daysLeftLicense}D Left</span>
                </div>
                {licenseExpiry && (
                  <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                    Expires: {format(new Date(licenseExpiry), 'dd MMM yyyy')}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 max-w-[120px] md:max-w-none relative group">
              <Building2 size={16} className="shrink-0" />
              <span className="text-xs md:text-sm font-medium truncate">{currentCompany?.name}</span>
              {(isTrialExpired && !isLicensedUser) && (
                <div className="absolute -top-1 -right-1 flex items-center justify-center p-0.5 bg-amber-500 rounded-full border border-white shadow-sm">
                  <Crown size={8} className="text-white fill-white" />
                </div>
              )}
            </div>

            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border",
              isOnline 
                ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50" 
                : "bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50 animate-pulse"
            )}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline Mode'}</span>
            </div>

            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar scroll-smooth">
          {currentCompany && (
            <div className="sticky top-0 z-10 w-full">
              <TrialBanner 
                company={currentCompany} 
                isLicensed={isLicensed()} 
                onUpgrade={() => {
                  setForceUpgrade(true);
                  setDismissedPayment(false);
                }} 
              />
            </div>
          )}

          <div className="p-4 md:p-8 w-full">
            <div className="max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'more' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 pb-24 lg:pb-0">
                      {moreItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.premium && !isLicensedUser && isTrialExpired) {
                              setForceUpgrade(true);
                              setDismissedPayment(false);
                            } else {
                              setActiveTab(item.id);
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border transition-all gap-2 sm:gap-3",
                            theme === 'dark' 
                              ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-50" 
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-900"
                          )}
                        >
                          <div className="p-2 sm:p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl relative">
                            <item.icon size={22} className="sm:w-6 sm:h-6" />
                            {item.premium && isTrialExpired && !isLicensedUser && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-amber-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-lg">
                                <Crown size={8} className="sm:w-2.5 sm:h-2.5 fill-white" />
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-[10px] sm:text-sm uppercase tracking-wider">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : renderPage()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Floating Action Button for Mobile */}
        <div className={cn(
          "fixed bottom-28 right-6 z-40 md:hidden transition-all",
          (isTrialExpired && !isLicensedUser) && "animate-bounce"
        )}>
          <button 
            onClick={() => {
              if (isTrialExpired && !isLicensedUser) {
                setForceUpgrade(true);
              } else {
                window.dispatchEvent(new CustomEvent('open-tx', { detail: 'Payment In' }));
              }
            }}
            className={cn(
              "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all shadow-indigo-500/40 relative",
              (isTrialExpired && !isLicensedUser) ? "bg-amber-500 text-white" : "bg-indigo-600 text-white"
            )}
          >
            {isTrialExpired && !isLicensedUser ? <Crown size={28} className="fill-white" /> : <Plus size={32} />}
            {isTrialExpired && !isLicensedUser && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center border-2 border-white">
                <span className="text-[10px] font-black">!</span>
              </div>
            )}
          </button>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className={cn(
          "h-20 shrink-0 flex items-center justify-around p-3 border-t backdrop-blur-md pb-safe md:hidden z-50",
          theme === 'dark' ? "bg-slate-900/95 border-slate-800" : "bg-white/95 border-slate-200"
        )}>
          {menuItems.filter(i => i.id !== 'admin').map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.premium && !isLicensedUser && isTrialExpired) {
                  setForceUpgrade(true);
                  setDismissedPayment(false);
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1 rounded-2xl transition-all relative min-w-[64px]",
                activeTab === item.id 
                  ? "text-indigo-600" 
                  : theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-900"
              )}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute inset-x-0 -top-3 h-1 bg-indigo-600 rounded-full mx-4"
                />
              )}
              <div className="relative">
                <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {isTrialExpired && !isLicensedUser && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center border border-white">
                    <Sparkles size={6} className="text-white" />
                  </div>
                )}
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-[0.1em]",
                activeTab === item.id ? "opacity-100" : "opacity-60"
              )}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <GlobalTransactionModal />
      <ShortcutHelper show={isShortcutPopupOpen} />

      {/* Payment Overlay */}
      {(forceUpgrade || (isTrialExpired && !isLicensedUser && !dismissedPayment && paymentStatus !== 'pending')) && currentCompany && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl min-h-screen flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => {
              // Only allow background click search if they forced it or if it's already pending
              if (paymentStatus === 'pending') {
                setDismissedPayment(true);
                setForceUpgrade(false);
              }
            }} />
            <div className="relative z-10 w-full max-w-xl">
              <PaymentScreen 
                company={currentCompany} 
                onClose={() => {
                  // If trial is expired and no request, don't allow permanent dismissal
                  if (isTrialExpired && !isLicensedUser && paymentStatus !== 'pending') {
                      setDismissedPayment(false);
                      setForceUpgrade(true);
                  } else {
                      setForceUpgrade(false);
                      setDismissedPayment(true);
                  }
                  if (activeTab !== 'dashboard') setActiveTab('dashboard');
                }} 
              />
              {(forceUpgrade || paymentStatus === 'pending') && (
                <button 
                  onClick={() => {
                    setForceUpgrade(false);
                    setDismissedPayment(true);
                    if (activeTab !== 'dashboard') setActiveTab('dashboard');
                  }}
                  className="absolute top-8 right-8 p-2 text-slate-400 hover:text-white transition-all z-20"
                >
                  <X size={24} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SetupCompany() {
  const { addCompany, loginWithUsername, restoreCompany, restoreData, syncStatus, session, companies, setCurrentCompany } = useApp();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [type, setType] = useState<'normal' | 'hr'>('normal');
  const [mode, setMode] = useState<'login' | 'signup' | 'restore' | 'list'>(companies.length > 0 ? 'list' : 'signup');

  const myCompanies = companies.filter(c => !c.owner_email || c.owner_email === session?.user?.email);
  const sharedCompanies = companies.filter(c => c.owner_email && c.owner_email !== session?.user?.email);

  const handleAction = async () => {
    if (mode === 'login') {
      if (!username.trim()) return;
      const success = await loginWithUsername(username.trim());
      if (success) setMode('list');
    } else if (mode === 'restore') {
      if (!recoveryCode.trim()) return;
      await restoreCompany(recoveryCode.trim());
      setMode('list');
    } else {
      if (!name.trim() || !username.trim()) return;
      
      const normalizedUsername = username.trim().toLowerCase();
      
      // 1. Check if username is available
      const available = await loginWithUsername(normalizedUsername, false);
      if (!available) return;

      // 2. Add company
      try {
        await addCompany({
          name: name.trim(),
          username: normalizedUsername,
          address: '',
          currency,
          company_type: type,
          user_id: session?.user?.id || 'default',
        });
        setMode('list');
      } catch (e: any) {
        console.error('Add company error:', e);
      }
    }
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        await restoreData(content);
        setMode('list');
      }
    };
    reader.readAsText(file);
  };

  if (mode === 'list' && companies.length > 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
             <div>
               <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Select Business</h1>
               <p className="text-sm text-slate-500 font-medium tracking-tight">Welcome back to Bugzy Pro</p>
             </div>
             <button 
              onClick={() => setMode('signup')}
              className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
             >
               <Plus size={20} />
             </button>
          </div>

          <div className="space-y-4">
             <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">My Companies</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {myCompanies.map(c => (
                 <button 
                  key={c.id} 
                  onClick={() => setCurrentCompany(c)}
                  className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 transition-all text-left shadow-sm group"
                 >
                   <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-110 transition-transform">
                     {c.company_type === 'hr' ? <Users size={24} /> : <Building2 size={24} />}
                   </div>
                   <div className="min-w-0">
                     <h4 className="font-bold text-slate-900 dark:text-slate-50 truncate">{c.name}</h4>
                     <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">{c.company_type === 'hr' ? 'HR / Offline' : 'Business / Online'}</p>
                   </div>
                 </button>
               ))}
             </div>
          </div>

          {sharedCompanies.length > 0 && (
            <div className="space-y-4">
               <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Shared With Me</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {sharedCompanies.map(c => (
                   <button 
                    key={c.id} 
                    onClick={() => setCurrentCompany(c)}
                    className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 transition-all text-left shadow-sm group"
                   >
                     <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-600 shrink-0 group-hover:scale-110 transition-transform">
                       <Cloud size={24} />
                     </div>
                     <div className="min-w-0">
                       <h4 className="font-bold text-slate-900 dark:text-slate-50 truncate">{c.name}</h4>
                       <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Owner: {c.owner_email}</p>
                     </div>
                   </button>
                 ))}
               </div>
            </div>
          )}

          <div className="flex justify-center gap-4 pt-4">
             <button onClick={() => setMode('login')} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Login with Username</button>
             <button onClick={() => setMode('restore')} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">Restore Data</button>
          </div>
        </div>
      </div>
    );
  }

  const title = mode === 'login' ? 'Login' : mode === 'restore' ? 'Restore Data' : 'Create Account';
  const subTitle = mode === 'login' ? 'Access your business data' : mode === 'restore' ? 'Enter recovery code or upload backup file' : 'Start managing your business';

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
        <h1 className="text-2xl font-bold text-center mb-1 text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-slate-500 text-center text-sm mb-8">{subTitle}</p>
        
        <div className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-400 mb-2">Company Type</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                   <button 
                    onClick={() => setType('normal')}
                    className={cn(
                      "py-3 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-2",
                      type === 'normal' ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                    )}
                   >
                     <Cloud size={14} /> Normal
                   </button>
                   <button 
                    onClick={() => setType('hr')}
                    className={cn(
                      "py-3 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-2",
                      type === 'hr' ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm" : "text-slate-500"
                    )}
                   >
                     <Users size={14} /> HR / Offline
                   </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-400 font-medium px-2 italic">
                  {type === 'normal' ? 'Full cloud sync & multi-device sharing enabled.' : 'Private offline-only company. No cloud sync.'}
                </p>
              </div>

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
            </div>
          )}
          
          {mode !== 'restore' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-50 font-mono"
                placeholder="unique_username"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Recovery Code</label>
                <input 
                  type="text" 
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-900 dark:text-slate-50 font-mono uppercase tracking-widest text-center"
                  placeholder="e.g. abcd-1234"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">Or use backup file</span>
                </div>
              </div>
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-indigo-500 transition-all cursor-pointer group">
                <input type="file" accept=".json" onChange={handleFileRestore} className="hidden" />
                <Upload className="text-slate-400 group-hover:text-indigo-500 mb-2" size={24} />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Restore from Backup File</span>
              </label>
            </div>
          )}

          {mode === 'signup' && (
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
          )}
          
          {syncStatus.error && (
            <p className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">{syncStatus.error}</p>
          )}

          <button 
            onClick={handleAction}
            disabled={syncStatus.loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {syncStatus.loading ? 'Processing...' : mode === 'login' ? 'Login' : mode === 'restore' ? 'Restore' : 'Create Account'}
          </button>

          <div className="flex flex-col gap-2 mt-4">
            {mode !== 'login' && (
              <button 
                onClick={() => setMode('login')}
                className="w-full text-indigo-600 text-sm font-bold hover:underline"
              >
                Already have an account? Login
              </button>
            )}
            {mode !== 'signup' && (
              <button 
                onClick={() => setMode('signup')}
                className="w-full text-indigo-600 text-sm font-bold hover:underline"
              >
                New user? Create Account
              </button>
            )}
            {mode !== 'restore' && (
              <button 
                onClick={() => setMode('restore')}
                className="w-full text-slate-500 text-sm font-bold hover:underline"
              >
                Restore with Recovery Code
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
