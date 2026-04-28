import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Users, 
  Briefcase, 
  ShieldAlert, 
  X, 
  ChevronRight,
  Globe,
  HardDrive,
  Mail,
  MoreVertical,
  LogOut,
  Settings as SettingsIcon,
  RefreshCw,
  Share2
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function ManageCompanies() {
  const { 
    companies, currentCompany, setCurrentCompany, addCompany, deleteCompany,
    syncStatus, settings, sendInvitation,
    getSharedCompanies, refreshData
  } = useApp();

  const [activeTab, setActiveTab] = useState<'my' | 'shared' | 'hr'>('my');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<'normal' | 'hr'>('normal');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharedCompanies, setSharedCompanies] = useState<any[]>([]);
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  useEffect(() => {
    if (activeTab === 'shared') {
      loadShared();
    }
  }, [activeTab]);

  const loadShared = async () => {
    setIsLoadingShared(true);
    try {
      const shared = await getSharedCompanies();
      setSharedCompanies(shared);
    } catch (e) {
      console.error('Failed to load shared companies:', e);
    } finally {
      setIsLoadingShared(false);
    }
  };

  const handleAddCompany = async () => {
    try {
      await addCompany({
        name: newCompanyName,
        company_type: newCompanyType,
        currency: settings.currency || 'PKR',
        address: '',
      });
      setIsAddModalOpen(false);
      setNewCompanyName('');
    } catch (e: any) {
      alert(e.message || 'Failed to add company');
    }
  };

  const handleShare = async () => {
    if (!isShareModalOpen) return;
    try {
      await sendInvitation(shareEmail);
      setIsShareModalOpen(null);
      setShareEmail('');
      alert('Invitation sent! 🚀');
    } catch (e: any) {
      alert(e.message || 'Failed to share');
    }
  };

  const myCompanies = companies.filter(c => c.company_type !== 'hr');
  const hrCompanies = companies.filter(c => c.company_type === 'hr');

  const renderCompanyCard = (company: any, isShared = false) => {
    const isActive = currentCompany?.id === company.id;
    const isHR = company.company_type === 'hr';
    const isOwner = company.my_role === 'OWNER';

    return (
      <motion.div
        key={company.id}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative group overflow-hidden p-6 rounded-[2rem] border transition-all cursor-pointer",
          isActive 
            ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 border-indigo-600" 
            : "bg-white border-slate-100 hover:border-indigo-200 shadow-sm"
        )}
        onClick={async () => {
            try {
              await setCurrentCompany(company);
              if (company.company_type === 'normal' || isShared) {
                  refreshData(undefined).catch(console.error);
              }
            } catch (err: any) {
              alert(err.message);
            }
        }}
      >
        <div className="flex justify-between items-start mb-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl",
            isActive ? "bg-white/20" : "bg-indigo-50 text-indigo-600"
          )}>
            {isHR ? <Briefcase size={20} /> : <Building2 size={20} />}
          </div>
          <div className="flex items-center gap-2">
            {!isShared && isOwner && (
               <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsShareModalOpen(company.id);
                }}
                className={cn(
                    "p-2 rounded-xl transition-all",
                    isActive ? "hover:bg-white/20 text-white/70" : "hover:bg-slate-100 text-slate-400"
                )}
               >
                <Share2 size={16} />
               </button>
            )}
            {isOwner && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteModalOpen(company.id);
                }}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  isActive ? "hover:bg-white/20 text-white/70" : "hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                )}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <h3 className="text-lg font-black">{company.name}</h3>
        <p className={cn(
          "text-xs font-bold mt-1 opacity-70",
          isActive ? "text-white" : "text-slate-500"
        )}>
          {isShared ? `Shared by: ${company.owner_email || 'Owner'}` : `${company.currency || 'PKR'} • ${isHR ? 'Offline Only' : 'Cloud Enabled'}`}
        </p>

        {isActive && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Active</span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Manage Companies</h1>
          <p className="text-slate-500 font-medium">Switch between your business entities</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-3xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/25"
        >
          <Plus size={20} />
          Create New Company
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-slate-100 rounded-3xl w-full max-w-md mb-8">
        <button 
          onClick={() => setActiveTab('my')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'my' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
          )}
        >
          <Building2 size={16} />
          My Data
        </button>
        <button 
          onClick={() => setActiveTab('shared')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'shared' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
          )}
        >
          <Users size={16} />
          Shared With Me
        </button>
        <button 
          onClick={() => setActiveTab('hr')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'hr' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-white/50"
          )}
        >
          <Briefcase size={16} />
          HR (Offline)
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeTab === 'my' && (
          <>
            {myCompanies.length === 0 && (
               <div className="col-span-full py-20 text-center">
                 <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-400">
                    <Building2 size={40} />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900">No companies found</h3>
                 <p className="text-slate-500 mt-2">Create your first company to get started!</p>
               </div>
            )}
            {myCompanies.map(c => renderCompanyCard(c))}
          </>
        )}

        {activeTab === 'shared' && (
          <>
            {isLoadingShared ? (
              <div className="col-span-full py-20 text-center">
                <RefreshCw size={40} className="mx-auto text-indigo-500 animate-spin mb-4" />
                <p className="font-bold text-slate-500">Checking for invitations...</p>
              </div>
            ) : sharedCompanies.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                 <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-400">
                    <Mail size={40} />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900">No shared companies</h3>
                 <p className="text-slate-500 mt-2">Companies shared with your email will appear here.</p>
              </div>
            ) : (
              sharedCompanies.map(c => renderCompanyCard(c, true))
            )}
          </>
        )}

        {activeTab === 'hr' && (
           <>
              {hrCompanies.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-slate-400">
                      <HardDrive size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">No HR companies</h3>
                  <p className="text-slate-500 mt-2">HR companies are fully offline and isolated.</p>
                </div>
              )}
              {hrCompanies.map(c => renderCompanyCard(c))}
           </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-2xl font-black">New Company</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Company Name</label>
                  <input 
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all"
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Company Type</label>
                  <div className="grid grid-cols-2 gap-4">
                     <button 
                      onClick={() => setNewCompanyType('normal')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                        newCompanyType === 'normal' ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-slate-100 hover:border-slate-200"
                      )}
                     >
                        <Globe size={20} />
                        <span className="font-bold text-sm">Normal (Sync)</span>
                     </button>
                     <button 
                      onClick={() => setNewCompanyType('hr')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                        newCompanyType === 'hr' ? "border-indigo-600 bg-indigo-50 text-indigo-600" : "border-slate-100 hover:border-slate-200"
                      )}
                     >
                        <HardDrive size={20} />
                        <span className="font-bold text-sm">HR (Offline)</span>
                     </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 font-medium flex items-center gap-1">
                    <ShieldAlert size={12} />
                    {newCompanyType === 'hr' 
                      ? 'HR Companies are strictly offline and never sync to cloud.' 
                      : 'Normal companies sync to cloud and can be shared.'}
                  </p>
                </div>
                <button 
                  onClick={handleAddCompany}
                  disabled={!newCompanyName.trim()}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  Create Company
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isShareModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
             >
               <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                 <div>
                   <h2 className="text-2xl font-black">Share Company</h2>
                   <p className="text-xs text-slate-500 font-bold">Invite others to access this company</p>
                 </div>
                 <button onClick={() => setIsShareModalOpen(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                   <X size={20} />
                 </button>
               </div>
               <div className="p-8 space-y-6">
                 <div>
                   <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-2">Recipient Email</label>
                   <div className="relative">
                     <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input 
                       type="email"
                       value={shareEmail}
                       onChange={(e) => setShareEmail(e.target.value)}
                       className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-indigo-500 font-bold transition-all"
                       placeholder="user@gmail.com"
                     />
                   </div>
                 </div>
                 <button 
                   onClick={handleShare}
                   disabled={!shareEmail.includes('@')}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   <Share2 size={18} />
                   Send Invitation
                 </button>
               </div>
             </motion.div>
           </div>
        )}

        {isDeleteModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm">
           <motion.div 
             initial={{ opacity: 0, scale: 0.95, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 text-center"
           >
             <div className="w-20 h-20 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-rose-600">
               <Trash2 size={40} />
             </div>
             <h3 className="text-2xl font-black mb-2 text-rose-600">Delete Company?</h3>
             <p className="text-slate-500 mb-8 font-medium">This will permanently delete the company and all its data. This action cannot be undone.</p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setIsDeleteModalOpen(null)}
                 className="flex-1 px-4 py-4 rounded-2xl font-black border-2 border-slate-100 hover:bg-slate-50 transition-all"
               >
                 Cancel
               </button>
               <button 
                 onClick={async () => {
                    await deleteCompany(isDeleteModalOpen);
                    setIsDeleteModalOpen(null);
                 }}
                 className="flex-1 px-4 py-4 rounded-2xl font-black bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20"
               >
                 Delete
               </button>
             </div>
           </motion.div>
         </div>
        )}
      </AnimatePresence>
    </div>
  );
}
