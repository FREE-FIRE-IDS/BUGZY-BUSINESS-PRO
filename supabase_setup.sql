-- Supabase Setup SQL for Bugzy Business Pro SaaS

-- 1. Update companies table (ensure fields exist)
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- 2. Create payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  user_email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  license_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  device_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- 5. Policies for payment_requests
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

-- 6. Policies for licenses
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

-- 7. Admin policy for companies table
CREATE POLICY "Admins can update company paid status" 
ON companies FOR UPDATE 
USING (auth.jwt() ->> 'email' = 'sudaiskamran31@gmail.com');
