import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Smartphone,
  Unplug,
  History,
  Lock,
  Loader2,
  Trash2,
  UserPlus,
  ArrowRight,
  Clock,
  XCircle,
  Building2,
  Wifi,
  Users
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Invitation, CompanyAccess, HRTransferRequest } from '../types';

export default function SyncCenter() {
  const { 
    settings, updateSettings, refreshData, manualSyncLogin, confirmSyncLogin, 
    isOnline, syncStatus, session, currentCompany,
    getInvitations, respondToInvitation, sendInvitation,
    getCompanyUsers, removeUser,
    getHRTransferRequests, approveHRTransfer, requestHRTransfer
  } = useApp();

  const [email, setEmail] = useState(settings.user_email || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(settings.sync_enabled || session ? 'active' : 'intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyAccess[]>([]);
  const [hrRequests, setHrRequests] = useState<HRTransferRequest[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');

  const isOwner = currentCompany?.my_role === 'OWNER';
  const isHR = currentCompany?.company_type === 'hr';

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, currentCompany?.id]);

  const loadData = async () => {
    try {
      const [invs, users] = await Promise.all([
        getInvitations(),
        currentCompany ? getCompanyUsers(currentCompany.id) : Promise.resolve([])
      ]);
      setInvitations(invs);
      setCompanyUsers(users);

      if (isOwner && isHR && currentCompany) {
        const hrReqs = await getHRTransferRequests();
        setHrRequests(hrReqs);
      }
    } catch (e) {
      console.error('Failed to load sync center data:', e);
    }
  };

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || cooldown > 0) return;
    
    setLoading(true);
    setError(null);
    try {
      await manualSyncLogin(email);
      setOtpSent(true);
      setStep('otp');
      setCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    setLoading(true);
    setError(null);
    try {
      if (otp.length === 6) {
        await confirmSyncLogin(email, otp);
        setStep('active');
      } else {
        setError('Invalid OTP code ❌');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableSync = async () => {
    if (window.confirm('Are you sure you want to disable sync?')) {
      updateSettings({ sync_enabled: false });
      setStep('intro');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setLoading(true);
    try {
      await sendInvitation(inviteEmail);
      setInviteEmail('');
      alert('Invitation sent! 🚀');
      loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (id: string, status: 'Accepted' | 'Rejected') => {
    try {
      await respondToInvitation(id, status);
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Cloud size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Sync Center</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Collaboration & Cloud Business Sync</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2",
            isOnline ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"
          )}>
            {isOnline ? <Wifi size={14} /> : <Unplug size={14} />}
            {isOnline ? 'System Online' : 'Offline Mode'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Connection Status */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="relative z-10 space-y-6">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Database size={20} className="text-indigo-500" />
                Connection State
              </h3>
              
              <AnimatePresence mode="wait">
                {step !== 'active' ? (
                  <motion.div 
                    key="intro" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="space-y-6"
                  >
                    <div className="p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl text-center">
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Sign in to enable cloud sync and invite members to your company.
                      </p>
                    </div>
                    {step === 'intro' ? (
                      <form onSubmit={handleSendOTP} className="space-y-4">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="Gmail address"
                          required
                        />
                        <button
                          type="submit"
                          disabled={loading || !isOnline}
                          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
                          {cooldown > 0 ? `Retry in ${cooldown}s` : 'Send Login Code'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerify} className="space-y-4 text-center">
                        <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">Enter Code</p>
                        <input
                          type="text"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full text-center text-3xl font-black py-3 bg-white dark:bg-slate-950 border-2 border-indigo-100 dark:border-indigo-900 rounded-xl text-indigo-600 outline-none"
                          placeholder="000000"
                        />
                        <button
                          type="submit"
                          className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-sm"
                        >
                          Verify & Sync
                        </button>
                        <button onClick={() => setStep('intro')} className="text-xs text-slate-400 font-bold underline">Change Email</button>
                      </form>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="active" 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                      <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Synced to</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-50 truncate">{settings.user_email}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => refreshData(undefined)}
                        className="w-full py-4 bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                      >
                        <History size={16} />
                        Manual Sync
                      </button>
                      <button 
                        onClick={handleDisableSync}
                        className="w-full py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 font-black text-sm rounded-xl"
                      >
                        Disconnect Sync
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Background pattern */}
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
          </div>

          {/* Pending Invitations Section */}
          {invitations.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              <h3 className="text-lg font-black flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Mail size={20} className="text-amber-500" />
                  Invitations
                </span>
                <span className="bg-amber-100 text-amber-600 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {invitations.length} New
                </span>
              </h3>
              
              <div className="space-y-3">
                {invitations.map(inv => (
                  <div key={inv.id} className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400">
                        <Building2 size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 font-bold uppercase">Business Invite</p>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-50 truncate">Company ID: {inv.company_id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleRespond(inv.id, 'Accepted')}
                        className="py-2.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-all"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleRespond(inv.id, 'Rejected')}
                        className="py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black rounded-xl hover:bg-slate-300 transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: User Management / HR Transfer */}
        <div className="lg:col-span-2 space-y-8">
          {isOwner && currentCompany ? (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Team Management</h3>
                  <p className="text-sm text-slate-500 font-medium">Control who can access this business</p>
                </div>
                <Users size={32} className="text-indigo-200" />
              </div>

              {!isHR && (
                <form onSubmit={handleInvite} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Collaborator email (Gmail)"
                    />
                  </div>
                  <button 
                    disabled={loading || !inviteEmail.includes('@')}
                    className="px-6 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <UserPlus size={18} />
                    <span className="hidden sm:inline">Invite</span>
                  </button>
                </form>
              )}

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Active Members</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companyUsers.map(user => (
                    <div key={user.id} className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm",
                          user.role === 'OWNER' ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                        )}>
                          {user.shared_email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-slate-50 truncate">{user.shared_email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                              user.role === 'OWNER' ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                            )}>
                              {user.role}
                            </span>
                            {user.role === 'OWNER' && <ShieldCheck size={10} className="text-amber-500" />}
                          </div>
                        </div>
                      </div>
                      {user.role !== 'OWNER' && (
                        <button 
                          onClick={() => removeUser(currentCompany.id, user.shared_email)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : !isOwner ? (
            <div className="bg-slate-50 dark:bg-slate-950/20 rounded-[2rem] p-10 border border-slate-100 dark:border-slate-800 text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mx-auto text-indigo-400">
                <Lock size={40} />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-50">Member Access</h3>
                <p className="text-slate-500 font-medium">As a member, you can work on this business, but only the owner can manage team access and sync settings.</p>
              </div>
            </div>
          ) : null}

          {/* HR Transfer Section (Visible to Owners of HR Companies) */}
          {isOwner && isHR && currentCompany && (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">HR Device Transfer</h3>
                  <p className="text-sm text-slate-500 font-medium">Approve requests to unlock this company on a new device</p>
                </div>
                <Smartphone size={32} className="text-rose-200" />
              </div>

              {hrRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/50 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-400 font-bold">No active transfer requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hrRequests.map(req => (
                    <div key={req.id} className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/20 text-rose-600 rounded-xl flex items-center justify-center">
                          <Smartphone size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-slate-50">New Device Request</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{format(new Date(req.created_at), 'dd MMM yyyy HH:mm')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                          <p className="text-[8px] font-black uppercase text-slate-400">Security Code</p>
                          <p className="text-lg font-black text-rose-600 tracking-[0.2em]">{req.transfer_code}</p>
                        </div>
                        <button 
                          onClick={() => approveHRTransfer(req.id)}
                          className="flex-1 sm:flex-none px-6 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20"
                        >
                          Approve Unlock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                  HR companies are locked to a single physical device for maximum data sovereignty. To move this company, use the recovery code on the new device, then approve it here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
