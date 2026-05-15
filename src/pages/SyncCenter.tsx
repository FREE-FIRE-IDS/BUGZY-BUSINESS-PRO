import React, { useState } from 'react';
import { 
  Cloud, 
  Mail, 
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
    settings, updateSettings, refreshData, manualSyncLogin, quickVerify, confirmSyncLogin, isOnline, syncStatus, signOut, session,
    currentCompany, shareCompany, invitations, fetchInvitations, updateInvitationStatus, sentInvitations, fetchSentInvitations,
    revokeCompanyAccess, isAdmin
  } = useApp();
  const [email, setEmail] = useState(settings.user_email || '');
  const [step, setStep] = useState((settings.sync_enabled && settings.is_verified) || session ? 'active' : 'intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  React.useEffect(() => {
    if (isAdmin) {
      console.log('[SyncCenter] Admin mode enabled');
    }
    const isVerified = (settings.sync_enabled && settings.is_verified) || !!session;
    if (isVerified && step !== 'active') {
      console.log('[SyncCenter] Force transitioning to active step based on state');
      setStep('active');
    }
  }, [settings.sync_enabled, settings.is_verified, session, step]);

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
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const isOwner = !!(currentCompany && (
    isAdmin || 
    (currentCompany.owner_email && (currentCompany.owner_email.toLowerCase() === (session?.user?.email || settings.user_email || '').toLowerCase().trim())) ||
    (!currentCompany.owner_email && currentCompany.user_email?.toLowerCase() === (session?.user?.email || settings.user_email || '').toLowerCase().trim())
  ));

  const handleEnableSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@') || loading) return;
    
    setLoading(true);
    setError(null);
    try {
      console.log('[SyncCenter] Attempting quick verification...');
      const success = await quickVerify(email);
      if (success) {
        console.log('[SyncCenter] Quick verification done, moving to active');
        setStep('active');
        alert('Cloud Sync Enabled! 🚀 Data is now syncing with ' + email);
      } else {
        setError('Verification failed. Please check your email.');
      }
    } catch (err: any) {
      console.error('[Quick Verify Error Stage]', err);
      setError(err.message || 'Verification failed. Please try again.');
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
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Manage your multi-device synchronization</p>
              {settings.sync_enabled && settings.user_email && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold text-slate-500">
                  {settings.user_email}
                </span>
              )}
            </div>
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
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Cloud Sync is Disabled</h2>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Link your Gmail account to enable instant real-time sync and secure cloud backup across all your devices.
              </p>
            </div>

            <form onSubmit={handleEnableSync} className="max-w-md mx-auto space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
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
                disabled={loading || !isOnline}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:bg-slate-400 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Cloud size={20} />}
                Enable Instant Sync
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
                    <Cloud size={28} />
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

            {/* Manage Shared Users Section */}
            <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600">
                  <Database size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Team & Shared Access</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {isOwner ? 'Control who can access this business data' : 'View members with access to this business'}
                  </p>
                </div>
              </div>
            </div>

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
                            <p className="font-black text-lg">{invite.companies?.name || 'Shared Company'}</p>
                            <p className="text-xs font-bold opacity-70">From: {invite.invited_by}</p>
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

            {/* Team Members List (Only for Owner or Admin) */}
            {isOwner && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm mb-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Team Members</h4>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => currentCompany && fetchSentInvitations(currentCompany.id)}
                      className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest"
                    >
                      Refresh
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 italic font-sans animate-pulse">Owner View</span>
                  </div>
                </div>
                
                {sentInvitations.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 dark:bg-slate-950/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 italic">No team members invited yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {sentInvitations.map(sent => (
                      <div key={sent.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-100 dark:border-indigo-800">
                            {sent.invited_email?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{sent.invited_email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                sent.status === 'pending' ? "bg-amber-100 text-amber-600 dark:bg-amber-900/20" : 
                                sent.status === 'accepted' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20" : 
                                "bg-rose-100 text-rose-600 dark:bg-rose-900/20"
                              )}>
                                {sent.status === 'accepted' ? 'Active Member' : sent.status}
                              </span>
                              {sent.status === 'pending' && <span className="text-[8px] font-bold text-slate-400 italic">Waiting for response</span>}
                            </div>
                          </div>
                        </div>
                        
                        <button 
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete access for ${sent.invited_email}?`)) {
                              await revokeCompanyAccess(currentCompany!.id, sent.invited_email);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all uppercase tracking-wider"
                          title="Revoke Access"
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
