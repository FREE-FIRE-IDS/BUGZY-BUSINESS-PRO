import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function SyncCenter() {
  const { 
    settings, updateSettings, refreshData, manualSyncLogin, confirmSyncLogin, isOnline, syncStatus, signOut, session,
    currentCompany, shareCompany, invitations, fetchInvitations, updateInvitationStatus, sentInvitations, fetchSentInvitations
  } = useApp();
  const [email, setEmail] = useState(settings.user_email || '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(settings.sync_enabled || session ? 'active' : 'intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Auto-transition if session becomes active (e.g. magic link clicked)
  React.useEffect(() => {
    if (session && step !== 'active') {
      setStep('active');
      if (!settings.sync_enabled) {
        updateSettings({ sync_enabled: true, user_email: session.user.email });
      }
    }
  }, [session, step]);

  React.useEffect(() => {
    if (step === 'active') {
      fetchInvitations();
      if (currentCompany) {
        fetchSentInvitations(currentCompany.id);
      }
    }
  }, [step, currentCompany?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !currentCompany) return;
    setIsInviting(true);
    try {
      await shareCompany(currentCompany.id, inviteEmail);
      setInviteEmail('');
      alert('Invitation sent successfully! 🚀');
    } catch (err: any) {
      alert(err.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      await updateInvitationStatus(id, status);
      alert(status === 'accepted' ? 'Company added to your Shared list! ✅' : 'Invitation rejected.');
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    setIsJoining(true);
    try {
      const { joinCompanyByCode } = useApp() as any; // Temporary cast if type isn't updated yet in current context
      // But I already updated the context type in the previous step, so it should be fine.
      await useApp().joinCompanyByCode(joinCode);
      setJoinCode('');
      alert('Successfully joined the company! 🎉');
    } catch (err: any) {
      alert(err.message || 'Invalid code or join failed');
    } finally {
      setIsJoining(false);
    }
  };

  const isOwner = currentCompany && (
    currentCompany.user_email?.toLowerCase() === settings.user_email?.toLowerCase() ||
    currentCompany.owner_email?.toLowerCase() === settings.user_email?.toLowerCase() ||
    !currentCompany.owner_email
  );

  React.useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (window.confirm('Are you sure you want to disable sync? Your data will remain only on this device.')) {
      updateSettings({ sync_enabled: false });
      setStep('intro');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Cloud size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Sync Center</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Manage your multi-device synchronization</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2",
            isOnline ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" : "bg-red-50 text-red-600 dark:bg-red-900/20"
          )}>
            <div className={cn("w-2 h-2 rounded-full animate-pulse", isOnline ? "bg-emerald-500" : "bg-red-500")} />
            {isOnline ? 'System Online' : 'Offline Mode'}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] p-10 border border-slate-100 dark:border-slate-800 text-center space-y-8"
          >
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center mx-auto text-indigo-600 mb-6">
                <ShieldCheck size={40} />
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Cloud Sync is Disabled</h2>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Link your Gmail account to enable professional real-time sync across all your devices.
              </p>
            </div>

            <form onSubmit={handleSendOTP} className="max-w-md mx-auto space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  placeholder="Enter your Gmail address"
                  required
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/10 p-4 rounded-xl">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !isOnline || cooldown > 0}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:bg-slate-400 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Mail size={20} />}
                {cooldown > 0 ? `Retry in ${cooldown}s` : 'Send Verification Code'}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 space-y-2">
                <Database className="text-indigo-500 mx-auto" size={24} />
                <h3 className="font-bold text-slate-900 dark:text-slate-50">Cloud Backup</h3>
                <p className="text-xs text-slate-500 font-medium">Automatic secure cloud storage</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 space-y-2">
                < Smartphone className="text-indigo-500 mx-auto" size={24} />
                <h3 className="font-bold text-slate-900 dark:text-slate-50">Multi-Device</h3>
                <p className="text-xs text-slate-500 font-medium">Access from mobile or desktop</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 space-y-2">
                <History className="text-indigo-500 mx-auto" size={24} />
                <h3 className="font-bold text-slate-900 dark:text-slate-50">Real-time</h3>
                <p className="text-xs text-slate-500 font-medium">Everything stays perfectly in sync</p>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'otp' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-[2rem] p-10 border border-slate-100 dark:border-slate-800 text-center space-y-8 max-w-md mx-auto"
          >
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Lock size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Verify Identity</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium px-4">
                We've sent a <span className="text-indigo-600 font-bold">Magic Link</span> or <span className="text-indigo-600 font-bold">6-digit code</span> to <span className="text-indigo-600 font-bold">{email}</span>
              </p>
              <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl mx-6 space-y-3 border border-indigo-100 dark:border-indigo-800/30">
                <p className="text-[12px] text-indigo-700 dark:text-indigo-300 font-bold leading-tight uppercase tracking-wider text-center">
                  Copy & Paste the 6-digit code below
                </p>
                <div className="h-px bg-indigo-100 dark:bg-indigo-800/40" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center italic">
                  Note: If the "Magic Link" button in your email says "site can't be reached", please simply copy the 6-digit code from the email and paste it here.
                </p>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 px-6">
                Please check <span className="text-rose-500">Inbox & Spam</span>.
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-6">
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="block w-full text-center text-4xl tracking-[0.5em] font-black py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-indigo-600 focus:border-indigo-500 transition-all"
                placeholder="000000"
                required
              />
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                Confirm Verification
              </button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={loading || cooldown > 0}
                  onClick={handleSendOTP}
                  className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend Code in ${cooldown}s` : "Didn't receive code? Resend"}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">OR</span>
                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-slate-500 font-medium">Already clicked the Magic Link?</p>
                <button
                  type="button"
                  onClick={() => refreshData()}
                  className="w-full py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-950 transition-all text-sm mb-4"
                >
                  Check Login Status
                </button>
              </div>
              <button 
                type="button"
                onClick={() => setStep('intro')}
                className="text-slate-500 text-sm font-bold hover:text-slate-900 dark:hover:text-slate-50 transition-colors"
              >
                Change Email Address
              </button>
            </form>
          </motion.div>
        )}

        {step === 'active' && (
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Sync is Active</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Successfully linked to {settings.user_email}</p>
                  </div>
                </div>
                <button 
                  onClick={handleDisableSync}
                  className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                >
                  <Unplug size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <History className="text-indigo-500" size={20} />
                     <span className="text-slate-900 dark:text-slate-50 font-bold">Last Sync</span>
                   </div>
                   <span className="text-sm text-slate-500 font-medium">
                     {syncStatus.success === 'Synced' ? 'Just now' : 'Pending...'}
                   </span>
                 </div>
                 <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <Database className="text-indigo-500" size={20} />
                     <span className="text-slate-900 dark:text-slate-50 font-bold">Cloud Storage</span>
                   </div>
                   <span className="text-sm text-emerald-500 font-bold uppercase tracking-wider">Enterprise</span>
                 </div>
              </div>

              <div className="pt-4 space-y-4">
                <button 
                  onClick={() => refreshData(undefined, true)}
                  disabled={syncStatus.loading}
                  className="w-full bg-slate-900 dark:bg-slate-50 text-white dark:text-slate-900 py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                >
                  {syncStatus.loading ? <Loader2 className="animate-spin" /> : <Cloud size={20} />}
                  Manual Cloud Refresh
                </button>
                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Only "Normal" companies are synced. HR companies remain local.</p>
                </div>
              </div>
            </motion.div>

            {/* Invitations Received */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence>
                {invitations.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-indigo-600 rounded-[2rem] p-8 text-white space-y-6 overflow-hidden col-span-1 md:col-span-2"
                  >
                    <div className="flex items-center gap-3">
                      <Mail size={24} />
                      <h3 className="text-xl font-black italic tracking-tight">New Invitations ({invitations.length})</h3>
                    </div>
                    <div className="space-y-4">
                      {invitations.map(invite => (
                        <div key={invite.id} className="bg-white/10 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <p className="font-black text-lg">{invite.companies?.name}</p>
                            <p className="text-xs font-bold opacity-70">From: {invite.owner_email}</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleUpdateStatus(invite.id, 'accepted')}
                              className="bg-white text-indigo-600 px-6 py-2 rounded-xl font-black text-sm hover:bg-indigo-50 transition-all"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(invite.id, 'rejected')}
                              className="bg-indigo-700 text-white px-6 py-2 rounded-xl font-black text-sm hover:bg-indigo-800 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Join by Code */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-amber-600">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">Join Company</h3>
                    <p className="text-xs text-slate-500 font-medium">Enter a 6-digit join code to access a company</p>
                  </div>
                </div>

                <form onSubmit={handleJoinByCode} className="space-y-4">
                  <input 
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-amber-500 font-black text-2xl tracking-[0.3em] text-center"
                  />
                  <button 
                    disabled={isJoining || joinCode.length < 6}
                    className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-amber-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                  >
                    {isJoining ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    Join with Code
                  </button>
                </form>
              </motion.div>

              {/* Invite New User (Owner only) */}
              {isOwner && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">Invite Team Member</h3>
                      <p className="text-xs text-slate-500 font-medium">Shared users can view and sync data</p>
                    </div>
                  </div>

                  <form onSubmit={handleInvite} className="space-y-4">
                    <input 
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@gmail.com"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 font-bold"
                    />
                    <button 
                      disabled={isInviting || !inviteEmail.includes('@')}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isInviting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                      Invite User
                    </button>
                  </form>
                </motion.div>
              )}
            </div>

            {/* Sent Invitations List */}
            {isOwner && sentInvitations.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sent Invitations</h4>
                  <span className="text-[10px] font-bold text-slate-400">Click a code to copy</span>
                </div>
                <div className="grid gap-3">
                  {sentInvitations.map(sent => (
                    <div key={sent.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black leading-none shrink-0">
                          {sent.shared_email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{sent.shared_email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                              sent.status === 'pending' ? "bg-amber-100 text-amber-600" : 
                              sent.status === 'accepted' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                            )}>
                              {sent.status}
                            </span>
                            {sent.join_code && (
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(sent.join_code);
                                  alert(`Code ${sent.join_code} copied!`);
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                              >
                                Code: {sent.join_code}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          const { revokeCompanyAccess } = useApp() as any;
                          revokeCompanyAccess(currentCompany!.id, sent.shared_email);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-500 self-end sm:self-auto"
                        title="Revoke Access"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
