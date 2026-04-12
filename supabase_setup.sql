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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- 4. Policies for payment_requests
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

-- 5. Admin policy for companies table
CREATE POLICY "Admins can update company paid status" 
ON companies FOR UPDATE 
USING (auth.jwt() ->> 'email' = 'sudaiskamran31@gmail.com');
