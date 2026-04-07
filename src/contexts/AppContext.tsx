import React, { createContext, useContext, useEffect, useState } from 'react';
import { Company, Party, BankAccount, InventoryItem as Item, Transaction, AppSettings, Invoice } from '../types';
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
  addInvoice: (invoice: Omit<Invoice, 'id' | 'created_at'>) => Promise<void>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string, hard?: boolean) => Promise<void>;
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
  const [companies, setCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem('companies');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse companies:', e);
      return [];
    }
  });
  const [currentCompany, setCurrentCompany] = useState<Company | null>(() => {
    try {
      const saved = localStorage.getItem('currentCompany');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse currentCompany:', e);
      return null;
    }
  });
  const [parties, setParties] = useState<Party[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('app_settings');
    const defaultSettings: AppSettings = {
      theme: 'light',
      currency: 'PKR',
      pdf_theme: 'standard',
      sync_enabled: true,
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [syncStatus, setSyncStatus] = useState<{ loading: boolean; error: string | null; success: string | null }>({
    loading: false,
    error: null,
    success: null
  });

  useEffect(() => {
    localStorage.setItem('companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    if (currentCompany) {
      localStorage.setItem('currentCompany', JSON.stringify(currentCompany));
      
      // Load company-specific data
      const companyId = currentCompany.id;
      const loadLocal = (key: string) => {
        try {
          const data = JSON.parse(localStorage.getItem(`${key}_${companyId}`) || '[]');
          return Array.isArray(data) ? data.filter(i => !i.deleted_at) : [];
        } catch (e) {
          console.error(`Failed to load ${key}:`, e);
          return [];
        }
      };

      setParties(loadLocal('parties'));
      setBanks(loadLocal('banks'));
      setItems(loadLocal('items'));
      setTransactions(loadLocal('transactions'));
      setInvoices(loadLocal('invoices'));
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

  const refreshData = async (emailOverride?: string) => {
    const email = emailOverride || settings.user_email;
    if (!settings.sync_enabled || !email) return;

    setSyncStatus({ loading: true, error: null, success: null });
    try {
      // 1. Pull Companies
      const { data: cloudCompanies, error: compError } = await supabase
        .from('companies')
        .select('*')
        .or(`user_email.eq.${email},linked_emails.cs.{${email}}`);
      
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
        let dbTable = table === 'items' ? 'inventory' : table;
        
        const { data: cloudData, error } = await supabase
          .from(dbTable)
          .select('*')
          .eq('company_id', companyId);
        
        if (error) {
            console.error(`Fetch error for ${dbTable}:`, error);
            // If table doesn't exist, skip but don't crash
            if (error.code === 'PGRST116' || error.message.includes('relation')) return;
            throw error;
        }
        
        const localData = JSON.parse(localStorage.getItem(`${table}_${companyId}`) || '[]');
        const { merged, toUpload } = mergeData(localData, cloudData || []);
        
        const nonDeleted = merged.filter((i: any) => !i.deleted_at);
        setter(nonDeleted);
        localStorage.setItem(`${table}_${companyId}`, JSON.stringify(merged));
        
        if (toUpload.length > 0) {
          await syncToCloud(table, toUpload);
        }
      };

      await Promise.all([
        fetchAndMerge('parties', setParties),
        fetchAndMerge('banks', setBanks),
        fetchAndMerge('items', setItems),
        fetchAndMerge('transactions', setTransactions),
        fetchAndMerge('invoices', setInvoices),
        // Add expenses mapping just in case user has a separate table
        fetchAndMerge('expenses', (data) => {
            // Merge into transactions if they are separate
            if (data.length > 0) {
                setTransactions(prev => {
                    const { merged } = mergeData(prev, data);
                    return merged.filter(t => !t.deleted_at);
                });
            }
        })
      ]);
      
      setSyncStatus({ loading: false, error: null, success: 'Synced' });
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus({ loading: false, error: error.message, success: null });
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
    const email = settings.user_email;
    if (!settings.sync_enabled || !email) {
        console.log(`[Sync Skip] Sync disabled or no email for ${table}`);
        return;
    }
    
    // Map 'items' to 'inventory' and 'expenses' to 'transactions' for Supabase
    let dbTable = table;
    if (table === 'items') dbTable = 'inventory';
    if (table === 'expenses') dbTable = 'transactions';
    
    try {
        // Sanitize data: replace empty strings with null for date fields
        const sanitize = (obj: any) => {
          const sanitized = { ...obj };
          Object.keys(sanitized).forEach(key => {
            if (sanitized[key] === "") {
              // If it looks like a date field or is a known optional field, set to null
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
        
        console.log(`[Sync Start] Table: ${dbTable} (${isNew ? 'INSERT' : 'UPSERT'})`, dataWithEmail);
        
        const { error } = await supabase.from(dbTable).upsert(dataWithEmail);
        
        if (error) {
            console.error(`[Sync Error] ${dbTable}:`, error);
            if (error.message.includes('Could not find the table')) {
                setSyncStatus({ 
                    loading: false, 
                    error: `Table "${dbTable}" not found. Please run the SQL setup script in Settings.`, 
                    success: null 
                });
            }
            throw error;
        }

        // Mark as synced locally
        if (currentCompany) {
            const localAll = JSON.parse(localStorage.getItem(`${table}_${currentCompany.id}`) || '[]');
            const ids = Array.isArray(data) ? data.map(d => d.id) : [data.id];
            const updatedAll = localAll.map((item: any) => ids.includes(item.id) ? { ...item, _synced: true } : item);
            localStorage.setItem(`${table}_${currentCompany.id}`, JSON.stringify(updatedAll));
        }

        console.log(`[Sync Success] ${dbTable} synced successfully`);
    } catch (error) {
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
    if (companies.length > 0 && !currentCompany) {
      setCurrentCompany(companies[0]);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [settings.sync_enabled, settings.user_email]);

  useEffect(() => {
    if (settings.sync_enabled && settings.user_email && currentCompany) {
        refreshData();
        console.log('[Realtime] Setting up subscription...');
        const channel = supabase.channel(`company-${currentCompany.id}`)
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                const { table, new: newRecord, old: oldRecord, eventType } = payload;
                const record = (newRecord || oldRecord) as any;
                
                // Robust relevance check
                const recordCompanyId = record?.company_id;
                const isRelevant = table === 'companies' || (recordCompanyId && recordCompanyId === currentCompany.id);
                
                if (isRelevant) {
                    console.log(`[Realtime] ${eventType} on ${table}:`, record);
                    
                    const updateState = (key: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
                        setter(prev => {
                            let updated = [...prev];
                            const localAll = JSON.parse(localStorage.getItem(`${key}_${currentCompany.id}`) || '[]');
                            let updatedAll = [...localAll];

                            if (eventType === 'INSERT') {
                                if (!updatedAll.find(i => i.id === record.id)) {
                                    updatedAll = [{ ...record, _synced: true }, ...updatedAll];
                                }
                            } else if (eventType === 'UPDATE') {
                                updatedAll = updatedAll.map(i => i.id === record.id ? { ...record, _synced: true } : i);
                                // If not found locally but updated in cloud, add it
                                if (!updatedAll.find(i => i.id === record.id)) {
                                    updatedAll = [{ ...record, _synced: true }, ...updatedAll];
                                }
                            } else if (eventType === 'DELETE') {
                                // record only contains the id in DELETE events
                                const id = record.id || payload.old?.id;
                                updatedAll = updatedAll.filter(i => i.id !== id);
                            }

                            localStorage.setItem(`${key}_${currentCompany.id}`, JSON.stringify(updatedAll));
                            return updatedAll.filter(i => !i.deleted_at);
                        });
                    };

                    if (table === 'transactions' || table === 'expenses') updateState('transactions', setTransactions);
                    else if (table === 'parties') updateState('parties', setParties);
                    else if (table === 'banks') updateState('banks', setBanks);
                    else if (table === 'inventory') updateState('items', setItems);
                    else if (table === 'invoices') updateState('invoices', setInvoices);
                    else if (table === 'companies') {
                        setCompanies(prev => {
                            const localAll = JSON.parse(localStorage.getItem('companies') || '[]');
                            let updatedAll = [...localAll];
                            if (eventType === 'INSERT') {
                                if (!updatedAll.find(c => c.id === record.id)) updatedAll = [...updatedAll, record];
                            } else if (eventType === 'UPDATE') {
                                updatedAll = updatedAll.map(c => c.id === record.id ? record : c);
                            } else if (eventType === 'DELETE') {
                                updatedAll = updatedAll.filter(c => c.id !== record.id);
                            }
                            localStorage.setItem('companies', JSON.stringify(updatedAll));
                            return updatedAll.filter(c => !c.deleted_at);
                        });
                    }
                }
            })
            .subscribe((status) => {
                console.log(`[Realtime] Status: ${status}`);
            });
        
        return () => {
            console.log('[Realtime] Cleaning up subscription...');
            supabase.removeChannel(channel);
        };
    }
  }, [currentCompany?.id, settings.sync_enabled, settings.user_email]);

  // Automatically recalculate balances when transactions change (e.g. via Realtime)
  useEffect(() => {
    if (currentCompany && transactions.length > 0) {
      recalculateBalances(transactions, parties, banks, items);
    }
  }, [transactions.length]);

  const recalculateBalances = async (allTransactions: Transaction[], allParties: Party[], allBanks: BankAccount[], allItems: Item[]) => {
    if (!currentCompany) return;

    const partyBalances: Record<string, number> = {};
    const bankBalances: Record<string, number> = {};
    const itemStock: Record<string, number> = {};

    allParties.forEach(p => partyBalances[p.id] = 0);
    allBanks.forEach(b => bankBalances[b.id] = 0);
    allItems.forEach(i => itemStock[i.id] = 0);

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

    if (settings.sync_enabled) {
      await Promise.all([
        ...changedParties.map(p => syncToCloud('parties', p)),
        ...changedBanks.map(b => syncToCloud('banks', b)),
        ...changedItems.map(i => syncToCloud('items', i))
      ]);
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
      syncToCloud('transactions', newTx, true).catch(err => console.error('Add Transaction Sync Error:', err));
    }
    
    // Recalculate balances (also optimistic)
    await recalculateBalances(updated, parties, banks, items);
  };

  const updateTransaction = async (id: string, tx: Partial<Transaction>) => {
    if (!currentCompany) return;
    const now = new Date().toISOString();
    const updated = transactions.map(t => t.id === id ? { ...t, ...tx, updated_at: now } : t);
    setTransactions(updated);
    localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      await syncToCloud('transactions', updated.find(t => t.id === id));
    }
    await recalculateBalances(updated, parties, banks, items);
  };

  const addParty = async (party: Omit<Party, 'id' | 'created_at'>) => {
    if (!currentCompany) return;
    const now = new Date().toISOString();
    const newParty: Party = {
      ...party,
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
            await deleteFromCloud('transactions', id);
        }
      } else {
        const updatedAll = localAll.map((t: any) => t.id === id ? { ...t, deleted_at: now, updated_at: now } : t);
        localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updatedAll));
        if (settings.sync_enabled) {
            await syncToCloud('transactions', { ...tx, deleted_at: now, updated_at: now });
        }
      }
      await recalculateBalances(updatedTransactions, parties, banks, items);
  };

  const addCompany = async (company: Omit<Company, 'id' | 'created_at'>) => {
    const now = new Date().toISOString();
    const newCompany: Company = {
      ...company,
      id: crypto.randomUUID(),
      user_email: settings.user_email || '',
      created_at: now,
      updated_at: now,
      linked_emails: [],
    };
    
    setCompanies(prev => [...prev, newCompany]);
    setCurrentCompany(newCompany);
    
    if (settings.sync_enabled && settings.user_email) {
      await syncToCloud('companies', newCompany);
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
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
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
      addCompany, updateCompany, deleteCompany, addInvoice, updateInvoice, deleteInvoice
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
