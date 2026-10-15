import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import type { Kind } from '@shared/types';
import { Btn, Field, inputCls } from '@/components/bits';
import { DemoLink } from '@/components/demo';
import { appUrl, supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { authMessage, NEUTRAL_RESET, NEUTRAL_SIGN_UP } from '@/lib/auth-errors';

export function Frame({ title, sub, children, demo = true }: { title: string; sub?: ReactNode; children: ReactNode; demo?: boolean }) {
  return (
    <div className="grain relative min-h-[100dvh] bg-plum px-5 py-8 text-cream">
      <main className="relative z-10 mx-auto max-w-md">
        <Link href="/" className="font-serif text-3xl">probono</Link>
        <h1 className="mt-10 font-serif text-5xl leading-[1.05]">{title}</h1>
        {sub && <div className="mt-3 text-cream/80">{sub}</div>}
        <div className="mt-8 rounded-3xl bg-cream p-5 text-plum">{children}</div>
        {demo && <div className="mt-5 text-center text-cream/80"><DemoLink /></div>}
      </main>
    </div>
  );
}

const Msg = ({ m }: { m: { text: string; bad: boolean } | null }) =>
  m ? <p role={m.bad ? 'alert' : 'status'} className={`text-sm ${m.bad ? 'font-semibold text-[#8a2f25]' : 'text-plum'}`}>{m.text}</p> : null;

function useCooldown() {
  const [until, setUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => { if (until <= Date.now()) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [until]);
  const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  return { left, start: () => setUntil(Date.now() + 60_000) };
}

export function ResendConfirmation({ email: initial = '' }: { email?: string }) {
  const [email, setEmail] = useState(initial);
  const [m, setM] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const cd = useCooldown();
  const send = async () => {
    if (!email.trim()) return setM({ text: 'Enter your email first.', bad: true });
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: appUrl() } });
    setBusy(false);
    cd.start();
    setM(error ? { text: authMessage(error, 'resend'), bad: true } : { text: NEUTRAL_SIGN_UP, bad: false });
  };
  return (
    <div className="space-y-3">
      {!initial && <Field label="Email" name="email">{(f) => <input {...f} name="email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>}
      <Msg m={m} />
      <Btn v="ghost" className="w-full" disabled={busy || cd.left > 0} onClick={send}>{cd.left ? `Resend available in ${cd.left}s` : busy ? 'Sending…' : 'Resend confirmation email'}</Btn>
    </div>
  );
}

export function SignInPage() {
  const [, go] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setUnconfirmed(error.code === 'email_not_confirmed'); setMsg({ text: authMessage(error, 'sign_in'), bad: true }); }
    else go('/app');
  };
  const forgot = async () => {
    if (!email.trim()) return setMsg({ text: 'Enter your email above first, then choose "Forgot password".', bad: true });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setBusy(false);
    // Neutral either way, unless the problem is our connection or a rate limit.
    setMsg(error && (error.status === 429 || error.code?.startsWith('over_') || error.name === 'AuthRetryableFetchError') ? { text: authMessage(error, 'reset'), bad: true } : { text: NEUTRAL_RESET, bad: false });
  };
  return (
    <Frame title="Welcome back" sub="Sign in to your volunteer or nonprofit account.">
      <form onSubmit={submit} className="space-y-4" noValidate={false}>
        <Field label="Email" name="email">{(f) => <input {...f} name="email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Password" name="password">{(f) => <input {...f} name="password" type="password" autoComplete="current-password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Msg m={msg} />
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-plum font-semibold text-cream disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {unconfirmed && <div className="mt-4"><ResendConfirmation email={email.trim()} /></div>}
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        <button onClick={forgot} disabled={busy} className="min-h-11 underline underline-offset-4">Forgot password</button>
        <Link href="/join" className="min-h-11 py-3 underline underline-offset-4">Create an account</Link>
      </div>
    </Frame>
  );
}

export function SignUpForm({ role, inviteCode, onSent }: { role: Kind; inviteCode?: string; onSent: (email: string) => void }) {
  const [, go] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setErr('Use at least 8 characters for your password.');
    setBusy(true); setErr('');
    localStorage.setItem('probono-join', JSON.stringify({ role, code: inviteCode ?? '' }));
    // intended_role only pre-fills the next screen. The server decides the role, with an invite for volunteers.
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: appUrl(), data: { intended_role: role } } });
    setBusy(false);
    if (error && error.code !== 'user_already_exists') return setErr(authMessage(error, 'sign_up'));
    if (data?.session) go('/app');
    else onSent(email.trim());
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" name="email">{(f) => <input {...f} name="email" type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Password" name="password" hint="At least 8 characters.">{(f) => <input {...f} name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      {err && <p role="alert" className="text-sm font-semibold text-[#8a2f25]">{err}</p>}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-plum font-semibold text-cream disabled:opacity-50">{busy ? 'Creating…' : 'Create account'}</button>
      <p className="text-center text-sm">Already have an account? <Link href="/sign-in" className="underline underline-offset-4">Sign in</Link></p>
    </form>
  );
}

export function CheckEmail({ email }: { email: string }) {
  return (
    <Frame title="Check your email" sub={<p>{NEUTRAL_SIGN_UP}</p>} demo={false}>
      <p className="mb-4 text-sm text-plum/75">Sent to <b>{email}</b>. It can take a few minutes; check spam too. Then come back to sign in.</p>
      <ResendConfirmation email={email} />
      <Link href="/sign-in" className="mt-3 flex min-h-11 items-center justify-center text-sm underline underline-offset-4">Go to sign in</Link>
    </Frame>
  );
}

export function ResetPasswordPage() {
  const [, go] = useLocation();
  const { session, recovering, doneRecovering, ready } = useSession();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (ready && !session && !recovering) return <LinkProblem code="otp_expired" />;
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setErr('Use at least 8 characters.');
    if (password !== again) return setErr("The two passwords don't match.");
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(authMessage(error, 'update'));
    doneRecovering();
    go('/app');
  };
  return (
    <Frame title="Set a new password" demo={false}>
      <form onSubmit={save} className="space-y-4">
        <Field label="New password" name="password" hint="At least 8 characters.">{(f) => <input {...f} name="password" type="password" autoComplete="new-password" minLength={8} required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        <Field label="Type it again" name="again">{(f) => <input {...f} name="again" type="password" autoComplete="new-password" required className={inputCls} value={again} onChange={(e) => setAgain(e.target.value)} />}</Field>
        {err && <p role="alert" className="text-sm font-semibold text-[#8a2f25]">{err}</p>}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-plum font-semibold text-cream disabled:opacity-50">{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Frame>
  );
}

// Expired, reused, or cross-device email links land here with a way forward.
export function LinkProblem({ code }: { code?: string }) {
  const { linkError, clearLinkError } = useSession();
  const c = code || linkError;
  const [email, setEmail] = useState('');
  const [m, setM] = useState<{ text: string; bad: boolean } | null>(null);
  const reset = async () => {
    if (!email.trim()) return setM({ text: 'Enter your email first.', bad: true });
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setM(error && (error.status === 429 || error.code?.startsWith('over_')) ? { text: authMessage(error, 'reset'), bad: true } : { text: NEUTRAL_RESET, bad: false });
  };
  const why = c === 'exchange_failed'
    ? "This link has to be opened in the same browser where you started, and it can only be used once. If you're signed in elsewhere, you can sign in here too."
    : 'That link has expired or was already used. Email links work once and for a limited time.';
  return (
    <Frame title="That link didn't work" sub={<p>{why}</p>} demo={false}>
      <div className="space-y-5">
        <Link href="/sign-in" onClick={clearLinkError} className="flex min-h-12 w-full items-center justify-center rounded-full bg-plum font-semibold text-cream">Try signing in</Link>
        <div>
          <p className="mb-2 text-sm font-semibold">Need a new confirmation email?</p>
          <ResendConfirmation />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Need a new password link?</p>
          <Field label="Email" name="reset-email">{(f) => <input {...f} name="reset-email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Msg m={m} />
          <Btn v="ghost" className="w-full" onClick={reset}>Send a password link</Btn>
        </div>
      </div>
    </Frame>
  );
}
