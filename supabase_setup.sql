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
  user_id TEXT,
  user_email TEXT,
  owner_email TEXT,
  linked_emails TEXT[] DEFAULT '{}',
  username TEXT,
  trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_paid BOOLEAN DEFAULT FALSE,
  company_type TEXT DEFAULT 'normal',
  recovery_code TEXT
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

-- 2. Ensure columns exist (for existing tables)
DO $$ 
BEGIN
  -- Companies
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

-- 6. company_access policies (Simplified to avoid recursion)
DROP POLICY IF EXISTS "company_access_all_policy" ON company_access;
DROP POLICY IF EXISTS "company_access_select" ON company_access;
DROP POLICY IF EXISTS "company_access_insert" ON company_access;
DROP POLICY IF EXISTS "company_access_update" ON company_access;
DROP POLICY IF EXISTS "company_access_delete" ON company_access;
DROP POLICY IF EXISTS "company_access_policy" ON company_access;
DROP POLICY IF EXISTS "company_access_read" ON company_access;
DROP POLICY IF EXISTS "company_access_write" ON company_access;
DROP POLICY IF EXISTS "company_access_edit" ON company_access;
DROP POLICY IF EXISTS "company_access_remove" ON company_access;

-- SELECT: Invitee or Owner can see the record
CREATE POLICY "company_access_read" ON company_access FOR SELECT USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(shared_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
);

-- INSERT: Only owner can invite
CREATE POLICY "company_access_write" ON company_access FOR INSERT WITH CHECK (
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
);

-- UPDATE: Owner or invitee (to accept)
CREATE POLICY "company_access_edit" ON company_access FOR UPDATE USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(shared_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
) WITH CHECK (true);

-- DELETE: Owner only
CREATE POLICY "company_access_remove" ON company_access FOR DELETE USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR 
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
);

-- 7. Companies Policies (Simplified to prevent loops)
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;
DROP POLICY IF EXISTS "companies_read" ON companies;
DROP POLICY IF EXISTS "companies_write" ON companies;
DROP POLICY IF EXISTS "companies_edit" ON companies;
DROP POLICY IF EXISTS "companies_remove" ON companies;

-- SELECT: Owner OR Linked OR Shared (via subquery)
CREATE POLICY "companies_read" ON companies FOR SELECT USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com' OR
  (auth.jwt() ->> 'email') = ANY(linked_emails) OR
  EXISTS (
    SELECT 1 FROM company_access 
    WHERE company_id = companies.id 
    AND LOWER(shared_email) = LOWER(auth.jwt() ->> 'email') 
  )
);


-- INSERT: Auth only
CREATE POLICY "companies_write" ON companies FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
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

-- 9. UPDATE: Owner or Admin
CREATE POLICY "companies_edit" ON companies FOR UPDATE USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
) WITH CHECK (true);

-- DELETE: Owner or Admin
CREATE POLICY "companies_remove" ON companies FOR DELETE USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  LOWER(auth.jwt() ->> 'email') = LOWER(owner_email) OR
  LOWER(auth.jwt() ->> 'email') = 'sudaiskamran31@gmail.com'
);

-- 8. Core Table Policies (Direct access via user_email or share check)
-- This avoids querying the 'companies' table inside these policies to prevent recursion.

-- Parties
DROP POLICY IF EXISTS "parties_access" ON parties;
DROP POLICY IF EXISTS "Parties access" ON parties;
DROP POLICY IF EXISTS "parties_full_access" ON parties;

CREATE POLICY "parties_access" ON parties FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  company_id IN (
    SELECT company_id FROM company_access 
    WHERE LOWER(shared_email) = LOWER(auth.jwt() ->> 'email') 
    AND status = 'accepted'
  )
);

-- Banks
DROP POLICY IF EXISTS "banks_access" ON banks;
DROP POLICY IF EXISTS "Banks access" ON banks;
DROP POLICY IF EXISTS "banks_full_access" ON banks;

CREATE POLICY "banks_access" ON banks FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  company_id IN (
    SELECT company_id FROM company_access 
    WHERE LOWER(shared_email) = LOWER(auth.jwt() ->> 'email') 
    AND status = 'accepted'
  )
);

-- Inventory
DROP POLICY IF EXISTS "inventory_access" ON inventory;
DROP POLICY IF EXISTS "Inventory access" ON inventory;
DROP POLICY IF EXISTS "inventory_full_access" ON inventory;

CREATE POLICY "inventory_access" ON inventory FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  company_id IN (
    SELECT company_id FROM company_access 
    WHERE LOWER(shared_email) = LOWER(auth.jwt() ->> 'email') 
    AND status = 'accepted'
  )
);

-- Transactions
DROP POLICY IF EXISTS "transactions_access" ON transactions;
DROP POLICY IF EXISTS "Transactions access" ON transactions;
DROP POLICY IF EXISTS "transactions_full_access" ON transactions;

CREATE POLICY "transactions_access" ON transactions FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  company_id IN (
    SELECT company_id FROM company_access 
    WHERE LOWER(shared_email) = LOWER(auth.jwt() ->> 'email') 
    AND status = 'accepted'
  )
);

-- Invoices
DROP POLICY IF EXISTS "invoices_access" ON invoices;
DROP POLICY IF EXISTS "Invoices access" ON invoices;
DROP POLICY IF EXISTS "invoices_full_access" ON invoices;

CREATE POLICY "invoices_access" ON invoices FOR ALL USING (
  LOWER(auth.jwt() ->> 'email') = LOWER(user_email) OR 
  company_id IN (
    SELECT company_id FROM company_access 
    WHERE LOWER(shared_email) = LOWER(auth.jwt() ->> 'email') 
    AND status = 'accepted'
  )
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

-- End of setup
