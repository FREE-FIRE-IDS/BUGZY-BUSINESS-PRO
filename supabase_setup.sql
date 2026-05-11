-- Supabase Setup SQL for Bugzy Business Pro SaaS

-- 1. Ensure core tables exist with proper schema
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency TEXT DEFAULT 'PKR',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id TEXT,
  user_email TEXT,
  owner_email TEXT,
  linked_emails TEXT[] DEFAULT '{}',
  username TEXT,
  trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_paid BOOLEAN DEFAULT FALSE,
  company_type TEXT DEFAULT 'normal',
  recovery_code TEXT
);

-- Helper functions to prevent recursion and check access efficiently
-- Using SET search_path = public to ensure SECURITY DEFINER actually bypasses RLS
CREATE OR REPLACE FUNCTION public.is_company_owner(cid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_email TEXT;
  current_uid TEXT;
BEGIN
  current_email := LOWER(auth.jwt() ->> 'email');
  current_uid := auth.uid()::text;
  
  -- Root Admin Bypass
  IF current_email = 'sudaiskamran31@gmail.com' THEN RETURN TRUE; END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = cid 
    AND (
      owner_id = current_uid OR
      LOWER(owner_email) = current_email OR 
      LOWER(user_email) = current_email OR
      current_email = ANY(COALESCE(linked_emails, '{}'))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to sync linked_emails for faster RLS
CREATE OR REPLACE FUNCTION public.sync_company_linked_emails()
RETURNS trigger AS $$
BEGIN
  -- This runs as security definer to bypass RLS and update the companies table
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.companies 
    SET linked_emails = (
      SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
      FROM public.company_members 
      WHERE company_id = NEW.company_id
    )
    WHERE id = NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.companies 
    SET linked_emails = (
      SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
      FROM public.company_members 
      WHERE company_id = OLD.company_id
    )
    WHERE id = OLD.company_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_company_member_change ON public.company_members;
CREATE TRIGGER on_company_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_linked_emails();

CREATE OR REPLACE FUNCTION public.is_company_member(cid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_email TEXT;
  current_uid TEXT;
BEGIN
  current_email := LOWER(auth.jwt() ->> 'email');
  current_uid := auth.uid()::text;
  -- Root Admin Bypass
  IF current_email = 'sudaiskamran31@gmail.com' THEN RETURN TRUE; END IF;
  -- Basic validity
  IF current_email IS NULL OR current_email = '' THEN RETURN FALSE; END IF;

  -- Use a direct query that bypasses RLS because this is SECURITY DEFINER
  RETURN EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = cid 
    AND (
      owner_id = current_uid OR
      LOWER(owner_email) = current_email OR 
      LOWER(user_email) = current_email OR 
      current_email = ANY(COALESCE(linked_emails, '{}'))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  opening_balance DOUBLE PRECISION DEFAULT 0,
  current_balance DOUBLE PRECISION DEFAULT 0,
  balance DOUBLE PRECISION DEFAULT 0,
  type TEXT CHECK (type IN ('Customer', 'Supplier', 'Both')),
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT,
  opening_balance DOUBLE PRECISION DEFAULT 0,
  current_balance DOUBLE PRECISION DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT,
  purchase_price DOUBLE PRECISION DEFAULT 0,
  sale_price DOUBLE PRECISION DEFAULT 0,
  opening_stock DOUBLE PRECISION DEFAULT 0,
  current_stock DOUBLE PRECISION DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  to_party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  to_bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  description TEXT,
  reference TEXT,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  date TEXT NOT NULL,
  due_date TEXT,
  type TEXT NOT NULL,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]',
  subtotal DOUBLE PRECISION DEFAULT 0,
  tax DOUBLE PRECISION DEFAULT 0,
  discount DOUBLE PRECISION DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  paid_amount DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'Unpaid',
  payment_type TEXT,
  bank_id UUID REFERENCES banks(id) ON DELETE SET NULL,
  notes TEXT,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ensure columns exist (for existing tables)
DO $$ 
BEGIN
  -- Companies
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='owner_id') THEN
    ALTER TABLE companies ADD COLUMN owner_id TEXT;
  END IF;
  -- If we have old user_id, migrate it to owner_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='user_id') THEN
    UPDATE companies SET owner_id = user_id WHERE owner_id IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='user_email') THEN
    ALTER TABLE companies ADD COLUMN user_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='owner_email') THEN
    ALTER TABLE companies ADD COLUMN owner_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='linked_emails') THEN
    ALTER TABLE companies ADD COLUMN linked_emails TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='trial_start') THEN
    ALTER TABLE companies ADD COLUMN trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='is_paid') THEN
    ALTER TABLE companies ADD COLUMN is_paid BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='company_type') THEN
    ALTER TABLE companies ADD COLUMN company_type TEXT DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='username') THEN
    ALTER TABLE companies ADD COLUMN username TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='recovery_code') THEN
    ALTER TABLE companies ADD COLUMN recovery_code TEXT;
  END IF;

  -- Other Tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parties' AND column_name='user_email') THEN
    ALTER TABLE parties ADD COLUMN user_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='banks' AND column_name='user_email') THEN
    ALTER TABLE banks ADD COLUMN user_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='user_email') THEN
    ALTER TABLE inventory ADD COLUMN user_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='user_email') THEN
    ALTER TABLE transactions ADD COLUMN user_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='user_email') THEN
    ALTER TABLE invoices ADD COLUMN user_email TEXT;
  END IF;
END $$;

-- 2. Create company_access table for sharing
CREATE TABLE IF NOT EXISTS company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  shared_email TEXT NOT NULL,
  join_code TEXT,
  permission TEXT DEFAULT 'view',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, shared_email)
);

-- Optimization and Sync robustness
ALTER TABLE companies REPLICA IDENTITY FULL;
-- ... (rest of REPLICA IDENTITY FULL)
ALTER TABLE company_access REPLICA IDENTITY FULL;

-- Ensure RLS is enabled on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- 6. User Profiles (Synced with auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_verified)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    (new.email_confirmed_at IS NOT NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    is_verified = (new.email_confirmed_at IS NOT NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Company Invites
CREATE TABLE IF NOT EXISTS company_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, invited_email, status)
);

ALTER TABLE company_invites ENABLE ROW LEVEL SECURITY;

-- company_invites policies
DROP POLICY IF EXISTS "Invites are viewable by sender or receiver" ON company_invites;
DROP POLICY IF EXISTS "Owners can create invites" ON company_invites;
DROP POLICY IF EXISTS "Receivers or owners can update invites" ON company_invites;
DROP POLICY IF EXISTS "invites_read" ON company_invites;
DROP POLICY IF EXISTS "invites_write" ON company_invites;

CREATE POLICY "invites_read"
ON company_invites FOR SELECT
USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_by) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id 
    AND (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "invites_write"
ON company_invites FOR INSERT
WITH CHECK (
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_by) AND
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id 
    AND (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  )
);

-- 8. Company Members
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their own company membership" ON company_members;
DROP POLICY IF EXISTS "Owners can manage members" ON company_members;
DROP POLICY IF EXISTS "Owners can insert members" ON company_members;
DROP POLICY IF EXISTS "Owners can update members" ON company_members;
DROP POLICY IF EXISTS "Owners can delete members" ON company_members;
DROP POLICY IF EXISTS "members_read" ON company_members;
DROP POLICY IF EXISTS "members_write" ON company_members;

CREATE POLICY "members_read"
ON company_members FOR SELECT
USING (
  auth.uid() = user_id OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id 
    AND (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Owners can insert members"
ON company_members FOR INSERT
WITH CHECK (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id 
    AND (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Owners can update members"
ON company_members FOR UPDATE
USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id 
    AND (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  )
);

CREATE POLICY "Owners can delete members"
ON company_members FOR DELETE
USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id 
    AND (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email'))
  )
);

-- Optimization and Sync robustness
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE company_invites REPLICA IDENTITY FULL;
ALTER TABLE company_members REPLICA IDENTITY FULL;

-- Legacy table cleanup (optional, keeping for safety but we will switch logic)
-- ALTER TABLE company_access RENAME TO company_access_legacy;

-- 7. Companies Policies (Simplified to prevent loops)
-- Use a DO block to aggressively drop ALL existing policies on companies table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'companies' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', policy_record.policyname);
    END LOOP;
END $$;

-- SELECT policy is DRY and FLAT. NO subqueries or function calls here to prevent recursion.
CREATE POLICY "companies_v14_select" ON public.companies FOR SELECT USING (
  owner_id = auth.uid()::text OR 
  LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR 
  LOWER(user_email) = LOWER(auth.jwt() ->> 'email') OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = ANY(COALESCE(linked_emails, '{}')) OR
  (username IS NOT NULL AND auth.uid() IS NULL) -- Allow lookup if not logged in
);

CREATE POLICY "companies_v14_insert" ON public.companies FOR INSERT WITH CHECK (
  true
);

CREATE POLICY "companies_v14_update" ON public.companies FOR UPDATE USING (
  owner_id = auth.uid()::text OR 
  LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR 
  LOWER(user_email) = LOWER(auth.jwt() ->> 'email') OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_member(id)
) WITH CHECK (true);

CREATE POLICY "companies_v14_delete" ON public.companies FOR DELETE USING (
  owner_id = auth.uid()::text OR 
  LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR 
  LOWER(user_email) = LOWER(auth.jwt() ->> 'email') OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_owner(id)
);

-- 8. Add Licenses and Payment Requests Tables (to ensure they exist for policies)
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  user_email TEXT,
  license_key TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  devices JSONB DEFAULT '[]',
  expiry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  user_email TEXT,
  name TEXT,
  phone TEXT,
  plan TEXT,
  amount DOUBLE PRECISION,
  screenshot TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='user_email') THEN
    ALTER TABLE licenses ADD COLUMN user_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='user_email') THEN
    ALTER TABLE payment_requests ADD COLUMN user_email TEXT;
  END IF;
END $$;

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- 8. Core Table Policies (Direct access via user_email or share check)
-- This avoids querying the 'companies' table inside these policies to prevent recursion.

-- Parties
DROP POLICY IF EXISTS "parties_access" ON public.parties;
DROP POLICY IF EXISTS "Parties access" ON public.parties;
DROP POLICY IF EXISTS "parties_full_access" ON public.parties;
DROP POLICY IF EXISTS "parties_policy" ON public.parties;

CREATE POLICY "parties_access" ON public.parties FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_member(company_id)
);

-- Banks
DROP POLICY IF EXISTS "banks_access" ON public.banks;
DROP POLICY IF EXISTS "Banks access" ON public.banks;
DROP POLICY IF EXISTS "banks_full_access" ON public.banks;
DROP POLICY IF EXISTS "banks_policy" ON public.banks;

CREATE POLICY "banks_access" ON public.banks FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_member(company_id)
);

-- Inventory
DROP POLICY IF EXISTS "inventory_access" ON public.inventory;
DROP POLICY IF EXISTS "Inventory access" ON public.inventory;
DROP POLICY IF EXISTS "inventory_full_access" ON public.inventory;
DROP POLICY IF EXISTS "inventory_policy" ON public.inventory;

CREATE POLICY "inventory_access" ON public.inventory FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_member(company_id)
);

-- Transactions
DROP POLICY IF EXISTS "transactions_access" ON public.transactions;
DROP POLICY IF EXISTS "Transactions access" ON public.transactions;
DROP POLICY IF EXISTS "transactions_full_access" ON public.transactions;
DROP POLICY IF EXISTS "transactions_policy" ON public.transactions;

CREATE POLICY "transactions_access" ON public.transactions FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_member(company_id)
);

-- Invoices
DROP POLICY IF EXISTS "invoices_access" ON public.invoices;
DROP POLICY IF EXISTS "Invoices access" ON public.invoices;
DROP POLICY IF EXISTS "invoices_full_access" ON public.invoices;
DROP POLICY IF EXISTS "invoices_policy" ON public.invoices;

CREATE POLICY "invoices_access" ON public.invoices FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  public.is_company_member(company_id)
);

-- 9. External systems Policies
-- Licenses
DROP POLICY IF EXISTS "Users can view their own licenses" ON licenses;
DROP POLICY IF EXISTS "Admins can view all licenses" ON licenses;
DROP POLICY IF EXISTS "Admins can manage licenses" ON licenses;
DROP POLICY IF EXISTS "Users can update their own device_id" ON licenses;
DROP POLICY IF EXISTS "license_access" ON licenses;
DROP POLICY IF EXISTS "licenses_access" ON licenses;

CREATE POLICY "licenses_access" ON licenses FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  auth.uid()::text = user_id::text OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
) WITH CHECK (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  auth.uid()::text = user_id::text OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
);

-- Payment Requests 
DROP POLICY IF EXISTS "Users can create their own payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Users can view their own payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Admins can view all payment requests" ON payment_requests;
DROP POLICY IF EXISTS "Admins can update payment requests" ON payment_requests;
DROP POLICY IF EXISTS "payment_requests_access" ON payment_requests;

CREATE POLICY "payment_requests_access" ON payment_requests FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
) WITH CHECK (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
);

-- Seed linked_emails for existing companies
DO $$
BEGIN
  UPDATE public.companies c
  SET linked_emails = (
    SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
    FROM public.company_members m
    WHERE m.company_id = c.id
  );
END $$;

-- End of setup
