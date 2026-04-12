import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { PaymentRequest } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Check, X, Clock, Building2, Mail, DollarSign } from 'lucide-react';

export default function Admin() {
  const { fetchPaymentRequests, updatePaymentRequestStatus, settings } = useApp();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchPaymentRequests();
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected', companyId: string) => {
    try {
      await updatePaymentRequestStatus(id, status, companyId);
      await loadRequests();
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage payment requests and user access</p>
        </div>
        <button 
          onClick={loadRequests}
          className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          <Clock size={20} className="text-slate-500" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="flex items-center justify-center p-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-20 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Clock size={40} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">No Requests Found</h3>
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
                    onClick={() => handleAction(req.id, 'approved', req.company_id)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Check size={18} /> Approve
                  </button>
                  <button 
                    onClick={() => handleAction(req.id, 'rejected', req.company_id)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all"
                  >
                    <X size={18} /> Reject
                  </button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
