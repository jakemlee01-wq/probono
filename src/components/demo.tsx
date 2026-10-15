import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import type { DemoAccount, DemoAccountId, Profile } from '@shared/types';
import { Btn, Modal } from './bits';
import { call, useConfig } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { errMsg } from '@/lib/util';

// One tap into a demo account. The server mints a one-time sign-in token, so no passwords or emails.
export function useDemoEntry() {
  const qc = useQueryClient();
  const [, go] = useLocation();
  const [busy, setBusy] = useState<DemoAccountId | null>(null);
  const [error, setError] = useState('');
  const enter = async (id: DemoAccountId) => {
    setBusy(id);
    setError('');
    try {
      const { tokenHash } = await call<{ tokenHash: string }>('/demo/sign-in', { method: 'POST', body: { accountId: id } });
      await supabase.auth.signOut({ scope: 'local' });
      const { error: e } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
      if (e) throw e;
      qc.removeQueries({ queryKey: ['state'] });
      go('/app');
      return true;
    } catch (e) {
      setError(errMsg(e));
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { enter, busy, error };
}

export function DemoPicker({ accounts }: { accounts: DemoAccount[] }) {
  const { enter, busy, error } = useDemoEntry();
  return (
    <div className="space-y-2">
      {accounts.map((a) => (
        <Btn key={a.id} className="w-full" disabled={busy !== null} onClick={() => enter(a.id)}>
          {busy === a.id ? 'Entering…' : `${a.name} · ${a.kind === 'volunteer' ? 'volunteer' : 'nonprofit'}`}
        </Btn>
      ))}
      {error && <p role="alert" className="pt-1 text-sm text-[#8a2f25]">{error}</p>}
    </div>
  );
}

export function DemoLink({ className = '' }: { className?: string }) {
  const { data } = useConfig();
  const [open, setOpen] = useState(false);
  if (!data?.demoMode || !data.demoAccounts.length) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className={`min-h-11 text-sm underline underline-offset-4 ${className}`}>Try the demo</button>
      {open && (
        <Modal title="Try the demo" onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-plum/70">Step in as a sample volunteer or nonprofit. Riverside is already interested in Sally, and Marcus is already interested in Northside, so you can try the full flow.</p>
          <DemoPicker accounts={data.demoAccounts} />
        </Modal>
      )}
    </>
  );
}

export function DemoBar({ profile, accounts }: { profile: Profile; accounts: DemoAccount[] }) {
  const [switching, setSwitching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const current = accounts.find((a) => a.id === profile.id);
  if (!current) return null;
  const reset = async () => {
    setResetting(true);
    try {
      const r = await call<{ message: string }>('/demo/reset', { method: 'POST' });
      await qc.invalidateQueries({ queryKey: ['state'] });
      toast(r.message);
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setResetting(false);
    }
  };
  return (
    <>
      <div className="relative z-40 flex min-h-10 flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-plum3 px-3 py-1.5 text-xs text-cream">
        <span><strong>Demo</strong> · viewing as {current.name}</span>
        <button className="min-h-8 font-semibold underline underline-offset-2" onClick={() => setSwitching(true)}>Switch</button>
        <button className="min-h-8 font-semibold underline underline-offset-2 disabled:opacity-50" disabled={resetting} onClick={reset}>{resetting ? 'Resetting…' : 'Reset demo'}</button>
      </div>
      {switching && (
        <Modal title="Switch demo account" onClose={() => setSwitching(false)}>
          <DemoPicker accounts={accounts} />
        </Modal>
      )}
    </>
  );
}
