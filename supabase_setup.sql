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
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT oid::regprocedure as format_name
        FROM pg_proc 
        WHERE proname IN (
            'respond_to_invite_by_email', 
            'get_company_team', 
            'get_table_data_by_email', 
            'delete_table_data_by_email', 
            'upsert_table_data_by_email', 
            'get_invites_for_email', 
            'get_companies_for_email', 
            'get_memberships_for_email',
            'is_authorized_for_company',
            'is_company_owner',
            'is_company_member',
            'rpc_leave_company',
            'sync_company_linked_emails',
            'handle_new_user'
        )
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.format_name || ' CASCADE';
    END LOOP;
END $$;

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
  recovery_code TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT,
  purchase_price DOUBLE PRECISION DEFAULT 0,
  sale_price DOUBLE PRECISION DEFAULT 0,
  price DOUBLE PRECISION DEFAULT 0,
  opening_stock DOUBLE PRECISION DEFAULT 0,
  current_stock DOUBLE PRECISION DEFAULT 0,
  stock DOUBLE PRECISION DEFAULT 0,
  low_stock_alert DOUBLE PRECISION DEFAULT 0,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
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
  category TEXT,
  quantity DOUBLE PRECISION,
  unit TEXT,
  price DOUBLE PRECISION,
  shipping_mark TEXT,
  total_weight DOUBLE PRECISION,
  shortage DOUBLE PRECISION,
  net_weight DOUBLE PRECISION,
  payment_type TEXT,
  user_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
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
  owner_id = auth.uid()::text OR 
  LOWER(owner_email) = LOWER(auth.jwt() ->> 'email') OR 
  LOWER(user_email) = LOWER(auth.jwt() ->> 'email') OR
  LOWER(auth.jwt() ->> 'email') = ANY(COALESCE(linked_emails, '{}')) OR
  id IN (SELECT company_id FROM public.company_invites WHERE status = 'pending' AND LOWER(invited_email) = LOWER(auth.jwt() ->> 'email')) OR
  id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() OR LOWER(user_email) = LOWER(auth.jwt() ->> 'email')) OR
  (username IS NOT NULL AND auth.uid() IS NULL)
) WITH CHECK (true);

-- Profiles
CREATE POLICY "profiles_access" ON public.profiles FOR ALL USING (
  auth.uid() = id
) WITH CHECK (true);

-- Invites
CREATE POLICY "invites_access" ON public.company_invites FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_by) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(invited_email) OR
  public.is_company_member(company_id)
) WITH CHECK (true);

-- Members
CREATE POLICY "members_access" ON public.company_members FOR ALL USING (
  auth.uid() = user_id OR
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR
  public.is_company_member(company_id)
) WITH CHECK (true);

-- Other tables
CREATE POLICY "parties_policy" ON public.parties FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "banks_policy" ON public.banks FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "inventory_policy" ON public.inventory FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "transactions_policy" ON public.transactions FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

CREATE POLICY "invoices_policy" ON public.invoices FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  public.is_company_member(company_id)
) WITH CHECK (true);

-- External
CREATE POLICY "licenses_policy" ON public.licenses FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  auth.uid()::text = user_id::text
) WITH CHECK (true);

CREATE POLICY "payment_requests_policy" ON public.payment_requests FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email)
) WITH CHECK (true);

-- 6. Replication Identity
ALTER TABLE companies REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE company_invites REPLICA IDENTITY FULL;
ALTER TABLE company_members REPLICA IDENTITY FULL;

-- 8. RPC Functions for bypassing RLS securely via email
DROP FUNCTION IF EXISTS public.get_companies_for_email(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_companies_for_email(req_email TEXT)
RETURNS SETOF public.companies AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT c.* 
  FROM public.companies c
  LEFT JOIN public.company_members m ON c.id = m.company_id
  WHERE 
    LOWER(c.owner_email) = LOWER(req_email) OR
    LOWER(c.user_email) = LOWER(req_email) OR
    LOWER(req_email) = ANY(COALESCE(c.linked_emails, '{}')) OR
    LOWER(m.user_email) = LOWER(req_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.get_invites_for_email(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_invites_for_email(req_email TEXT)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  invited_email TEXT,
  invited_by TEXT,
  status TEXT,
  company_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.company_id, i.invited_email, i.invited_by, i.status, c.name as company_name
  FROM public.company_invites i
  JOIN public.companies c ON i.company_id = c.id
  WHERE LOWER(i.invited_email) = LOWER(req_email) AND i.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.is_company_owner(UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.is_company_owner(req_company_id UUID, req_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = req_company_id AND (
      LOWER(owner_email) = LOWER(req_email) OR
      LOWER(user_email) = LOWER(req_email)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.is_authorized_for_company(UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.is_authorized_for_company(req_company_id UUID, req_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = req_company_id AND (
      LOWER(owner_email) = LOWER(req_email) OR
      LOWER(user_email) = LOWER(req_email) OR
      LOWER(req_email) = ANY(COALESCE(linked_emails, '{}'))
    )
  ) OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = req_company_id AND LOWER(user_email) = LOWER(req_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.get_memberships_for_email(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_memberships_for_email(req_email TEXT)
RETURNS TABLE (
  membership_id UUID,
  companies JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id as membership_id, pg_catalog.to_jsonb(c.*) as companies
  FROM public.company_members m
  JOIN public.companies c ON m.company_id = c.id
  WHERE LOWER(m.user_email) = LOWER(req_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. RPC Functions for bypassing RLS securely via email
CREATE OR REPLACE FUNCTION public.sync_company_linked_emails()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.companies
    SET linked_emails = (
        SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
        FROM public.company_members
        WHERE company_id = COALESCE(NEW.company_id, OLD.company_id)
    )
    WHERE id = COALESCE(NEW.company_id, OLD.company_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_company_members ON public.company_members;
CREATE TRIGGER trg_sync_company_members
AFTER INSERT OR DELETE OR UPDATE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.sync_company_linked_emails();

DROP FUNCTION IF EXISTS public.get_table_data_by_email(TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_table_data_by_email(TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_table_data_by_email(req_company_id TEXT, req_email TEXT, req_table TEXT)
RETURNS SETOF JSONB AS $$
DECLARE
  v_uuid_company_id UUID;
BEGIN
  v_uuid_company_id := req_company_id::UUID;
  IF NOT public.is_authorized_for_company(v_uuid_company_id, req_email) THEN
    RAISE EXCEPTION 'Not authorized for this company %', req_company_id;
  END IF;

  -- Dynamic query based on table name (validated against allowlist)
  IF req_table NOT IN ('parties', 'banks', 'inventory', 'transactions', 'invoices', 'profiles', 'licenses', 'payment_requests', 'company_access', 'company_invites', 'company_members') THEN
    RAISE EXCEPTION 'Table % not allowed', req_table;
  END IF;

  RETURN QUERY EXECUTE format('SELECT pg_catalog.to_jsonb(t.*) FROM public.%I t WHERE company_id = %L', req_table, v_uuid_company_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.upsert_table_data_by_email(TEXT, JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.upsert_table_data_by_email(TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.upsert_table_data_by_email(req_email TEXT, req_payload JSONB, req_table TEXT)
RETURNS JSONB AS $$
DECLARE
  v_company_id UUID;
  v_item JSONB;
  v_result JSONB;
  v_cols TEXT;
BEGIN
  -- Validate table name
  IF req_table NOT IN ('companies', 'parties', 'banks', 'inventory', 'transactions', 'invoices', 'profiles', 'licenses', 'payment_requests', 'company_access', 'company_invites', 'company_members') THEN
    RAISE EXCEPTION 'Table % not allowed', req_table;
  END IF;

  -- Pre-calculate set clause for the table (excluding id)
  SELECT string_agg(quote_ident(column_name) || ' = EXCLUDED.' || quote_ident(column_name), ', ') INTO v_cols
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = req_table AND column_name != 'id';

  -- 1. Extract company_id and validate access
  IF jsonb_typeof(req_payload) = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements(req_payload) LOOP
      v_company_id := (v_item->>'company_id')::UUID;
      IF NOT public.is_authorized_for_company(v_company_id, req_email) THEN
        RAISE EXCEPTION 'Not authorized for company %', v_company_id;
      END IF;

      -- Ensure ID exists to avoid NULL constraint violation on PRIMARY KEY during jsonb_populate_record
      IF NOT (v_item ? 'id') OR (v_item->>'id') IS NULL THEN
        v_item := v_item || jsonb_build_object('id', gen_random_uuid());
      END IF;

      EXECUTE format(
        'INSERT INTO public.%I AS t SELECT * FROM jsonb_populate_record(NULL::public.%I, %L) ' ||
        'ON CONFLICT (id) DO UPDATE SET %s ' ||
        'RETURNING pg_catalog.to_jsonb(t.*)',
        req_table, req_table, v_item, v_cols
      ) INTO v_result;
    END LOOP;
    v_result := '{"status": "success", "message": "Bulk upsert complete"}'::jsonb;
  ELSE
    v_company_id := (req_payload->>'company_id')::UUID;
    IF NOT public.is_authorized_for_company(v_company_id, req_email) THEN
      RAISE EXCEPTION 'Not authorized for company %', v_company_id;
    END IF;

    -- Ensure ID exists
    IF NOT (req_payload ? 'id') OR (req_payload->>'id') IS NULL THEN
      req_payload := req_payload || jsonb_build_object('id', gen_random_uuid());
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I AS t SELECT * FROM jsonb_populate_record(NULL::public.%I, %L) ' ||
      'ON CONFLICT (id) DO UPDATE SET %s ' ||
      'RETURNING pg_catalog.to_jsonb(t.*)',
      req_table, req_table, req_payload, v_cols
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.delete_table_data_by_email(TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.delete_table_data_by_email(TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_table_data_by_email(req_email TEXT, req_id TEXT, req_table TEXT)
RETURNS VOID AS $$
DECLARE
  v_company_id UUID;
  v_record_id UUID;
BEGIN
  v_record_id := req_id::UUID;
  -- Validate table name
  IF req_table NOT IN ('companies', 'parties', 'banks', 'inventory', 'transactions', 'invoices', 'profiles', 'licenses', 'payment_requests', 'company_access', 'company_invites', 'company_members') THEN
    RAISE EXCEPTION 'Table % not allowed', req_table;
  END IF;

  -- 1. Get company_id of the record to check authorization
  IF req_table = 'companies' THEN
    v_company_id := v_record_id;
  ELSE
    BEGIN
      EXECUTE format('SELECT company_id FROM public.%I WHERE id = %L', req_table, v_record_id) INTO v_company_id;
    EXCEPTION WHEN OTHERS THEN
      v_company_id := NULL;
    END;
  END IF;

  -- 2. Authorization Checks
  
  -- Check if user is the business owner (Full access to delete anything in company)
  IF v_company_id IS NOT NULL AND public.is_company_owner(v_company_id, req_email) THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = %L', req_table, v_record_id);
    RETURN;
  END IF;

  -- 3. Self-access bypass (Record-specific authorization)
  
  -- Members can remove themselves
  IF req_table = 'company_members' THEN
    IF EXISTS (SELECT 1 FROM public.company_members WHERE id = v_record_id AND LOWER(user_email) = LOWER(req_email)) THEN
       EXECUTE format('DELETE FROM public.company_members WHERE id = %L', v_record_id);
       -- Force sync linked_emails for the company this member belonged to
       IF v_company_id IS NOT NULL THEN
         UPDATE public.companies 
         SET linked_emails = (
           SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
           FROM public.company_members 
           WHERE company_id = v_company_id
         )
         WHERE id = v_company_id;
       END IF;
       RETURN;
    END IF;
  END IF;

  -- Invitees can reject/delete their own invite, OR the inviter can delete it
  IF req_table = 'company_invites' THEN
    IF EXISTS (SELECT 1 FROM public.company_invites WHERE id = v_record_id AND (LOWER(invited_email) = LOWER(req_email) OR LOWER(invited_by) = LOWER(req_email))) THEN
       EXECUTE format('DELETE FROM public.company_invites WHERE id = %L', v_record_id);
       RETURN;
    END IF;
  END IF;

  -- 4. Fallback: General authorization check
  IF v_company_id IS NOT NULL AND NOT public.is_authorized_for_company(v_company_id, req_email) THEN
    RAISE EXCEPTION 'Unauthorized to delete from %', req_table;
  END IF;

  -- If we reached here, either it's an authorized worker or owner. 
  IF v_company_id IS NOT NULL THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = %L', req_table, v_record_id);
    
    -- Final cleanup sync for company_members deletions
    IF req_table = 'company_members' THEN
       UPDATE public.companies 
       SET linked_emails = (
         SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
         FROM public.company_members 
         WHERE company_id = v_company_id
       )
       WHERE id = v_company_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.rpc_leave_company(TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.rpc_leave_company(req_company_id TEXT, req_email TEXT)
RETURNS VOID AS $$
DECLARE
  v_uuid_id UUID;
BEGIN
    v_uuid_id := req_company_id::UUID;
    DELETE FROM public.company_members 
    WHERE company_id = v_uuid_id
    AND LOWER(user_email) = LOWER(req_email);
    
    -- Force sync linked_emails as backup
    UPDATE public.companies 
    SET linked_emails = (
      SELECT COALESCE(array_agg(DISTINCT LOWER(user_email)), '{}')
      FROM public.company_members 
      WHERE company_id = v_uuid_id
    )
    WHERE id = v_uuid_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.respond_to_invite_by_email(req_invite_id TEXT, req_status TEXT, req_email TEXT)
RETURNS VOID AS $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM public.company_invites WHERE id = req_invite_id::UUID AND LOWER(invited_email) = LOWER(req_email);
    IF v_company_id IS NULL THEN RAISE EXCEPTION 'Invitation not found or unauthorized'; END IF;

    IF req_status = 'accepted' THEN
        INSERT INTO public.company_members (company_id, user_email, role) VALUES (v_company_id, LOWER(req_email), 'member') ON CONFLICT DO NOTHING;
    END IF;
    DELETE FROM public.company_invites WHERE id = req_invite_id::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_company_team(req_company_id TEXT, req_email TEXT)
RETURNS TABLE (
  id TEXT,
  invited_email TEXT,
  status TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_uuid_id UUID;
BEGIN
  v_uuid_id := req_company_id::UUID;
  -- Security check: only owner/member can see the team
  IF NOT public.is_authorized_for_company(v_uuid_id, req_email) THEN
    RAISE EXCEPTION 'Not authorized to view team';
  END IF;

  RETURN QUERY
  -- Members
  SELECT 
    'member-' || m.id::text, 
    LOWER(m.user_email), 
    'accepted'::text, 
    m.role,
    m.created_at
  FROM public.company_members m
  WHERE m.company_id = v_uuid_id
  UNION ALL
  -- Pending Invites
  SELECT 
    i.id::text, 
    LOWER(i.invited_email), 
    i.status, 
    'member'::text,
    i.created_at
  FROM public.company_invites i
  WHERE i.company_id = v_uuid_id AND i.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
