-- Supabase Setup SQL for Bugzy Business Pro SaaS

-- 1. Update companies table (ensure fields exist)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'normal';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS linked_emails TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS recovery_code TEXT;

-- 2. Create company_access table for sharing
CREATE TABLE IF NOT EXISTS company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  shared_email TEXT NOT NULL,
  permission TEXT DEFAULT 'view',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, shared_email)
);

-- 3. Create payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  license_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  status TEXT DEFAULT 'active',
  devices TEXT[] DEFAULT '{}',
  expiry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- 6. Basic Policies

-- Companies Policies
CREATE POLICY "Users can view companies they own or are shared with"
ON companies FOR SELECT
USING (
  auth.jwt() ->> 'email' = user_email OR 
  auth.jwt() ->> 'email' = ANY(linked_emails) OR
  auth.jwt() ->> 'email' = owner_email
);

CREATE POLICY "Users can insert their own companies"
ON companies FOR INSERT
WITH CHECK (auth.jwt() ->> 'email' = user_email OR auth.jwt() ->> 'email' = owner_email);

CREATE POLICY "Owners can update their companies"
ON companies FOR UPDATE
USING (auth.jwt() ->> 'email' = user_email OR auth.jwt() ->> 'email' = owner_email);

-- Company Access Policies
CREATE POLICY "Owners can manage access to their companies"
ON company_access FOR ALL
USING (auth.jwt() ->> 'email' = owner_email);

CREATE POLICY "Users can view invitations sent to them"
ON company_access FOR SELECT
USING (auth.jwt() ->> 'email' = shared_email);

CREATE POLICY "Users can update invitation status (accept/reject)"
ON company_access FOR UPDATE
USING (auth.jwt() ->> 'email' = shared_email)
WITH CHECK (auth.jwt() ->> 'email' = shared_email);

-- 7. Policies for payment_requests
CREATE POLICY "Users can create their own payment requests" 
ON payment_requests FOR INSERT 
WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view their own payment requests" 
ON payment_requests FOR SELECT 
USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Admins can view all payment requests" 
ON payment_requests FOR SELECT 
USING (auth.jwt() ->> 'email' = 'sudaiskamran31@gmail.com');

CREATE POLICY "Admins can update payment requests" 
ON payment_requests FOR UPDATE 
USING (auth.jwt() ->> 'email' = 'sudaiskamran31@gmail.com');

-- 8. Policies for licenses
CREATE POLICY "Users can view their own licenses" 
ON licenses FOR SELECT 
USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Admins can view all licenses" 
ON licenses FOR SELECT 
USING (auth.jwt() ->> 'email' = 'sudaiskamran31@gmail.com');

CREATE POLICY "Admins can manage licenses" 
ON licenses FOR ALL 
USING (auth.jwt() ->> 'email' = 'sudaiskamran31@gmail.com');

CREATE POLICY "Users can update their own device_id" 
ON licenses FOR UPDATE 
USING (auth.jwt() ->> 'email' = user_email)
WITH CHECK (auth.jwt() ->> 'email' = user_email);
