import { createClient } from '@supabase/supabase-js';

// Use environment variables with safe fallbacks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing configuration. Some features may not work.');
}

// Create client with error handling
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Helper to check connection
export const checkSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('companies').select('id').limit(1);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[Supabase] Connection failed:', err);
    return false;
  }
};
