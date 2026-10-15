import { useState } from 'react';
import type { Kind } from '@shared/types';
import { Btn, Field, inputCls } from './bits';
import { useAct } from '@/lib/act';
import { supabase } from '@/lib/supabase';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { run, pending } = useAct();
  const [kind, setKind] = useState<Kind>('volunteer');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const vol = kind === 'volunteer';
  const ok = name.trim() && (!vol || code.trim());
  return (
    <div className="grain relative min-h-[100dvh] bg-plum px-5 py-10 text-cream">
      <div className="rise relative z-10 mx-auto max-w-md">
        <p className="font-serif text-2xl">probono</p>
        <h1 className="mt-8 font-serif text-5xl leading-[1.05]">Let's get to know you.</h1>
        <p className="mt-3 text-cream/70">Two quick things now. You'll fill in the rest of your profile right after.</p>
        <div className="mt-8 grid grid-cols-2 gap-2 rounded-full bg-plum2 p-1">
          {(['volunteer', 'nonprofit'] as const).map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full py-3 text-sm font-semibold ${kind === k ? 'bg-cream text-plum' : 'text-cream/70'}`}>{k === 'volunteer' ? 'I have time to give' : 'We need a hand'}</button>
          ))}
        </div>
        <div className="mt-6 space-y-4 rounded-3xl bg-cream p-5 text-plum">
          <Field label={vol ? 'Your name' : 'Organization name'}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete={vol ? 'name' : 'organization'} /></Field>
          {vol && (
            <Field label="Invite code" hint="Volunteers join by invitation.">
              <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
            </Field>
          )}
          <Btn className="w-full" disabled={pending || !ok} onClick={() => run({ action: 'onboard', kind, name: name.trim(), inviteCode: vol ? code.trim() : undefined }, { done: onDone })}>{pending ? 'Setting up...' : 'Continue'}</Btn>
        </div>
        <button className="mt-6 min-h-11 text-sm text-cream/60 underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}
