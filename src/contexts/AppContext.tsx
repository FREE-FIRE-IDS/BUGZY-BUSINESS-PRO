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

const mergeData = <T extends { id: string; updated_at?: string; created_at?: string }>(
  local: T[],
  cloud: T[]
): { merged: T[]; toUpload: T[] } => {
  const mergedMap = new Map<string, T>();
  const toUploadMap = new Map<string, T>();

  // Start with local data
  local.forEach(item => mergedMap.set(item.id, item));

  // Merge cloud data
  cloud.forEach(cloudItem => {
    const localItem = mergedMap.get(cloudItem.id);
    if (!localItem) {
      // Only in cloud, add to merged
      mergedMap.set(cloudItem.id, cloudItem);
    } else {
      // In both, resolve conflict
      const localTime = new Date(localItem.updated_at || localItem.created_at || 0).getTime();
      const cloudTime = new Date(cloudItem.updated_at || cloudItem.created_at || 0).getTime();

      if (cloudTime > localTime) {
        // Cloud is newer
        mergedMap.set(cloudItem.id, cloudItem);
      } else if (localTime > cloudTime) {
        // Local is newer, mark for upload
        toUploadMap.set(localItem.id, localItem);
      }
    }
  });

  // Local items not in cloud should also be uploaded
  const cloudIds = new Set(cloud.map(c => c.id));
  local.forEach(localItem => {
    if (!cloudIds.has(localItem.id)) {
      toUploadMap.set(localItem.id, localItem);
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
      setParties(JSON.parse(localStorage.getItem(`parties_${companyId}`) || '[]'));
      setBanks(JSON.parse(localStorage.getItem(`banks_${companyId}`) || '[]'));
      setItems(JSON.parse(localStorage.getItem(`items_${companyId}`) || '[]'));
      setTransactions(JSON.parse(localStorage.getItem(`transactions_${companyId}`) || '[]'));
      setInvoices(JSON.parse(localStorage.getItem(`invoices_${companyId}`) || '[]'));
    } else {
      localStorage.removeItem('currentCompany');
      // Clear data if no company selected
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
    
    // Load local data first for immediate UI response
    let localParties: Party[] = [];
    let localBanks: BankAccount[] = [];
    let localItems: Item[] = [];
    let localTransactions: Transaction[] = [];
    let localInvoices: Invoice[] = [];

    if (currentCompany) {
        const companyId = currentCompany.id;
        localParties = JSON.parse(localStorage.getItem(`parties_${companyId}`) || '[]');
        localBanks = JSON.parse(localStorage.getItem(`banks_${companyId}`) || '[]');
        localItems = JSON.parse(localStorage.getItem(`items_${companyId}`) || '[]');
        localTransactions = JSON.parse(localStorage.getItem(`transactions_${companyId}`) || '[]');
        localInvoices = JSON.parse(localStorage.getItem(`invoices_${companyId}`) || '[]');
        
        setParties(localParties);
        setBanks(localBanks);
        setItems(localItems);
        setTransactions(localTransactions);
        setInvoices(localInvoices);
    }

    if (!settings.sync_enabled || !email) return;

    setSyncStatus({ loading: true, error: null, success: null });
    try {
      // 1. Pull Companies
      const { data: cloudCompanies, error: compError } = await supabase
        .from('companies')
        .select('*')
        .or(`user_email.eq.${email},linked_emails.cs.{${email}}`);
      
      if (compError) throw compError;
      
      const { merged: mergedCompanies, toUpload: companiesToUpload } = mergeData(companies, cloudCompanies || []);
      setCompanies(mergedCompanies.filter(c => !c.deleted_at));
      if (companiesToUpload.length > 0) {
        await syncToCloud('companies', companiesToUpload);
      }
      
      let activeCompany = currentCompany;
      const nonDeletedCompanies = mergedCompanies.filter(c => !c.deleted_at);
      if (!activeCompany && nonDeletedCompanies.length > 0) {
        activeCompany = nonDeletedCompanies[0];
        setCurrentCompany(activeCompany);
      }

      if (!activeCompany) {
          setSyncStatus({ loading: false, error: null, success: null });
          return;
      }

      // 2. Pull Data for activeCompany
      const fetchAndMerge = async (table: string, localData: any[], setter: (data: any[]) => void) => {
        const dbTable = table === 'items' ? 'inventory' : table;
        const { data: cloudData, error } = await supabase
          .from(dbTable)
          .select('*')
          .eq('company_id', activeCompany!.id);
        
        if (error) throw error;
        
        const { merged, toUpload } = mergeData(localData, cloudData || []);
        setter(merged.filter((i: any) => !i.deleted_at));
        localStorage.setItem(`${table}_${activeCompany!.id}`, JSON.stringify(merged));
        
        if (toUpload.length > 0) {
          await syncToCloud(table, toUpload);
        }
      };

      await Promise.all([
        fetchAndMerge('parties', localParties, setParties),
        fetchAndMerge('banks', localBanks, setBanks),
        fetchAndMerge('items', localItems, setItems),
        fetchAndMerge('transactions', localTransactions, setTransactions),
        fetchAndMerge('invoices', localInvoices, setInvoices),
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
        const dataWithEmail = Array.isArray(data) 
          ? data.map(d => ({ ...d, user_email: email }))
          : { ...data, user_email: email };
        
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
    
    if (settings.sync_enabled && settings.user_email) {
        console.log('[Realtime] Setting up subscription...');
        const channel = supabase.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                const { table, new: newRecord, old: oldRecord, eventType } = payload;
                const record = (newRecord || oldRecord) as any;
                
                // Robust relevance check
                const recordCompanyId = record?.company_id;
                const isRelevant = table === 'companies' || (recordCompanyId && recordCompanyId === currentCompany?.id);
                
                if (isRelevant) {
                    console.log(`[Realtime] ${eventType} on ${table}:`, record);
                    // Surgical updates for instant UI feedback
                    if (table === 'transactions') {
                        setTransactions(prev => {
                            let updated = [...prev];
                            if (eventType === 'INSERT') {
                                if (!updated.find(t => t.id === newRecord.id)) {
                                    updated = [newRecord as Transaction, ...updated];
                                }
                            } else if (eventType === 'UPDATE') {
                                if (newRecord.deleted_at) {
                                    updated = updated.filter(t => t.id !== newRecord.id);
                                } else {
                                    updated = updated.map(t => t.id === newRecord.id ? (newRecord as Transaction) : t);
                                }
                            } else if (eventType === 'DELETE') {
                                updated = updated.filter(t => t.id !== oldRecord.id);
                            }
                            localStorage.setItem(`transactions_${currentCompany?.id}`, JSON.stringify(updated));
                            return updated;
                        });
                    } else if (table === 'parties') {
                        setParties(prev => {
                            let updated = [...prev];
                            if (eventType === 'INSERT') {
                                if (!updated.find(p => p.id === newRecord.id)) {
                                    updated = [...updated, newRecord as Party];
                                }
                            } else if (eventType === 'UPDATE') {
                                if (newRecord.deleted_at) {
                                    updated = updated.filter(p => p.id !== newRecord.id);
                                } else {
                                    updated = updated.map(p => p.id === newRecord.id ? (newRecord as Party) : p);
                                }
                            } else if (eventType === 'DELETE') {
                                updated = updated.filter(p => p.id !== oldRecord.id);
                            }
                            localStorage.setItem(`parties_${currentCompany?.id}`, JSON.stringify(updated));
                            return updated;
                        });
                    } else if (table === 'banks') {
                        setBanks(prev => {
                            let updated = [...prev];
                            if (eventType === 'INSERT') {
                                if (!updated.find(b => b.id === newRecord.id)) {
                                    updated = [...updated, newRecord as BankAccount];
                                }
                            } else if (eventType === 'UPDATE') {
                                if (newRecord.deleted_at) {
                                    updated = updated.filter(b => b.id !== newRecord.id);
                                } else {
                                    updated = updated.map(b => b.id === newRecord.id ? (newRecord as BankAccount) : b);
                                }
                            } else if (eventType === 'DELETE') {
                                updated = updated.filter(b => b.id !== oldRecord.id);
                            }
                            localStorage.setItem(`banks_${currentCompany?.id}`, JSON.stringify(updated));
                            return updated;
                        });
                    } else if (table === 'inventory') {
                        setItems(prev => {
                            let updated = [...prev];
                            if (eventType === 'INSERT') {
                                if (!updated.find(i => i.id === newRecord.id)) {
                                    updated = [...updated, newRecord as Item];
                                }
                            } else if (eventType === 'UPDATE') {
                                if (newRecord.deleted_at) {
                                    updated = updated.filter(i => i.id !== newRecord.id);
                                } else {
                                    updated = updated.map(i => i.id === newRecord.id ? (newRecord as Item) : i);
                                }
                            } else if (eventType === 'DELETE') {
                                updated = updated.filter(i => i.id !== oldRecord.id);
                            }
                            localStorage.setItem(`items_${currentCompany?.id}`, JSON.stringify(updated));
                            return updated;
                        });
                    } else if (table === 'invoices') {
                        setInvoices(prev => {
                            let updated = [...prev];
                            if (eventType === 'INSERT') {
                                if (!updated.find(i => i.id === newRecord.id)) {
                                    updated = [newRecord as Invoice, ...updated];
                                }
                            } else if (eventType === 'UPDATE') {
                                if (newRecord.deleted_at) {
                                    updated = updated.filter(i => i.id !== newRecord.id);
                                } else {
                                    updated = updated.map(i => i.id === newRecord.id ? (newRecord as Invoice) : i);
                                }
                            } else if (eventType === 'DELETE') {
                                updated = updated.filter(i => i.id !== oldRecord.id);
                            }
                            localStorage.setItem(`invoices_${currentCompany?.id}`, JSON.stringify(updated));
                            return updated;
                        });
                    } else if (table === 'companies') {
                        setCompanies(prev => {
                            let updated = [...prev];
                            if (eventType === 'INSERT') {
                                if (!updated.find(c => c.id === newRecord.id)) {
                                    updated = [...updated, newRecord as Company];
                                }
                            } else if (eventType === 'UPDATE') {
                                if (newRecord.deleted_at) {
                                    updated = updated.filter(c => c.id !== newRecord.id);
                                } else {
                                    updated = updated.map(c => c.id === newRecord.id ? (newRecord as Company) : c);
                                }
                            } else if (eventType === 'DELETE') {
                                updated = updated.filter(c => c.id !== oldRecord.id);
                            }
                            localStorage.setItem('companies', JSON.stringify(updated));
                            return updated;
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

  const deleteParty = async (id: string, hard = false) => {
    if (!currentCompany) return;
    const party = parties.find(p => p.id === id);
    if (!party) return;
    
    const now = new Date().toISOString();
    const updated = parties.filter(p => p.id !== id);
    setParties(updated);
    localStorage.setItem(`parties_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      if (hard) {
        await deleteFromCloud('parties', id);
      } else {
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

  const deleteBank = async (id: string, hard = false) => {
    if (!currentCompany) return;
    const bank = banks.find(b => b.id === id);
    if (!bank) return;

    const now = new Date().toISOString();
    const updated = banks.filter(b => b.id !== id);
    setBanks(updated);
    localStorage.setItem(`banks_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      if (hard) {
        await deleteFromCloud('banks', id);
      } else {
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

  const deleteItem = async (id: string, hard = false) => {
    if (!currentCompany) return;
    const item = items.find(i => i.id === id);
    if (!item) return;

    const now = new Date().toISOString();
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    localStorage.setItem(`items_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      if (hard) {
        await deleteFromCloud('items', id);
      } else {
        await syncToCloud('items', { ...item, deleted_at: now, updated_at: now });
      }
    }
  };

  const deleteTransaction = async (id: string, hard = false) => {
      if (!currentCompany) return;
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      const now = new Date().toISOString();
      const updated = transactions.filter(t => t.id !== id);
      setTransactions(updated);
      localStorage.setItem(`transactions_${currentCompany.id}`, JSON.stringify(updated));
      
      if (settings.sync_enabled) {
          if (hard) {
            await deleteFromCloud('transactions', id);
          } else {
            await syncToCloud('transactions', { ...tx, deleted_at: now, updated_at: now });
          }
      }
      await recalculateBalances(updated, parties, banks, items);
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

  const deleteCompany = async (id: string) => {
    const companyToDelete = companies.find(c => c.id === id);
    if (!companyToDelete) return;

    const now = new Date().toISOString();
    const updated = companies.filter(c => c.id !== id);
    setCompanies(updated);
    
    if (currentCompany?.id === id) {
      const nextCompany = updated.length > 0 ? updated[0] : null;
      setCurrentCompany(nextCompany);
    }

    if (settings.sync_enabled) {
      await syncToCloud('companies', { ...companyToDelete, deleted_at: now, updated_at: now });
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

  const deleteInvoice = async (id: string, hard = false) => {
    if (!currentCompany) return;
    const invoice = invoices.find(i => i.id === id);
    if (!invoice) return;

    const now = new Date().toISOString();
    const updated = invoices.filter(i => i.id !== id);
    setInvoices(updated);
    localStorage.setItem(`invoices_${currentCompany.id}`, JSON.stringify(updated));
    
    if (settings.sync_enabled) {
      if (hard) {
        await deleteFromCloud('invoices', id);
      } else {
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
