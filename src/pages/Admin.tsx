import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PaymentRequest, License } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
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
    } catch (e) {
      console.error(e);
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
    return `${segment()}-${segment()}-${segment()}-${segment()}`;
  };

  const handleApprove = async (id: string, companyId: string) => {
    const key = generateKey();
    if (!confirm(`Generate and send license key: ${key}?`)) return;
    
    try {
      await updatePaymentRequestStatus(id, 'approved', companyId, key);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to approve');
    }
  };

  const handleReject = async (id: string, companyId: string) => {
    if (!confirm('Reject this payment request?')) return;
    try {
      await updatePaymentRequestStatus(id, 'rejected', companyId);
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
        <button 
          onClick={loadData}
          className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <RefreshCw size={20} className={cn("text-slate-500", loading && "animate-spin")} />
        </button>
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
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Building2 size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">{req.company_name}</h3>
                      <div className="flex flex-wrap gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                          <Mail size={14} /> {req.user_email}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          <DollarSign size={14} /> {formatCurrency(req.amount, settings.currency)}
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
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => handleApprove(req.id, req.company_id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Check size={18} /> Approve & Key
                      </button>
                      <button 
                        onClick={() => handleReject(req.id, req.company_id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                      >
                        <X size={18} /> Reject
                      </button>
                    </div>
                  )}
                  {req.status === 'approved' && req.license_key && (
                    <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Generated Key</p>
                      <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{req.license_key}</p>
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
                          <Mail size={14} /> {lic.user_email}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500">
                          {lic.device_id ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                              <ShieldCheck size={14} /> Bound to Device
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

                  {lic.device_id && (
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
