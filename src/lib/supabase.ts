import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Keys for local storage overrides
const STORAGE_URL_KEY = 'custom_supabase_url';
const STORAGE_ANON_KEY = 'custom_supabase_anon_key';

// Default configuration from environment or fallback
const DEFAULT_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://cwjzviirdwznlaxtzhkp.supabase.co';
const DEFAULT_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NgO56HkNqoMbmdmwRb6eog_GOaVJO2b';

export const getSupabaseConfig = () => {
  const customUrl = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_URL_KEY) : null;
  const customKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_ANON_KEY) : null;
  return {
    url: (customUrl && customUrl.trim()) ? customUrl.trim() : DEFAULT_URL,
    anonKey: (customKey && customKey.trim()) ? customKey.trim() : DEFAULT_KEY,
    isCustom: Boolean(customUrl && customUrl.trim())
  };
};

/**
 * safeFetch:
 * Intercepts network failures (such as DNS failure, offline state, connection refused)
 * so that Supabase calls NEVER throw an uncaught "TypeError: Failed to fetch"
 * and instead resolve gracefully with offline-aware responses.
 */
export const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const res = await fetch(input, init);
    return res;
  } catch (err: any) {
    const rawUrl = typeof input === 'string' 
      ? input 
      : (typeof Request !== 'undefined' && input instanceof Request) 
        ? input.url 
        : ((input as any)?.url || '');

    console.warn('[Supabase safeFetch] Network fetch intercepted for:', rawUrl, err?.message);

    // If it's an Auth query, return safe empty response rather than crashing or throwing TypeError
    if (rawUrl.includes('/auth/v1/user') || rawUrl.includes('/auth/v1/session') || rawUrl.includes('/auth/v1/recover')) {
      return new Response(JSON.stringify({ user: null, session: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For PostgREST table queries or RPC calls, return 503 with structured PGRST_UNREACHABLE error
    return new Response(JSON.stringify({
      code: 'PGRST_UNREACHABLE',
      message: 'Cloud service unreachable. App is operating in offline mode.',
      details: err?.message || 'Network request failed',
      hint: 'Your local data is safe on this device. When cloud is available, syncing will resume.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

const createActiveClient = (): SupabaseClient => {
  const config = getSupabaseConfig();
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
    global: {
      fetch: safeFetch
    }
  });
};

export let supabase: SupabaseClient = createActiveClient();

export const saveSupabaseConfig = (url: string, key: string) => {
  if (typeof localStorage !== 'undefined') {
    if (url.trim()) {
      localStorage.setItem(STORAGE_URL_KEY, url.trim());
    } else {
      localStorage.removeItem(STORAGE_URL_KEY);
    }
    if (key.trim()) {
      localStorage.setItem(STORAGE_ANON_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_ANON_KEY);
    }
  }
  supabase = createActiveClient();
};

export const resetSupabaseConfig = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_ANON_KEY);
  }
  supabase = createActiveClient();
};

export const testSupabaseConnection = async (testUrl?: string, testKey?: string): Promise<{ success: boolean; message: string }> => {
  const targetUrl = (testUrl || getSupabaseConfig().url).trim();
  const targetKey = (testKey || getSupabaseConfig().anonKey).trim();
  
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return { success: false, message: 'Invalid URL. Must start with https:// or http://' };
  }

  try {
    const testClient = createClient(targetUrl, targetKey, {
      global: { fetch: safeFetch }
    });
    
    const { error } = await testClient.from('companies').select('id').limit(1);
    if (!error) {
      return { success: true, message: 'Successfully connected to Supabase database! 🎉' };
    }
    if (error.code === 'PGRST_UNREACHABLE' || error.message.includes('unreachable') || error.message.includes('Failed to fetch')) {
      return { success: false, message: 'Could not connect to host. Please verify project URL and internet connection.' };
    }
    // If table not found or permission denied, the host itself is alive and reached
    if (error.code === '42P01' || error.message.includes('relation') || error.code === '42501' || error.message.includes('permission')) {
      return { success: true, message: 'Connected to Supabase! (Tables need SQL setup script in Settings)' };
    }
    return { success: true, message: `Connected (Response: ${error.message})` };
  } catch (e: any) {
    return { success: false, message: e.message || 'Connection failed' };
  }
};
