import { useState } from 'react';
import { Link } from 'wouter';
import type { Kind } from '@shared/types';
import { Btn, Field, inputCls } from '@/components/bits';
import { call } from '@/lib/api';
import { CheckEmail, Frame, SignUpForm } from './auth';

type Saved = { role: Kind; code: string };
export function readJoin(): Saved | null {
  try { const v = JSON.parse(localStorage.getItem('probono-join') ?? 'null'); return v?.role === 'volunteer' || v?.role === 'nonprofit' ? v : null; } catch { return null; }
}
export function clearJoin() { try { localStorage.removeItem('probono-join'); } catch { /* ignore */ } }

// An invite link looks like .../probono/#/join/volunteer?code=PB-...
function codeFromLink() {
  const q = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q).get('code') ?? '';
}

export function JoinChooser() {
  return (
    <Frame title="Join the pilot" sub={<p>probono is a small Twin Cities pilot matching accounting and finance volunteers with local nonprofits.</p>}>
      <div className="space-y-3">
        <Link href="/join/volunteer" className="block rounded-2xl border border-plum/20 p-4 hover:bg-plum/5">
          <span className="block font-semibold">I'm a volunteer with an invite</span>
          <span className="text-sm text-plum/70">Volunteers join by invitation during the pilot.</span>
        </Link>
        <Link href="/join/nonprofit" className="block rounded-2xl border border-plum/20 p-4 hover:bg-plum/5">
          <span className="block font-semibold">We're a nonprofit</span>
          <span className="text-sm text-plum/70">Register freely. We review your organization before volunteers see your postings.</span>
        </Link>
        <p className="pt-1 text-center text-sm">Already have an account? <Link href="/sign-in" className="underline underline-offset-4">Sign in</Link></p>
      </div>
    </Frame>
  );
}

export function JoinVolunteer() {
  const [code, setCode] = useState(codeFromLink);
  const [status, setStatus] = useState<{ ok: boolean; message: string; forEmail?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  if (sent) return <CheckEmail email={sent} />;
  const check = async () => {
    if (!code.trim()) return setStatus({ ok: false, message: 'Enter your invite code.' });
    setBusy(true);
    try {
      const r = await call<{ status: string; message: string; forEmail: boolean }>('/invites/check', { method: 'POST', body: { code } });
      setStatus({ ok: r.status === 'ok', message: r.message, forEmail: r.forEmail });
    } catch (e) {
      setStatus({ ok: false, message: (e as Error).message });
    }
    setBusy(false);
  };
  return (
    <Frame title="Join with an invite" sub={<p>Volunteer spots are invite-only in this pilot. Your code is checked now and used up when you finish setting up your profile.</p>}>
      {!status?.ok ? (
        <div className="space-y-4">
          <Field label="Invite code" name="inviteCode" error={status && !status.ok ? status.message : ''}>
            {(f) => <input {...f} name="inviteCode" className={inputCls} value={code} onChange={(e) => { setCode(e.target.value); setStatus(null); }} autoCapitalize="characters" placeholder="PB-XXXXX-XXXXX-XXXXX-XXXXX" />}
          </Field>
          <Btn className="w-full" disabled={busy} onClick={check}>{busy ? 'Checking…' : 'Check invite'}</Btn>
          <details className="text-sm text-plum/75">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">I don't have an invite</summary>
            <p>There's no public waitlist yet. Invites come from the people running the pilot. If you know someone involved, ask them for one.</p>
          </details>
        </div>
      ) : (
        <div className="space-y-4">
          <p role="status" className="rounded-2xl bg-sage/25 p-3 text-sm">That invite is valid.{status.forEmail ? ' It was issued for a specific email address, so sign up with that address.' : ''}</p>
          <SignUpForm role="volunteer" inviteCode={code.trim()} onSent={setSent} />
        </div>
      )}
    </Frame>
  );
}

export function JoinNonprofit() {
  const [sent, setSent] = useState('');
  if (sent) return <CheckEmail email={sent} />;
  return (
    <Frame title="Create a nonprofit account" sub={
      <div className="space-y-2 text-sm">
        <p>For Twin Cities nonprofits that want help with accounting or finance work: budgets, reporting, systems, month-end, grant tracking.</p>
        <p>1. Create your account and organization profile. 2. Write a posting. 3. The probono pilot team reviews your organization, then volunteers can see your postings. Review is done by hand, and there's no set turnaround yet.</p>
      </div>
    }>
      <SignUpForm role="nonprofit" onSent={setSent} />
    </Frame>
  );
}
