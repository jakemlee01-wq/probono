import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'wouter';
import { Compass, UserRound } from 'lucide-react';
import type { AppConfig, AppState, Profile } from '@shared/types';
import { Btn, ErrorBox, Modal, Skeleton } from '@/components/bits';
import { Discovery } from '@/components/discovery';
import { Pending } from '@/components/pending';
import { Workspace } from '@/components/workspace';
import { Onboarding } from '@/components/onboarding';
import { ProfileEditor } from '@/components/profile-editor';
import { Postings } from '@/components/postings';
import { DemoBar } from '@/components/demo';
import { useAppState, useConfig } from '@/lib/api';
import { useAct } from '@/lib/act';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/util';

export default function AppPage() {
  const { session, ready } = useSession();
  if (!ready) return <div className="min-h-[100dvh] bg-plum" />;
  if (!session) return <Redirect to="/" />;
  return <Shell />;
}

function Shell() {
  const [tab, setTab] = useState<'discover' | 'profile'>('discover');
  const [sel, setSel] = useState<string | undefined>(undefined);
  const q = useAppState(sel);
  const cfg = useConfig();
  const state = q.data;
  const me = state?.profile ?? null;

  useEffect(() => {
    if (!sel && me?.kind === 'nonprofit' && state?.postings.length) setSel(state.postings.find((p) => p.status !== 'Complete')?.id ?? state.postings[0].id);
  }, [sel, me?.kind, state]);

  if (!state && !q.isError) return <div className="min-h-[100dvh] bg-plum p-6"><Skeleton className="mx-auto mt-16 h-[60dvh] max-w-md text-white" /></div>;
  if (!state) return <div className="min-h-[100dvh] bg-plum p-6 text-cream"><div className="mx-auto mt-20 max-w-md"><ErrorBox onRetry={() => q.refetch()} /></div></div>;
  if (state.needsOnboarding || !me) return <Onboarding onDone={() => setTab('profile')} />;

  const np = me.kind === 'nonprofit';
  const active = sel ?? state.postings[0]?.id;
  const activePosting = state.postings.find((p) => p.id === active);
  // Three modes, one at a time: discovery is plum, pending and partnership are cream.
  const dark = tab === 'discover' && state.mode === 'discovery';
  const pill = state.mode === 'pending' ? 'Pending project'
    : state.mode === 'project' ? 'Partnership'
    : me.paused ? 'Paused'
    : np ? `${activePosting?.notesLeft ?? 5} of 5 notes left`
    : `Open · ${me.terms.hoursPerWeek} hrs/wk`;
  const demo = !!cfg.data?.demoMode && cfg.data.demoAccounts.some((a) => a.id === me.id);

  return (
    <div className={`grain relative min-h-[100dvh] ${dark ? 'bg-plum text-white' : 'bg-cream text-plum'}`}>
      {demo && cfg.data && <DemoBar profile={me} accounts={cfg.data.demoAccounts} />}
      <header className="relative z-10 mx-auto flex max-w-2xl items-center justify-between px-5 pb-3 pt-5">
        <span className="font-serif text-2xl">probono</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${dark ? 'border-white/30 bg-white/10' : 'border-plum/30 bg-plum/5'}`}>{pill}</span>
      </header>
      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-48 pt-2">
        {tab === 'discover' && np && state.postings.length > 1 && (
          <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
            {state.postings.map((p) => (
              <button key={p.id} onClick={() => setSel(p.id)} className={`min-h-9 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${active === p.id ? (dark ? 'border-white bg-white text-plum' : 'border-plum bg-plum text-cream') : 'border-current/30 opacity-80'}`}>{p.title} · {p.status}</button>
            ))}
          </div>
        )}
        {tab === 'discover' && (
          state.mode === 'pending' && state.currentProject ? <Pending key={state.currentProject.id} project={state.currentProject} me={me} />
          : state.mode === 'project' && state.currentProject ? <Workspace key={state.currentProject.id} project={state.currentProject} me={me} demo={demo} />
          : <Discovery state={state} me={me} postingId={active} goProfile={() => setTab('profile')} />
        )}
        {tab === 'profile' && <ProfileTab me={me} state={state} config={cfg.data} onWork={(id) => { setSel(id); setTab('discover'); }} />}
      </main>
      <nav className={`pb-safe fixed inset-x-0 bottom-0 z-30 border-t ${dark ? 'border-white/15 bg-plum' : 'border-plum/15 bg-cream'}`}>
        <div className="mx-auto grid h-16 max-w-2xl grid-cols-2">
          {([['discover', state.mode === 'discovery' ? 'Discover' : state.mode === 'pending' ? 'Pending' : 'Project', Compass], ['profile', 'Profile', UserRound]] as const).map(([k, l, I]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)} className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${tab === k ? '' : 'opacity-50'}`}><I size={20} />{l}</button>
          ))}
        </div>
      </nav>
      <Notice state={state} me={me} />
    </div>
  );
}

function ProfileTab({ me, state, config, onWork }: { me: Profile; state: AppState; config?: AppConfig; onWork: (id: string) => void }) {
  const [seg, setSeg] = useState<'postings' | 'profile'>('postings');
  const np = me.kind === 'nonprofit';
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-4xl leading-none">{me.name}</h1>
      {np && (
        <div className="flex rounded-full bg-plum/10 p-1">
          {(['postings', 'profile'] as const).map((s) => <button key={s} onClick={() => setSeg(s)} className={`min-h-10 flex-1 rounded-full py-2 text-xs font-semibold capitalize ${seg === s ? 'bg-plum text-cream' : 'text-plum/70'}`}>{s}</button>)}
        </div>
      )}
      {np && seg === 'postings' ? <Postings postings={state.postings} me={me} config={config} onWork={onWork} /> : <ProfileEditor key={me.id} profile={me} config={config} />}
      <Btn v="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>Sign out</Btn>
    </div>
  );
}

// The moments that change the app's mode get a pop-up you acknowledge with OK.
function Notice({ state, me }: { state: AppState; me: Profile }) {
  const { run, pending } = useAct();
  const seen = useRef<Set<string>>(new Set());
  const [, bump] = useState(0);
  const n = state.notification;
  const proj = n === 'closed' ? state.lastClosedProject : state.currentProject;
  if (!n || !proj) return null;
  const key = `${n}:${proj.id}:${proj.status}`;
  if (seen.current.has(key)) return null;
  const ok = () => run({ action: 'acknowledge', projectId: proj.id }, { quiet: true, done: () => { seen.current.add(key); bump((x) => x + 1); } });
  const cs = proj.status;
  const vol = me.kind === 'volunteer';
  const other = vol ? proj.nonprofit : proj.volunteer;
  const theirNote = vol ? proj.nonprofitClosingNote : proj.volunteerClosingNote;
  const title = n === 'mutual' ? "It's mutual" : n === 'confirmed' ? 'Project confirmed'
    : cs === 'closed' ? 'Project complete' : cs === 'passed' ? 'Project passed' : cs === 'lapsed' ? 'Time ran out' : 'Project ended early';
  return (
    <Modal title={title}>
      {n === 'mutual' && <p className="mb-5 text-plum/80">You and {other.name} are both interested, so this is now a pending project. Discovery is paused while you decide, and you both have 3 days to confirm.</p>}
      {n === 'confirmed' && <p className="mb-5 text-plum/80">You both said yes. Your partnership with {other.name} runs {fmtDate(proj.startDate)} to {fmtDate(proj.endDate)}.</p>}
      {n === 'closed' && (
        <div className="mb-5 text-plum/80">
          <p>{cs === 'closed' ? `Your partnership with ${other.name} is complete. Thank you for the time.` : cs === 'passed' ? `The pending project with ${other.name} was passed on. Back to discovery.` : cs === 'lapsed' ? `The 3 days ended before you both confirmed the project with ${other.name}.` : `Your partnership with ${other.name} ended early. Back to discovery.`}</p>
          {cs === 'closed' && theirNote ? <p className="mt-4 border-l-2 border-apricot pl-3 font-serif text-lg italic">"{theirNote}"<span className="block text-xs not-italic text-plum/55">{other.name}</span></p> : null}
        </div>
      )}
      <Btn className="w-full" disabled={pending} onClick={ok}>OK</Btn>
    </Modal>
  );
}
