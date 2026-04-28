import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Globe, 
  FileText, 
  Cloud, 
  Shield, 
  Bell, 
  Trash2,
  ChevronRight,
  LogOut,
  Building2,
  Plus,
  CheckCircle2,
  Link2,
  Tag,
  X,
  Database,
  ShieldAlert,
  Download,
  Upload
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Settings() {
  const { 
    settings, updateSettings, companies, currentCompany, setCurrentCompany, 
    refreshData, addCompany, deleteCompany, pullCompanies, syncStatus,
    linkDevice, signOut, updateCompany, isAdmin, backupData, restoreData,
    isDeviceLicensed, isLicensed, licenseExpiry
  } = useApp();
  const { theme, toggleTheme } = useTheme();
  const [emailInput, setEmailInput] = React.useState(settings.user_email || '');
  const [linkEmailInput, setLinkEmailInput] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  const [linkEmailError, setLinkEmailError] = React.useState('');
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState('');
  const [newCompanyUsername, setNewCompanyUsername] = React.useState('');
  const [showSqlSetup, setShowSqlSetup] = React.useState(false);
  const [isDeleteCompanyModalOpen, setIsDeleteCompanyModalOpen] = React.useState<string | null>(null);

  useEffect(() => {
    if (isAddCompanyModalOpen) {
      setNewCompanyUsername('');
    }
  }, [isAddCompanyModalOpen]);

  const currencies = [
    { code: 'PKR', name: 'Pakistan Rupee' },
    { code: 'USD', name: 'US Dollar' },
    { code: 'None', name: 'None' },
  ];

  const pdfThemes = [
    { id: 'standard', name: 'Standard' },
    { id: 'modern', name: 'Modern' },
    { id: 'minimal', name: 'Minimal' },
  ];

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [companyName, setCompanyName] = useState(currentCompany?.name || '');
  const [companyLogo, setCompanyLogo] = useState(currentCompany?.logo_url || '');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      setCompanyName(currentCompany.name);
      setCompanyLogo(currentCompany.logo_url || '');
    }
  }, [currentCompany?.id]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCompany) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`; // Removed 'logos/' prefix to simplify path inside bucket

      // Try to upload. If it fails with "Bucket not found", we'll catch it.
      const { error: uploadError } = await supabase.storage
        .from('business_assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Storage bucket "business_assets" not found. Please create a public bucket named "business_assets" in your Supabase Storage dashboard.');
        }
        if (uploadError.message.includes('row-level security policy')) {
          throw new Error('Upload blocked by RLS policy. Please go to Settings > Cloud Sync > Database Setup and run the updated SQL script in your Supabase SQL Editor to enable storage permissions.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('business_assets')
        .getPublicUrl(filePath);

      setCompanyLogo(publicUrl);
      setToast({ message: 'Logo uploaded! Click Save to apply.', type: 'success' });
    } catch (error: any) {
      console.error('Upload error:', error);
      setToast({ message: error.message || 'Upload failed', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateBranding = async () => {
    if (!currentCompany) return;
    try {
      await updateCompany(currentCompany.id, {
        name: companyName,
        logo_url: companyLogo
      });
      setToast({ message: 'Branding updated successfully!', type: 'success' });
    } catch (error: any) {
      setToast({ message: 'Failed to update branding: ' + error.message, type: 'error' });
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const sqlSetup = `
-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  logo_url TEXT,
  currency TEXT,
  user_id TEXT,
  user_email TEXT,
  linked_emails TEXT[],
  username TEXT,
  recovery_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. Create Parties Table
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  type TEXT,
  opening_balance NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Ensure opening_balance column exists for existing tables
ALTER TABLE parties ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- 3. Create Banks Table
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT,
  opening_balance NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Ensure opening_balance column exists for existing tables
ALTER TABLE banks ADD COLUMN IF NOT EXISTS opening_balance NUMERIC DEFAULT 0;

-- 4. Create Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC DEFAULT 0,
  stock NUMERIC DEFAULT 0,
  low_stock_alert NUMERIC DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 5. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  to_party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  to_bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  quantity NUMERIC,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 6. Create Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  amount NUMERIC NOT NULL,
  description TEXT,
  category TEXT,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  payment_type TEXT DEFAULT 'Cash',
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 7. Create Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  tax NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Sale',
  payment_type TEXT NOT NULL DEFAULT 'Cash',
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 8. Create Payment Requests Table
DROP TABLE IF EXISTS payment_requests;
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT,
  phone TEXT,
  plan TEXT,
  amount NUMERIC,
  screenshot TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Company Access Table
CREATE TABLE IF NOT EXISTS company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  shared_email TEXT NOT NULL,
  permission TEXT DEFAULT 'view',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(company_id, shared_email)
);

-- 10. Create Licenses Table
DROP TABLE IF EXISTS licenses;
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  license_key TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  devices JSONB DEFAULT '[]',
  expiry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggressively fix schema cache
NOTIFY pgrst, 'reload schema';

-- 10. Fix Companies Username Constraint
ALTER TABLE companies ADD COLUMN IF NOT EXISTS username TEXT;
DROP INDEX IF EXISTS idx_companies_username;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_username_key;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_username_unique;
DROP INDEX IF EXISTS companies_username_idx;

-- 11. Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- 9. Create Comprehensive Access Policies
-- This allows authenticated users full access as requested
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('companies', 'parties', 'banks', 'inventory', 'transactions', 'expenses', 'invoices', 'payment_requests', 'licenses', 'company_access')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Full Access" ON %I', t);
        -- Allowing both authenticated and anon to ensure sync works even if session is pending, 
        -- but focusing on authenticated as requested.
        EXECUTE format('CREATE POLICY "Full Access" ON %I FOR ALL TO authenticated, anon USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- 10. Setup Storage for Logos
-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('business_assets', 'business_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Full Access" ON storage.objects;
CREATE POLICY "Full Access" ON storage.objects FOR ALL TO authenticated, anon USING (bucket_id = 'business_assets') WITH CHECK (bucket_id = 'business_assets');

-- 11. Setup updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. Create triggers for all tables
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('companies', 'parties', 'banks', 'inventory', 'transactions', 'expenses', 'invoices', 'company_access')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- 13. Enable Realtime
-- Ensure the publication exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to publication using correct syntax (no IF EXISTS)
-- We use a DO block to safely add tables only if they are not already in the publication
DO $$
DECLARE
    tbl text;
    tables_to_add text[] := ARRAY['companies', 'parties', 'banks', 'inventory', 'transactions', 'invoices', 'expenses', 'payment_requests', 'licenses', 'company_access'];
BEGIN
    FOREACH tbl IN ARRAY tables_to_add
    LOOP
        -- Check if table is already in publication
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', tbl);
        END IF;
    END LOOP;
END $$;

-- 14. Set Replica Identity to FULL for better Realtime support
ALTER TABLE companies REPLICA IDENTITY FULL;
ALTER TABLE parties REPLICA IDENTITY FULL;
ALTER TABLE banks REPLICA IDENTITY FULL;
ALTER TABLE inventory REPLICA IDENTITY FULL;
ALTER TABLE transactions REPLICA IDENTITY FULL;
ALTER TABLE invoices REPLICA IDENTITY FULL;
ALTER TABLE expenses REPLICA IDENTITY FULL;
ALTER TABLE payment_requests REPLICA IDENTITY FULL;
ALTER TABLE licenses REPLICA IDENTITY FULL;

-- 15. Final Schema Reload
NOTIFY pgrst, 'reload schema';
`;

  const handleAddCompany = async () => {
    if (!newCompanyName || !newCompanyUsername) return;
    
    try {
      await addCompany({
        name: newCompanyName,
        address: '',
        currency: settings.currency,
        user_id: settings.user_email || 'default',
        username: newCompanyUsername.toLowerCase().trim(),
      });
      setNewCompanyName('');
      setNewCompanyUsername('');
      setIsAddCompanyModalOpen(false);
    } catch (e) {
      // Error is handled by syncStatus in AppContext
    }
  };

  const isValidGmail = (email: string) => {
    return email.toLowerCase().endsWith('@gmail.com') || email === '16897463890072@1689746389007200';
  };

  const handleEnableSync = async () => {
    setEmailError('');
    if (!emailInput) return;
    if (!isValidGmail(emailInput)) {
      setEmailError('Invalid Gmail ❌');
      return;
    }
    updateSettings({ 
      user_email: emailInput, 
      is_verified: true, // Auto-verify since we're using email-only system
      sync_enabled: true 
    });
    refreshData(emailInput);
  };

  const handleLinkDevice = async () => {
    setLinkEmailError('');
    if (!linkEmailInput) return;
    if (!isValidGmail(linkEmailInput)) {
      setLinkEmailError('Invalid Gmail ❌');
      return;
    }
    await linkDevice(linkEmailInput);
    setLinkEmailInput('');
  };

  const handleResetApp = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleDeleteCompany = async (id: string) => {
    await deleteCompany(id, true); // Permanent delete by default as requested
    setIsDeleteCompanyModalOpen(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 px-4 md:px-0">
      {/* Data Management Section */}
      <section>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Database size={24} className="text-indigo-600" />
          Data Management
        </h3>
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <button 
              onClick={() => backupData()}
              className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500 transition-all text-left"
             >
               <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-indigo-600">
                 <Download size={24} />
               </div>
               <div>
                 <p className="font-bold text-slate-900 dark:text-white">Backup Data</p>
                 <p className="text-xs text-slate-500">Download all your records to a JSON file</p>
               </div>
             </button>

             <button 
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e: any) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (res) => restoreData(res.target?.result as string);
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-rose-500 transition-all text-left"
             >
               <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-rose-600">
                 <Upload size={24} />
               </div>
               <div>
                 <p className="font-bold text-slate-900 dark:text-white">Restore Data</p>
                 <p className="text-xs text-slate-500">Restore your records from a backup file</p>
               </div>
             </button>
          </div>
        </div>
      </section>

      {/* Branding Section */}
      <section>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-900 dark:text-white">
          <Building2 size={24} className="text-indigo-600" />
          Company Branding
        </h3>
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] md:text-sm font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company Name</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white font-bold"
                  placeholder="e.g. Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Logo</label>
                <div className="flex items-center gap-4">
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all cursor-pointer",
                    isUploading && "opacity-50 cursor-not-allowed"
                  )}>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={isUploading}
                      className="hidden"
                    />
                    <Building2 size={20} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {isUploading ? 'Uploading...' : 'Choose Logo File'}
                    </span>
                  </label>
                  {companyLogo && (
                    <button 
                      onClick={() => setCompanyLogo('')}
                      className="p-3 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                      title="Remove Logo"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">Recommended: Square PNG or SVG (max 2MB)</p>
              </div>
              <button 
                onClick={handleUpdateBranding}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
              >
                Save Branding
              </button>
            </div>
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-200">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo Preview" className="max-h-32 object-contain mb-4" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-200 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                  <Building2 size={40} />
                </div>
              )}
              <p className="text-[10px] text-slate-500 text-center uppercase tracking-wider">Logo Preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* Preferences Section */}
      <section>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
          <SettingsIcon size={24} className="text-indigo-600" />
          General Preferences
        </h3>
        <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {/* Theme */}
            <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                  {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                </div>
                <div>
                  <p className="font-bold">Appearance</p>
                  <p className="text-xs text-slate-500">Toggle between light and dark mode</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className="w-14 h-8 bg-slate-100 dark:bg-slate-100 rounded-full p-1 relative transition-all"
              >
                <div className={cn(
                  "w-6 h-6 bg-white dark:bg-indigo-600 rounded-full shadow-sm transition-all",
                  theme === 'dark' ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            {/* Currency */}
            <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                  <Globe size={20} />
                </div>
                <div>
                  <p className="font-bold">Currency</p>
                  <p className="text-xs text-slate-500">Default currency for transactions</p>
                </div>
              </div>
              <select 
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
              >
                {currencies.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>

            {/* PDF Theme */}
            <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="font-bold">PDF Theme</p>
                  <p className="text-xs text-slate-500">Choose layout for your invoices</p>
                </div>
              </div>
              <select 
                value={settings.pdf_theme}
                onChange={(e) => updateSettings({ pdf_theme: e.target.value })}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
              >
                {pdfThemes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Cloud Sync */}
            <div className="p-6 space-y-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
                    <Cloud size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">Cloud Sync</p>
                      {settings.is_verified && <CheckCircle2 size={14} className="text-emerald-500" />}
                    </div>
                    <p className="text-xs text-slate-500">Enable real-time sync with Supabase</p>
                  </div>
                </div>
                <button 
                  onClick={() => updateSettings({ sync_enabled: !settings.sync_enabled })}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 relative transition-all",
                    settings.sync_enabled ? "bg-indigo-600" : "bg-slate-200 dark:bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 bg-white rounded-full shadow-sm transition-all",
                    settings.sync_enabled ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>
              
              {settings.sync_enabled && (
                <div className="space-y-6 pt-2">
                  {!settings.is_verified ? (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-2">
                          <input 
                            type="email" 
                            placeholder="Enter Gmail to sync"
                            value={emailInput}
                            onChange={(e) => {
                              setEmailInput(e.target.value);
                              setEmailError('');
                            }}
                            className={cn(
                              "w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                              emailError ? "border-rose-500 ring-rose-500/20 ring-2" : "border-slate-200 dark:border-slate-700"
                            )}
                          />
                          {emailError && <p className="text-rose-500 text-xs font-bold">{emailError}</p>}
                        </div>
                        <button 
                          onClick={handleEnableSync}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 h-fit"
                        >
                          Enable Sync
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{settings.user_email}</p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-wider">Sync Active</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => refreshData()}
                            disabled={syncStatus.loading}
                            className="px-4 py-2 bg-white dark:bg-white text-emerald-600 dark:text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 dark:border-emerald-200 hover:bg-emerald-50 transition-all disabled:opacity-50"
                          >
                            {syncStatus.loading ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button 
                            onClick={() => updateSettings({ is_verified: false, user_email: '' })}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <LogOut size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Device Linking */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                          <Link2 size={16} className="text-indigo-600" />
                          Link Another Device
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1 space-y-2">
                            <input 
                              type="email" 
                              placeholder="Enter second device's Gmail"
                              value={linkEmailInput}
                              onChange={(e) => {
                                setLinkEmailInput(e.target.value);
                                setLinkEmailError('');
                              }}
                              className={cn(
                                "w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                                linkEmailError ? "border-rose-500 ring-rose-500/20 ring-2" : "border-slate-200 dark:border-slate-700"
                              )}
                            />
                            {linkEmailError && <p className="text-rose-500 text-xs font-bold">{linkEmailError}</p>}
                          </div>
                          <button 
                            onClick={handleLinkDevice}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all h-fit"
                          >
                            Link
                          </button>
                        </div>
                        {currentCompany?.linked_emails && currentCompany.linked_emails.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentCompany.linked_emails.map(email => (
                              <span key={email} className="px-3 py-1 bg-slate-100 dark:bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-600 border border-slate-200 dark:border-slate-200">
                                {email}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800/50">
                        <div>
                          <p className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Mobile Sync</p>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">Pull your companies from another device</p>
                        </div>
                        <button 
                          onClick={async () => {
                            const success = await pullCompanies(settings.user_email || '');
                            if (success) {
                              setToast({ message: 'Cloud companies found and restored!', type: 'success' });
                            } else {
                              setToast({ message: 'No linked companies found for this Gmail.', type: 'error' });
                            }
                          }}
                          disabled={syncStatus.loading}
                          className="px-4 py-2 bg-white dark:bg-white text-indigo-600 dark:text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-200 hover:bg-indigo-50 transition-all disabled:opacity-50"
                        >
                          {syncStatus.loading ? 'Searching...' : 'Pull Companies'}
                        </button>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-50 rounded-2xl border border-slate-100 dark:border-slate-200">
                        <button 
                          onClick={() => setShowSqlSetup(!showSqlSetup)}
                          className="flex items-center justify-between w-full text-left"
                        >
                          <div>
                            <p className="text-sm font-bold">Database Setup</p>
                            <p className="text-[10px] text-slate-500">Run SQL to fix sync errors</p>
                          </div>
                          <ChevronRight size={16} className={cn("transition-transform", showSqlSetup && "rotate-90")} />
                        </button>
                        {showSqlSetup && (
                          <div className="mt-4 space-y-3">
                            <p className="text-[10px] text-slate-500">If you see "table not found" errors, copy this SQL and run it in your Supabase SQL Editor:</p>
                            <div className="relative">
                              <pre className="bg-slate-950 text-slate-300 p-3 rounded-xl text-[8px] overflow-x-auto max-h-40">
                                {sqlSetup}
                              </pre>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(sqlSetup);
                                  setToast({ message: 'SQL copied to clipboard!', type: 'success' });
                                }}
                                className="absolute top-2 right-2 p-1 bg-white/10 hover:bg-white/20 rounded text-[8px] text-white"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {syncStatus.error && (
                    <div className="px-2 space-y-2">
                      <p className="text-xs text-rose-600 font-medium">{syncStatus.error}</p>
                      {syncStatus.error.includes('not found') && (
                        <button 
                          onClick={() => {
                            setShowSqlSetup(true);
                            navigator.clipboard.writeText(sqlSetup);
                            setToast({ message: 'SQL copied to clipboard! Please run it in your Supabase SQL Editor.', type: 'success' });
                          }}
                          className="w-full py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-bold border border-rose-100 dark:border-rose-800 hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                        >
                          <Database size={12} />
                          Copy Fix SQL & Show Instructions
                        </button>
                      )}
                    </div>
                  )}
                  {syncStatus.success && (
                    <p className="text-xs text-emerald-600 font-medium px-2">{syncStatus.success}</p>
                  )}
                </div>
              )}
            </div>

            {/* Appearance */}
          </div>
        </div>
      </section>
      
      {/* Admin Section */}
      {/* Backup & Restore */}
      <section>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-indigo-600">
          <Database size={24} />
          Backup & Restore
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Download size={24} />
              </div>
              <div>
                <p className="font-bold">Create Backup</p>
                <p className="text-sm text-slate-500">Export all your data to a JSON file. Keep this file safe as a local snapshot.</p>
              </div>
              <button 
                onClick={backupData}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Download Backup
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                <Upload size={24} />
              </div>
              <div>
                <p className="font-bold">Restore Data</p>
                <p className="text-sm text-slate-500 text-amber-600 font-medium">Warning: This will REPLACE all current data. This action cannot be undone.</p>
              </div>
              <label className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload size={18} />
                Upload & Restore
                <input 
                  type="file" 
                  accept=".json" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const content = event.target?.result as string;
                        if (confirm("CRITICAL WARNING: This will permanently DELETE all current data and replace it with the backup file. Are you absolutely sure?")) {
                          try {
                            await restoreData(content);
                          } catch (err: any) {
                            setToast({ message: err.message, type: 'error' });
                          }
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section>
          <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-indigo-600">
            <Shield size={24} />
            Admin Access
          </h3>
          <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Admin Dashboard</p>
                <p className="text-sm text-slate-500">You are logged in as an administrator. Access the dashboard to manage payments.</p>
              </div>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'admin' }))}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
              >
                <Shield size={18} />
                Open Admin Panel
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6 text-rose-600">
          <Shield size={24} />
          Danger Zone
        </h3>
        <div className="space-y-4">
          <div className="bg-white dark:bg-white rounded-3xl border border-slate-100 dark:border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold">Sign Out</p>
                <p className="text-sm text-slate-500">Sign out of your current account. Your data will remain safe on this device.</p>
              </div>
              <button 
                onClick={signOut}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-100 text-slate-600 dark:text-slate-900 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-200 transition-all flex items-center gap-2"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>

          <div className="bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-900/30 p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-rose-900 dark:text-rose-100">Delete All Data</p>
                <p className="text-sm text-rose-600 dark:text-rose-400">Permanently remove all companies, parties, and transactions.</p>
              </div>
              <button 
                onClick={handleResetApp}
                className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Trash2 size={18} />
                Reset App
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="text-center pt-8">
        <p className="text-xs text-slate-400 mt-4">Bugzy Business Pro v1.0.0 • Made with ❤️ for Business</p>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] font-bold text-white",
              toast.type === 'success' ? "bg-emerald-600" : "bg-rose-600"
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

