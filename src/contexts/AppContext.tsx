import React, { createContext, useContext, useEffect, useState } from 'react';
import { Company, Party, BankAccount, InventoryItem as Item, Transaction, AppSettings, Invoice, Invitation, CompanyAccess, HRTransferRequest } from '../types';
import { supabase } from '../lib/supabase';
import { addDays, isAfter } from 'date-fns';

interface AppContextType {
  companies: Company[];
  currentCompany: Company | null;
  setCurrentCompany: (company: Company) => Promise<void>;
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
  addCompany: (company: Omit<Company, 'id' | 'created_at'>) => Promise<void>;
  updateCompany: (id: string, company: Partial<Company>) => Promise<void>;
  backupData: () => void;
  restoreData: (json: string) => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'created_at'>) => Promise<void>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string, hard?: boolean) => Promise<void>;
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
  deviceId: string;
  manualSyncLogin: (email: string) => Promise<string>;
  confirmSyncLogin: (email: string, token: string) => Promise<boolean>;
  sendInvitation: (email: string) => Promise<void>;
  respondToInvitation: (invitationId: string, status: 'Accepted' | 'Rejected') => Promise<void>;
  getInvitations: () => Promise<Invitation[]>;
  getCompanyUsers: (companyId: string) => Promise<CompanyAccess[]>;
  removeUser: (companyId: string, email: string) => Promise<void>;
  requestHRTransfer: (companyId: string) => Promise<string>;
  approveHRTransfer: (requestId: string) => Promise<void>;
  getHRTransferRequests: () => Promise<HRTransferRequest[]>;
  getSharedCompanies: () => Promise<Company[]>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mergeData = <T extends { id: string; updated_at?: string; created_at?: string; deleted_at?: string | null; _synced?: boolean }>(
  local: T[],
  cloud: T[]
): { merged: T[]; toUpload: T[] } => {
  const mergedMap = new Map<string, T>();
  const toUploadMap = new Map<string, T>();

  // Mark all cloud items as synced
  const cloudItems = cloud.map(item => ({ ...item, _synced: true }));
  const cloudIds = new Set(cloudItems.map(c => c.id));

  // Start with local data
  local.forEach(item => mergedMap.set(item.id, item));

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
  const [deviceId] = useState(() => {
    let id = localStorage.getItem('bugzy_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
      localStorage.setItem('bugzy_device_id', id);
    }
    return id;
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => localStorage.getItem('currentUser'));
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
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
      return;
    }

    const id = currentCompany.id;
    const load = (key: string) => {
      const saved = localStorage.getItem(`${key}_${id}`);
      return saved ? JSON.parse(saved) : [];
    };

    setParties(load('parties'));
    setBanks(load('banks'));
    setItems(load('items'));
    setTransactions(load('transactions'));
    setInvoices(load('invoices'));
  }, [currentCompany, currentUser]);

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
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);

  // Background Auto-Sync (Vyapar Style)
  useEffect(() => {
    if (!currentCompany || !isOnline || !settings.sync_enabled) return;
    
    const interval = setInterval(() => {
      console.log('[Background Sync] Triggering auto-sync...');
      refreshData(undefined, true).catch(console.error);
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [currentCompany?.id, isOnline, settings.sync_enabled]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasInitialSynced = React.useRef<Record<string, boolean>>({});
  const isInternalUpdate = React.useRef(false);

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
    if (currentCompany) {
      localStorage.setItem('currentCompany', JSON.stringify(currentCompany));
      // Trigger data pull when company changes
      refreshData(undefined, true);
    } else {
      localStorage.removeItem('currentCompany');
      setParties([]);
      setBanks([]);
      setItems([]);
      setTransactions([]);
      setInvoices([]);
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
        if (payload.new && (payload.new as any).user_email === settings.user_email) {
          const updatedCompany = payload.new as Company;
          setCompanies(prev => {
            const exists = prev.find(c => c.id === updatedCompany.id);
            if (exists) {
              // Only update if data actually changed to avoid re-render loops
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
        }
      })
      .subscribe();

    const accessChannel = supabase
      .channel('access-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_access' }, (payload) => {
        const email = settings.user_email?.toLowerCase();
        if (!email) return;

        const data = (payload.new || payload.old) as any;
        if (data.user_email?.toLowerCase() === email) {
          // If our access was modified or added, we should reload shared companies or refresh companies list
          // For simplicity, we just trigger refresh
          refreshData(undefined, true).catch(console.error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(accessChannel);
    };
  }, [settings.user_email, currentCompany?.id]);

  const refreshData = async (emailOverride?: string, force = false) => {
    const email = emailOverride || settings.user_email;
    const username = currentUser;
    
    if (!settings.sync_enabled || (!email && !username)) return;
    
    // Prevent redundant syncs unless forced
    if (!force && currentCompany && hasInitialSynced.current[currentCompany.id]) {
      console.log(`[Sync] Skipping redundant sync for ${currentCompany.id}`);
      return;
    }

    setSyncStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      // 1. Pull Companies
      let query = supabase.from('companies').select('*');
      
      if (email) {
        // PostgREST cs syntax for arrays with dots requires quoting the value inside the braces
        // Also quoting the user_email eq value for safety with dots
        query = query.or(`user_email.eq."${email}",linked_emails.cs.{"${email}"}`);
      } else if (username) {
        query = query.eq('username', username);
      }

      const localCompanies = companies;
      const { data: cloudCompanies, error: compError } = await query;
      
      if (compError) {
        console.error('Error fetching companies:', compError);
        // If we have local companies, continue with them. If not, stop.
        if (localCompanies.length === 0) {
            setSyncStatus({ loading: false, error: 'Failed to connect to cloud', success: null });
            return;
        }
      }
      
      const { merged: mergedCompanies, toUpload: companiesToUpload } = mergeData(localCompanies, cloudCompanies || []);
      
      const nonDeletedCompanies = mergedCompanies.filter(c => !c.deleted_at);
      if (JSON.stringify(companies) !== JSON.stringify(nonDeletedCompanies)) {
        setCompanies(nonDeletedCompanies);
      }
      localStorage.setItem(`companies_${username || email || currentUser}`, JSON.stringify(mergedCompanies));

      if (companiesToUpload.length > 0) {
        await syncToCloud('companies', companiesToUpload);
      }
      
      let activeCompany = currentCompany;
      if (!activeCompany && nonDeletedCompanies.length > 0) {
        activeCompany = nonDeletedCompanies[0];
        setCurrentCompany(activeCompany);
      } else if (activeCompany) {
        // Just in case currentCompany was updated during merge
        const updatedActive = mergedCompanies.find(c => c.id === activeCompany?.id);
        if (updatedActive && JSON.stringify(activeCompany) !== JSON.stringify(updatedActive)) {
          setCurrentCompany(updatedActive);
        }
      }

      if (!activeCompany) {
          setSyncStatus({ loading: false, error: null, success: null });
          return;
      }

      // 2. Multi-Company Detail Sync (Sync active first, then others)
      const otherCompanies = nonDeletedCompanies.filter(c => c.id !== activeCompany?.id);

      const syncOneCompany = async (comp: Company) => {
        if (comp.company_type === 'hr') return; // Strictly offline
        const fetchAndMerge = async (table: string, setter: (data: any[]) => void) => {
          try {
            const dbTable = table === 'items' ? 'inventory' : table;
            const { data, error } = await supabase.from(dbTable).select('*').eq('company_id', comp.id);
            if (error) {
              if (error.code === 'PGRST116' || error.message.includes('relation')) return;
              throw error;
            }
            
            const localKey = `${table}_${comp.id}`;
            const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
            const { merged, toUpload } = mergeData(localData, data || []);
            
            localStorage.setItem(localKey, JSON.stringify(merged));
            if (comp.id === activeCompany?.id) {
              isInternalUpdate.current = true;
              setter(merged.filter(i => {
                  if (!i) return false;
                  if (i.deleted_at && i.deleted_at !== '') return false;
                  return true;
              }));
              isInternalUpdate.current = false;
            }
            
            if (toUpload.length > 0 && settings.sync_enabled) {
              await syncToCloud(table, toUpload, false, comp.id);
            }
          } catch (err) {
            console.error(`Sync error for ${table} in ${comp.name}:`, err);
          }
        };

        return Promise.allSettled([
          fetchAndMerge('parties', setParties),
          fetchAndMerge('banks', setBanks),
          fetchAndMerge('items', setItems),
          fetchAndMerge('transactions', setTransactions),
          fetchAndMerge('invoices', setInvoices),
        ]);
      };

      if (activeCompany) {
          await syncOneCompany(activeCompany);
      }
      otherCompanies.forEach(comp => syncOneCompany(comp));

      hasInitialSynced.current[activeCompany?.id || ''] = true;
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

  const pullCompanies = async (email?: string) => {
    const targetEmail = email || settings.user_email;
    const username = currentUser;
    
    if (!targetEmail && !username) {
      setSyncStatus({ loading: false, error: 'No email or username found to pull data', success: null });
      return false;
    }
    
    setSyncStatus({ loading: true, error: null, success: null });
    try {
      let query = supabase.from('companies').select('*');
      
      if (targetEmail) {
        query = query.or(`user_email.eq."${targetEmail}",linked_emails.cs.{"${targetEmail}"}`);
      } else {
        query = query.eq('username', username);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const { merged, toUpload } = mergeData(companies, data);
        const nonDeleted = merged.filter(c => !c.deleted_at);
        // Actually, companies state should probably only have non-deleted ones for UI
        setCompanies(nonDeleted);
        
        if (toUpload.length > 0) {
          await syncToCloud('companies', toUpload);
        }
        
        if (!currentCompany && nonDeleted.length > 0) {
          setCurrentCompany(nonDeleted[0]);
        }
        
        setSyncStatus({ loading: false, error: null, success: `Successfully pulled ${data.length} companies` });
        return true;
      } else {
        setSyncStatus({ 
          loading: false, 
          error: 'No companies found in the cloud. If you have data on this device, click "Sync Now" to push it to the cloud.', 
          success: null 
        });
        return false;
      }
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
    const companyId = companyIdOverride || currentCompany?.id;
    const company = companyId === currentCompany?.id ? currentCompany : companies.find(c => c.id === companyId);
    
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
          if (dbTable === 'transactions' && sanitized.category) {
            sanitized.description = sanitized.description 
              ? `[${sanitized.category}] ${sanitized.description}`
              : `[${sanitized.category}]`;
            delete sanitized.category;
          }
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
          ? data.map(d => sanitize({ ...d, user_email: email }))
          : sanitize({ ...data, user_email: email });
        
        console.log(`[Sync Attempt] Table: ${dbTable}, Operation: ${isNew ? 'INSERT' : 'UPSERT'}`, dataWithEmail);
        
        // Robust Upsert with Recursive Column Stripping
        const performUpsert = async (payload: any): Promise<{ data: any, error: any }> => {
            const { data: res, error: err } = await supabase.from(dbTable).upsert(payload).select();
            
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
                const commonProblems = ['opening_stock', 'unit', 'category'];
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
        const { error } = await supabase.from(dbTable).delete().eq('id', id);
        if (error) {
            console.error(`[Delete Error] ${dbTable}:`, error);
            if (error.code === 'PGRST116' || error.message.includes('relation')) return;
            throw error;
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
    }, 1000);

    return () => clearTimeout(timer);
  }, [transactions, parties, banks, items, invoices, currentCompany?.id]);

  const recalculateBalances = async (allTransactions: Transaction[], allParties: Party[], allBanks: BankAccount[], allItems: Item[], allInvoices: Invoice[]) => {
    if (!currentCompany) return;

    const partyBalances: Record<string, number> = {};
    const bankBalances: Record<string, number> = {};
    const itemStock: Record<string, number> = {};

    allParties.forEach(p => partyBalances[p.id] = p.opening_balance || 0);
    allBanks.forEach(b => bankBalances[b.id] = b.opening_balance || 0);
    allItems.forEach(i => itemStock[i.id] = i.opening_stock || 0);

    // 1. Process Invoices
    allInvoices.forEach(inv => {
      if (inv.party_id && partyBalances[inv.party_id] !== undefined) {
        if (inv.type === 'Sale') partyBalances[inv.party_id] += inv.total;
        if (inv.type === 'Purchase') partyBalances[inv.party_id] -= inv.total;
      }
      
      if (inv.status === 'Paid' && inv.payment_type === 'Bank' && inv.bank_id && bankBalances[inv.bank_id] !== undefined) {
        if (inv.type === 'Sale') bankBalances[inv.bank_id] += inv.total;
        if (inv.type === 'Purchase') bankBalances[inv.bank_id] -= inv.total;
      }
      
      if (inv.items) {
        inv.items.forEach(item => {
          if (item.item_id && itemStock[item.item_id] !== undefined) {
            if (inv.type === 'Sale') itemStock[item.item_id] -= item.quantity;
            if (inv.type === 'Purchase') itemStock[item.item_id] += item.quantity;
          }
        });
      }
    });

    // 2. Process Transactions
    [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(tx => {
      if (tx.party_id && partyBalances[tx.party_id] !== undefined) {
        if (tx.type === 'Payment In' || tx.type === 'Sale') partyBalances[tx.party_id] += tx.amount;
        if (tx.type === 'Payment Out' || tx.type === 'Purchase' || tx.type === 'Expense' || tx.type === 'Party To Party' || tx.type === 'Party To Bank') partyBalances[tx.party_id] -= tx.amount;
        if (tx.type === 'Bank To Party') partyBalances[tx.party_id] += tx.amount;
      }
      if (tx.to_party_id && partyBalances[tx.to_party_id] !== undefined) {
        partyBalances[tx.to_party_id] += tx.amount;
      }

      if (tx.bank_id && bankBalances[tx.bank_id] !== undefined) {
        if (tx.type === 'Deposit' || tx.type === 'Payment In' || tx.type === 'Sale' || tx.type === 'Party To Bank') bankBalances[tx.bank_id] += tx.amount;
        if (tx.type === 'Withdraw' || tx.type === 'Payment Out' || tx.type === 'Expense' || tx.type === 'Bank To Bank' || tx.type === 'Bank To Party') bankBalances[tx.bank_id] -= tx.amount;
      }
      if (tx.to_bank_id && bankBalances[tx.to_bank_id] !== undefined) {
        bankBalances[tx.to_bank_id] += tx.amount;
      }

      if (tx.item_id && tx.quantity && itemStock[tx.item_id] !== undefined) {
        if (tx.type === 'Sale' || tx.type === 'Stock Out') itemStock[tx.item_id] -= tx.quantity;
        if (tx.type === 'Purchase' || tx.type === 'Stock In') itemStock[tx.item_id] += tx.quantity;
      }
    });

    const updatedParties = allParties.map(p => ({ ...p, balance: partyBalances[p.id] }));
    const updatedBanks = allBanks.map(b => ({ ...b, balance: bankBalances[b.id] }));
    const updatedItems = allItems.map(i => ({ ...i, stock: itemStock[i.id] }));

    // Only sync if values actually changed to save API calls
    const changedParties = updatedParties.filter((p, idx) => p.balance !== allParties[idx].balance);
    const changedBanks = updatedBanks.filter((b, idx) => b.balance !== allBanks[idx].balance);
    const changedItems = updatedItems.filter((i, idx) => i.stock !== allItems[idx].stock);

    setParties(updatedParties);
    setBanks(updatedBanks);
    setItems(updatedItems);

    localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(updatedParties));
    localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(updatedBanks));
    localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updatedItems));

    // Only sync if there are actual changes and we're not in the middle of an internal update
    if (settings.sync_enabled && !isInternalUpdate.current && !syncStatus.loading) {
      const partiesToSync = changedParties.map(p => syncToCloud('parties', p));
      const banksToSync = changedBanks.map(b => syncToCloud('banks', b));
      const itemsToSync = changedItems.map(i => syncToCloud('items', i));

      if (partiesToSync.length > 0 || banksToSync.length > 0 || itemsToSync.length > 0) {
        Promise.all([...partiesToSync, ...banksToSync, ...itemsToSync])
          .catch(err => console.error('Recalculate Sync Error:', err));
      }
    }
  };

  const addTransaction = async (tx: Omit<Transaction, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...tx,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    const updated = [newTx, ...transactions];
    
    // Instant UI Update
    setTransactions(updated);
    localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
    
    // Background Sync
    if (settings.sync_enabled) {
      const table = tx.type === 'Expense' ? 'expenses' : 'transactions';
      syncToCloud(table, newTx, true).catch(err => console.error('Add Transaction Sync Error:', err));
    }
    
    // Recalculate balances (also optimistic)
    await recalculateBalances(updated, parties, banks, items, invoices);
  };

  const updateTransaction = async (id: string, tx: Partial<Transaction>) => {
    if (!currentCompany) return;

    const now = new Date().toISOString();
    const updated = transactions.map(t => t.id === id ? { ...t, ...tx, updated_at: now } : t);
    setTransactions(updated);
    localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      const table = (tx.type === 'Expense' || updated.find(t => t.id === id)?.type === 'Expense') ? 'expenses' : 'transactions';
      await syncToCloud(table, updated.find(t => t.id === id));
    }
    await recalculateBalances(updated, parties, banks, items, invoices);
  };

  const addParty = async (party: Omit<Party, 'id' | 'created_at'>) => {
    if (!currentCompany) return;

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
            // Mapping for syncToCloud is done internally, but here we trigger both potentially
            await deleteFromCloud('transactions', id);
            if (tx.type === 'Expense') {
                // Also explicitly try 'expenses' literal table just in case legacy data exists
                await supabase.from('expenses').delete().eq('id', id);
            }
        }
      } else {
        const updatedAll = localAll.map((t: any) => t.id === id ? { ...t, deleted_at: now, updated_at: now } : t);
        localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updatedAll));
        if (settings.sync_enabled) {
            const table = tx.type === 'Expense' ? 'expenses' : 'transactions';
            await syncToCloud(table, { ...tx, deleted_at: now, updated_at: now });
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

  const addCompany = async (company: Omit<Company, 'id' | 'created_at'>) => {
    setSyncStatus({ loading: true, error: null, success: null });
    
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
    const deviceId = localStorage.getItem('device_id') || crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);

    const newCompany: Company = {
      ...company,
      id: generateId(),
      user_email: settings.user_email || '',
      username: company.username || currentUser || '',
      company_type: company.company_type || 'normal',
      created_at: now,
      updated_at: now,
      my_role: 'OWNER',
      owner_email: settings.user_email?.toLowerCase() || '',
      device_id: deviceId
    };
    
    try {
      // Check if username is taken by ANOTHER account
      const targetUsername = (company.username || currentUser || '').toLowerCase().trim();
      if (!targetUsername) throw new Error('Username is required');

      // Save to cloud ONLY if it's NOT an HR company
      if (newCompany.company_type !== 'hr') {
        const { error } = await supabase.from('companies').insert(newCompany);
        if (error) {
          if (error.message.includes('unique constraint') || error.code === '23505') {
            throw new Error(`Username "${targetUsername}" is already in use by another account ❌. Please choose a different username.`);
          }
          throw error;
        }

        // Add to company_access
        if (settings.user_email) {
          await supabase.from('company_access').insert({
            company_id: newCompany.id,
            user_email: settings.user_email.toLowerCase(),
            role: 'OWNER'
          });
        }
      }

      // Update local state
      const updatedCompanies = [...companies, newCompany];
      setCompanies(updatedCompanies);
      setCurrentCompany(newCompany);
      localStorage.setItem(`companies_${newCompany.username || currentUser}`, JSON.stringify(updatedCompanies));
      localStorage.setItem(`currentCompany_${newCompany.username || currentUser}`, JSON.stringify(newCompany));
      
      if (!currentUser) {
        setCurrentUser(newCompany.username);
        localStorage.setItem('currentUser', newCompany.username);
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
    if (currentCompany?.my_role === 'MEMBER') {
        alert('Action restricted: Only OWNER can create backups ❌');
        return;
    }
    
    const data: any = {
      username: currentUser,
      companies: JSON.parse(localStorage.getItem(`companies_${currentUser}`) || '[]'),
      settings: JSON.parse(localStorage.getItem('app_settings') || '{}'),
      companyData: {}
    };

    data.companies.forEach((c: any) => {
      data.companyData[c.id] = {
        parties: JSON.parse(localStorage.getItem(`parties_${c.id}`) || '[]'),
        banks: JSON.parse(localStorage.getItem(`banks_${c.id}`) || '[]'),
        items: JSON.parse(localStorage.getItem(`items_${c.id}`) || '[]'),
        transactions: JSON.parse(localStorage.getItem(`transactions_${c.id}`) || '[]'),
        invoices: JSON.parse(localStorage.getItem(`invoices_${c.id}`) || '[]'),
      };
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${currentUser}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const restoreData = async (json: string) => {
    if (currentCompany?.my_role === 'MEMBER') {
        alert('Action restricted: Only OWNER can restore data ❌');
        return;
    }
    try {
      const data = JSON.parse(json);
      if (!data.username) throw new Error('Invalid backup file');

      // REPLACE ALL DATA
      localStorage.clear();
      
      localStorage.setItem('currentUser', data.username);
      localStorage.setItem(`companies_${data.username}`, JSON.stringify(data.companies));
      localStorage.setItem('app_settings', JSON.stringify(data.settings));
      if (data.device_license) localStorage.setItem('device_license', data.device_license);
      if (data.active_license_key) localStorage.setItem('active_license_key', data.active_license_key);

      Object.keys(data.companyData).forEach(companyId => {
        const cData = data.companyData[companyId];
        localStorage.setItem(`parties_${companyId}`, JSON.stringify(cData.parties));
        localStorage.setItem(`banks_${companyId}`, JSON.stringify(cData.banks));
        localStorage.setItem(`items_${companyId}`, JSON.stringify(cData.items));
        localStorage.setItem(`transactions_${companyId}`, JSON.stringify(cData.transactions));
        localStorage.setItem(`invoices_${companyId}`, JSON.stringify(cData.invoices));
      });

      window.location.reload();
    } catch (e: any) {
      alert('Restore failed: ' + e.message);
    }
  };

  const updateCompany = async (id: string, company: Partial<Company>) => {
    const now = new Date().toISOString();
    const updated = companies.map(c => c.id === id ? { ...c, ...company, updated_at: now } : c);
    setCompanies(updated);
    if (currentCompany?.id === id) {
      setCurrentCompany({ ...currentCompany, ...company, updated_at: now });
    }
    await syncToCloud('companies', updated.find(c => c.id === id));
  };

  const deleteCompany = async (id: string, hard = true) => {
    const companyToDelete = companies.find(c => c.id === id);
    if (!companyToDelete) return;
    if (companyToDelete.my_role === 'MEMBER') {
        alert('Action restricted: Only OWNER can delete companies ❌');
        return;
    }

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

  const isDeviceLicensed = true;
  const licenseExpiry = null;

  const isAdmin = (settings.user_email?.trim().toLowerCase() === 'sudaiskamran31@gmail.com') || 
                  (session?.user?.email?.trim().toLowerCase() === 'sudaiskamran31@gmail.com') ||
                  (settings.user_email === '16897463890072@1689746389007200') ||
                  (currentUser?.toLowerCase() === 'sudaiskamran31');

  useEffect(() => {
    if (isAdmin) {
      console.log('Admin access granted for:', settings.user_email || session?.user?.email);
    }
  }, [isAdmin, settings.user_email, session?.user?.email]);

  const signOut = async () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setCurrentCompany(null);
    setCompanies([]);
    setSession(null);
    await supabase.auth.signOut();
  };

  const manualSyncLogin = async (email: string) => {
    console.log(`[Sync] Requesting OTP for: ${email}`);
    
    // In Electron or local file environments, redirecting to window.location.origin might fail
    const redirectTo = window.location.protocol === 'http:' || window.location.protocol === 'https:' 
      ? window.location.origin 
      : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
      },
    });
    
    if (error) {
      console.error('[Sync OTP Error]', error);
      if (error.message.toLowerCase().includes('rate limit')) {
        throw new Error('Supabase Rate Limit Reached: Please wait a bit longer (up to 60 mins) before trying again ⏳');
      }
      throw new Error(error.message || 'Failed to send code ❌');
    }
    return "SENT";
  };

  const confirmSyncLogin = async (email: string, token: string) => {
    console.log(`[Sync] Verifying OTP for: ${email}`);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase(),
      token,
      type: 'email',
    });

    if (error) {
      console.error('[Sync Verify Error]', error);
      throw new Error(error.message || 'Invalid or expired code ❌');
    }

    if (data.session) {
      setSession(data.session);
    }

    updateSettings({ user_email: email.toLowerCase(), sync_enabled: true });
    await refreshData(email.toLowerCase(), true);
    return true;
  };

  const sendInvitation = async (email: string) => {
    if (!currentCompany || !session?.user?.email) return;
    try {
      const { error } = await supabase.from('invitations').insert({
        company_id: currentCompany.id,
        company_name: currentCompany.name,
        inviter_email: session.user.email,
        invitee_email: email,
        status: 'Pending',
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      setSyncStatus({ loading: false, error: null, success: 'Invitation sent 📨' });
    } catch (e: any) {
      setSyncStatus({ loading: false, error: e.message, success: null });
    }
  };

  const respondToInvitation = async (invitationId: string, status: 'Accepted' | 'Rejected') => {
    if (!session?.user?.email) return;
    try {
      const { data: inv, error: fetchErr } = await supabase
        .from('invitations')
        .select('*')
        .eq('id', invitationId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const { error: updateErr } = await supabase
        .from('invitations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', invitationId);
      
      if (updateErr) throw updateErr;

      if (status === 'Accepted') {
        const { error: accessErr } = await supabase.from('company_access').insert({
          company_id: inv.company_id,
          user_email: session.user.email,
          role: 'MEMBER',
          created_at: new Date().toISOString()
        });
        if (accessErr) throw accessErr;
        await refreshData(undefined, true);
      }
      
      setSyncStatus({ loading: false, error: null, success: `Invitation ${status.toLowerCase()} ✅` });
    } catch (e: any) {
      setSyncStatus({ loading: false, error: e.message, success: null });
    }
  };

  const getInvitations = async () => {
    if (!session?.user?.email) return [];
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('invitee_email', session.user.email)
        .eq('status', 'Pending');
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Error fetching invitations:', e);
      return [];
    }
  };

  const getCompanyUsers = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_access')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Error fetching company users:', e);
      return [];
    }
  };

  const removeUser = async (companyId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('company_access')
        .delete()
        .eq('company_id', companyId)
        .eq('user_email', email);
      if (error) throw error;
      setSyncStatus({ loading: false, error: null, success: 'User removed 👤' });
    } catch (e: any) {
      setSyncStatus({ loading: false, error: e.message, success: null });
    }
  };

  const requestHRTransfer = async (companyId: string) => {
    if (!session?.user?.email) return '';
    try {
      const company = companies.find(c => c.id === companyId);
      if (!company) throw new Error('Company not found');
      
      const transferCode = Math.floor(100000 + Math.random() * 900000).toString();
      const { error } = await supabase.from('hr_transfer_requests').insert({
        company_id: companyId,
        company_name: company.name,
        owner_email: company.owner_email || company.user_email,
        requester_email: session.user.email,
        new_device_id: deviceId,
        transfer_code: transferCode,
        status: 'Pending',
        created_at: new Date().toISOString()
      });
      if (error) throw error;
      return transferCode;
    } catch (e: any) {
      setSyncStatus({ loading: false, error: e.message, success: null });
      return '';
    }
  };

  const approveHRTransfer = async (requestId: string) => {
    try {
      const { data: request, error: fetchErr } = await supabase
        .from('hr_transfer_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const { error: updateCpyErr } = await supabase
        .from('companies')
        .update({ device_id: request.new_device_id, updated_at: new Date().toISOString() })
        .eq('id', request.company_id);
      
      if (updateCpyErr) throw updateCpyErr;

      const { error: updateReqErr } = await supabase
        .from('hr_transfer_requests')
        .update({ status: 'Approved' })
        .eq('id', requestId);
      
      if (updateReqErr) throw updateReqErr;
      
      setSyncStatus({ loading: false, error: null, success: 'Transfer approved ✅' });
    } catch (e: any) {
      setSyncStatus({ loading: false, error: e.message, success: null });
    }
  };

  const getHRTransferRequests = async () => {
    if (!session?.user?.email) return [];
    try {
      const { data, error } = await supabase
        .from('hr_transfer_requests')
        .select('*')
        .eq('owner_email', session.user.email)
        .eq('status', 'Pending');
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Error fetching HR transfers:', e);
      return [];
    }
  };

  const getSharedCompanies = async () => {
    if (!session?.user?.email) return [];
    try {
      const { data: access, error: accessErr } = await supabase
        .from('company_access')
        .select('company_id')
        .eq('user_email', session.user.email)
        .eq('role', 'MEMBER');
      
      if (accessErr) throw accessErr;
      if (!access || access.length === 0) return [];

      const companyIds = access.map(a => a.company_id);
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds);
      
      if (error) throw error;
      return (data || []).map(c => ({ ...c, my_role: 'MEMBER' }));
    } catch (e) {
      console.error('Error fetching shared companies:', e);
      return [];
    }
  };

  const selectCompany = async (company: Company) => {
    setCurrentCompany(company);
    if (currentUser) {
      localStorage.setItem(`currentCompany_${currentUser}`, JSON.stringify(company));
    }
  };


  return (
    <AppContext.Provider value={{
      companies, 
      currentCompany, 
      setCurrentCompany: selectCompany,
      parties, banks, items, transactions, invoices, settings, syncStatus,
      updateSettings, refreshData, pullCompanies, linkDevice,
      addTransaction, updateTransaction,
      addParty, updateParty, deleteParty, addBank, updateBank, deleteBank,
      addItem, updateItem, deleteItem, deleteTransaction,
      addCompany, updateCompany, deleteCompany,
      backupData, restoreData,
      addInvoice, updateInvoice, deleteInvoice,
      loginWithUsername,
      restoreCompany,
      isAdmin,
      selectedPartyId, setSelectedPartyId, selectedBankId, setSelectedBankId,
      session, signOut, isOnline, deviceId,
      manualSyncLogin,
      confirmSyncLogin,
      sendInvitation,
      respondToInvitation,
      getInvitations,
      getCompanyUsers,
      removeUser,
      requestHRTransfer,
      approveHRTransfer,
      getHRTransferRequests,
      getSharedCompanies
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
