import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { FORMATS, type AppConfig, type Profile, type Prompts, type Terms } from '@shared/types';
import { Btn, Chips, Field, Tile, inputCls } from './bits';
import { useAct } from '@/lib/act';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { errMsg, photoUrl } from '@/lib/util';

export function TermsEditor({ value, onChange }: { value: Terms; onChange: (t: Terms) => void }) {
  const set = (k: keyof Terms, v: string | number) => onChange({ ...value, [k]: v } as Terms);
  const num = (k: keyof Terms, label: string) => (
    <Field label={label}><input type="number" inputMode="numeric" min="0" className={inputCls} value={value[k] as number} onChange={(e) => set(k, Number(e.target.value))} /></Field>
  );
  return (
    <div className="grid grid-cols-2 gap-3">
      {num('hoursPerWeek', 'Hours per week')}{num('weeks', 'Weeks')}{num('minWeeks', 'Fewest weeks')}{num('maxWeeks', 'Most weeks')}
      <Field label="Start date"><input type="date" className={inputCls} value={value.startDate?.slice(0, 10) || ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
      <Field label="Available until"><input type="date" className={inputCls} value={value.availableUntil?.slice(0, 10) || ''} onChange={(e) => set('availableUntil', e.target.value)} /></Field>
      <div className="col-span-2">
        <Field label="Format">
          <select className={inputCls} value={value.format} onChange={(e) => set('format', e.target.value)}>
            {FORMATS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
      </div>
    </div>
  );
}

export function PromptsEditor({ value, onChange, kind = 'volunteer' }: { value: Prompts; onChange: (p: Prompts) => void; kind?: 'volunteer' | 'nonprofit' }) {
  const labels = kind === 'volunteer' ? ["I'm best at", 'Causes close to me', 'Working with me looks like'] : ['What we do', 'Where we are stuck', 'Success looks like'];
  return (
    <div className="space-y-3">
      {(['first', 'second', 'third'] as const).map((k, i) => (
        <Field key={k} label={labels[i]}>
          <textarea rows={3} className={inputCls} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        </Field>
      ))}
    </div>
  );
}

export function ProfileEditor({ profile, config }: { profile: Profile; config?: AppConfig }) {
  const [d, setD] = useState<Profile>(profile);
  const { run, pending } = useAct();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const vol = d.kind === 'volunteer';

  const upload = async (f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast('Please choose a JPG, PNG, or WebP image', true);
    if (f.size > 5 * 1024 * 1024) return toast('Images can be up to 5MB', true);
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Please sign in again.');
      const ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('photos').upload(path, f, { contentType: f.type });
      if (error) throw error;
      const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
      const next = { ...d, photos: [...d.photos, url] };
      setD(next);
      run({ action: 'update_profile', profile: next }, { quiet: true, done: () => toast('Photo added') });
    } catch (e) { toast(errMsg(e), true); }
    setBusy(false);
  };

  return (
    <div className="space-y-6 text-plum">
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">{vol ? 'About you' : 'About your organization'}</h2>
        <Field label={vol ? 'Name' : 'Organization name'}><input className={inputCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label={vol ? 'Role' : 'Mission in a line'}><input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={vol ? 'Years of experience' : 'Years running'}><input type="number" inputMode="numeric" min="0" className={inputCls} value={d.years} onChange={(e) => setD({ ...d, years: Number(e.target.value) })} /></Field>
          <Field label={vol ? 'Credential' : 'Founded'}><input className={inputCls} value={d.credential} onChange={(e) => setD({ ...d, credential: e.target.value })} /></Field>
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-serif text-2xl">Photos</h2>
        <div className="flex flex-wrap gap-3">
          {d.photos.map((p, i) => (
            <div key={p + i} className="relative">
              <Tile name={d.name} src={photoUrl(p)} className="h-24 w-20 rounded-xl text-xl" />
              <button aria-label="Remove photo" onClick={() => setD({ ...d, photos: d.photos.filter((_, j) => j !== i) })} className="absolute -right-2 -top-2 rounded-full bg-plum p-1 text-cream"><X size={12} /></button>
            </div>
          ))}
          <button disabled={busy} onClick={() => file.current?.click()} className="flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-plum/35 text-xs text-plum/70 disabled:opacity-50"><ImagePlus size={18} />{busy ? 'Uploading' : 'Add'}</button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </div>
        <p className="mt-2 text-xs text-plum/55">Real, warm photos work best. Images up to 5MB. Removing a photo saves when you save below.</p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">{vol ? 'Skills' : 'Skills you would welcome'}</h2>
        <Chips options={config?.skills ?? d.skills} value={d.skills} onChange={(skills) => setD({ ...d, skills })} />
        <h2 className="pt-2 font-serif text-2xl">Causes</h2>
        <Chips options={config?.causes ?? d.causes} value={d.causes} onChange={(causes) => setD({ ...d, causes })} />
      </section>
      <section>
        <h2 className="mb-1 font-serif text-2xl">{vol ? 'Your terms' : 'Usual terms'}</h2>
        {vol && <p className="mb-3 text-sm text-plum/65">Only postings that fit these show up for you.</p>}
        <TermsEditor value={d.terms} onChange={(terms) => setD({ ...d, terms })} />
      </section>
      <section>
        <h2 className="mb-3 font-serif text-2xl">In your words</h2>
        <PromptsEditor kind={d.kind} value={d.prompts} onChange={(prompts) => setD({ ...d, prompts })} />
      </section>
      <Btn className="w-full" disabled={pending || !d.name.trim()} onClick={() => run({ action: 'update_profile', profile: d })}>{pending ? 'Saving...' : 'Save profile'}</Btn>
      {vol && (
        <section className="rounded-3xl border border-plum/15 bg-white/50 p-5">
          <h2 className="mb-1 font-serif text-2xl">Take a break</h2>
          <p className="mb-3 text-sm text-plum/65">Pausing hides you from discovery. Nothing else changes.</p>
          <button type="button" role="switch" aria-checked={d.paused} disabled={pending} onClick={() => run({ action: 'pause', paused: !d.paused }, { done: () => setD({ ...d, paused: !d.paused }) })} className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <span className={`relative h-6 w-11 rounded-full ${d.paused ? 'bg-plum' : 'bg-plum/20'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${d.paused ? 'left-6' : 'left-1'}`} /></span>
            Pause my profile
          </button>
        </section>
      )}
      <section className="rounded-3xl bg-plum p-5 text-cream">
        <h2 className="mb-3 font-serif text-2xl">Track record</h2>
        <div className="flex gap-8">
          <div><p className="font-serif text-4xl">{profile.completedProjects}</p><p className="text-xs text-cream/60">projects finished</p></div>
          {vol && <div><p className="font-serif text-4xl">{profile.hoursGiven}</p><p className="text-xs text-cream/60">hours given</p></div>}
        </div>
        {profile.quotes.map((q, i) => <p key={i} className="mt-4 border-l-2 border-apricot pl-3 font-serif italic">"{q.text}"<span className="mt-1 block text-xs not-italic text-cream/60">{q.author}</span></p>)}
      </section>
    </div>
  );
}
