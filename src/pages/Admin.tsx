import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PaymentRequest, License } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Building2, Mail, DollarSign, Key, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Admin() {
  const { fetchPaymentRequests, updatePaymentRequestStatus, fetchLicenses, resetLicenseDevice, settings } = useApp();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'licenses'>('payments');

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqData, licData] = await Promise.all([
        fetchPaymentRequests(),
        fetchLicenses()
      ]);
      setRequests(reqData);
      setLicenses(licData);
    } catch (e: any) {
      console.error('Admin Load Error:', e);
      const rawError = (e.message || JSON.stringify(e)).toLowerCase();
      
      if (rawError.includes('schema cache') || rawError.includes('column') || rawError.includes('not found')) {
        const fixSql = `
-- 1. DROP AND RECREATE (The most reliable fix)
-- WARNING: This will delete existing payment requests/licenses!
DROP TABLE IF EXISTS payment_requests;
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT,
  phone TEXT,
  plan TEXT,
  amount NUMERIC,
  screenshot TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS licenses;
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  license_key TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  devices JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fix Permissions
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full Access" ON payment_requests;
CREATE POLICY "Full Access" ON payment_requests FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Full Access" ON licenses;
CREATE POLICY "Full Access" ON licenses FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE payment_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE licenses;

-- 4. FORCE RELOAD CACHE
NOTIFY pgrst, 'reload schema';
        `.trim();
        
        alert(`DATABASE ERROR DETECTED!\n\nSupabase is stuck on an old table structure. I have copied a "Deep Clean" SQL script to your clipboard.\n\n1. Go to Supabase SQL Editor.\n2. Paste and Run the script.\n3. Refresh the app.`);
        navigator.clipboard.writeText(fixSql);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const generateKey = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}`;
  };

  const handleApprove = async (id: string) => {
    if (!confirm(`Approve this payment and activate subscription?`)) return;
    
    try {
      await updatePaymentRequestStatus(id, 'approved');
      await loadData();
    } catch (e: any) {
      console.error('Approval Error:', e);
      const rawError = e.message || JSON.stringify(e);
      
      if (rawError.includes('schema cache') || rawError.includes('column') || rawError.includes('not found') || rawError.includes('row level security')) {
        const fixSql = `
-- 1. DROP AND RECREATE (The most reliable fix)
-- WARNING: This will delete existing payment requests/licenses!
DROP TABLE IF EXISTS payment_requests;
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT,
  phone TEXT,
  plan TEXT,
  amount NUMERIC,
  screenshot TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TABLE IF EXISTS licenses;
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  license_key TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  devices JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fix Permissions
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full Access" ON payment_requests;
CREATE POLICY "Full Access" ON payment_requests FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Full Access" ON licenses;
CREATE POLICY "Full Access" ON licenses FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE payment_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE licenses;

-- 4. FORCE RELOAD CACHE
NOTIFY pgrst, 'reload schema';
        `.trim();
        
        const errorType = rawError.includes('row level security') ? 'RLS (PERMISSION) ERROR' : 'SCHEMA ERROR';
        alert(`${errorType} DETECTED!\n\nSupabase is stuck on an old table structure. I have copied a "Deep Clean" SQL script to your clipboard.\n\n1. Go to Supabase SQL Editor.\n2. Paste and Run the script.\n3. Refresh the app.`);
        navigator.clipboard.writeText(fixSql);
      } else {
        alert('Failed to approve: ' + rawError);
      }
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this payment request?')) return;
    try {
      await updatePaymentRequestStatus(id, 'rejected');
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to reject');
    }
  };

  const handleResetDevice = async (id: string) => {
    if (!confirm('Reset device binding for this license?')) return;
    try {
      await resetLicenseDevice(id);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to reset');
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage payments and license keys</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const sql = `
-- NUCLEAR FIX FOR SCHEMA AND RLS
ALTER TABLE IF EXISTS licenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE IF EXISTS licenses ADD COLUMN IF NOT EXISTS license_key TEXT;
ALTER TABLE IF EXISTS licenses ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE IF EXISTS licenses ADD COLUMN IF NOT EXISTS devices JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS licenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS payment_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE IF EXISTS payment_requests ADD COLUMN IF NOT EXISTS screenshot TEXT;
ALTER TABLE IF EXISTS payment_requests ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE IF EXISTS payment_requests ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS payment_requests ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE IF EXISTS payment_requests ADD COLUMN IF NOT EXISTS amount NUMERIC;

-- Fix RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Full Access" ON licenses;
CREATE POLICY "Full Access" ON licenses FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Full Access" ON payment_requests;
CREATE POLICY "Full Access" ON payment_requests FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE payment_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE licenses;

NOTIFY pgrst, 'reload schema';
              `.trim();
              navigator.clipboard.writeText(sql);
              alert("NUCLEAR FIX COPIED!\n\n1. Go to Supabase SQL Editor\n2. Paste and RUN these commands\n3. Refresh this page\n\nThis will force-add all missing columns and fix RLS permissions.");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-bold border border-rose-100 dark:border-rose-800 hover:bg-rose-100 transition-all animate-pulse"
            title="Fix schema cache errors"
          >
            <ShieldAlert size={18} /> NUCLEAR FIX: Status Column
          </button>
          <button 
            onClick={loadData}
            className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            <RefreshCw size={20} className={cn("text-slate-500", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('payments')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'payments' ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Payments ({requests.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('licenses')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
            activeTab === 'licenses' ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Licenses ({licenses.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="flex items-center justify-center p-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : activeTab === 'payments' ? (
            requests.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-20 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Clock size={40} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">No Requests</h3>
                <p className="text-slate-500">All payment requests have been processed.</p>
              </div>
            ) : (
              requests.map((req, idx) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden">
                      {req.screenshot ? (
                        <img 
                          src={req.screenshot} 
                          alt="Proof" 
                          className="w-full h-full object-cover cursor-pointer" 
                          onClick={() => window.open(req.screenshot, '_blank')}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Building2 size={32} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">{req.name}</h3>
                      <div className="flex flex-wrap gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Mail size={14} /> {req.user_id}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          <DollarSign size={14} /> {formatCurrency(req.amount, settings.currency)}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-50">
                          <Clock size={14} /> {req.plan}
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          req.status === 'pending' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                          req.status === 'approved' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                          {req.status}
                        </div>
                      </div>
                      {req.phone && (
                        <p className="text-xs text-slate-400 mt-2 font-mono">Phone: {req.phone}</p>
                      )}
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => handleApprove(req.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Check size={18} /> Approve
                      </button>
                      <button 
                        onClick={() => handleReject(req.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                      >
                        <X size={18} /> Reject
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="flex flex-col items-end gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Subscription Active</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )
          ) : (
            licenses.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-20 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Key size={40} className="text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">No Licenses</h3>
                <p className="text-slate-500">No licenses have been generated yet.</p>
              </div>
            ) : (
              licenses.map((lic, idx) => (
                <motion.div
                  key={lic.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Key size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-mono font-bold text-slate-900 dark:text-slate-50">{lic.license_key}</h3>
                      <div className="flex flex-wrap gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Mail size={14} /> {lic.user_id}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                          {Array.isArray(lic.devices) && lic.devices.length > 0 ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <ShieldCheck size={14} /> {lic.devices.length} Device(s) Bound
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                              <ShieldAlert size={14} /> Not Activated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(lic.devices) && lic.devices.length > 0 && (
                    <button 
                      onClick={() => handleResetDevice(lic.id)}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
                    >
                      <RefreshCw size={18} /> Reset Device
                    </button>
                  )}
                </motion.div>
              ))
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
