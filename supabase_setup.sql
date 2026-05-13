-- Supabase Setup SQL for Bugzy Business Pro SaaS

-- 1. Aggressively drop ALL existing policies on core tables first to resolve dependency issues
DO $$
DECLARE
    table_name_rec RECORD;
    policy_record RECORD;
BEGIN
    FOR table_name_rec IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('companies', 'company_members', 'company_invites', 'parties', 'banks', 'inventory', 'transactions', 'invoices', 'profiles', 'licenses', 'payment_requests', 'company_access')
    LOOP
        FOR policy_record IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = table_name_rec.tablename AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, table_name_rec.tablename);
        END LOOP;
    END LOOP;
END $$;

-- 2. Now safe to drop functions that policies depended on
DROP FUNCTION IF EXISTS public.is_company_owner(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_company_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.sync_company_linked_emails() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Core Tables with proper schema
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

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

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

-- 4. Helper functions (SECURITY DEFINER)
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
  IF current_email IS NULL OR current_email = '' THEN 
    IF current_uid IS NULL THEN RETURN FALSE; END IF;
  END IF;

  -- Use a direct query that bypasses RLS because this is SECURITY DEFINER
  IF EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = cid 
    AND (
      owner_id = current_uid OR
      LOWER(owner_email) = current_email OR 
      LOWER(user_email) = current_email OR 
      current_email = ANY(COALESCE(linked_emails, '{}'))
    )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Also check company_members directly to be safe
  RETURN EXISTS (
    SELECT 1 FROM public.company_members 
    WHERE company_id = cid AND (user_id = auth.uid() OR LOWER(user_email) = current_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_company_owner(cid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_company_member(cid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_company_linked_emails()
RETURNS trigger AS $$
BEGIN
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

-- triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_company_member_change ON public.company_members;
CREATE TRIGGER on_company_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_linked_emails();

-- 5. RLS Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- Companies
CREATE POLICY "companies_access" ON public.companies FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  owner_id = auth.uid()::text OR 
  LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR 
  LOWER(user_email) = LOWER(auth.jwt() ->> 'email') OR
  LOWER(auth.jwt() ->> 'email') = ANY(COALESCE(linked_emails, '{}')) OR
  (username IS NOT NULL AND auth.uid() IS NULL)
) WITH CHECK (true);

-- Profiles
CREATE POLICY "profiles_access" ON public.profiles FOR ALL USING (
  auth.uid() = id OR LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
) WITH CHECK (true);

-- Invites
CREATE POLICY "invites_access" ON public.company_invites FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_by) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_email) OR
  public.is_company_member(company_id)
) WITH CHECK (true);

-- Members
CREATE POLICY "members_access" ON public.company_members FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  auth.uid() = user_id OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR
  public.is_company_member(company_id)
) WITH CHECK (true);

-- Other tables
CREATE POLICY "parties_policy" ON public.parties FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "banks_policy" ON public.banks FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "inventory_policy" ON public.inventory FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "transactions_policy" ON public.transactions FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "invoices_policy" ON public.invoices FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

-- External
CREATE POLICY "licenses_policy" ON public.licenses FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  auth.uid()::text = user_id::text
) WITH CHECK (true);

CREATE POLICY "payment_requests_policy" ON public.payment_requests FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email)
) WITH CHECK (true);

-- 6. Replication Identity
ALTER TABLE companies REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE company_invites REPLICA IDENTITY FULL;
ALTER TABLE company_members REPLICA IDENTITY FULL;

-- 7. Seed linked_emails
DO $$
BEGIN
  UPDATE public.companies c
  SET linked_emails = (
    SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
    FROM public.company_members m
    WHERE m.company_id = c.id
  );
END $$;
