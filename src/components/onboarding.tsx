import { useState } from 'react';
import type { Kind } from '@shared/types';
import { LIMITS, textError } from '@shared/rules';
import { Btn, Field, inputCls } from './bits';
import { useAct } from '@/lib/act';
import { supabase } from '@/lib/supabase';
import { readJoin, clearJoin } from '@/pages/join';

// First screen after a new account confirms its email. The role is fixed once this is saved.
export function Onboarding({ onDone }: { onDone: () => void }) {
  const saved = readJoin();
  const { run, pending } = useAct();
  const [kind, setKind] = useState<Kind>(saved?.role ?? 'volunteer');
  const [name, setName] = useState('');
  const [code, setCode] = useState(saved?.code ?? '');
  const [tried, setTried] = useState(false);
  const [codeErr, setCodeErr] = useState('');
  const vol = kind === 'volunteer';
  const nameErr = textError(name, vol ? 'Your name' : 'Organization name', LIMITS.name, true);
  const submit = () => {
    setTried(true); setCodeErr('');
    if (nameErr || (vol && !code.trim())) return;
    run({ action: 'onboard', kind, name: name.trim(), inviteCode: vol ? code.trim() : undefined }, {
      done: () => { clearJoin(); onDone(); },
      fail: (r) => { if (r.field === 'inviteCode') setCodeErr(r.message); },
    });
  };
  return (
    <div className="grain relative min-h-[100dvh] bg-plum px-5 py-10 text-cream">
      <main className="rise relative z-10 mx-auto max-w-md">
        <p className="font-serif text-2xl">probono</p>
        <h1 className="mt-8 font-serif text-5xl leading-[1.05]">Let's set you up.</h1>
        <p className="mt-3 text-cream/75">One step now. You'll fill in the rest of your profile next. You can't switch between volunteer and nonprofit later, so pick carefully.</p>
        <div role="radiogroup" aria-label="Account type" className="mt-8 grid grid-cols-2 gap-2 rounded-full bg-plum2 p-1">
          {(['volunteer', 'nonprofit'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full py-3 text-sm font-semibold ${kind === k ? 'bg-cream text-plum' : 'text-cream/75'}`}>{k === 'volunteer' ? "I'm a volunteer" : "We're a nonprofit"}</button>
          ))}
        </div>
        <div className="mt-6 space-y-4 rounded-3xl bg-cream p-5 text-plum">
          <Field label={vol ? 'Your name' : 'Organization name'} name="name" required error={tried ? nameErr : ''}>
            {(f) => <input {...f} name="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete={vol ? 'name' : 'organization'} />}
          </Field>
          {vol ? (
            <Field label="Invite code" name="inviteCode" required error={codeErr || (tried && !code.trim() ? 'Enter your invite code.' : '')} hint="Volunteers join by invitation during the pilot. The code is used up when you continue.">
              {(f) => <input {...f} name="inviteCode" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" placeholder="PB-XXXXX-XXXXX-XXXXX-XXXXX" />}
            </Field>
          ) : (
            <p className="text-sm text-plum/75">Nonprofits can register freely. The probono pilot team reviews each organization before volunteers can see its postings. There's no set review time yet.</p>
          )}
          <Btn className="w-full" disabled={pending} onClick={submit}>{pending ? 'Setting up…' : 'Continue'}</Btn>
        </div>
        <button className="mt-6 min-h-11 text-sm text-cream/70 underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </main>
    </div>
  );
}
