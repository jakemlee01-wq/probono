import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import { CAUSE_OPTIONS, FORMATS, SKILL_OPTIONS, type AppState, type Kind, type Profile, type Prompts, type Terms } from '@shared/types';
import { LIMITS, profileErrors, type Errors } from '@shared/rules';
import { Btn, Chips, ErrorSummary, Field, Modal, Tile, focusField, inputCls } from './bits';
import { Badges, trackLine } from './prospect-card';
import { useAct } from '@/lib/act';
import { call } from '@/lib/api';
import { authMessage } from '@/lib/auth-errors';
import { useToast } from '@/lib/toast';
import { supabase } from '@/lib/supabase';
import { errMsg, photoUrl } from '@/lib/util';

const num = (v: string) => (v === '' ? ('' as unknown as number) : Number(v));

// Volunteers set limits; a posting states one project. The engine shows a posting to a volunteer only
// when it fits inside their limits.
export function TermsEditor({ value, onChange, errors = {}, kind = 'volunteer' }: { value: Terms; onChange: (t: Terms) => void; errors?: Errors; kind?: 'volunteer' | 'posting' }) {
  const posting = kind === 'posting';
  const set = (patch: Partial<Terms>) => {
    const t = { ...value, ...patch } as Terms;
    if (posting) {
      // A posting is one fixed length; the range fields mirror it so validation and matching agree.
      t.minWeeks = t.maxWeeks = t.weeks;
      const start = /^\d{4}-\d{2}-\d{2}$/.test(t.startDate) ? t.startDate : '';
      if (start && Number(t.weeks) > 0) { const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(t.weeks) * 7 + 30); t.availableUntil = d.toISOString().slice(0, 10); }
    } else {
      t.weeks = Number(t.minWeeks) || t.weeks;
    }
    onChange(t);
  };
  const n = (k: keyof Terms, label: string, hint: string, min: number, max: number) => (
    <Field label={label} name={k} error={errors[k]} hint={hint}>
      {(f) => <input {...f} name={k} type="number" inputMode="numeric" min={min} max={max} step={1} className={inputCls} value={value[k] as number} onChange={(e) => set({ [k]: num(e.target.value) } as Partial<Terms>)} />}
    </Field>
  );
  const d = (k: 'startDate' | 'availableUntil', label: string, hint: string) => (
    <Field label={label} name={k} error={errors[k]} hint={hint}>{(f) => <input {...f} name={k} type="date" className={inputCls} value={value[k]?.slice(0, 10) || ''} onChange={(e) => set({ [k]: e.target.value } as Partial<Terms>)} />}</Field>
  );
  return (
    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      {posting ? <>
        {n('hoursPerWeek', 'Hours a week', 'What the work needs, 1 to 40.', 1, 40)}
        {n('weeks', 'Project length (weeks)', 'From start to hand-off.', 1, 52)}
        {d('startDate', 'Proposed start', 'Agreed for real in the work agreement.')}
      </> : <>
        {n('hoursPerWeek', 'Most hours a week', "You'll only see postings that need this or less.", 1, 40)}
        {n('minWeeks', 'Shortest project', 'In weeks.', 1, 52)}
        {n('maxWeeks', 'Longest project', 'In weeks.', 1, 52)}
        {d('startDate', 'Available from', 'Postings starting before this are hidden.')}
        {d('availableUntil', 'Available until', 'Projects must end by this date.')}
      </>}
      <Field label="Format" name="format" error={errors.format}>
        {(f) => <select {...f} name="format" className={inputCls} value={value.format} onChange={(e) => set({ format: e.target.value as Terms['format'] })}>{FORMATS.map((x) => <option key={x}>{x}</option>)}</select>}
      </Field>
    </div>
  );
}

export const PROMPT_LABELS: Record<Kind, string[]> = {
  volunteer: ["I'm best at", 'Causes close to me', 'Working with me looks like'],
  nonprofit: ['What we do', 'Where we are stuck', 'Success looks like'],
};
export function PromptsEditor({ value, onChange, kind = 'volunteer', errors = {} }: { value: Prompts; onChange: (p: Prompts) => void; kind?: Kind; errors?: Errors }) {
  return (
    <div className="space-y-3">
      {(['first', 'second', 'third'] as const).map((k, i) => (
        <Field key={k} label={PROMPT_LABELS[kind][i]} name={k} error={errors[k]} count={value[k]} max={LIMITS.longText.max}>
          {(f) => <textarea {...f} name={k} rows={3} className={inputCls} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />}
        </Field>
      ))}
    </div>
  );
}

// Re-encoding drops camera and location metadata, bounds the size, and proves the file is a real image.
async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Please choose a JPG, PNG, or WebP image.');
  if (file.size > LIMITS.photos.bytes) throw new Error('Images can be up to 5 MB.');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("That file couldn't be read as an image. Try another one."); }
  if (bmp.width < 200 || bmp.height < 200) throw new Error('Please use an image at least 200 pixels on each side.');
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  if (!blob || blob.size > LIMITS.photos.bytes) throw new Error("That image is too large even after resizing. Try a smaller one.");
  return blob;
}

export function ProfileEditor({ profile, state }: { profile: Profile; state: AppState }) {
  const [d, setD] = useState<Profile>(profile);
  const [tried, setTried] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const { run, pending } = useAct();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const vol = d.kind === 'volunteer';
  const demo = state.demo;
  const all = profileErrors(d, new Date().getFullYear());
  const shown = tried ? all : Object.fromEntries(Object.entries(all).filter(([k]) => touched.has(k)));
  const blur = (e: React.FocusEvent<HTMLDivElement>) => { const n = (e.target as HTMLElement).getAttribute('name'); if (n) setTouched((s) => new Set(s).add(n)); };

  const save = (next = d) => {
    const errs = profileErrors(next, new Date().getFullYear());
    if (Object.keys(errs).length) { setTried(true); focusField(Object.keys(errs)[0]); return; }
    run({ action: 'update_profile', profile: next });
  };

  const upload = async (f: File) => {
    if (d.photos.length >= LIMITS.photos.max) return toast(`You can add up to ${LIMITS.photos.max} photos.`, true);
    setBusy(true);
    try {
      const blob = await preparePhoto(f);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Please sign in again.');
      const path = `${auth.user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(error.message.includes('size') ? 'Images can be up to 5 MB.' : "The upload didn't finish. Please try again.");
      const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
      const next = { ...d, photos: [...d.photos, url] };
      setD(next);
      run({ action: 'update_profile', profile: next }, { quiet: true, done: () => toast('Photo added') });
    } catch (e) { toast(errMsg(e), true); }
    setBusy(false);
  };

  return (
    <div className="space-y-6 text-plum" onBlur={blur}>
      <ErrorSummary errors={tried ? all : {}} />
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">{vol ? 'About you' : 'About your organization'}</h2>
        <Field label={vol ? 'Name' : 'Organization name'} name="name" required error={shown.name} count={d.name} max={LIMITS.name.max}>{(f) => <input {...f} name="name" className={inputCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <Field label={vol ? 'Role' : 'Mission in a line'} name="title" error={shown.title} count={d.title} max={LIMITS.headline.max}>{(f) => <input {...f} name="title" className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />}</Field>
        {vol ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Years of experience" name="years" error={shown.years} hint="Whole number, 0 to 80">{(f) => <input {...f} name="years" type="number" inputMode="numeric" min={0} max={80} step={1} className={inputCls} value={d.years ?? ''} onChange={(e) => setD({ ...d, years: e.target.value === '' ? null : Number(e.target.value) })} />}</Field>
            <Field label="Credential" name="credential" error={shown.credential} hint="Shown as self-reported">{(f) => <input {...f} name="credential" className={inputCls} value={d.credential} onChange={(e) => setD({ ...d, credential: e.target.value })} placeholder="e.g. CPA" />}</Field>
          </div>
        ) : (
          <Field label="Year founded" name="foundedYear" error={shown.foundedYear} hint="Optional. Shown as 'Not provided' if blank.">{(f) => <input {...f} name="foundedYear" type="number" inputMode="numeric" min={1800} max={new Date().getFullYear()} step={1} className={inputCls} value={d.foundedYear ?? ''} onChange={(e) => setD({ ...d, foundedYear: e.target.value === '' ? null : Number(e.target.value) })} />}</Field>
        )}
        <Badges profile={profile} />
      </section>
      <section>
        <h2 className="mb-3 font-serif text-2xl">Photos</h2>
        <div className="flex flex-wrap gap-3">
          {d.photos.map((p, i) => (
            <div key={p + i} className="relative">
              <Tile name={d.name} alt={`Photo ${i + 1}`} src={photoUrl(p)} className="h-28 w-[5.6rem] rounded-xl text-xl" />
              <button aria-label={`Remove photo ${i + 1}`} onClick={() => setD({ ...d, photos: d.photos.filter((_, j) => j !== i) })} className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-plum text-cream"><X size={14} /></button>
            </div>
          ))}
          {!demo && d.photos.length < LIMITS.photos.max && (
            <button disabled={busy} onClick={() => file.current?.click()} className="flex h-28 w-[5.6rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-plum/40 text-xs text-plum/75 disabled:opacity-50"><ImagePlus size={18} aria-hidden />{busy ? 'Uploading…' : 'Add photo'}</button>
          )}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </div>
        <p className="mt-2 text-xs text-plum/65">
          {demo ? 'Photo uploads are turned off in the demo.' : `Optional. JPG, PNG, or WebP up to 5 MB, ${LIMITS.photos.max} at most. We resize them and remove location data. Without a photo, your initials show. Removing a photo takes effect when you save.`}
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">{vol ? 'Skills' : 'Skills you would welcome'}</h2>
        <p className="text-xs text-plum/65">This pilot covers accounting and finance work.</p>
        <Chips label="Skills" options={SKILL_OPTIONS} value={d.skills} onChange={(skills) => setD({ ...d, skills })} />
        <h2 className="pt-2 font-serif text-2xl">Causes</h2>
        <Chips label="Causes" options={CAUSE_OPTIONS} value={d.causes} onChange={(causes) => setD({ ...d, causes })} />
      </section>
      {vol && (
        <section>
          <h2 className="mb-1 font-serif text-2xl">What you can take on</h2>
          <p className="mb-3 text-sm text-plum/70">These are limits for matching. A posting shows up for you only if its hours, length, start date, and format fit inside them.</p>
          <TermsEditor value={d.terms} onChange={(terms) => setD({ ...d, terms })} errors={shown} />
        </section>
      )}
      <section>
        <h2 className="mb-3 font-serif text-2xl">In your words</h2>
        <PromptsEditor kind={d.kind} value={d.prompts} onChange={(prompts) => setD({ ...d, prompts })} errors={shown} />
      </section>
      <Btn className="w-full" disabled={pending} onClick={() => save()}>{pending ? 'Saving…' : 'Save profile'}</Btn>
      {vol && (
        <section className="rounded-3xl border border-plum/15 bg-white/50 p-5">
          <h2 className="mb-1 font-serif text-2xl">Take a break</h2>
          <p className="mb-3 text-sm text-plum/70">Pausing hides you from discovery and stops new interest. Projects already in progress continue, and you can still message those partners.</p>
          <button type="button" role="switch" aria-checked={profile.paused} disabled={pending} onClick={() => run({ action: 'pause', paused: !profile.paused })} className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <span aria-hidden className={`relative h-6 w-11 rounded-full ${profile.paused ? 'bg-plum' : 'bg-plum/25'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${profile.paused ? 'left-6' : 'left-1'}`} /></span>
            Pause my profile
          </button>
        </section>
      )}
      <section className="rounded-3xl bg-plum p-5 text-cream">
        <h2 className="mb-2 font-serif text-2xl">Track record</h2>
        <p className="text-sm text-cream/80">{trackLine(profile)}</p>
        <p className="mt-1 text-xs text-cream/65">Counted from completed projects on probono. You can't edit these.</p>
        {profile.quotes?.map((q, i) => <p key={i} className="mt-4 border-l-2 border-apricot pl-3 font-serif italic">"{q.text}"<span className="mt-1 block text-xs not-italic text-cream/65">{q.author}, {q.projectTitle}{q.fictional ? ' · fictional demo quote' : ''}</span></p>)}
      </section>
      <Blocked state={state} />
      <Account demo={demo} />
    </div>
  );
}

function Blocked({ state }: { state: AppState }) {
  const { run, pending } = useAct();
  if (!state.blocked.length) return null;
  return (
    <section className="rounded-3xl border border-plum/15 bg-white/50 p-5">
      <h2 className="mb-2 font-serif text-2xl">Blocked</h2>
      <ul className="space-y-1">
        {state.blocked.map((b) => (
          <li key={b.id} className="flex items-center justify-between text-sm">{b.name}<Btn v="ghost" disabled={pending} onClick={() => run({ action: 'unblock', targetId: b.id })}>Unblock</Btn></li>
        ))}
      </ul>
    </section>
  );
}

function Account({ demo }: { demo: boolean }) {
  const [, go] = useLocation();
  const qc = useQueryClient();
  const [del, setDel] = useState(false);
  const signOut = async () => { await supabase.auth.signOut(); qc.clear(); go('/'); };
  return (
    <section className="space-y-3 rounded-3xl border border-plum/15 bg-white/50 p-5">
      <h2 className="font-serif text-2xl">Account</h2>
      <nav aria-label="Policies and help" className="flex flex-wrap gap-x-4 text-sm">
        {[['terms', 'Terms'], ['privacy', 'Privacy'], ['community', 'Community rules'], ['support', 'Support']].map(([k, l]) => <a key={k} href={`#/about/${k}`} className="min-h-11 py-3 underline underline-offset-4">{l}</a>)}
      </nav>
      {!demo && <Btn v="ghost" className="w-full" onClick={signOut}>Sign out</Btn>}
      {!demo && <button onClick={() => setDel(true)} className="min-h-11 w-full text-sm text-[#8a2f25] underline underline-offset-4">Delete my account</button>}
      {demo && <p className="text-xs text-plum/65">Sign-out and account deletion don't apply in the demo. Use "Exit demo" at the top.</p>}
      {del && <DeleteAccount onClose={() => setDel(false)} />}
    </section>
  );
}

function DeleteAccount({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [, go] = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = async () => {
    setBusy(true); setErr('');
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email ?? '';
    // Re-entering the password gives a fresh session; the server refuses deletion with an old one.
    const re = await supabase.auth.signInWithPassword({ email, password });
    if (re.error || !re.data.session) { setBusy(false); return setErr(authMessage(re.error, 'sign_in')); }
    try {
      await call('/account/delete', { method: 'POST', token: re.data.session.access_token });
      await supabase.auth.signOut({ scope: 'local' });
      qc.clear();
      go('/');
      toast('Your account is deleted.');
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };
  return (
    <Modal title="Delete your account?" onClose={onClose}>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-plum/85">
        <li>Your profile and postings leave discovery right away, and your photos are deleted.</li>
        <li>Any proposed or active project stops, and the other side is told.</li>
        <li>Past project records stay with the other side, with your name replaced by "Deleted account".</li>
        <li>Safety reports involving you are kept for the pilot team. probono hasn't published a retention period yet.</li>
        <li>This can't be undone.</li>
      </ul>
      <Field label="Your password" name="password" error={err}>{(f) => <input {...f} name="password" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      <div className="mt-4 flex gap-3">
        <Btn v="ghost" className="flex-1" onClick={onClose}>Keep my account</Btn>
        <Btn v="danger" className="flex-1" disabled={busy || !password} onClick={confirm}>{busy ? 'Deleting…' : 'Delete account'}</Btn>
      </div>
    </Modal>
  );
}
