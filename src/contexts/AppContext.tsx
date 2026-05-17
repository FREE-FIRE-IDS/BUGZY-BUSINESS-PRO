import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Company, Party, BankAccount, InventoryItem as Item, Transaction, AppSettings, Invoice, PaymentRequest, License, Subscription } from '../types';
import { supabase } from '../lib/supabase';
import { addDays, isAfter } from 'date-fns';

interface AppContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => void;
  parties: Party[];
  banks: BankAccount[];
  items: Item[];
  transactions: Transaction[];
  invoices: Invoice[];
  settings: AppSettings;
  syncStatus: { loading: boolean; error: string | null; success: string | null };
  updateSettings: (settings: Partial<AppSettings>) => void;
  refreshData: (emailOverride?: string) => Promise<void>;
  pullCompanies: (email: string) => Promise<boolean>;
  generateVerificationCode: (email: string) => Promise<string>;
  verifyCode: (code: string) => Promise<boolean>;
  linkDevice: (email: string) => Promise<boolean>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'created_at'>) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  addParty: (party: Omit<Party, 'id' | 'created_at'>) => Promise<void>;
  updateParty: (id: string, party: Partial<Party>) => Promise<void>;
  deleteParty: (id: string, hard?: boolean) => Promise<void>;
  addBank: (bank: Omit<BankAccount, 'id' | 'created_at'>) => Promise<void>;
  updateBank: (id: string, bank: Partial<BankAccount>) => Promise<void>;
  deleteBank: (id: string, hard?: boolean) => Promise<void>;
  addItem: (item: Omit<Item, 'id' | 'created_at'>) => Promise<void>;
  updateItem: (id: string, item: Partial<Item>) => Promise<void>;
  deleteItem: (id: string, hard?: boolean) => Promise<void>;
  deleteTransaction: (id: string, hard?: boolean) => Promise<void>;
  addCompany: (company: Omit<Company, 'id' | 'created_at'>, licenseKey?: string) => Promise<void>;
  updateCompany: (id: string, company: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  backupData: () => void;
  restoreData: (json: string) => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'created_at'>) => Promise<void>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string, hard?: boolean) => Promise<void>;
  submitPaymentRequest: (data: {
    user_name: string;
    username?: string;
    account_name: string;
    phone: string;
    amount: number;
    plan: 'monthly' | 'yearly';
    screenshot_url?: string;
  }) => Promise<void>;
  fetchPaymentRequests: () => Promise<PaymentRequest[]>;
  updatePaymentRequestStatus: (id: string, status: 'approved' | 'rejected', companyId: string) => Promise<void>;
  paymentStatus: 'none' | 'pending' | 'approved' | 'rejected';
  activateLicense: (key: string) => Promise<void>;
  fetchLicenses: () => Promise<License[]>;
  resetLicenseDevice: (id: string) => Promise<void>;
  isDeviceLicensed: boolean;
  licenseExpiry: string | null;
  isTrialExpired: boolean;
  isLicensed: () => boolean;
  loginWithUsername: (username: string, isLogin?: boolean) => Promise<boolean>;
  isAdmin: boolean;
  selectedPartyId: string | null;
  setSelectedPartyId: (id: string | null) => void;
  selectedBankId: string | null;
  setSelectedBankId: (id: string | null) => void;
  session: any;
  signOut: () => Promise<void>;
  restoreCompany: (code: string) => Promise<boolean>;
  isOnline: boolean;
  manualSyncLogin: (email: string) => Promise<string>;
  quickVerify: (email: string) => Promise<boolean>;
  verifySyncCode: (email: string, token: string) => Promise<boolean>;
  confirmSyncLogin: (email: string, token: string) => Promise<boolean>;
  shareCompany: (companyId: string, shareWithEmail: string) => Promise<void>;
  revokeCompanyAccess: (companyId: string, sharedEmail: string) => Promise<void>;
  getSharedCompanies: () => Promise<Company[]>;
  addTransactions: (txs: Omit<Transaction, 'id' | 'created_at'>[]) => Promise<void>;
  invitations: any[];
  fetchInvitations: () => Promise<void>;
  updateInvitationStatus: (inviteId: string, status: 'accepted' | 'rejected') => Promise<void>;
  sentInvitations: any[];
  fetchSentInvitations: (companyId: string) => Promise<void>;
  getPartyBalance: (partyId: string) => number;
  getBankBalance: (bankId: string) => number;
  isSharedCompany: (company?: Company | null) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mergeData = <T extends { id: string; updated_at?: string; created_at?: string; deleted_at?: string | null; _synced?: boolean }>(
  local: T[],
  cloud: T[]
): { merged: T[]; toUpload: T[] } => {
  const mergedMap = new Map<string, T>();
  const toUploadMap = new Map<string, T>();

  // Mark all cloud items as synced
  const cloudItems = cloud.filter(Boolean).map(item => ({ ...item, _synced: true }));
  const cloudIds = new Set(cloudItems.filter(c => c?.id).map(c => c.id));

  // Start with local data
  local.filter(Boolean).forEach(item => {
    if (item?.id) mergedMap.set(item.id, item);
  });

  // Merge cloud data
  cloudItems.forEach(cloudItem => {
    const localItem = mergedMap.get(cloudItem.id);
    if (!localItem) {
      // Only in cloud, add to merged
      mergedMap.set(cloudItem.id, cloudItem);
    } else {
      // In both, resolve conflict based on updated_at
      const localTime = new Date(localItem.updated_at || localItem.created_at || 0).getTime();
      const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at || 0).getTime();

      if (cloudTime > localTime) {
        // Cloud is newer, but preserve local fields not in cloud (like 'unit' if DB isn't updated)
        mergedMap.set(cloudItem.id, { ...localItem, ...cloudItem });
      } else if (localTime > cloudTime) {
        // Local is newer, mark for upload
        toUploadMap.set(localItem.id, localItem);
      } else {
        // Same time, ensure local is marked as synced
        mergedMap.set(cloudItem.id, { ...localItem, _synced: true });
      }
    }
  });

  // Local items not in cloud
  local.forEach(localItem => {
    if (!cloudIds.has(localItem.id)) {
      if (localItem._synced) {
        // Was previously synced but now missing from cloud -> it was deleted in cloud
        // We should remove it from mergedMap (it will be filtered out by deleted_at check later if we keep it, but better to remove)
        mergedMap.delete(localItem.id);
      } else {
        // Never synced -> it's a new local item, needs upload
        toUploadMap.set(localItem.id, localItem);
      }
    }
  });

  return {
    merged: Array.from(mergedMap.values()),
    toUpload: Array.from(toUploadMap.values())
  };
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('currentUser'));
  
  const [companies, setCompanies] = useState<Company[]>(() => {
    if (typeof window === 'undefined') return [];
    const user = localStorage.getItem('currentUser');
    if (!user) return [];
    const saved = localStorage.getItem(`companies_${user}`);
    return saved ? JSON.parse(saved).filter((c: any) => !c.deleted_at) : [];
  });

  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('currentUser');
    if (!user) return null;
    const saved = localStorage.getItem(`currentCompany_${user}`);
    if (saved) return JSON.parse(saved);
    // Fallback to first company
    const savedCompanies = localStorage.getItem(`companies_${user}`);
    if (savedCompanies) {
      const parsed = JSON.parse(savedCompanies).filter((c: any) => !c.deleted_at);
      return parsed[0] || null;
    }
    return null;
  });
  const [parties, setParties] = useState<Party[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [leavingIds, setLeavingIds] = useState<string[]>([]);
  
  // Re-sync state when currentUser changes (e.g. after restore or login)
  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`companies_${currentUser}`);
      if (saved) {
        const parsed = JSON.parse(saved).filter((c: any) => !c.deleted_at);
        setCompanies(parsed);
        companiesRef.current = parsed;
      }
    } else {
      setCompanies([]);
      companiesRef.current = [];
    }
  }, [currentUser]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const currentCompanyIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    currentCompanyIdRef.current = currentCompany?.id || null;
  }, [currentCompany]);

  // Load data when user or company changes
  useEffect(() => {
    if (!currentUser) {
      setCompanies([]);
      setCurrentCompany(null);
      return;
    }

    const savedCompanies = localStorage.getItem(`companies_${currentUser}`);
    const loadedCompanies = savedCompanies ? JSON.parse(savedCompanies) : [];
    setCompanies(loadedCompanies);

    const savedCurrent = localStorage.getItem(`currentCompany_${currentUser}`);
    const loadedCurrent = savedCurrent ? JSON.parse(savedCurrent) : (loadedCompanies[0] || null);
    setCurrentCompany(loadedCurrent);
  }, [currentUser]);

  useEffect(() => {
    if (!currentCompany || !currentUser) {
      setParties([]);
      setBanks([]);
      setItems([]);
      setTransactions([]);
      setInvoices([]);
      hasInitialSynced.current = {};
      return;
    }

    const id = currentCompany.id;
    const load = (key: string) => {
      const saved = localStorage.getItem(`${key}_${id}`);
      try {
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error(`Failed to parse ${key} for ${id}:`, e);
        return [];
      }
    };

    // Load instantly from cache
    setParties(load('parties'));
    setBanks(load('banks'));
    setItems(load('items'));
    setTransactions(load('transactions'));
    setInvoices(load('invoices'));

    // Trigger sync if enabled
    if (settings.sync_enabled) {
      refreshData(undefined, true).catch(err => console.error('Switch Company Refresh Error:', err));
    }
  }, [currentCompany?.id, currentUser]);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app_settings');
    const defaultSettings: AppSettings = {
      theme: 'light',
      currency: 'PKR',
      pdf_theme: 'standard',
      sync_enabled: true,
      onboarding_completed: false,
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; error: string | null; success: string | null }>({
    loading: false,
    error: null,
    success: null
  });
  const [paymentStatus, setPaymentStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);

  // Real-time license listener
  useEffect(() => {
    const userId = session?.user?.id || currentUser;
    if (!userId) return;

    const checkLicense = async () => {
      // Do not perform license check if offline to prevent incorrect deactivation
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('Skipping license check: Device is offline');
        return;
      }

      try {
        const currentKey = localStorage.getItem('active_license_key');
        
        // Master key bypass - never check/deactivate if master key is used
        if (currentKey === 'MASTER-KEY' || currentKey === '16897463890072' || settings.user_email === 'sudaiskamran31@gmail.com') {
          setIsDeviceLicensed(true);
          return;
        }

        // Select specific fields for maximum compatibility
        const { data, error } = await supabase
          .from('licenses')
          .select('id, user_id, user_email, license_key, status, expiry_at, devices')
          .eq('status', 'active')
          .or(`user_id.eq.${userId},user_email.eq.${userId},user_email.eq.${session?.user?.email || settings.user_email}`)
          .maybeSingle();

        if (error) {
          console.log('Error checking license, trying fallback by key...');
          if (currentKey) {
             const { data: fallbackData } = await supabase
               .from('licenses')
               .select('*')
               .eq('license_key', currentKey)
               .maybeSingle();
             if (fallbackData) { 
               setIsDeviceLicensed(true); 
               return; 
             }
          }
          return;
        }

        if (data) {
          // If we found a valid license for this user, activate it locally
          // We loosen the device check here to prevent the "again key" loop
          // But still save the device if possible
          const deviceId = localStorage.getItem('device_id');
          localStorage.setItem('device_license', 'true');
          localStorage.setItem('active_license_key', data.license_key);
          setIsDeviceLicensed(true);

          if (data.expiry_at) {
              setLicenseExpiry(data.expiry_at);
              localStorage.setItem('license_expiry', data.expiry_at);
          }
        } else {
          // Only deactivate if explicitly NOT FOUND and we are not an admin
          if (currentKey !== 'MASTER-KEY' && settings.user_email !== 'sudaiskamran31@gmail.com') {
            console.log('No active license found in cloud for this user');
            // We don't forcefully setIsDeviceLicensed(false) here to avoid loops
            // if they just activated it. We only do it if they have NO key at all.
            if (!currentKey) {
              setIsDeviceLicensed(false);
              localStorage.removeItem('device_license');
            }
          }
        }
      } catch (err) {
        console.error('License check error:', err);
      }
    };

    checkLicense();

    // Subscribe to changes in licenses table for this user
    const channel = supabase
      .channel(`user-license-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'licenses',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newLicense = payload.new as License;
            if (newLicense.status === 'active') {
              localStorage.setItem('device_license', 'true');
              localStorage.setItem('active_license_key', newLicense.license_key);
              setIsDeviceLicensed(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, currentUser]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.email) {
        setSettings(prev => ({ ...prev, user_email: session.user.email, is_verified: true, sync_enabled: true }));
        setCurrentUser(session.user.email);
        localStorage.setItem('currentUser', session.user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.email) {
        setSettings(prev => ({ ...prev, user_email: session.user.email, is_verified: true, sync_enabled: true }));
        setCurrentUser(session.user.email);
        localStorage.setItem('currentUser', session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasInitialSynced = React.useRef<Record<string, boolean>>({});
  const isInternalUpdate = React.useRef(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshData(undefined, true); // Pull fresh data when coming back online
    };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => {
      if (navigator.onLine) {
        refreshData(undefined, true); // Refresh when user returns to tab
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`companies_${currentUser}`, JSON.stringify(companies));
    }
  }, [companies, currentUser]);

  useEffect(() => {
    if (currentUser && companies.length === 0 && !syncStatus.loading) {
      console.log(`[Auto-Sync] No companies found for ${currentUser}, triggering refresh...`);
      refreshData(undefined, true);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentCompany) {
      localStorage.setItem('currentCompany', JSON.stringify(currentCompany));
    } else {
      localStorage.removeItem('currentCompany');
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!settings.user_email) return;

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, (payload) => {
        const email = settings.user_email?.toLowerCase();
        const newData = payload.new as any;
        const oldData = payload.old as any;
        
        const hasAccess = (d: any) => d && (
          d.user_email?.toLowerCase() === email || 
          (d.linked_emails && d.linked_emails.includes(email)) || 
          d.owner_email?.toLowerCase() === email
        );

        if (hasAccess(newData) || hasAccess(oldData)) {
          if (hasAccess(newData)) {
            const updatedCompany = newData as Company;
            setCompanies(prev => {
              const exists = prev.find(c => c.id === updatedCompany.id);
              if (exists) {
                if (JSON.stringify(exists) === JSON.stringify(updatedCompany)) return prev;
                return prev.map(c => c.id === updatedCompany.id ? updatedCompany : c);
              }
              return [...prev, updatedCompany];
            });
            if (currentCompany?.id === updatedCompany.id) {
              if (JSON.stringify(currentCompany) !== JSON.stringify(updatedCompany)) {
                setCurrentCompany(updatedCompany);
              }
            }
          } else {
            // Access was lost (either deleted from DB or user removed from permission)
            const targetId = newData?.id || oldData?.id;
            if (targetId) {
              setCompanies(prev => prev.filter(c => c.id !== targetId));
              if (currentCompany?.id === targetId) {
                setCurrentCompany(null);
                toast.error('Your access to this business has been updated 🔐');
              }
            }
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parties' }, (payload) => {
        const data = (payload.new || payload.old) as any;
        if (currentCompany?.id === data.company_id) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setParties(prev => {
              const exists = prev.find(p => p.id === data.id);
              if (exists) return prev.map(p => p.id === data.id ? data : p);
              return [...prev, data];
            });
          } else if (payload.eventType === 'DELETE') {
            setParties(prev => prev.filter(p => p.id === data.id));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, (payload) => {
        const data = (payload.new || payload.old) as any;
        if (currentCompany?.id === data.company_id) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setBanks(prev => {
              const exists = prev.find(b => b.id === data.id);
              if (exists) return prev.map(b => b.id === data.id ? data : b);
              return [...prev, data];
            });
          } else if (payload.eventType === 'DELETE') {
            setBanks(prev => prev.filter(b => b.id === data.id));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        const data = (payload.new || payload.old) as any;
        if (currentCompany?.id === data.company_id) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setItems(prev => {
              const exists = prev.find(i => i.id === data.id);
              if (exists) return prev.map(i => i.id === data.id ? data : i);
              return [...prev, data];
            });
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id === data.id));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        const data = (payload.new || payload.old) as any;
        if (currentCompany?.id === data.company_id) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setTransactions(prev => {
              const exists = prev.find(t => t.id === data.id);
              if (exists) return prev.map(t => t.id === data.id ? data : t);
              return [...prev, data];
            });
          } else if (payload.eventType === 'DELETE') {
            setTransactions(prev => prev.filter(t => t.id === data.id));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, (payload) => {
        const data = (payload.new || payload.old) as any;
        if (currentCompany?.id === data.company_id) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setInvoices(prev => {
              const exists = prev.find(i => i.id === data.id);
              if (exists) return prev.map(i => i.id === data.id ? data : i);
              return [...prev, data];
            });
          } else if (payload.eventType === 'DELETE') {
            setInvoices(prev => prev.filter(i => i.id === data.id));
          }
        }
      })
      .subscribe();

    // Real-time access channel (Restrict to sessions to avoid RLS errors for guest users)
    let accessChannel: any = null;
    if (session) {
      accessChannel = supabase
        .channel('access-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_invites' }, (payload) => {
          const email = (session?.user?.email || settings.user_email || '').toLowerCase().trim();
          if (!email) return;

          const data = (payload.new || payload.old) as any;
          if (data.invited_email?.toLowerCase() === email) {
            fetchInvitations().catch(console.error);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_members' }, (payload) => {
          const email = (session?.user?.email || settings.user_email || '').toLowerCase().trim();
          if (!email) return;

          const data = (payload.new || payload.old) as any;
          if (data.user_email?.toLowerCase() === email) {
            refreshData(undefined, true).catch(console.error);
          }
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (accessChannel) supabase.removeChannel(accessChannel);
    };
  }, [settings.user_email, currentCompany?.id]);

  const refreshData = async (emailOverride?: string, force = false, companyIdOverride?: string) => {
    const email = emailOverride || settings.user_email;
    const username = currentUser;
    
    if (!settings.sync_enabled || (!email && !username)) return;
    
    const activeCompanyId = companyIdOverride || currentCompany?.id;

    // Prevent redundant syncs unless forced
    if (!force && activeCompanyId && hasInitialSynced.current[activeCompanyId]) {
      console.log(`[Sync] Skipping redundant sync for ${activeCompanyId}`);
      return;
    }

    setSyncStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      // 1. Pull Companies
      const fetchCompanies = async () => {
        if (email) {
          // Default to RPC as it's more robust for shared companies
          const { data, error } = await supabase.rpc('get_companies_for_email', { req_email: email });
          if (!error) return { data, error };
          
          // Fallback to direct query if RPC fails
          console.warn('[Sync] RPC fetch error, falling back to direct query:', error);
          return supabase.from('companies').select('*')
            .or(`user_email.eq."${email}",linked_emails.cs.{"${email}"},owner_email.eq."${email}"`);
        } else if (username) {
          return supabase.from('companies').select('*').eq('username', username);
        } else {
          return supabase.from('companies').select('*');
        }
      };

      const localCompanies = companiesRef.current;
      let { data: cloudCompanies, error: compError } = await fetchCompanies();
      
      if (compError) {
        console.error('Error fetching companies:', compError);
        // Final broad fallback
        const { data: fallback, error: fallError } = await supabase.from('companies').select('*');
        if (!fallError) {
          cloudCompanies = fallback.filter(c => 
            c.user_email === email || 
            c.owner_email === email || 
            (c.linked_emails && c.linked_emails.includes(email))
          );
        }
        
        if (!cloudCompanies && localCompanies.length === 0) {
            setSyncStatus({ loading: false, error: 'Failed to connect to cloud: ' + compError.message, success: null });
            return;
        }
      }
      
      const { merged: mergedCompanies, toUpload: companiesToUpload } = mergeData<Company>(localCompanies, (cloudCompanies as Company[]) || []);
      
      const nonDeletedCompanies = mergedCompanies.filter(c => !c.deleted_at) as Company[];
      if (JSON.stringify(companies) !== JSON.stringify(nonDeletedCompanies)) {
        setCompanies(nonDeletedCompanies);
      }
      localStorage.setItem(`companies_${username || email || currentUser}`, JSON.stringify(mergedCompanies));

      if (companiesToUpload.length > 0) {
        await syncToCloud('companies', companiesToUpload);
      }
      
      let activeCompany = currentCompany;
      // If we have an active company, check if it's still available after sync/leave
      if (activeCompany) {
        const found = nonDeletedCompanies.find(c => c.id === activeCompany?.id);
        if (found) {
          // If found and different, update it
          if (JSON.stringify(activeCompany) !== JSON.stringify(found)) {
            setCurrentCompany(found);
            activeCompany = found;
          }
        } else {
          // If NOT found (user left or deleted), set to null or first available
          if (nonDeletedCompanies.length > 0) {
            activeCompany = nonDeletedCompanies[0];
            setCurrentCompany(activeCompany);
          } else {
            activeCompany = null;
            setCurrentCompany(null);
          }
        }
      } else if (nonDeletedCompanies.length > 0) {
        activeCompany = nonDeletedCompanies[0];
        setCurrentCompany(activeCompany);
      }

      if (!activeCompany) {
          setSyncStatus({ loading: false, error: null, success: null });
          return;
      }

      // 2. Multi-Company Detail Sync (Sync active first, then others)
      const otherCompanies = nonDeletedCompanies.filter(c => c.id !== activeCompany?.id);

      const syncOneCompany = async (comp: Company) => {
        if (comp.company_type === 'hr') return; // Strictly offline
        const tables = ['parties', 'banks', 'items', 'transactions', 'invoices'];
        
        return Promise.allSettled(tables.map(async (table) => {
          try {
            const dbTable = table === 'items' ? 'inventory' : table;
            const setter = table === 'parties' ? setParties : 
                           table === 'banks' ? setBanks : 
                           table === 'items' ? setItems : 
                           table === 'transactions' ? setTransactions : setInvoices;

            let query;
            if (!session && email) {
              query = supabase.rpc('get_table_data_by_email', { 
                req_company_id: comp.id, 
                req_email: email,
                req_table: dbTable 
              });
            } else {
              query = supabase.from(dbTable).select('*').eq('company_id', comp.id);
            }

            const { data, error } = await query;
            if (error) {
              if (error.code === 'PGRST116' || error.message.includes('relation')) return;
              throw error;
            }
            
            const localKey = `${table}_${comp.id}`;
            const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
            const { merged, toUpload } = mergeData<any>(Array.isArray(localData) ? localData : [], Array.isArray(data) ? data : []);
            
            localStorage.setItem(localKey, JSON.stringify(merged));
            if (comp.id === currentCompanyIdRef.current) {
              isInternalUpdate.current = true;
              setter(merged.filter(i => i && (!i.deleted_at || i.deleted_at === '')));
              isInternalUpdate.current = false;
            }
            
            if (toUpload.length > 0 && settings.sync_enabled) {
              await syncToCloud(table, toUpload, false, comp.id);
            }
          } catch (err) {
            console.error(`Sync error for ${table} in ${comp.name}:`, err);
          }
        }));
      };

      // 3. Sync individual companies sequentially to prevent network saturation and state races
      if (activeCompany) {
          await syncOneCompany(activeCompany);
          hasInitialSynced.current[activeCompany.id] = true;
      }
      
      // Sync others in background without awaiting, but sequentially to be gentle
      const syncOthers = async () => {
        for (const comp of otherCompanies) {
          if (!comp || comp.id === activeCompany?.id) continue;
          await syncOneCompany(comp);
          hasInitialSynced.current[comp.id] = true;
        }
      };
      
      syncOthers().catch(console.error);
      fetchInvitations().catch(console.error);

      setSyncStatus({ loading: false, error: null, success: 'Synced' });
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus({ loading: false, error: error.message, success: null });
    } finally {
      setSyncStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const linkDevice = async (email: string) => {
    if (!currentCompany) return false;
    const linkedEmails = currentCompany.linked_emails || [];
    if (linkedEmails.includes(email)) return true;
    
    const updatedCompany = { ...currentCompany, linked_emails: [...linkedEmails, email] };
    await updateCompany(currentCompany.id, updatedCompany);
    setSyncStatus({ loading: false, error: null, success: `Device ${email} linked successfully!` });
    return true;
  };

  const companiesRef = React.useRef<Company[]>(companies);
  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  const pullCompanies = async (email?: string) => {
    const targetEmail = (email || settings.user_email || session?.user?.email || '').toLowerCase().trim();
    const username = currentUser;
    
    if (!targetEmail && !username) {
      setSyncStatus({ loading: false, error: 'No email or username found to pull data', success: null });
      return false;
    }
    
    setSyncStatus({ loading: true, error: null, success: null });
    try {
      let query;
      
      if (targetEmail) {
        // Use RPC to bypass RLS for email-sync mode if not fully logged in via session
        if (!session) {
          query = supabase.rpc('get_companies_for_email', { req_email: targetEmail });
        } else {
          query = supabase.from('companies').select('*')
            .or(`user_email.eq."${targetEmail}",linked_emails.cs.{"${targetEmail}"},owner_email.eq."${targetEmail}"`);
        }
      } else {
        query = supabase.from('companies').select('*').eq('username', username || '');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Use latest companies from Ref to avoid race conditions
      const currentLocalCompanies = companiesRef.current;
      const { merged, toUpload } = mergeData(currentLocalCompanies, data || []);
      
      // CRITICAL: Filter out any IDs we are currently leaving
      const finalMerged = merged.filter(c => !leavingIds.includes(c.id));
      const nonDeleted = finalMerged.filter(c => !c.deleted_at);
      
      // Save to state and local storage
      setCompanies(nonDeleted);
      
      // CRITICAL: Determine which user context to save under
      const effectiveUser = username || targetEmail?.split('@')[0] || 'user';
      if (!currentUser) {
        setCurrentUser(effectiveUser);
        localStorage.setItem('currentUser', effectiveUser);
      }
      
      localStorage.setItem(`companies_${effectiveUser}`, JSON.stringify(finalMerged));
      
      if (toUpload.length > 0) {
        await syncToCloud('companies', toUpload);
      }
      
      // Handle current company if none selected
      const savedCurrent = localStorage.getItem(`currentCompany_${effectiveUser}`);
      if (!currentCompany && !savedCurrent && nonDeleted.length > 0) {
        setCurrentCompany(nonDeleted[0]);
        localStorage.setItem(`currentCompany_${effectiveUser}`, JSON.stringify(nonDeleted[0]));
      }
      
      setSyncStatus({ loading: false, error: null, success: data && data.length > 0 ? `Successfully pulled ${data.length} companies` : 'Already up to date' });
      return true;
    } catch (error: any) {
      console.error('Error pulling companies:', error);
      let errorMessage = error.message || 'Check your connection.';
      
      if (errorMessage.includes('Could not find the table')) {
        errorMessage = 'Database table "companies" not found. Please go to Settings > Cloud Sync > Database Setup and run the SQL script in your Supabase SQL Editor.';
      }

      setSyncStatus({ 
        loading: false, 
        error: `Failed to pull companies: ${errorMessage}`, 
        success: null 
      });
      return false;
    }
  };

  const syncToCloud = async (table: string, data: any, isNew: boolean = false, companyIdOverride?: string) => {
    let activeCompanyId = companyIdOverride || currentCompany?.id;
    
    // Defensive: if table is not 'companies' but we have no activeCompanyId, try to pull it from the payload
    if (!activeCompanyId && table !== 'companies' && data) {
        if (Array.isArray(data) && data.length > 0) {
            activeCompanyId = data[0].company_id;
        } else if (data.company_id) {
            activeCompanyId = data.company_id;
        }
    }

    // Safety check: Don't sync data without a company ID (except for companies table)
    if (!activeCompanyId && table !== 'companies') {
        console.log(`[Sync Skip] No company ID for table ${table}`);
        return;
    }

    const company = activeCompanyId === currentCompany?.id ? currentCompany : companies.find(c => c.id === activeCompanyId);
    
    // SKIP SYNC FOR HR COMPANIES as requested
    if (company?.company_type === 'hr') {
        return;
    }

    const email = settings.user_email || company?.user_email || (company?.username ? `${company.username}@bugzy.app` : null);
    const isUsernameAccount = !!company?.username;
    
    if (!settings.sync_enabled && !isUsernameAccount) {
        return;
    }

    if (!email) {
        console.log(`[Sync Skip] No email or username found for ${table}`);
        return;
    }
    
    // Verify session as requested
    if (!session) {
        console.warn(`[Sync Warning] No active session found for ${table}. Current Auth State:`, supabase.auth.getUser());
    }

    // Map 'items' to 'inventory' for Supabase
    let dbTable = table;
    if (table === 'items') dbTable = 'inventory';
    if (table === 'expenses') dbTable = 'transactions';
    
    try {
        // Sanitize data: replace empty strings with null for date fields and strip local metadata
        const sanitize = (obj: any) => {
          const sanitized = { ...obj };
          Object.keys(sanitized).forEach(key => {
            // Strip local metadata starting with _ (like _synced)
            if (key.startsWith('_')) {
              delete (sanitized as any)[key];
              return;
            }

            if (sanitized[key] === "") {
              if (key.includes('date') || key.includes('_at') || key === 'bank_id' || key === 'party_id' || key === 'to_party_id' || key === 'to_bank_id') {
                sanitized[key] = null;
              }
            }
          });
          return sanitized;
        };

    const dataWithEmail = Array.isArray(data) 
          ? data.map(d => sanitize({ ...d, user_email: email, company_id: d.company_id || activeCompanyId }))
          : sanitize({ ...data, user_email: email, company_id: data.company_id || activeCompanyId });
        
        // Final validation for companies table
        if (table === 'companies') {
            const hasId = Array.isArray(dataWithEmail) 
                ? dataWithEmail.every(d => !!d.id)
                : !!(dataWithEmail as any).id;
            
            if (!hasId) {
                console.error('[Sync Error] Company data is missing required "id" field!', dataWithEmail);
                return;
            }
        }

        // Strip company_id for tables that don't have it
        const tablesWithNoCompanyId = ['companies', 'profiles', 'licenses', 'payment_requests'];
        if (tablesWithNoCompanyId.includes(table)) {
            if (Array.isArray(dataWithEmail)) {
                dataWithEmail.forEach(d => delete d.company_id);
            } else {
                delete (dataWithEmail as any).company_id;
            }
        }

        console.log(`[Sync Attempt] Table: ${dbTable}, Operation: ${isNew ? 'INSERT' : 'UPSERT'}`, dataWithEmail);
        
        // Robust Upsert with Recursive Column Stripping
        const performUpsert = async (payload: any): Promise<{ data: any, error: any }> => {
            let res, err;

            if (!session && settings.user_email) {
              // Use secure RPC for email-sync mode
              const { data: rpcRes, error: rpcErr } = await supabase.rpc('upsert_table_data_by_email', {
                req_email: email.toLowerCase().trim(),
                req_payload: payload,
                req_table: dbTable
              });
              res = rpcRes;
              err = rpcErr;
            } else {
              const { data: directRes, error: directErr } = await supabase.from(dbTable).upsert(payload).select();
              res = directRes;
              err = directErr;
            }
            
            if (err && (err.message.includes('column') || err.message.includes('schema cache'))) {
                const match = err.message.match(/column "(.*?)"/);
                const missingCol = match ? match[1] : null;
                
                if (missingCol) {
                    console.warn(`[Sync Robustness] Stripping missing column "${missingCol}" and retrying...`);
                    const stripped = Array.isArray(payload)
                        ? payload.map(item => { const { [missingCol]: _, ...rest } = item; return rest; })
                        : (() => { const { [missingCol]: _, ...rest } = payload; return rest; })();
                    return performUpsert(stripped); // Recursive call
                }

                // Hard fallback for specific common missing columns if regex fails
                const commonProblems = ['opening_stock', 'unit', 'category', 'price', 'quantity'];
                for (const col of commonProblems) {
                    if (err.message.includes(col)) {
                        console.warn(`[Sync Robustness] Manually stripping "${col}" and retrying...`);
                        const stripped = Array.isArray(payload)
                            ? payload.map(item => { const { [col]: _, ...rest } = item; return rest; })
                            : (() => { const { [col]: _, ...rest } = payload; return rest; })();
                        return performUpsert(stripped);
                    }
                }
            }
            return { data: res, error: err };
        };

        const { data: result, error } = await performUpsert(dataWithEmail);
        
        if (error) {
            console.error(`[Sync Error] ${dbTable} failed:`, {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            
            setSyncStatus({ 
                loading: false, 
                error: `Sync failed for ${dbTable}: ${error.message}${error.hint ? ' - ' + error.hint : ''}`, 
                success: null 
            });
            throw error;
        }

        console.log(`[Sync Success] ${dbTable} synced. Result:`, result);

        // Mark as synced locally
        if (currentCompany) {
            const localAll = JSON.parse(localStorage.getItem(`${table}_${currentCompany.id}`) || '[]');
            const ids = Array.isArray(data) ? data.map(d => d.id) : [data.id];
            const updatedAll = localAll.map((item: any) => ids.includes(item.id) ? { ...item, _synced: true } : item);
            localStorage.setItem(`${table}_${currentCompany.id}`, JSON.stringify(updatedAll));
        }
    } catch (error: any) {
        console.error(`[Sync Exception] ${dbTable}:`, error);
        throw error;
    }
};

const deleteFromCloud = async (table: string, id: string, emailOverride?: string | null) => {
    const compId = currentCompany?.id;
    const company = compId ? companies.find(c => c.id === compId) : null;
    if (company?.company_type === 'hr') return;

    const email = emailOverride || settings.user_email || currentCompany?.user_email || (currentCompany?.username ? `${currentCompany.username}@bugzy.app` : null);
    const isUsernameAccount = !!currentCompany?.username || !!emailOverride;
    
    if (!settings.sync_enabled && !isUsernameAccount) return;
    if (!email) return;
    
    let dbTable = table;
    if (table === 'items') dbTable = 'inventory';
    if (table === 'expenses') dbTable = 'transactions';

    console.log(`[Delete Start] Table: ${dbTable}, ID: ${id}, Email: ${email}`);
    try {
        let err;
        if (!session && email) {
          const { error: rpcErr } = await supabase.rpc('delete_table_data_by_email', {
            req_email: email.toLowerCase().trim(),
            req_id: id,
            req_table: dbTable
          });
          err = rpcErr;
        } else {
          const { error: deleteErr } = await supabase.from(dbTable).delete().eq('id', id);
          err = deleteErr;
        }

        if (err) {
            console.error(`[Delete Error] ${dbTable}:`, err);
            if (err.code === 'PGRST116' || err.message.includes('relation')) return;
            throw err;
        }
        console.log(`[Delete Success] ${dbTable} record deleted from cloud`);
    } catch (error) {
        console.error(`[Delete Exception] ${dbTable}:`, error);
        throw error;
    }
};

  useEffect(() => {
    const init = async () => {
      // Load current company from localStorage initially just to have a starting point
      const saved = localStorage.getItem('currentCompany');
      if (saved) {
        const company = JSON.parse(saved);
        setCurrentCompany(company);
      }
      
      // Then pull companies from cloud
      if (settings.user_email || currentUser) {
        await refreshData(undefined, true);
        
        // Check for pending payment requests
        const userId = session?.user?.id || currentUser;
        if (userId) {
          const { data } = await supabase
            .from('payment_requests')
            .select('status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) setPaymentStatus(data.status as any);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (settings.user_email) {
      refreshData();
    }
  }, [settings.sync_enabled, settings.user_email]);

  // Handle linking another email explicitly when changed in settings
  useEffect(() => {
    if (settings.user_email && !companies.some(c => c.user_email === settings.user_email || c.linked_emails?.includes(settings.user_email!))) {
       console.log('[Sync] New email linked, fetching companies again...');
       refreshData(undefined, true);
    }
  }, [settings.user_email]);

  useEffect(() => {
    if (settings.sync_enabled && settings.user_email && currentCompany) {
        // Only refresh if not already synced for this company
        if (!hasInitialSynced.current[currentCompany.id]) {
            refreshData();
        }
        
        console.log('[Realtime] Setting up subscription...');
        const channel = supabase.channel(`company-sync-${currentCompany.id}`)
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                console.log('[Realtime] Payload Received:', {
                    table: payload.table,
                    eventType: payload.eventType,
                    new: payload.new,
                    old: payload.old,
                    timestamp: new Date().toISOString()
                });
                const { table, new: newRecord, old: oldRecord, eventType } = payload;
                const record = (newRecord || oldRecord) as any;
                
                if (!record) return;

                const recordCompanyId = record?.company_id || (oldRecord as any)?.company_id;
                const managedCompanyIds = new Set(companies.map(c => c.id));
                let isRelevant = table === 'companies' || (recordCompanyId && managedCompanyIds.has(recordCompanyId));
                
                // FORCE relevance for deletions to ensure propagation across devices even if replica identity is partial
                if (eventType === 'DELETE' || (record && record.deleted_at)) {
                    isRelevant = true; 
                }
                
                if (isRelevant) {
                    const updateState = (key: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
                        isInternalUpdate.current = true;
                        
                        const targetIds = (recordCompanyId) 
                            ? [recordCompanyId]
                            : Array.from(managedCompanyIds);

                        targetIds.forEach(targetId => {
                            const localAll = JSON.parse(localStorage.getItem(`${key}_${targetId}`) || '[]');
                            if (!Array.isArray(localAll)) return;
                            
                            let updatedAll = [...localAll];
                            let changed = false;
                            const recordId = record.id || (oldRecord as any)?.id;

                            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                                const index = updatedAll.findIndex(i => i.id === recordId);
                                if (index !== -1) {
                                    const localTime = new Date(updatedAll[index].updated_at || updatedAll[index].created_at || 0).getTime();
                                    const remoteTime = new Date(record.updated_at || record.created_at || 0).getTime();
                                    if (remoteTime >= localTime) {
                                        updatedAll[index] = { ...record, _synced: true };
                                        changed = true;
                                    }
                                } else {
                                    updatedAll = [{ ...record, _synced: true }, ...updatedAll];
                                    changed = true;
                                }
                            } else if (eventType === 'DELETE') {
                                if (recordId) {
                                    const originalSize = updatedAll.length;
                                    updatedAll = updatedAll.filter(i => i.id !== recordId);
                                    if (updatedAll.length !== originalSize) changed = true;
                                }
                            }

                            if (changed) {
                                localStorage.setItem(`${key}_${targetId}`, JSON.stringify(updatedAll));
                                // Only update active state if it matches current company
                                if (targetId === currentCompany?.id) {
                                    setter(updatedAll.filter(i => !i.deleted_at));
                                }
                            }
                        });
                        
                        setTimeout(() => { isInternalUpdate.current = false; }, 100);
                    };

                    if (table === 'transactions' || table === 'expenses') {
                        updateState('transactions', setTransactions);
                    }
                    else if (table === 'parties') updateState('parties', setParties);
                    else if (table === 'banks') updateState('banks', setBanks);
                    else if (table === 'inventory') updateState('items', setItems);
                    else if (table === 'invoices') updateState('invoices', setInvoices);
                    else if (table === 'companies') {
                        isInternalUpdate.current = true;
                        setCompanies(prev => {
                            const localAll = JSON.parse(localStorage.getItem(`companies_${currentUser}`) || '[]');
                            let updatedAll = [...localAll];
                            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                                const index = updatedAll.findIndex(c => c.id === record.id);
                                if (index !== -1) {
                                    const localTime = new Date(updatedAll[index].updated_at || updatedAll[index].created_at || 0).getTime();
                                    const remoteTime = new Date(record.updated_at || record.created_at || 0).getTime();
                                    if (remoteTime >= localTime) {
                                        updatedAll[index] = record;
                                        // Update current company branding if it's the active one
                                        if (currentCompany.id === record.id) {
                                            setCurrentCompany(record);
                                        }
                                    }
                                } else {
                                    updatedAll = [...updatedAll, record];
                                }
                            } else if (eventType === 'DELETE') {
                                const id = record.id || (oldRecord as any)?.id;
                                if (!id) return prev;
                                updatedAll = updatedAll.filter(c => c.id !== id);
                            }
                            if (currentUser) {
                                localStorage.setItem(`companies_${currentUser}`, JSON.stringify(updatedAll));
                            }
                            return updatedAll.filter(c => !c.deleted_at);
                        });
                        setTimeout(() => { isInternalUpdate.current = false; }, 100);
                    }
                }
            })
            .subscribe((status, err) => {
                console.log(`[Realtime] Status: ${status}`, err || '');
            });
        
        return () => {
            console.log('[Realtime] Cleaning up subscription...');
            supabase.removeChannel(channel);
        };
    }
  }, [currentCompany?.id, settings.sync_enabled, settings.user_email]);

  // Automatically recalculate balances when transactions change (e.g. via Realtime)
  useEffect(() => {
    if (!currentCompany || syncStatus.loading) return;

    const timer = setTimeout(() => {
      recalculateBalances(transactions, parties, banks, items, invoices);
    }, 100);

    return () => clearTimeout(timer);
  }, [transactions, parties, banks, items, invoices, currentCompany?.id]);

  const isRecalculating = React.useRef(false);

  const recalculateBalances = async (allTransactions: Transaction[], allParties: Party[], allBanks: BankAccount[], allItems: Item[], allInvoices: Invoice[]) => {
    if (!currentCompany || isRecalculating.current) return;
    
    isRecalculating.current = true;
    try {
      const partyBalances: Record<string, number> = {};
      const bankBalances: Record<string, number> = {};
      const itemStock: Record<string, number> = {};

      allParties.forEach(p => partyBalances[p.id] = p.opening_balance || 0);
      allBanks.forEach(b => bankBalances[b.id] = b.opening_balance || 0);
      allItems.forEach(i => itemStock[i.id] = i.opening_stock || 0);

      // 1. Process Invoices
      allInvoices.forEach(inv => {
        if (!inv || inv.deleted_at) return;
        if (inv.party_id && partyBalances[inv.party_id] !== undefined) {
          if (inv.type === 'Sale') partyBalances[inv.party_id] += (inv.total || 0);
          if (inv.type === 'Purchase') partyBalances[inv.party_id] -= (inv.total || 0);
        }
        
        if (inv.status === 'Paid' && inv.payment_type === 'Bank' && inv.bank_id && bankBalances[inv.bank_id] !== undefined) {
          if (inv.type === 'Sale') bankBalances[inv.bank_id] += (inv.total || 0);
          if (inv.type === 'Purchase') bankBalances[inv.bank_id] -= (inv.total || 0);
        }
        
        if (inv.items) {
          inv.items.forEach(item => {
            if (item.item_id && itemStock[item.item_id] !== undefined) {
              if (inv.type === 'Sale') itemStock[item.item_id] -= (item.quantity || 0);
              if (inv.type === 'Purchase') itemStock[item.item_id] += (item.quantity || 0);
            }
          });
        }
      });

      // 2. Process Transactions (Sort once)
      const sortedTxs = [...allTransactions].filter(t => t && t.date && !t.deleted_at).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      
      sortedTxs.forEach(tx => {
        if (tx.party_id && partyBalances[tx.party_id] !== undefined) {
          if (tx.type === 'Payment In' || tx.type === 'Sale' || tx.type === 'Bank To Party') partyBalances[tx.party_id] += (tx.amount || 0);
          if (tx.type === 'Payment Out' || tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Party To Party' || tx.type === 'Party To Bank' || tx.type === 'Party To Cash') partyBalances[tx.party_id] -= (tx.amount || 0);
        }
        if (tx.to_party_id && partyBalances[tx.to_party_id] !== undefined) {
          partyBalances[tx.to_party_id] += (tx.amount || 0);
        }

        if (tx.bank_id && bankBalances[tx.bank_id] !== undefined) {
          const isBankIn = ['Deposit', 'Cash Deposit', 'Payment In', 'Sale', 'Party To Bank', 'Cash To Bank', 'Bank To Bank'].includes(tx.type);
          const isBankOut = ['Withdraw', 'Cash Withdraw', 'Payment Out', 'Expense', 'Bank To Party', 'Bank To Cash'].includes(tx.type);
          
          // Special case for Bank To Bank: bank_id is source (out), to_bank_id is dest (in)
          if (tx.type === 'Bank To Bank') {
             bankBalances[tx.bank_id] -= (tx.amount || 0);
          } else if (isBankIn) {
             bankBalances[tx.bank_id] += (tx.amount || 0);
          } else if (isBankOut) {
             bankBalances[tx.bank_id] -= (tx.amount || 0);
          }
        }
        if (tx.to_bank_id && bankBalances[tx.to_bank_id] !== undefined) {
          bankBalances[tx.to_bank_id] += (tx.amount || 0);
        }

        if (tx.item_id && tx.quantity && itemStock[tx.item_id] !== undefined) {
          if (tx.type === 'Sale' || tx.type === 'Stock Out') itemStock[tx.item_id] -= (tx.quantity || 0);
          if (tx.type === 'Purchase' || tx.type === 'Stock In') itemStock[tx.item_id] += (tx.quantity || 0);
        }
      });

      const updatedParties = allParties.map(p => ({ ...p, balance: partyBalances[p.id] || 0 }));
      const updatedBanks = allBanks.map(b => ({ ...b, balance: bankBalances[b.id] || 0 }));
      const updatedItems = allItems.map(i => ({ ...i, stock: itemStock[i.id] || 0 }));

      // Update state if anything changed
      const anyPartyChanged = updatedParties.some((p, idx) => p.balance !== allParties[idx]?.balance);
      const anyBankChanged = updatedBanks.some((b, idx) => b.balance !== allBanks[idx]?.balance);
      const anyItemChanged = updatedItems.some((i, idx) => i.stock !== allItems[idx]?.stock);

      if (anyPartyChanged) setParties(updatedParties);
      if (anyBankChanged) setBanks(updatedBanks);
      if (anyItemChanged) setItems(updatedItems);

      if (anyPartyChanged || anyBankChanged || anyItemChanged) {
        localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(updatedParties));
        localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(updatedBanks));
        localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updatedItems));

        if (settings.sync_enabled && !isInternalUpdate.current && !syncStatus.loading) {
          if (anyPartyChanged) updatedParties.forEach(p => {
             const old = allParties.find(op => op.id === p.id);
             if (old && old.balance !== p.balance) syncToCloud('parties', p, false, currentCompany.id);
          });
          if (anyBankChanged) updatedBanks.forEach(b => {
             const old = allBanks.find(ob => ob.id === b.id);
             if (old && old.balance !== b.balance) syncToCloud('banks', b, false, currentCompany.id);
          });
          if (anyItemChanged) updatedItems.forEach(i => {
             const old = allItems.find(oi => oi.id === i.id);
             if (old && old.stock !== i.stock) syncToCloud('inventory', i, false, currentCompany.id);
          });
        }
      }
    } finally {
      isRecalculating.current = false;
    }
  };

  const addTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      _synced: false
    };
    
    // Instant UI Update with functional setter to ensure stability
    setTransactions(prev => {
      const updated = [newTx, ...prev];
      localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
      return updated;
    });
    
    // Background Sync
    if (settings.sync_enabled) {
      syncToCloud('transactions', newTx, true).catch(err => console.error('Add Transaction Sync Error:', err));
    }
  };

  const addTransactions = async (txs: Omit<Transaction, 'id' | 'created_at'>[]) => {
    if (!currentCompany || txs.length === 0) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const now = new Date().toISOString();
    const newTxs: Transaction[] = txs.map(tx => ({
      ...tx,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      _synced: false
    }));
    
    setTransactions(prev => {
      const updated = [...newTxs, ...prev];
      localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
      return updated;
    });

    if (settings.sync_enabled) {
      // Small delay for cloud sync to not overwhelm
      syncToCloud('transactions', newTxs, true).catch(err => console.error('Bulk Sync Error:', err));
    }
  };

  const updateTransaction = async (id: string, tx: Partial<Transaction>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
    const now = new Date().toISOString();
    
    setTransactions(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...tx, updated_at: now, _synced: false } : t);
      localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
      return updated;
    });
    
    const targetTx = transactions.find(t => t.id === id);
    if (targetTx && settings.sync_enabled) {
      syncToCloud('transactions', [{ ...targetTx, ...tx, updated_at: now, _synced: false }], true)
        .catch(err => console.error('Update Sync Error:', err));
    }
  };

  const addParty = async (party: Omit<Party, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const now = new Date().toISOString();
    const newParty: Party = {
      ...party,
      opening_balance: party.opening_balance || 0,
      balance: party.opening_balance || 0,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    const updated = [...parties, newParty];
    
    // Instant UI Update
    setParties(updated);
    localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(updated));
    
    // Background Sync
    if (settings.sync_enabled) {
      syncToCloud('parties', newParty, true).catch(err => console.error('Add Party Sync Error:', err));
    }
    await recalculateBalances(transactions, updated, banks, items, invoices);
  };

  const updateParty = async (id: string, party: Partial<Party>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
    const now = new Date().toISOString();
    const updated = parties.map(p => p.id === id ? { ...p, ...party, updated_at: now } : p);
    setParties(updated);
    localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      await syncToCloud('parties', updated.find(p => p.id === id));
    }
    await recalculateBalances(transactions, updated, banks, items, invoices);
  };

  const deleteParty = async (id: string, hard = true) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const party = parties.find(p => p.id === id);
    if (!party) return;
    
    const now = new Date().toISOString();
    const updatedParties = parties.filter(p => p.id !== id);
    setParties(updatedParties);

    const localAll = JSON.parse(localStorage.getItem(`parties_${currentCompany.id}`) || '[]');
    
    if (hard) {
      const filteredAll = localAll.filter((p: any) => p.id !== id);
      localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(filteredAll));
      if (settings.sync_enabled) {
        await deleteFromCloud('parties', id);
      }
    } else {
      const updatedAll = localAll.map((p: any) => p.id === id ? { ...p, deleted_at: now, updated_at: now } : p);
      localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(updatedAll));
      if (settings.sync_enabled) {
        await syncToCloud('parties', { ...party, deleted_at: now, updated_at: now });
      }
    }
    await recalculateBalances(transactions, updatedParties, banks, items, invoices);
  };

  const addBank = async (bank: Omit<BankAccount, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const now = new Date().toISOString();
    const newBank: BankAccount = {
      ...bank,
      opening_balance: bank.opening_balance || 0,
      balance: bank.opening_balance || 0,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    const updated = [...banks, newBank];
    
    // Instant UI Update
    setBanks(updated);
    localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(updated));
    
    // Background Sync
    if (settings.sync_enabled) {
      syncToCloud('banks', newBank, true).catch(err => console.error('Add Bank Sync Error:', err));
    }
    await recalculateBalances(transactions, parties, updated, items, invoices);
  };

  const updateBank = async (id: string, bank: Partial<BankAccount>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
    const now = new Date().toISOString();
    const updated = banks.map(b => b.id === id ? { ...b, ...bank, updated_at: now } : b);
    setBanks(updated);
    localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      await syncToCloud('banks', updated.find(b => b.id === id));
    }
    await recalculateBalances(transactions, parties, updated, items, invoices);
  };

  const deleteBank = async (id: string, hard = true) => {
    if (!currentCompany) return;
    const bank = banks.find(b => b.id === id);
    if (!bank) return;

    const now = new Date().toISOString();
    const updatedBanks = banks.filter(b => b.id !== id);
    setBanks(updatedBanks);

    const localAll = JSON.parse(localStorage.getItem(`banks_${currentCompany.id}`) || '[]');
    
    if (hard) {
      const filteredAll = localAll.filter((b: any) => b.id !== id);
      localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(filteredAll));
      if (settings.sync_enabled) {
        await deleteFromCloud('banks', id);
      }
    } else {
      const updatedAll = localAll.map((b: any) => b.id === id ? { ...b, deleted_at: now, updated_at: now } : b);
      localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(updatedAll));
      if (settings.sync_enabled) {
        await syncToCloud('banks', { ...bank, deleted_at: now, updated_at: now });
      }
    }
    await recalculateBalances(transactions, parties, updatedBanks, items, invoices);
  };

  const addItem = async (item: Omit<Item, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const now = new Date().toISOString();
    const newItem: Item = {
      ...item,
      opening_stock: item.stock || 0,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    const updated = [...items, newItem];
    
    // Instant UI Update
    setItems(updated);
    localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updated));
    
    // Background Sync
    if (settings.sync_enabled) {
      syncToCloud('items', newItem, true).catch(err => console.error('Add Item Sync Error:', err));
    }
    await recalculateBalances(transactions, parties, banks, updated, invoices);
  };

  const updateItem = async (id: string, item: Partial<Item>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
    const now = new Date().toISOString();
    
    // If stock is being updated directly, it might be an opening stock edit
    const itemToUpdate = items.find(i => i.id === id);
    const updatedFields = { ...item };
    if (item.stock !== undefined && itemToUpdate && itemToUpdate.stock === itemToUpdate.opening_stock) {
        // If they are the same, maybe it's an initial setup phase
        (updatedFields as any).opening_stock = item.stock;
    }

    const updated = items.map(i => i.id === id ? { ...i, ...updatedFields, updated_at: now } : i);
    setItems(updated);
    localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      await syncToCloud('items', updated.find(i => i.id === id));
    }
    await recalculateBalances(transactions, parties, banks, updated, invoices);
  };

  const deleteItem = async (id: string, hard = true) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
    const item = items.find(i => i.id === id);
    if (!item) return;

    const now = new Date().toISOString();
    const updatedItems = items.filter(i => i.id !== id);
    setItems(updatedItems);

    const localAll = JSON.parse(localStorage.getItem(`items_${currentCompany.id}`) || '[]');
    
    if (hard) {
      const filteredAll = localAll.filter((i: any) => i.id !== id);
      localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(filteredAll));
      if (settings.sync_enabled) {
        await deleteFromCloud('items', id);
      }
    } else {
      const updatedAll = localAll.map((i: any) => i.id === id ? { ...i, deleted_at: now, updated_at: now } : i);
      localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updatedAll));
      if (settings.sync_enabled) {
        await syncToCloud('items', { ...item, deleted_at: now, updated_at: now });
      }
    }
    await recalculateBalances(transactions, parties, banks, updatedItems, invoices);
  };

  const deleteTransaction = async (id: string, hard = true) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      const now = new Date().toISOString();
      const updatedTransactions = transactions.filter(t => t.id !== id);
      setTransactions(updatedTransactions);

      const localAll = JSON.parse(localStorage.getItem(`transactions_${currentCompany.id}`) || '[]');
      
      if (hard) {
        const filteredAll = localAll.filter((t: any) => t.id !== id);
        localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(filteredAll));
        if (settings.sync_enabled) {
            await deleteFromCloud('transactions', id);
        }
      } else {
        const updatedAll = localAll.map((t: any) => t.id === id ? { ...t, deleted_at: now, updated_at: now } : t);
        localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updatedAll));
        if (settings.sync_enabled) {
            await syncToCloud('transactions', { ...tx, deleted_at: now, updated_at: now });
        }
      }
      await recalculateBalances(updatedTransactions, parties, banks, items, invoices);
  };

  const loginWithUsername = async (username: string, isLogin: boolean = true) => {
    const normalizedUsername = username.toLowerCase().trim();
    if (!normalizedUsername) return false;
    
    setSyncStatus({ loading: true, error: null, success: null });
    
    try {
      // 1. Check local storage first (for offline support)
      const localCompaniesStr = localStorage.getItem(`companies_${normalizedUsername}`);
      if (localCompaniesStr) {
        const localData = JSON.parse(localCompaniesStr);
        if (isLogin) {
          localStorage.setItem('currentUser', normalizedUsername);
          setCurrentUser(normalizedUsername);
          setCompanies(localData);
          if (localData.length > 0) {
            setCurrentCompany(localData[0]);
            localStorage.setItem('currentCompany', JSON.stringify(localData[0]));
          }
          setSyncStatus({ loading: false, error: null, success: 'Login successful (Offline)' });
          
          // Try to sync in background if online
          refreshData(undefined, true).catch(console.error);
          return true;
        } else {
          // If signup attempt but exists locally, we still check cloud to be sure
          // but we can warn early
          console.log('Username exists locally, checking cloud...');
        }
      }

      // 2. Check cloud
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .ilike('username', normalizedUsername);

      if (error) {
        // If offline and we already logged in via local storage, we are fine
        if (localCompaniesStr && isLogin) return true;
        
        if (error.message.includes('permission denied') || error.code === '42501') {
          throw new Error('Permission denied ❌. Please go to Settings > Cloud Sync > Database Setup and run the SQL script to fix permissions.');
        }
        throw error;
      }

      if (data && data.length > 0) {
        // User exists in cloud
        if (!isLogin) {
          setSyncStatus({ 
            loading: false, 
            error: `Username "${normalizedUsername}" is already taken ❌. Please choose another or login.`, 
            success: null 
          });
          return false;
        }
        
        // Login logic: Save fetched companies to localStorage so useEffect can pick them up
        localStorage.setItem(`companies_${normalizedUsername}`, JSON.stringify(data));
        localStorage.setItem('currentUser', normalizedUsername);
        
        // Also set state directly to avoid "empty frame"
        setCompanies(data);
        if (data.length > 0) {
          setCurrentCompany(data[0]);
          localStorage.setItem(`currentCompany_${normalizedUsername}`, JSON.stringify(data[0]));
        }
        
        setCurrentUser(normalizedUsername);
        setSyncStatus({ loading: false, error: null, success: 'Login successful' });
        return true;
      }

      // 3. If it's a login attempt and not found in cloud or local, return false
      if (isLogin) {
        setSyncStatus({ loading: false, error: 'Username not found ❌', success: null });
        return false;
      }

      // 4. For signup: username is available
      localStorage.setItem('currentUser', normalizedUsername);
      setCurrentUser(normalizedUsername);
      setSyncStatus({ loading: false, error: null, success: null });
      return true;
    } catch (err: any) {
      console.error('Login/Check error:', err);
      // If offline and we have local data, we already handled it. 
      // If we reach here, it means we don't have local data or it's a real error.
      const isOffline = !navigator.onLine || err.message?.includes('Failed to fetch');
      if (isOffline && isLogin) {
         setSyncStatus({ loading: false, error: 'You are offline and this account is not saved on this device ❌', success: null });
      } else {
         setSyncStatus({ loading: false, error: err.message || 'Operation failed', success: null });
      }
      return false;
    }
  };

  const addCompany = async (company: Omit<Company, 'id' | 'created_at'>, licenseKey?: string) => {
    setSyncStatus({ loading: true, error: null, success: null });
    
    // 0. Handle License Activation if provided
    if (licenseKey && (!isDeviceLicensed || companies.length === 0)) {
      try {
        await activateLicense(licenseKey);
      } catch (err: any) {
        setSyncStatus({ loading: false, error: err.message, success: null });
        throw err;
      }
    }

    const now = new Date().toISOString();
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const isFirstCompany = companies.length === 0;
    const myEmail = settings.user_email?.toLowerCase() || session?.user?.email?.toLowerCase();
    
    const newCompany: Company = {
      ...company,
      id: generateId(),
      owner_id: session?.user?.id || '',
      user_id: session?.user?.id || '',
      user_email: myEmail || '',
      username: company.username?.toLowerCase().trim() || currentUser || '',
      company_type: company.company_type || 'normal',
      trial_start: now,
      is_paid: isDeviceLicensed,
      created_at: now,
      updated_at: now,
      linked_emails: [],
      owner_email: myEmail || ''
    };
    
    try {
      // 1. Mandatory License Check for FIRST company creation
      if (companies.length === 0 && !isDeviceLicensed) {
        throw new Error('LICENSE_REQUIRED');
      }

      // 2. Check if username is taken by ANOTHER account
      const targetUsername = (company.username || currentUser || '').toLowerCase().trim();
      if (!targetUsername) throw new Error('Username is required');

      // 2. Save to cloud ONLY if it's NOT an HR company AND we have a session
      if (newCompany.company_type !== 'hr') {
        const performInsert = async (payload: any): Promise<{ error: any }> => {
          // If no session, don't even try - wait for sync later
          if (!session?.user) {
            console.warn('[AddCompany] No active cloud session. Business will be saved locally and synced when you sign in with Google.');
            return { error: null };
          }

          const { error: insertError } = await supabase.from('companies').insert(payload);
          if (insertError && insertError.message.includes('column')) {
             const match = insertError.message.match(/column "(.*?)"/);
             const missingCol = match ? match[1] : null;
             if (missingCol) {
               console.warn(`[AddCompany Robustness] Stripping missing column "${missingCol}" and retrying...`);
               const { [missingCol]: _, ...rest } = payload;
               return performInsert(rest);
             }
          }
          return { error: insertError };
        };

        const { error } = await performInsert(newCompany);
        if (error) {
          if (error.message.includes('unique constraint') || error.code === '23505' || error.message.includes('already exists')) {
            throw new Error(`Username "${targetUsername}" is already in use ❌. Please use a different Short Username (like "mybusiness2").`);
          }
          throw error;
        }
      }

      // 3. Update local state
      const updatedCompanies = [...companies, newCompany];
      setCompanies(updatedCompanies);
      setCurrentCompany(newCompany);
      localStorage.setItem(`companies_${newCompany.username}`, JSON.stringify(updatedCompanies));
      localStorage.setItem(`currentCompany_${newCompany.username}`, JSON.stringify(newCompany));
      
      if (!currentUser) {
        setCurrentUser(newCompany.username);
        localStorage.setItem('currentUser', newCompany.username);
      }
      
      // Update sync only for normal companies
      if (newCompany.company_type === 'normal') {
          updateSettings({ sync_enabled: false }); // User must enable manually in Sync Center
      }
      
      setSyncStatus({ loading: false, error: null, success: 'Company created successfully' });
    } catch (e: any) {
      console.error('Failed to create company:', e);
      setSyncStatus({ loading: false, error: e.message || 'Failed to create company', success: null });
      throw e;
    }
  };

  const backupData = () => {
    if (!currentUser) return;
    
    const stripSyncFields = (obj: any) => {
      const { 
        user_email, 
        owner_email, 
        linked_emails, 
        _synced, 
        created_at_cloud, // any cloud specific fields
        updated_at_cloud,
        ...rest 
      } = obj;
      return rest;
    };

    const companies = JSON.parse(localStorage.getItem(`companies_${currentUser}`) || '[]').filter((c: any) => !c.deleted_at);
    const cleanedCompanies = companies.map(stripSyncFields);

    const data: any = {
      username: currentUser,
      companies: cleanedCompanies,
      settings: JSON.parse(localStorage.getItem('app_settings') || '{}'),
      device_license: localStorage.getItem('device_license'),
      active_license_key: localStorage.getItem('active_license_key'),
      companyData: {}
    };

    companies.forEach((c: any) => {
      const parties = JSON.parse(localStorage.getItem(`parties_${c.id}`) || '[]').filter((p: any) => !p.deleted_at);
      const banks = JSON.parse(localStorage.getItem(`banks_${c.id}`) || '[]').filter((b: any) => !b.deleted_at);
      const items = JSON.parse(localStorage.getItem(`items_${c.id}`) || '[]').filter((i: any) => !i.deleted_at);
      const transactions = JSON.parse(localStorage.getItem(`transactions_${c.id}`) || '[]').filter((t: any) => !t.deleted_at);
      const invoices = JSON.parse(localStorage.getItem(`invoices_${c.id}`) || '[]').filter((inv: any) => !inv.deleted_at);

      data.companyData[c.id] = {
        parties: parties.map(stripSyncFields),
        banks: banks.map(stripSyncFields),
        items: items.map(stripSyncFields),
        transactions: transactions.map(stripSyncFields),
        invoices: invoices.map(stripSyncFields),
      };
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `backup_${currentCompany?.name.replace(/\s+/g, '_') || currentUser}_${new Date().toISOString().split('T')[0]}.byb`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const restoreData = async (json: string) => {
    try {
      const data = JSON.parse(json);
      if (!data.username) throw new Error('Invalid backup file');

      const userEmail = (settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();

      const stripSyncedAndDeleted = (arr: any[]) => (arr || []).map(i => {
        const { _synced, user_email, owner_email, linked_emails, deleted_at, ...rest } = i;
        return rest;
      });

      // 1. Update current user context if needed
      if (!currentUser) {
        localStorage.setItem('currentUser', data.username);
        setCurrentUser(data.username);
      }

      // 2. Add Companies as New Entries (Don't Merge or Overwrite)
      const targetUserKey = currentUser || data.username;
      const companiesKey = `companies_${targetUserKey}`;
      const existingCompanies = JSON.parse(localStorage.getItem(companiesKey) || '[]');
      const backupCompanies = stripSyncedAndDeleted(data.companies);
      
      const newRestoredCompanies: any[] = [];
      const idMapping: Record<string, string> = {};

      backupCompanies.forEach((c: any) => {
        // Generate a new ID for the restored version to prevent conflicts
        const newId = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
        idMapping[c.id] = newId;
        newRestoredCompanies.push({
          ...c,
          id: newId,
          user_email: userEmail || undefined,
          owner_email: userEmail || undefined,
          linked_emails: userEmail ? [userEmail] : [],
          company_type: 'normal', 
          _synced: false,
          deleted_at: null 
        });
      });

      const finalCompanies = [...existingCompanies, ...newRestoredCompanies];
      localStorage.setItem(companiesKey, JSON.stringify(finalCompanies));
      
      // Update state and ref immediately to block pullCompanies from overwriting
      const activeRestored = finalCompanies.filter(c => !c.deleted_at);
      setCompanies(activeRestored);
      companiesRef.current = activeRestored;

      if (!currentCompany && newRestoredCompanies.length > 0) {
        const first = newRestoredCompanies[0];
        setCurrentCompany(first);
        localStorage.setItem(`currentCompany_${targetUserKey}`, JSON.stringify(first));
      }

      // 3. Update global settings if none exist
      const existingSettings = JSON.parse(localStorage.getItem('app_settings') || '{}');
      if (Object.keys(existingSettings).length === 0) {
        localStorage.setItem('app_settings', JSON.stringify(data.settings));
      }
      
      if (data.device_license && !localStorage.getItem('device_license')) {
        localStorage.setItem('device_license', data.device_license);
      }
      if (data.active_license_key && !localStorage.getItem('active_license_key')) {
        localStorage.setItem('active_license_key', data.active_license_key);
      }

      // 4. Save individual company data under the NEW IDs
      Object.keys(data.companyData || {}).forEach(oldCompanyId => {
        const newCompanyId = idMapping[oldCompanyId];
        if (!newCompanyId) return;
        
        const cData = data.companyData[oldCompanyId];
        const markNew = (arr: any[]) => (arr || []).map(item => ({ ...item, _synced: false }));

        localStorage.setItem(`parties_${newCompanyId}`, JSON.stringify(stripSyncedAndDeleted(markNew(cData.parties))));
        localStorage.setItem(`banks_${newCompanyId}`, JSON.stringify(stripSyncedAndDeleted(markNew(cData.banks))));
        localStorage.setItem(`items_${newCompanyId}`, JSON.stringify(stripSyncedAndDeleted(markNew(cData.items))));
        localStorage.setItem(`transactions_${newCompanyId}`, JSON.stringify(stripSyncedAndDeleted(markNew(cData.transactions))));
        localStorage.setItem(`invoices_${newCompanyId}`, JSON.stringify(stripSyncedAndDeleted(markNew(cData.invoices))));
      });

      toast.success('Backup restored! Restored businesses added to your list.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      alert('Restore failed: ' + e.message);
    }
  };

  const updateCompany = async (id: string, company: Partial<Company>) => {
    const now = new Date().toISOString();
    const updatedCompanies = companies.map(c => c.id === id ? { ...c, ...company, updated_at: now } : c);
    setCompanies(updatedCompanies);
    
    const userKey = currentUser || 'default';
    
    if (currentCompany?.id === id) {
      const updatedCurrent = { ...currentCompany, ...company, updated_at: now };
      setCurrentCompany(updatedCurrent);
      if (userKey) {
        localStorage.setItem(`currentCompany_${userKey}`, JSON.stringify(updatedCurrent));
      }
    }
    
    // Update Local Storage
    localStorage.setItem(`companies_${userKey}`, JSON.stringify(updatedCompanies));
    
    const targetCompany = updatedCompanies.find(c => c.id === id);
    if (targetCompany) {
      await syncToCloud('companies', targetCompany, false, targetCompany.id);
    }
  };

  const deleteCompany = async (id: string, hard = true) => {
    const companyToDelete = companies.find(c => c.id === id);
    if (!companyToDelete) return;

    const now = new Date().toISOString();
    const updatedCompanies = companies.filter(c => c.id !== id);
    
    // 1. Update State
    setCompanies(updatedCompanies);
    
    // 2. Update Local Storage explicitly for current user
    const targetUser = currentUser || companyToDelete.username;
    if (targetUser) {
      if (hard) {
        localStorage.setItem(`companies_${targetUser}`, JSON.stringify(updatedCompanies));
      } else {
        const withSoftDeleted = companies.map(c => c.id === id ? { ...c, deleted_at: now, updated_at: now } : c);
        localStorage.setItem(`companies_${targetUser}`, JSON.stringify(withSoftDeleted));
      }
    }

    // 3. Sync to Cloud
    if (hard) {
      const companyEmail = companyToDelete.user_email || (companyToDelete.username ? `${companyToDelete.username}@bugzy.app` : null);
      await deleteFromCloud('companies', id, companyEmail);
    } else {
      await syncToCloud('companies', { ...companyToDelete, deleted_at: now, updated_at: now });
    }

    // 4. Handle navigation if deleting current
    if (currentCompany?.id === id) {
      const nextCompany = updatedCompanies.length > 0 ? updatedCompanies[0] : null;
      setCurrentCompany(nextCompany);
      if (nextCompany && targetUser) {
        localStorage.setItem(`currentCompany_${targetUser}`, JSON.stringify(nextCompany));
      } else if (targetUser) {
        localStorage.removeItem(`currentCompany_${targetUser}`);
      }
    }
  };

  const restoreCompany = async (code: string) => {
    if (!code) return false;
    setSyncStatus({ loading: true, error: null, success: null });
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('recovery_code', code.toLowerCase())
        .is('deleted_at', null)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Invalid recovery code. No company found.');
        }
        throw error;
      }
      
      if (data) {
        // Essential: Set this user as active so data persists
        const targetUser = data.username || currentUser;
        if (targetUser) {
          setCurrentUser(targetUser);
          localStorage.setItem('currentUser', targetUser);
        }

        setCompanies(prev => {
          const exists = prev.find(c => c.id === data.id);
          const updated = exists ? prev.map(c => c.id === data.id ? data : c) : [...prev, data];
          if (targetUser) {
            localStorage.setItem(`companies_${targetUser}`, JSON.stringify(updated));
          }
          return updated;
        });
        
        setCurrentCompany(data);
        if (targetUser) {
          localStorage.setItem(`currentCompany_${targetUser}`, JSON.stringify(data));
        }
        
        // Force is_verified so it shows in premium context if needed, but sync stays off or as is
        const newSettings: Partial<AppSettings> = { is_verified: true };
        if (data.user_email && !settings.user_email) {
          newSettings.user_email = data.user_email;
          newSettings.sync_enabled = false;
        }
        updateSettings(newSettings);
        
        setSyncStatus({ loading: false, error: null, success: 'Company restored successfully!' });
        
        // Trigger a full data pull for this company
        setTimeout(() => {
          refreshData(data.user_email, true);
        }, 500);
        
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error restoring company:', error);
      setSyncStatus({ loading: false, error: error.message, success: null });
      return false;
    }
  };

  const addInvoice = async (invoice: Omit<Invoice, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }

    const now = new Date().toISOString();
    const newInvoice: Invoice = {
      ...invoice,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    const updated = [newInvoice, ...invoices];
    
    // Instant UI Update
    setInvoices(updated);
    localStorage.setItem(`invoices_${currentCompany.id}`, JSON.stringify(updated));
    
    // Background Sync
    if (settings.sync_enabled) {
      syncToCloud('invoices', newInvoice, true).catch(err => console.error('Add Invoice Sync Error:', err));
    }
    await recalculateBalances(transactions, parties, banks, items, updated);
  };

  const updateInvoice = async (id: string, invoice: Partial<Invoice>) => {
    if (!currentCompany) return;

    if (isTrialExpired) {
      alert('Package Expired! Please upgrade to Pro ❌');
      return;
    }
    const now = new Date().toISOString();
    const updated = invoices.map(i => i.id === id ? { ...i, ...invoice, updated_at: now } : i);
    setInvoices(updated);
    localStorage.setItem(`invoices_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      await syncToCloud('invoices', updated.find(i => i.id === id));
    }
    await recalculateBalances(transactions, parties, banks, items, updated);
  };

  const deleteInvoice = async (id: string, hard = true) => {
    if (!currentCompany) return;
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;

    const now = new Date().toISOString();
    const updatedInvoices = invoices.filter(i => i.id !== id);
    setInvoices(updatedInvoices);

    const localAll = JSON.parse(localStorage.getItem(`invoices_${currentCompany.id}`) || '[]');
    
    if (hard) {
      const filteredAll = localAll.filter((i: any) => i.id !== id);
      localStorage.setItem(`invoices_${currentCompany.id}`, JSON.stringify(filteredAll));
      if (settings.sync_enabled) {
        await deleteFromCloud('invoices', id);
      }
    } else {
      const updatedAll = localAll.map((i: any) => i.id === id ? { ...i, deleted_at: now, updated_at: now } : i);
      localStorage.setItem(`invoices_${currentCompany.id}`, JSON.stringify(updatedAll));
      if (settings.sync_enabled) {
        await syncToCloud('invoices', { ...invoice, deleted_at: now, updated_at: now });
      }
    }
    await recalculateBalances(transactions, parties, banks, items, updatedInvoices);
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('app_settings', JSON.stringify(updated));
      return updated;
    });
    
    if (newSettings.user_email) {
      setCurrentUser(newSettings.user_email);
      localStorage.setItem('currentUser', newSettings.user_email);
    }
  };

  const handleSupabaseError = (error: any, context: string) => {
    console.error(`${context} Error:`, error);
    throw error;
  };

  const submitPaymentRequest = async (data: {
    name: string;
    phone: string;
    amount: number;
    plan: string;
    screenshot: string;
  }) => {
    const now = new Date().toISOString();
    
    // Attempt 1: Full payload
    const fullRequest = {
      user_id: session?.user?.id || currentUser || 'anonymous',
      name: data.name,
      phone: data.phone,
      amount: data.amount,
      plan: data.plan,
      screenshot: data.screenshot,
      status: 'pending',
      created_at: now,
    };
    
    const { error } = await supabase.from('payment_requests').insert(fullRequest);
    
    if (error) {
      console.warn('Initial payment submit failed, trying fallback...');
      // Fallback: Minimal payload (in case some columns are missing)
      const fallbackRequest = {
        name: data.name,
        phone: data.phone,
        amount: data.amount,
        status: 'pending'
      };
      const { error: error2 } = await supabase.from('payment_requests').insert(fallbackRequest as any);
      if (error2) handleSupabaseError(error2, 'Submit Payment Fallback');
    }

    setPaymentStatus('pending');
  };

  const fetchPaymentRequests = async () => {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'Fetch Payment Requests');
    return data || [];
  };

  const updatePaymentRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    const now = new Date().toISOString();
    
    // 1. If approved, generate license first
    if (status === 'approved') {
      const licenseKey = generateLicenseKey();
      
      // Fetch request data first to get user_id
      const { data: reqData, error: fetchError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) handleSupabaseError(fetchError, 'Fetch Request for Approval');

      // Insert license
      const licensePayload: any = {
        license_key: licenseKey,
        user_id: reqData.user_id,
        status: 'active',
        created_at: now
      };

      // Only add optional columns if we are sure they exist, or try and catch
      const { error: licenseError } = await supabase
        .from('licenses')
        .insert(licensePayload);

      if (licenseError) {
        console.warn('Primary license insert failed, using absolute minimal...');
        await supabase.from('licenses').insert({ license_key: licenseKey, status: 'active' });
      }

      // Try updating extra fields separately
      await supabase.from('licenses').update({ 
        expiry_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        devices: []
      }).eq('license_key', licenseKey);
    }

    // 2. Update request status
    const { error: reqError } = await supabase
      .from('payment_requests')
      .update({ status })
      .eq('id', id);
    
    if (reqError) handleSupabaseError(reqError, 'Update Request Status');
  };

  const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}-${segment()}`;
  };

  const activateLicense = async (key: string) => {
    // MASTER LICENSE CHECK
    if (key === '16897463890072' || key === 'BUGZY-SECRET') {
      localStorage.setItem('device_license', 'true');
      localStorage.setItem('active_license_key', 'MASTER-KEY');
      setIsDeviceLicensed(true);
      return;
    }

    // 1. Get/Create Device ID
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    
    // 2. Fetch License
    const { data: license, error: fetchError } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', key.toUpperCase())
      .single();
    
    if (fetchError || !license) throw new Error('Invalid License Key ❌');
    if (license.status !== 'active') throw new Error('License is inactive ❌');
    
    // Check expiry
    if (license.expiry_at && new Date(license.expiry_at) < new Date()) {
      throw new Error('License has expired ❌');
    }

    // 3. Bind Device and User
    const devices = Array.isArray(license.devices) ? license.devices : [];
    const userId = session?.user?.id || currentUser;
    
    // Device Limit Check (Max 2 devices for standard keys, unlimited for master/special)
    if (!devices.includes(deviceId) && devices.length >= 2) {
      throw new Error('Device limit reached (Max 2 devices) ❌');
    }

    if (!devices.includes(deviceId) || (userId && license.user_id !== userId)) {
      const updatedDevices = devices.includes(deviceId) ? devices : [...devices, deviceId];
      const { error: updateError } = await supabase
        .from('licenses')
        .update({ 
          devices: updatedDevices,
          user_id: userId || license.user_id 
        })
        .eq('id', license.id);
      
      if (updateError) throw updateError;
    }
    
    // If we found a valid license for this user, activate it locally
    // We loosen the device check here to prevent the "again key" loop
    // But still save the device if possible
    localStorage.setItem('device_license', 'true');
    localStorage.setItem('active_license_key', key.toUpperCase());
    setIsDeviceLicensed(true);

    if (license.expiry_at) {
      localStorage.setItem('license_expiry', license.expiry_at);
      setLicenseExpiry(license.expiry_at);
    }
    
    // We update devices list but don't block if it fails since we already marked it as licensed locally
    try {
      const devices = Array.isArray(license.devices) ? license.devices : [];
      if (!devices.includes(deviceId)) {
        await supabase.from('licenses').update({ devices: [...devices, deviceId] }).eq('id', license.id);
      }
    } catch (e) {
      console.warn('Device bind skipped', e);
    }
  };

  const fetchLicenses = async () => {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'Fetch Licenses');
    return data || [];
  };

  const resetLicenseDevice = async (id: string) => {
    const { error } = await supabase
      .from('licenses')
      .update({ 
        device_id: null, 
        devices: [], 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'Reset License Device');
  };

  const getInitialLicenseState = () => {
    const licensed = localStorage.getItem('device_license') === 'true';
    const expiry = localStorage.getItem('license_expiry');
    if (licensed && expiry && new Date(expiry) < new Date()) {
      localStorage.removeItem('device_license');
      localStorage.removeItem('active_license_key');
      localStorage.removeItem('license_expiry');
      return false;
    }
    return licensed;
  };

  const [isDeviceLicensed, setIsDeviceLicensed] = useState(getInitialLicenseState);
  const [licenseExpiry, setLicenseExpiry] = useState<string | null>(() => localStorage.getItem('license_expiry'));

  const isTrialExpired = React.useMemo(() => {
    // License required ONLY on first company creation or activation
    if (isDeviceLicensed) return false;
    
    // If they already have a company, we assume they passed the initial check 
    // unless the user specifically wants to block ALL companies if trial expires.
    // The prompt says "if trial KTM hojati ha tb magar ab mujhe wo nhi me chata humble app me new company create krne or login krne ke waqt first time license key require ho"
    // This means license is checked ONLY when creating first company.
    
    return false; // By default don't block via isTrialExpired anymore, handle in Creation logic
  }, [currentCompany, isDeviceLicensed]);

  useEffect(() => {
    const licensed = localStorage.getItem('device_license') === 'true';
    const expiry = localStorage.getItem('license_expiry');
    
    let stillValid = licensed;
    if (licensed && expiry) {
      if (new Date(expiry) < new Date()) {
        stillValid = false;
        localStorage.removeItem('device_license');
        localStorage.removeItem('active_license_key');
        localStorage.removeItem('license_expiry');
      }
    }

    if (stillValid !== isDeviceLicensed) {
      setIsDeviceLicensed(stillValid);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'device_license') {
        setIsDeviceLicensed(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isDeviceLicensed]);

  // Centralized Admin check
  const isAdmin = React.useMemo(() => {
    const adminEmail = 'sudaiskamran31@gmail.com';
    const emailFromSettings = settings.user_email?.trim().toLowerCase();
    const emailFromSession = session?.user?.email?.trim().toLowerCase();
    const emailFromUser = currentUser?.trim().toLowerCase();

    return emailFromSettings === adminEmail || 
           emailFromSession === adminEmail || 
           emailFromUser === 'sudaiskamran31' ||
           emailFromUser === 'sudaiskamran31@gmail.com' ||
           settings.user_email === '16897463890072@1689746389007200';
  }, [settings.user_email, session, currentUser]);

  useEffect(() => {
    if (isAdmin) {
      console.log('[App] Root Admin Access Detected');
    }
  }, [isAdmin]);

  const signOut = async () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setCurrentCompany(null);
    setCompanies([]);
    setSession(null);
    await supabase.auth.signOut();
  };

  const isSharedCompany = (company?: Company | null) => {
    if (!company) return false;
    
    // Admin bypass: if they are the admin, they might have special access,
    // but we still want to know if they are the ORIGINAL owner for UI buttons.
    
    const myEmail = (session?.user?.email || settings.user_email || currentUser || '').toLowerCase().trim();
    if (!myEmail) return false;

    const ownerEmail = (company.owner_email || company.user_email || '').toLowerCase().trim();
    const myId = session?.user?.id;
    const ownerId = company.owner_id || company.user_id;
    
    // If I am the owner (by ID or Email or Username), it's not shared
    if (ownerId && myId && ownerId === myId) return false;
    if (ownerEmail && myEmail && ownerEmail === myEmail) return false;
    if (company.username && myEmail && company.username.toLowerCase() === myEmail) return false;
    
    // If it was created offline and hasn't been synced (no owner_email), it's mine
    if (company.company_type === 'hr' || (!company.owner_email && !company.owner_id)) return false;

    return true;
  };

  const manualSyncLogin = async (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[Sync] Requesting verification code for: ${normalizedEmail}`);
    
    // Update local settings immediately
    updateSettings({ user_email: normalizedEmail, sync_enabled: true });

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          // Explicitly NOT providing emailRedirectTo forces token behavior in many cases
          // or at least doesn't confuse the flow with local URLs
        },
      });
      
      if (error) {
        console.error('[Sync OTP Error Raw]', error);
        
        // Handle empty error {} or specific rate limits
        let errorMessage = 'Failed to send code ❌';
        if (error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'object') {
          errorMessage = (error as any).error_description || (error as any).msg || JSON.stringify(error);
        }

        if (errorMessage.toLowerCase().includes('rate limit') || errorMessage.includes('429')) {
          throw new Error('Too many requests. Please wait 60 seconds before trying again ⏳');
        }
        
        if (errorMessage === '{}') {
          throw new Error('Supabase configuration error. Ensure Email Auth is enabled in dashboard.');
        }

        throw new Error(errorMessage);
      }
      
      return "SENT";
    } catch (err: any) {
      console.error('[Sync OTP Exception]', err);
      throw new Error(err.message || 'Verification service unavailable ❌');
    }
  };

  const quickVerify = async (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return false;

    console.log(`[Sync] Quick-verifying email: ${normalizedEmail}`);
    
    try {
      // 1. Mark as verified in settings
      updateSettings({ 
        user_email: normalizedEmail, 
        sync_enabled: true, 
        is_verified: true 
      });

      // 2. CRITICAL: Migrate local session to email session to prevent "Login Page" redirect
      const oldUser = currentUser;
      const newUser = normalizedEmail.split('@')[0] || normalizedEmail; 
      
      if (oldUser && oldUser !== newUser) {
        // Copy current local companies to the new email-based key in localStorage
        const localData = localStorage.getItem(`companies_${oldUser}`);
        if (localData) {
          localStorage.setItem(`companies_${newUser}`, localData);
        }
        
        const localCurrent = localStorage.getItem(`currentCompany_${oldUser}`);
        if (localCurrent) {
          localStorage.setItem(`currentCompany_${newUser}`, localCurrent);
        }

        // Switch context
        setCurrentUser(newUser);
        localStorage.setItem('currentUser', newUser);
      } else if (!oldUser) {
        setCurrentUser(newUser);
        localStorage.setItem('currentUser', newUser);
      }

      // 3. Start background sync
      refreshData(normalizedEmail, true).catch(e => console.error('Quick sync error:', e));
      fetchInvitations(normalizedEmail).catch(e => console.error('Quick fetch invites error:', e));
      
      // 4. Silent background sign-in attempt (optional, doesn't block)
      supabase.auth.signInWithOtp({ 
        email: normalizedEmail,
        options: { shouldCreateUser: true }
      }).catch(() => {});

      return true;
    } catch (err: any) {
      console.error('[Quick Verify Error]', err);
      return true;
    }
  };

  const verifySyncCode = async (email: string, token: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedToken = token.trim();
    
    try {
      // Supabase OTP can be "magiclink", "signup", or "email" depending on user state
      // We try them in order of probability for a login flow
      let result = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'magiclink',
      });

      if (result.error || !result.data.session) {
        console.warn('[Verify OTP] magiclink failed, trying signup...', result.error);
        result = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'signup',
        });
      }

      if (result.error || !result.data.session) {
        console.warn('[Verify OTP] signup failed, trying email type...', result.error);
        result = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'email',
        });
      }

      if (result.error || !result.data.session) {
        console.warn('[Verify OTP] email failed, trying invite type...', result.error);
        result = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'invite',
        });
      }

      if (result.error) {
        console.error('[Verify OTP Error Full]', result.error);
        throw new Error(result.error.message || 'Invalid or expired code ❌');
      }

      const { data } = result;
      if (data.session) {
        setSession(data.session);
        const email = normalizedEmail || data.session.user?.email || '';
        updateSettings({ is_verified: true, user_email: email, sync_enabled: true });
        // Immediately trigger refresh
        refreshData(email, true).catch(e => console.error('Sync verify refresh error:', e));
        fetchInvitations(email).catch(e => console.error('Early fetch invites error:', e));
        return true;
      }
      
      // Fallback: If no session but no error, it might be a partial success or already verified
      // But for login flow we really want a session.
      console.warn('[Verify OTP] Success but no session returned');
      updateSettings({ is_verified: true, user_email: normalizedEmail, sync_enabled: true });
      return true;
    } catch (err: any) {
      throw new Error(err.message || 'Verification failed ❌');
    }
  };

  const confirmSyncLogin = async (email: string, token: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedToken = token.trim();
    
    console.log(`[Sync] Verifying OTP for: ${normalizedEmail}`);
    
    try {
      let result = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: 'magiclink',
      });

      if (result.error || !result.data.session) {
        console.warn('[Sync Verify] magiclink failed, trying signup...', result.error);
        result = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'signup',
        });
      }

      if (result.error || !result.data.session) {
        console.warn('[Sync Verify] signup failed, trying email type...', result.error);
        result = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'email',
        });
      }

      if (result.error || !result.data.session) {
        console.warn('[Sync Verify] email failed, trying invite type...', result.error);
        result = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedToken,
          type: 'invite',
        });
      }

      if (result.error) {
        console.error('[Sync Verify Error Full]', result.error);
        throw new Error(result.error.message || 'Invalid or expired code ❌');
      }

      const { data } = result;
      // CRITICAL: Force update both session and settings
      if (data.session) {
        setSession(data.session);
        const email = normalizedEmail || data.session.user?.email || '';
        updateSettings({ is_verified: true, user_email: email, sync_enabled: true });
        
        // Immediately pull data
        refreshData(email, true).catch(e => console.error('Confirm login refresh error:', e));
        fetchInvitations(email).catch(e => console.error('Confirm login fetch invites error:', e));
        
        return true;
      }
      
      updateSettings({ user_email: normalizedEmail, sync_enabled: true, is_verified: true });
      
      // Essential: Start sync immediately but don't strictly block UI transition if these are slow
      refreshData(normalizedEmail, true).catch(e => {
        console.error('Initial sync error:', e);
        // If sync fails but auth succeeded, we still want to be in "active" step
      });
      fetchInvitations(normalizedEmail).catch(e => console.error('Fetch invites error:', e));
      
      return true;
    } catch (err: any) {
      throw new Error(err.message || 'Verification failed ❌');
    }
  };

  const shareCompany = async (companyId: string, shareWithEmail: string) => {
    if (!currentCompany) throw new Error('No company selected ❌');
    
    console.log('[Invite] Initiating invite for:', shareWithEmail);

    const authEmail = (settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();
    const myEmail = authEmail;
    
    if (!myEmail) throw new Error('Please login or enable sync first ❌');

    // 1. Verify Sender (must be verified)
    const isEmailVerified = session?.user?.email_confirmed_at || settings.is_verified;
    // For admin, we skip verification check or assume true
    if (!isEmailVerified && !isAdmin) {
      throw new Error('Please verify your email before inviting others 🛡️');
    }

    const inviteeEmail = shareWithEmail.toLowerCase().trim();
    if (inviteeEmail === myEmail) throw new Error('You cannot invite yourself ❌');

    // 2. Check for existing entries securely using RPC
    let existingInvite = null;
    let existingMember = null;

    // Use RPC to check existing invitations
    const { data: inv } = await supabase.rpc('get_table_data_by_email', {
      req_company_id: companyId,
      req_email: myEmail,
      req_table: 'company_invites'
    });
    existingInvite = (inv as any[])?.find(i => 
      i.invited_email.toLowerCase() === inviteeEmail && i.status === 'pending'
    );

    // Use RPC to check existing members
    const { data: mem } = await supabase.rpc('get_table_data_by_email', {
      req_company_id: companyId,
      req_email: myEmail,
      req_table: 'company_members'
    });
    existingMember = (mem as any[])?.find(m => 
      m.user_email?.toLowerCase() === inviteeEmail
    );

    if (existingInvite) throw new Error('An invitation is already pending for this user ⏳');
    if (existingMember) throw new Error('User is already a member of this company ✅');

    // 4. Create Invite
    const { error: rpcError } = await supabase.rpc('upsert_table_data_by_email', {
      req_email: myEmail,
      req_payload: {
        company_id: companyId,
        invited_email: inviteeEmail,
        invited_by: myEmail,
        status: 'pending'
      },
      req_table: 'company_invites'
    });

    if (rpcError) {
      console.error('[Invite Error]', rpcError);
      throw new Error(rpcError.message || 'Failed to create invitation ❌');
    }

    toast.success(`Invitation sent to ${inviteeEmail}! 🚀`);
    await fetchSentInvitations(companyId);
  };

   const fetchInvitations = async (emailOverride?: string) => {
    const email = (emailOverride || settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();
    if (!email) return;

    console.log('[Sync] Fetching invitations for:', email);
    
    // Always use RPC to bypass RLS for invitations
    const { data, error } = await supabase.rpc('get_invites_for_email', { req_email: email });

    if (!error && data) {
      setInvitations(data.map((item: any) => ({
        ...item,
        companies: { name: item.company_name }
      })));
    } else if (error) {
      console.error('[Fetch Invites Error]', error);
    }
  };

  const fetchSentInvitations = async (companyId: string) => {
    if (!companyId) return;
    
    const authEmail = (settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();
    if (!authEmail) return;

    try {
      const { data, error } = await supabase.rpc('get_company_team', {
        req_company_id: companyId,
        req_email: authEmail
      });

      if (error) throw error;

      if (data) {
        setSentInvitations(data.map((item: any) => ({
          id: item.id,
          invited_email: item.invited_email,
          status: item.status,
          role: item.role,
          created_at: item.created_at
        })));
      }
    } catch (err) {
      console.error('Fetch team failed:', err);
    }
  };

  const updateInvitationStatus = async (inviteId: string, status: 'accepted' | 'rejected') => {
    console.log('[Invitation] Updating status:', { inviteId, status });
    const email = (settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();
    if (!email) throw new Error('Email required to process invitation');

    try {
      // Always use RPC for invitation response to bypass RLS and ensure server-side linked_emails update
      const { error: rpcError } = await supabase.rpc('respond_to_invite_by_email', {
        req_invite_id: inviteId,
        req_status: status,
        req_email: email
      });
      
      if (rpcError) throw rpcError;
      
      if (status === 'accepted') {
        toast.success('Successfully joined the company! 🎉');
        // Give the DB a moment to process everything before refreshing
        setTimeout(async () => {
          await refreshData(email, true);
          await fetchInvitations();
        }, 1000);
      } else {
        toast.success('Invitation declined');
        await fetchInvitations();
      }
      
      setInvitations(prev => prev.filter(i => i.id !== inviteId));
    } catch (err: any) {
      console.error('[Invitation Status Update Error]', err);
      toast.error(err.message || 'Failed to update invitation status');
      throw err;
    }
  };

  const revokeCompanyAccess = async (companyId: string, sharedEmail: string) => {
    console.log('[Access] Revoking access for:', sharedEmail);
    const emailToRevoke = sharedEmail.toLowerCase().trim();
    const authEmail = (settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();

    if (!authEmail) throw new Error('Authentication required to revoke access ❌');

    try {
      // 1. Revoke Invite (if pending)
      const { data: inv, error: invError } = await supabase.rpc('get_table_data_by_email', {
        req_company_id: companyId,
        req_email: authEmail,
        req_table: 'company_invites'
      });

      if (invError) console.error('[Revoke] Error fetching invites:', invError);
      
      const targetInv = (inv as any[])?.find(i => i.invited_email?.toLowerCase() === emailToRevoke);
      console.log('[Revoke] Target Invite found:', targetInv ? targetInv.id : 'None');

      if (targetInv) {
        const { error: delInvError } = await supabase.rpc('delete_table_data_by_email', {
          req_email: authEmail,
          req_id: targetInv.id,
          req_table: 'company_invites'
        });
        if (delInvError) throw delInvError;
        console.log('[Revoke] Pending invite deleted successfully');
      }

      // 2. Revoke Membership (if accepted)
      const { data: mem, error: memError } = await supabase.rpc('get_table_data_by_email', {
        req_company_id: companyId,
        req_email: authEmail,
        req_table: 'company_members'
      });

      if (memError) console.error('[Revoke] Error fetching members:', memError);

      const targetMem = (mem as any[])?.find(m => m.user_email?.toLowerCase() === emailToRevoke);
      console.log('[Revoke] Target Member found:', targetMem ? targetMem.id : 'None');

      if (targetMem) {
        const { error: delMemError } = await supabase.rpc('delete_table_data_by_email', {
          req_email: authEmail,
          req_id: targetMem.id,
          req_table: 'company_members'
        });
        if (delMemError) throw delMemError;
        console.log('[Revoke] Active membership deleted successfully');
      }

      toast.success(`Access revoked for ${sharedEmail}`);
      // Force refresh of the team list
      await fetchSentInvitations(companyId);
    } catch (err: any) {
      console.error('[Revoke Access Error]', err);
      const msg = err.message || 'Failed to revoke access';
      if (msg.includes('policy')) {
        toast.error('Permission denied: Only the business owner can revoke access.');
      } else {
        toast.error(msg);
      }
      throw err;
    }
  };

  const getSharedCompanies = async () => {
    const myEmail = (session?.user?.email || settings.user_email || '').toLowerCase().trim();
    if (!myEmail) return [];

    console.log('[Sync] Fetching shared companies for:', myEmail);
    
    // Always use RPC to find companies where this email is a member to bypass RLS efficiently
    const { data: memberships, error } = await supabase.rpc('get_memberships_for_email', { 
      req_email: myEmail 
    });

    if (error) {
      console.error('[Shared Companies RPC Error]', error);
      return [];
    }

    // Include the membership_id so we can leave easily
    const filtered = (memberships || [])
      .map((m: any) => ({
        ...m.companies,
        membership_id: m.membership_id // Track membership ID for leaving
      }))
      .filter((c: any) => c && c.user_email?.toLowerCase() !== myEmail && c.owner_email?.toLowerCase() !== myEmail);

    return filtered;
  };

  const leaveCompany = async (companyId: string) => {
    const authEmail = (settings.user_email || currentUser || session?.user?.email || '').toLowerCase().trim();
    if (!authEmail) throw new Error('Authentication required to leave company ❌');

    try {
      // 1. Mark as leaving locally to prevent ghost reappearances during pull
      setLeavingIds(prev => [...prev, companyId]);

      // 2. Call RPC to leave
      const { error } = await supabase.rpc('rpc_leave_company', {
        req_company_id: companyId,
        req_email: authEmail
      });
      
      if (error) throw error;
      
      // 3. Filter companies locally using functional update to be absolutely sure
      let nextToSet: Company | null = null;
      setCompanies(prev => {
        const updated = prev.filter(c => c.id !== companyId);
        companiesRef.current = updated; // Update ref immediately
        nextToSet = updated.length > 0 ? updated[0] : null;
        if (currentUser) {
           // We save without the left company
           const allCompanies = JSON.parse(localStorage.getItem(`companies_${currentUser}`) || '[]');
           const filteredAll = allCompanies.filter((c: any) => c.id !== companyId);
           localStorage.setItem(`companies_${currentUser}`, JSON.stringify(filteredAll));
        }
        return updated;
      });
      
      // 4. Handle navigation if deleting current
      if (currentCompany?.id === companyId) {
        setCurrentCompany(nextToSet);
        if (currentUser) {
          if (nextToSet) {
            localStorage.setItem(`currentCompany_${currentUser}`, JSON.stringify(nextToSet));
          } else {
            localStorage.removeItem(`currentCompany_${currentUser}`);
          }
        }
      }
      
      // 5. Robust Cleanup: Clear local storage related to this company
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes(companyId) || key.includes(`_${companyId}`))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        // Ignored
      }
      
      toast.success('Successfully left company');
      
      // 6. Delayed cleanup of ignored ID and refresh
      setTimeout(async () => {
        setLeavingIds(prev => prev.filter(id => id !== companyId));
        await refreshData(authEmail, true);
      }, 5000); // 5s to ensure cloud settled

      return true;
    } catch (err: any) {
      console.error('[Leave Error]', err);
      toast.error(err.message || 'Failed to leave company');
      throw err;
    }
  };

  const getPartyBalance = (partyId: string) => {
    if (!partyId || !Array.isArray(parties) || !Array.isArray(transactions) || !Array.isArray(invoices)) return 0;
    
    const party = parties.find(p => p && p.id === partyId);
    if (!party) return 0;
    
    let balance = party.opening_balance || 0;
    
    // Process transactions
    transactions.filter(t => t && (t.party_id === partyId || t.to_party_id === partyId)).forEach(tx => {
      if (tx.party_id === partyId) {
        if (tx.type === 'Payment In' || tx.type === 'Sale' || tx.type === 'Bank To Party' || tx.type === 'Cash To Party') balance += tx.amount || 0;
        if (tx.type === 'Payment Out' || tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Party To Bank' || tx.type === 'Party To Party' || tx.type === 'Party To Cash') balance -= tx.amount || 0;
      }
      if (tx.to_party_id === partyId) {
        balance += tx.amount || 0;
      }
    });

    // Process invoices
    invoices.filter(i => i && i.party_id === partyId).forEach(inv => {
      if (inv.type === 'Sale') balance += inv.total || 0;
      if (inv.type === 'Purchase') balance -= inv.total || 0;
    });

    return balance;
  };

  const getBankBalance = (bankId: string) => {
    if (!bankId || !Array.isArray(banks) || !Array.isArray(transactions) || !Array.isArray(invoices)) return 0;
    
    const bank = banks.find(b => b && b.id === bankId);
    if (!bank) return 0;
    
    let balance = bank.opening_balance || 0;
    
    // Process transactions
    transactions.filter(t => t && (t.bank_id === bankId || t.to_bank_id === bankId)).forEach(tx => {
      if (tx.bank_id === bankId) {
        // Money leaving bank
        if (tx.type === 'Bank To Bank' || tx.type === 'Bank To Party' || tx.type === 'Withdraw' || tx.type === 'Cash Withdraw' || tx.type === 'Bank To Cash' || tx.type === 'Expense' || tx.type === 'Purchase') {
          balance -= tx.amount || 0;
        }
        // Money entering bank
        if (tx.type === 'Deposit' || tx.type === 'Cash Deposit' || tx.type === 'Income' || tx.type === 'Sale' || tx.type === 'Cash To Bank' || tx.type === 'Adjust Cash') {
          balance += tx.amount || 0;
        }
      }
      if (tx.to_bank_id === bankId) {
        balance += tx.amount || 0;
      }
    });

    // Process invoices paid via this bank
    invoices.filter(i => i && i.bank_id === bankId).forEach(inv => {
      if (inv.type === 'Sale') balance += inv.total || 0;
      if (inv.type === 'Purchase') balance -= inv.total || 0;
    });

    return balance;
  };

  return (
    <AppContext.Provider value={{
      companies, 
      currentCompany, 
      setCurrentCompany: (company) => {
        setCurrentCompany(company);
        const userKey = currentUser || 'default';
        localStorage.setItem(`currentCompany_${userKey}`, JSON.stringify(company));
      },
      parties, banks, items, transactions, invoices, settings, syncStatus,
      updateSettings, refreshData, pullCompanies, linkDevice,
      addTransaction, addTransactions, updateTransaction,
      addParty, updateParty, deleteParty, addBank, updateBank, deleteBank,
      addItem, updateItem, deleteItem, deleteTransaction,
      addCompany, updateCompany, deleteCompany,
      backupData, restoreData,
      addInvoice, updateInvoice, deleteInvoice,
      submitPaymentRequest, fetchPaymentRequests, updatePaymentRequestStatus,
      paymentStatus,
      activateLicense, fetchLicenses, resetLicenseDevice,
      isDeviceLicensed,
      licenseExpiry,
      isTrialExpired,
      isLicensed: () => isDeviceLicensed,
      loginWithUsername,
      restoreCompany,
      isAdmin,
      selectedPartyId, setSelectedPartyId, selectedBankId, setSelectedBankId,
      session, signOut, isOnline,
      manualSyncLogin,
      quickVerify,
      verifySyncCode,
      confirmSyncLogin,
      shareCompany,
      revokeCompanyAccess,
      getSharedCompanies,
      leaveCompany,
      isSharedCompany,
      invitations,
      fetchInvitations,
      updateInvitationStatus,
      sentInvitations,
      fetchSentInvitations,
      getPartyBalance,
      getBankBalance
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
