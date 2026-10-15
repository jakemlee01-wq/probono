import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { demo as demoStore, useDemoPersona } from './demo-store';
import type { DemoPersonaId } from '@shared/fixtures';

type S = {
  session: Session | null;
  demo: DemoPersonaId | null;
  ready: boolean;
  recovering: boolean;
  linkError: string; // set when an email link came back expired, reused, or opened on another device
  doneRecovering: () => void;
  clearLinkError: () => void;
};
const Ctx = createContext<S>({ session: null, demo: null, ready: false, recovering: false, linkError: '', doneRecovering: () => {}, clearLinkError: () => {} });
export const useSession = () => useContext(Ctx);

// Supabase sends link problems back as ?error_code=... or #error_code=... on the site address.
function readLinkError(): string {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
  return q.get('error_code') || h.get('error_code') || (q.get('error') || h.get('error') ? 'link_error' : '');
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const demo = useDemoPersona();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [linkError, setLinkError] = useState(() => readLinkError());
  useEffect(() => {
    const hadCode = new URLSearchParams(window.location.search).has('code');
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) demoStore.exit();
      setReady(true);
      if (hadCode && !data.session) setLinkError((e) => e || 'exchange_failed');
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession((prev) => {
        if (prev?.user.id !== s?.user.id) qc.removeQueries({ queryKey: ['state'] });
        return s;
      });
      if (s) demoStore.exit();
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setReady(true);
    });
    // Clean auth parameters out of the address bar, keeping the hash route.
    if (hadCode || readLinkError()) {
      const hash = window.location.hash.includes('error') ? '#/link-error' : window.location.hash;
      window.history.replaceState(null, '', window.location.pathname + hash);
    }
    return () => data.subscription.unsubscribe();
  }, [qc]);
  // The demo and a real session never mix: a real sign-in always wins and ends the demo.
  const value: S = {
    session, demo: session ? null : demo, ready, recovering, linkError,
    doneRecovering: () => setRecovering(false), clearLinkError: () => setLinkError(''),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
