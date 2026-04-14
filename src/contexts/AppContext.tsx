import React, { createContext, useContext, useEffect, useState } from 'react';
import { Company, Party, BankAccount, InventoryItem as Item, Transaction, AppSettings, Invoice, PaymentRequest, License, Subscription } from '../types';
import { supabase } from '../lib/supabase';

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
  addCompany: (company: Omit<Company, 'id' | 'created_at'>) => Promise<void>;
  updateCompany: (id: string, company: Partial<Company>) => Promise<void>;
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
  activateLicense: (key: string) => Promise<void>;
  fetchLicenses: () => Promise<License[]>;
  resetLicenseDevice: (id: string) => Promise<void>;
  isDeviceLicensed: boolean;
  isLicensed: () => boolean;
  loginWithUsername: (username: string, isLogin?: boolean) => Promise<boolean>;
  isAdmin: boolean;
  selectedPartyId: string | null;
  setSelectedPartyId: (id: string | null) => void;
  selectedBankId: string | null;
  setSelectedBankId: (id: string | null) => void;
  session: any;
  signOut: () => Promise<void>;
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
        // Cloud is newer
        mergedMap.set(cloudItem.id, cloudItem);
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
    localStorage.setItem('companies', JSON.stringify(companies));
  }, [companies]);

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
              return prev.map(c => c.id === updatedCompany.id ? updatedCompany : c);
            }
            return [...prev, updatedCompany];
          });
          if (currentCompany?.id === updatedCompany.id) {
            setCurrentCompany(updatedCompany);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
        query = query.or(`user_email.eq.${email},linked_emails.cs.{${email}}`);
      } else if (username) {
        query = query.eq('username', username);
      }

      const { data: cloudCompanies, error: compError } = await query;
      
      if (compError) throw compError;
      
      const localCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
      const { merged: mergedCompanies, toUpload: companiesToUpload } = mergeData(localCompanies, cloudCompanies || []);
      
      const nonDeletedCompanies = mergedCompanies.filter(c => !c.deleted_at);
      setCompanies(nonDeletedCompanies);
      localStorage.setItem('companies', JSON.stringify(mergedCompanies));

      if (companiesToUpload.length > 0) {
        await syncToCloud('companies', companiesToUpload);
      }
      
      let activeCompany = currentCompany;
      if (!activeCompany && nonDeletedCompanies.length > 0) {
        activeCompany = nonDeletedCompanies[0];
        setCurrentCompany(activeCompany);
      }

      if (!activeCompany) {
          setSyncStatus({ loading: false, error: null, success: null });
          return;
      }

      const companyId = activeCompany.id;

      // 2. Pull Data for activeCompany
      const fetchAndMerge = async (table: string, setter: (data: any[]) => void) => {
        try {
          let dbTable = table === 'items' ? 'inventory' : table;
          
          const { data: cloudData, error } = await supabase
            .from(dbTable)
            .select('*')
            .eq('company_id', companyId);
          
          if (error) {
              console.error(`Fetch error for ${dbTable}:`, error);
              if (error.code === 'PGRST116' || error.message.includes('relation')) return;
              throw error;
          }
          
          const nonDeleted = (cloudData || []).filter((i: any) => !i.deleted_at);
          
          isInternalUpdate.current = true;
          setter(nonDeleted);
          isInternalUpdate.current = false;
        } catch (e) {
          console.error(`Failed to sync ${table}:`, e);
        }
      };

      await Promise.allSettled([
        fetchAndMerge('parties', setParties),
        fetchAndMerge('banks', setBanks),
        fetchAndMerge('items', setItems),
        fetchAndMerge('transactions', setTransactions),
        fetchAndMerge('invoices', setInvoices),
        fetchAndMerge('expenses', (data) => {
            if (data.length > 0) {
                setTransactions(prev => {
                    const { merged } = mergeData(prev, data);
                    return merged.filter(t => !t.deleted_at);
                });
            }
        })
      ]);
      
      hasInitialSynced.current[activeCompany.id] = true;
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

  const pullCompanies = async (email: string) => {
    if (!email) {
      setSyncStatus({ loading: false, error: 'Please enter an email address', success: null });
      return false;
    }
    setSyncStatus({ loading: true, error: null, success: null });
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .or(`user_email.eq.${email},linked_emails.cs.{${email}}`);
      
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
          error: 'No companies found in the cloud for this email. If you have data on this device, click "Sync Now" to push it to the cloud.', 
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

  const syncToCloud = async (table: string, data: any, isNew: boolean = false) => {
    const email = settings.user_email || currentCompany?.user_email || (currentCompany?.username ? `${currentCompany.username}@bugzy.app` : null);
    const isUsernameAccount = !!currentCompany?.username;
    
    if (!settings.sync_enabled && !isUsernameAccount) {
        console.log(`[Sync Skip] Sync disabled and not a username account for ${table}`);
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
    
    try {
        // Sanitize data: replace empty strings with null for date fields
        const sanitize = (obj: any) => {
          const sanitized = { ...obj };
          Object.keys(sanitized).forEach(key => {
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
        
        const { data: result, error } = await supabase.from(dbTable).upsert(dataWithEmail).select();
        
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

const deleteFromCloud = async (table: string, id: string) => {
    if (!settings.sync_enabled || !settings.user_email) return;
    
    let dbTable = table;
    if (table === 'items') dbTable = 'inventory';
    if (table === 'expenses') dbTable = 'transactions';

    console.log(`[Delete Start] Table: ${dbTable}, ID: ${id}`);
    try {
        const { error } = await supabase.from(dbTable).delete().eq('id', id);
        if (error) {
            console.error(`[Delete Error] ${dbTable}:`, error);
            // If table doesn't exist, ignore for now
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
      if (settings.user_email) {
        await refreshData(undefined, true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    refreshData();
  }, [settings.sync_enabled, settings.user_email]);

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

                const recordCompanyId = record?.company_id;
                let isRelevant = table === 'companies' || (recordCompanyId && recordCompanyId === currentCompany.id);
                
                if (!isRelevant && eventType === 'DELETE') {
                    // For deletes, we might not have company_id in oldRecord if it wasn't selected
                    // But usually oldRecord has the primary key
                    isRelevant = true; 
                }
                
                if (isRelevant) {
                    const updateState = (key: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
                        isInternalUpdate.current = true;
                        setter(prev => {
                            const localAll = JSON.parse(localStorage.getItem(`${key}_${currentCompany.id}`) || '[]');
                            let updatedAll = [...localAll];

                            if (eventType === 'INSERT' || eventType === 'UPDATE') {
                                const index = updatedAll.findIndex(i => i.id === record.id);
                                if (index !== -1) {
                                    // Only update if the incoming record is newer
                                    const localTime = new Date(updatedAll[index].updated_at || updatedAll[index].created_at || 0).getTime();
                                    const remoteTime = new Date(record.updated_at || record.created_at || 0).getTime();
                                    if (remoteTime >= localTime) {
                                        updatedAll[index] = { ...record, _synced: true };
                                    }
                                } else {
                                    updatedAll = [{ ...record, _synced: true }, ...updatedAll];
                                }
                            } else if (eventType === 'DELETE') {
                                const id = record.id || (oldRecord as any)?.id;
                                if (!id) return prev;
                                updatedAll = updatedAll.filter(i => i.id !== id);
                            }

                            localStorage.setItem(`${key}_${currentCompany.id}`, JSON.stringify(updatedAll));
                            return updatedAll.filter(i => !i.deleted_at);
                        });
                        setTimeout(() => { isInternalUpdate.current = false; }, 100);
                    };

                    if (table === 'transactions' || table === 'expenses') updateState('transactions', setTransactions);
                    else if (table === 'parties') updateState('parties', setParties);
                    else if (table === 'banks') updateState('banks', setBanks);
                    else if (table === 'inventory') updateState('items', setItems);
                    else if (table === 'invoices') updateState('invoices', setInvoices);
                    else if (table === 'companies') {
                        isInternalUpdate.current = true;
                        setCompanies(prev => {
                            const localAll = JSON.parse(localStorage.getItem('companies') || '[]');
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
                            localStorage.setItem('companies', JSON.stringify(updatedAll));
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
    allItems.forEach(i => itemStock[i.id] = 0);

    // 1. Process Invoices
    allInvoices.forEach(inv => {
      if (inv.party_id && partyBalances[inv.party_id] !== undefined) {
        if (inv.type === 'Sale') partyBalances[inv.party_id] += inv.total;
        if (inv.type === 'Purchase') partyBalances[inv.party_id] -= inv.total;
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
  };

  const addItem = async (item: Omit<Item, 'id' | 'created_at'>) => {
    if (!currentCompany) return;
    const now = new Date().toISOString();
    const newItem: Item = {
      ...item,
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
  };

  const updateItem = async (id: string, item: Partial<Item>) => {
    if (!currentCompany) return;
    const now = new Date().toISOString();
    const updated = items.map(i => i.id === id ? { ...i, ...item, updated_at: now } : i);
    setItems(updated);
    localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      await syncToCloud('items', updated.find(i => i.id === id));
    }
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
            const table = tx.type === 'Expense' ? 'expenses' : 'transactions';
            await deleteFromCloud(table, id);
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
    setSyncStatus({ loading: true, error: null, success: null });
    
    try {
      // 1. Check cloud first to see if user exists
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('username', normalizedUsername);

      if (error) throw error;

      if (data && data.length > 0) {
        // User exists in cloud
        if (!isLogin) {
          setSyncStatus({ 
            loading: false, 
            error: 'Username already taken ❌. If you already have an account, please use the Login tab.', 
            success: null 
          });
          return false;
        }
        const userCompanies = data;
        localStorage.setItem('currentUser', normalizedUsername);
        localStorage.setItem(`companies_${normalizedUsername}`, JSON.stringify(userCompanies));
        localStorage.setItem(`currentCompany_${normalizedUsername}`, JSON.stringify(userCompanies[0]));
        setCurrentUser(normalizedUsername);
        setSyncStatus({ loading: false, error: null, success: 'Login successful' });
        return true;
      }

      // 2. Check local storage
      const localCompanies = localStorage.getItem(`companies_${normalizedUsername}`);
      if (localCompanies) {
        localStorage.setItem('currentUser', normalizedUsername);
        setCurrentUser(normalizedUsername);
        setSyncStatus({ loading: false, error: null, success: 'Login successful' });
        return true;
      }

      // 3. If it's a login attempt and not found, return false
      if (isLogin) {
        setSyncStatus({ loading: false, error: 'Username not found ❌', success: null });
        return false;
      }

      // 4. Create new user session (for signup)
      localStorage.setItem('currentUser', normalizedUsername);
      setCurrentUser(normalizedUsername);
      setSyncStatus({ loading: false, error: null, success: null });
      return true;
    } catch (err: any) {
      console.error('Login error:', err);
      setSyncStatus({ loading: false, error: err.message || 'Login failed', success: null });
      return false;
    }
  };

  const addCompany = async (company: Omit<Company, 'id' | 'created_at'>) => {
    if (!currentUser) return;
    setSyncStatus({ loading: true, error: null, success: null });
    
    const now = new Date().toISOString();
    const newCompany: Company = {
      ...company,
      id: crypto.randomUUID(),
      user_email: settings.user_email || '',
      username: currentUser,
      trial_start: now,
      is_paid: false,
      created_at: now,
      updated_at: now,
      linked_emails: [],
    };
    
    try {
      // 1. Save to cloud first to ensure uniqueness/persistence
      const { error } = await supabase.from('companies').insert(newCompany);
      if (error) {
        if (error.message.includes('unique constraint') || error.code === '23505') {
          throw new Error('This username or company ID is already in use ❌');
        }
        throw error;
      }

      // 2. Update local state only after successful cloud insert
      const updatedCompanies = [...companies, newCompany];
      setCompanies(updatedCompanies);
      setCurrentCompany(newCompany);
      localStorage.setItem(`companies_${currentUser}`, JSON.stringify(updatedCompanies));
      localStorage.setItem(`currentCompany_${currentUser}`, JSON.stringify(newCompany));
      
      // Enable sync by default for username accounts
      updateSettings({ sync_enabled: true });
      setSyncStatus({ loading: false, error: null, success: 'Company created successfully' });
    } catch (e: any) {
      console.error('Failed to create company:', e);
      setSyncStatus({ loading: false, error: e.message || 'Failed to create company', success: null });
      throw e;
    }
  };

  const backupData = () => {
    if (!currentUser) return;
    
    const data: any = {
      username: currentUser,
      companies: JSON.parse(localStorage.getItem(`companies_${currentUser}`) || '[]'),
      settings: JSON.parse(localStorage.getItem('app_settings') || '{}'),
      device_license: localStorage.getItem('device_license'),
      active_license_key: localStorage.getItem('active_license_key'),
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

    const now = new Date().toISOString();
    const updatedCompanies = companies.filter(c => c.id !== id);
    setCompanies(updatedCompanies);
    
    const localAll = JSON.parse(localStorage.getItem('companies') || '[]');
    
    if (hard) {
      const filteredAll = localAll.filter((c: any) => c.id !== id);
      localStorage.setItem('companies', JSON.stringify(filteredAll));
      if (settings.sync_enabled) {
        await deleteFromCloud('companies', id);
      }
    } else {
      const updatedAll = localAll.map((c: any) => c.id === id ? { ...c, deleted_at: now, updated_at: now } : c);
      localStorage.setItem('companies', JSON.stringify(updatedAll));
      if (settings.sync_enabled) {
        await syncToCloud('companies', { ...companyToDelete, deleted_at: now, updated_at: now });
      }
    }

    if (currentCompany?.id === id) {
      const nextCompany = updatedCompanies.length > 0 ? updatedCompanies[0] : null;
      setCurrentCompany(nextCompany);
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
        setCompanies(prev => {
          const exists = prev.find(c => c.id === data.id);
          if (exists) return prev;
          return [...prev, data];
        });
        setCurrentCompany(data);
        
        // Update settings with the email from the company if available
        if (data.user_email) {
          updateSettings({ user_email: data.user_email, sync_enabled: true, is_verified: true });
        }
        
        setSyncStatus({ loading: false, error: null, success: 'Company restored successfully!' });
        
        // Trigger a full data pull for this company
        // We need to wait a bit for settings to update
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
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const submitPaymentRequest = async (data: {
    user_name: string;
    username?: string;
    account_name: string;
    phone: string;
    amount: number;
    plan: 'monthly' | 'yearly';
    screenshot_url?: string;
  }) => {
    if (!currentCompany) return;
    const now = new Date().toISOString();
    const request: Omit<PaymentRequest, 'id'> = {
      company_id: currentCompany.id,
      user_id: session?.user?.id || 'anonymous',
      username: data.username || currentCompany.username,
      user_name: data.user_name,
      user_email: settings.user_email || session?.user?.email || '',
      company_name: currentCompany.name,
      account_name: data.account_name,
      phone: data.phone,
      amount: data.amount,
      plan: data.plan,
      screenshot_url: data.screenshot_url,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    
    const { error } = await supabase.from('payment_requests').insert(request);
    if (error) throw error;
  };

  const fetchPaymentRequests = async () => {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const updatePaymentRequestStatus = async (id: string, status: 'approved' | 'rejected', companyId: string) => {
    const now = new Date().toISOString();
    
    // 1. If approved, generate license first
    let licenseKey = null;
    if (status === 'approved') {
      licenseKey = generateLicenseKey();
      
      // Fetch request data first to get user_id (username)
      const { data: reqData, error: fetchError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      // Insert license
      const { error: licenseError } = await supabase
        .from('licenses')
        .insert({
          license_key: licenseKey,
          user_id: reqData.username || reqData.user_email, // Use username if available
          user_email: reqData.user_email,
          status: 'active',
          is_active: true,
          created_at: now,
          updated_at: now
        });

      if (licenseError) throw licenseError;

      // Note: We no longer strictly need to update company.is_paid 
      // as the system is now device-based, but we keep it for cloud metadata
      await updateCompany(companyId, { 
        is_paid: true,
        subscription: {
          plan: reqData.plan,
          start_date: now,
          end_date: new Date(Date.now() + (reqData.plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        }
      });
    }

    // 2. Update request status (and license key if approved)
    const updateData: any = { status, updated_at: now };
    if (licenseKey) updateData.license_key = licenseKey;

    const { error: reqError } = await supabase
      .from('payment_requests')
      .update(updateData)
      .eq('id', id);
    
    if (reqError) throw reqError;
  };

  const generateLicenseKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}-${segment()}`;
  };

  const activateLicense = async (key: string) => {
    // MASTER LICENSE CHECK
    if (key === '16897463890072') {
      localStorage.setItem('device_license', 'true');
      localStorage.setItem('active_license_key', 'MASTER-KEY');
      setIsDeviceLicensed(true);
      return;
    }

    // 1. Get Device ID (Simple fingerprint)
    const deviceId = navigator.userAgent + (navigator as any).deviceMemory + (navigator as any).hardwareConcurrency;
    
    // 2. Fetch License
    const { data: license, error: fetchError } = await supabase
      .from('licenses')
      .select('*')
      .eq('license_key', key.toUpperCase())
      .single();
    
    if (fetchError || !license) throw new Error('Invalid License Key ❌');
    if (license.status !== 'active' && !license.is_active) throw new Error('License is inactive ❌');
    
    // 3. Check Device Binding
    if (license.device_id && license.device_id !== deviceId) {
      throw new Error('License already bound to another device ❌');
    }
    
    // 4. Bind Device and Activate
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('licenses')
      .update({ 
        device_id: deviceId, 
        status: 'active',
        updated_at: now 
      })
      .eq('id', license.id);
    
    if (updateError) throw updateError;
    
    // 5. Unlock Device Globally
    localStorage.setItem('device_license', 'true');
    localStorage.setItem('active_license_key', key.toUpperCase());
    setIsDeviceLicensed(true);
  };

  const fetchLicenses = async () => {
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  const resetLicenseDevice = async (id: string) => {
    const { error } = await supabase
      .from('licenses')
      .update({ device_id: null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  };

  const [isDeviceLicensed, setIsDeviceLicensed] = useState(() => localStorage.getItem('device_license') === 'true');

  useEffect(() => {
    const licensed = localStorage.getItem('device_license') === 'true';
    if (licensed !== isDeviceLicensed) {
      setIsDeviceLicensed(licensed);
    }
  }, []);

  const isAdmin = (settings.user_email?.trim().toLowerCase() === 'sudaiskamran31@gmail.com') || 
                  (session?.user?.email?.trim().toLowerCase() === 'sudaiskamran31@gmail.com');

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
  };

  return (
    <AppContext.Provider value={{
      companies, 
      currentCompany, 
      setCurrentCompany: (company) => setCurrentCompany(company),
      parties, banks, items, transactions, invoices, settings, syncStatus,
      updateSettings, refreshData, pullCompanies, linkDevice,
      addTransaction, updateTransaction,
      addParty, updateParty, deleteParty, addBank, updateBank, deleteBank,
      addItem, updateItem, deleteItem, deleteTransaction,
      addCompany, updateCompany, deleteCompany,
      backupData, restoreData,
      addInvoice, updateInvoice, deleteInvoice,
      submitPaymentRequest, fetchPaymentRequests, updatePaymentRequestStatus,
      activateLicense, fetchLicenses, resetLicenseDevice,
      isDeviceLicensed,
      isLicensed: () => isDeviceLicensed,
      loginWithUsername,
      isAdmin,
      selectedPartyId, setSelectedPartyId, selectedBankId, setSelectedBankId,
      session, signOut
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
