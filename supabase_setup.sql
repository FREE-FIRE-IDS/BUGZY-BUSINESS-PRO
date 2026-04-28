-- Supabase Setup SQL for Bugzy Business Pro (Free & Collaborative)

-- 1. Fix Database Error & Ensure Types
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'normal' CHECK (company_type IN ('normal', 'hr'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS device_id TEXT;

-- 2. Create Company Access Table (Roles)
CREATE TABLE IF NOT EXISTS company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MEMBER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_email)
);

-- 3. Create Invitations Table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  inviter_email TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create HR Transfer Requests Table
CREATE TABLE IF NOT EXISTS hr_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  new_device_id TEXT NOT NULL,
  transfer_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE company_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_transfer_requests ENABLE ROW LEVEL SECURITY;

-- 6. Policies (Simplified for broad access based on email)
-- In a real app, you'd use more strict checks, but for this sync-heavy app:
CREATE POLICY "Enable all access for involved users in invitations" ON invitations
  USING (invitee_email = auth.jwt() ->> 'email' OR inviter_email = auth.jwt() ->> 'email');

CREATE POLICY "Enable all access for involved users in access" ON company_access
  USING (user_email = auth.jwt() ->> 'email' OR EXISTS (
    SELECT 1 FROM company_access WHERE company_id = company_access.company_id AND user_email = auth.jwt() ->> 'email' AND role = 'OWNER'
  ));

CREATE POLICY "Enable all access for involved users in hr transfers" ON hr_transfer_requests
  USING (requester_email = auth.jwt() ->> 'email' OR owner_email = auth.jwt() ->> 'email');
