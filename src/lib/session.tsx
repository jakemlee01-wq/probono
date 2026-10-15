import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

type S = { session: Session | null; ready: boolean; recovering: boolean; doneRecovering: () => void };
const Ctx = createContext<S>({ session: null, ready: false, recovering: false, doneRecovering: () => {} });
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession((prev) => {
        if (prev?.user.id !== s?.user.id) qc.removeQueries({ queryKey: ['state'] });
        return s;
      });
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setReady(true);
    });
    // Clean ?code= out of the address bar after an email link signs someone in.
    if (new URLSearchParams(window.location.search).has('code')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return <Ctx.Provider value={{ session, ready, recovering, doneRecovering: () => setRecovering(false) }}>{children}</Ctx.Provider>;
}
