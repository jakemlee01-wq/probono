import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Btn, Field, inputCls } from '@/components/bits';
import { DemoLink } from '@/components/demo';
import { appUrl, supabase } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { errMsg } from '@/lib/util';

function Frame({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="grain relative min-h-[100dvh] bg-plum px-5 py-8 text-cream">
      <div className="relative z-10 mx-auto max-w-md">
        <Link href="/" className="font-serif text-3xl">probono</Link>
        <h1 className="mt-10 font-serif text-5xl leading-[1.05]">{title}</h1>
        {sub && <p className="mt-3 text-cream/70">{sub}</p>}
        <div className="mt-8 rounded-3xl bg-cream p-5 text-plum">{children}</div>
        <div className="mt-5 text-center text-cream/75"><DemoLink /></div>
      </div>
    </div>
  );
}

export function SignInPage() {
  const [, go] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg({ text: error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message, bad: true });
    else go('/app');
  };
  const forgot = async () => {
    if (!email.trim()) return setMsg({ text: 'Enter your email first, then tap "Forgot password".', bad: true });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
    setBusy(false);
    setMsg(error ? { text: errMsg(error), bad: true } : { text: 'Check your email for a link to set a new password.', bad: false });
  };
  return (
    <Frame title="Welcome back" sub="Pick up where you left off.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {msg && <p role="alert" className={`text-sm ${msg.bad ? 'text-[#8a2f25]' : 'text-plum'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-plum font-semibold text-cream disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <button onClick={forgot} className="min-h-11 underline underline-offset-4">Forgot password</button>
        <Link href="/sign-up" className="min-h-11 py-3 underline underline-offset-4">Create an account</Link>
      </div>
    </Frame>
  );
}

export function SignUpPage() {
  const [, go] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: appUrl() } });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    if (data.session) go('/app');
    else setSent(true);
  };
  if (sent) {
    return (
      <Frame title="Check your email" sub={`We sent a confirmation link to ${email}. Open it on this device to finish signing up.`}>
        <p className="text-sm text-plum/75">Volunteers will enter their invite code on the next screen. Nonprofits can set up right away.</p>
      </Frame>
    );
  }
  return (
    <Frame title="Join probono" sub="A few hours can change a month for someone. Volunteers join by invitation; nonprofits are always welcome.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint="At least 8 characters."><input type="password" autoComplete="new-password" minLength={8} required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <p role="alert" className="text-sm text-[#8a2f25]">{err}</p>}
        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-full bg-plum font-semibold text-cream disabled:opacity-50">{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-center text-sm">Already have an account? <Link href="/sign-in" className="underline underline-offset-4">Sign in</Link></p>
    </Frame>
  );
}

export function ResetPasswordPage() {
  const [, go] = useLocation();
  const { doneRecovering } = useSession();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    doneRecovering();
    go('/app');
  };
  return (
    <Frame title="Set a new password">
      <div className="space-y-4">
        <Field label="New password" hint="At least 8 characters."><input type="password" autoComplete="new-password" minLength={8} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {err && <p role="alert" className="text-sm text-[#8a2f25]">{err}</p>}
        <Btn className="w-full" disabled={busy || password.length < 8} onClick={save}>{busy ? 'Saving…' : 'Save password'}</Btn>
      </div>
    </Frame>
  );
}
