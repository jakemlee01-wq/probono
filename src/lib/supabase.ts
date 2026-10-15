import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// PKCE puts the email-confirmation code in ?code=, which keeps it clear of the #/ hash routes.
export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'missing', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Where Supabase sends people back after confirming an email or resetting a password.
export const appUrl = () => window.location.origin + window.location.pathname;
