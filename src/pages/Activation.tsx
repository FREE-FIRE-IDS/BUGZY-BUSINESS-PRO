import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { motion } from 'motion/react';
import { Key, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Activation() {
  const { activateLicense, currentCompany } = useApp();
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setStatus('loading');
    setError('');
    try {
      await activateLicense(key.trim());
      setStatus('success');
      // App will reload or redirect via App.tsx logic
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setError(err.message || 'Activation failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 text-center">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Key size={40} />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 mb-4 tracking-tight">Activate License</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
          Enter your unique license key to unlock full features for <span className="font-bold text-slate-900 dark:text-slate-50">{currentCompany?.name}</span>.
        </p>

        <form onSubmit={handleActivate} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              className={cn(
                "w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl text-center font-mono text-xl tracking-widest focus:outline-none transition-all",
                status === 'error' ? "border-rose-500 bg-rose-50 dark:bg-rose-900/10" : "border-slate-100 dark:border-slate-800 focus:border-indigo-500"
              )}
              disabled={status === 'loading' || status === 'success'}
            />
            {status === 'error' && (
              <div className="flex items-center justify-center gap-2 mt-3 text-rose-500 text-sm font-bold">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center justify-center gap-2 mt-3 text-emerald-500 text-sm font-bold">
                <ShieldCheck size={16} />
                Activation Successful!
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={status === 'loading' || status === 'success' || !key.trim()}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {status === 'loading' ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                Verifying...
              </>
            ) : (
              'Activate Now'
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">No License Key?</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 text-left">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Pay <span className="font-bold text-indigo-600">Rs. 5,000</span> to:</p>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">JazzCash/EasyPaisa</span>
              <span className="font-mono font-bold text-indigo-600">0332-7373104</span>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm font-bold text-indigo-600 hover:underline"
          >
            I Have Paid, Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
