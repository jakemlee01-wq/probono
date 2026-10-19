import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { FolderOpen, HeartHandshake, UserRound, WifiOff } from 'lucide-react';
import type { AppNotification, AppState, Profile } from '@shared/types';
import { Btn, ErrorBox, Modal, Skeleton } from '@/components/bits';
import { Discovery } from '@/components/discovery';
import { Projects } from '@/components/projects';
import { Onboarding } from '@/components/onboarding';
import { ProfileEditor } from '@/components/profile-editor';
import { Postings } from '@/components/postings';
import { DemoBar, DemoGuide } from '@/components/demo';
import { demo as demoStore, useDemoVersion } from '@/lib/demo-store';
import { Notifications } from '@/components/notifications';
import { ApiError, useAppState, useOnline } from '@/lib/api';
import { useAct } from '@/lib/act';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { fmtDate, POSTING_LABEL, projectLabel } from '@/lib/util';

export default function AppPage() {
  const { session, demo, ready } = useSession();
  if (!ready) return <div className="min-h-[100dvh] bg-plum" />;
  if (!session && !demo) return <Redirect to="/" />;
  return <Shell />;
}

type Tab = 'discover' | 'projects' | 'profile';
// Stable routes: #/app, #/app/projects, #/app/projects/<id>, #/app/profile. Links and tabs agree.
function parse(loc: string): { tab: Tab; projectId?: string } {
  const parts = loc.split('?')[0].split('/').filter(Boolean); // ['app', ...]
  if (parts[1] === 'projects') return { tab: 'projects', projectId: parts[2] };
  if (parts[1] === 'profile') return { tab: 'profile' };
  return { tab: 'discover' };
}

function Shell() {
  const [loc, go] = useLocation();
  const { tab, projectId } = parse(loc);
  const { demo } = useSession();
  useDemoVersion(); // re-render when the guide is shown or hidden
  const [sel, setSel] = useState<string | undefined>(undefined);
  const q = useAppState(sel);
  const online = useOnline();
  const state = q.data;
  const me = state?.profile ?? null;

  useEffect(() => {
    if (!sel && me?.kind === 'nonprofit' && state?.postings.length) setSel(state.postings.find((p) => p.status !== 'Complete')?.id ?? state.postings[0].id);
  }, [sel, me?.kind, state]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab, projectId]);
  // The demo guide shows once: leaving the first screen dismisses it for good (Explore demo can bring it back).
  const firstTab = useRef(tab);
  useEffect(() => { if (demo && tab !== firstTab.current && demoStore.guideOn()) demoStore.setGuide(false); }, [tab, demo]);
  useEffect(() => { if (q.error instanceof ApiError && q.error.status === 401) supabase.auth.signOut(); }, [q.error]);

  if (!state && !q.isError) return <div className="min-h-[100dvh] bg-plum p-6" aria-busy="true"><Skeleton className="mx-auto mt-16 h-[60dvh] max-w-md text-white" /></div>;
  if (!state) return <div className="min-h-[100dvh] bg-plum p-6 text-cream"><div className="mx-auto mt-20 max-w-md"><ErrorBox text={(q.error as Error)?.message} onRetry={() => q.refetch()} /></div></div>;
  if (state.needsOnboarding || !me) return <Onboarding onDone={() => go('/app/profile')} />;

  const np = me.kind === 'nonprofit';
  const active = sel ?? state.postings[0]?.id;
  const dark = tab === 'discover';
  const live = state.projects.filter((p) => ['pending', 'active', 'completion_pending'].includes(p.status));
  const needsMe = live.some((p) => projectLabel(p, me.kind).yours);
  const pill = me.paused ? 'Paused'
    : live.length > 1 ? `${live.length} projects`
    : live.length === 1 ? projectLabel(live[0], me.kind).label
    : np ? (state.reviewGate?.waiting ? 'Waiting for review' : 'Accepting volunteers') : 'Open to projects';
  const openNotice = (n: AppNotification) => go(n.projectId ? `/app/projects/${n.projectId}` : '/app');
  const stale = q.isError && !!state;

  return (
    <div className={`grain relative min-h-[100dvh] ${dark ? 'bg-plum text-white' : 'bg-cream text-plum'}`}>
      {demo && <DemoBar persona={demo} />}
      {(!online || stale) && (
        <div role="status" className="relative z-40 flex items-center justify-center gap-2 bg-[#8a2f25] px-3 py-2 text-center text-xs text-cream">
          <WifiOff size={14} aria-hidden />{!online ? "You're offline. You're seeing the last saved view, and changes won't be sent until you're back." : "Can't reach probono right now. Retrying. Changes may not save."}
        </div>
      )}
      <header className="relative z-10 mx-auto flex max-w-2xl items-center justify-between gap-2 px-5 pb-1.5 pt-2">
        <span className="shrink-0 font-serif text-2xl">probono</span>
        <span className="flex min-w-0 items-center gap-1">
          <span className={`min-w-0 truncate rounded-full border px-3 py-1 text-xs font-semibold ${dark ? 'border-white/30 bg-white/10' : 'border-plum/30 bg-plum/5'}`}>{pill}</span>
          <Notifications items={state.notifications} unread={state.unread} dark={dark} onOpen={openNotice} />
        </span>
      </header>
      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-28 pt-1">
        {demo && demoStore.guideOn() && <DemoGuide state={state} me={me} dark={dark} />}
        {tab === 'discover' && np && state.postings.length > 1 && (
          <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Choose a posting">
            {state.postings.map((p) => (
              <button key={p.id} aria-pressed={active === p.id} onClick={() => setSel(p.id)} className={`min-h-9 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold ${active === p.id ? 'border-white bg-white text-plum' : 'border-white/35 text-white/85'}`}>{p.title} · {POSTING_LABEL[p.status]}</button>
            ))}
          </div>
        )}
        {tab === 'discover' && <Discovery state={state} me={me} postingId={active} goProfile={() => go('/app/profile')} goProject={(id) => go(`/app/projects/${id}`)} />}
        {tab === 'projects' && <Projects state={state} me={me} openId={projectId} open={(id) => go(id ? `/app/projects/${id}` : '/app/projects')} goDiscover={() => go('/app')} />}
        {tab === 'profile' && <ProfileTab me={me} state={state} onWork={(id) => { setSel(id); go('/app'); }} onOpenProject={(id) => go(`/app/projects/${id}`)} />}
      </main>
      <nav aria-label="Main" className={`pb-safe fixed inset-x-0 bottom-0 z-30 border-t ${dark ? 'border-white/15 bg-plum' : 'border-plum/15 bg-cream'}`}>
        <div className="mx-auto grid h-16 max-w-2xl grid-cols-3">
          {([['discover', 'Match', HeartHandshake, '/app'], ['projects', 'Projects', FolderOpen, '/app/projects'], ['profile', 'Profile', UserRound, '/app/profile']] as const).map(([k, l, I, href]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => go(href)} className={`relative flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${tab === k ? '' : 'opacity-65'}`}>
              <I size={20} aria-hidden />{l}
              {k === 'projects' && needsMe && <span className="absolute right-[calc(50%-1.4rem)] top-2 h-2.5 w-2.5 rounded-full bg-apricot" aria-label="needs your action" />}
            </button>
          ))}
        </div>
      </nav>
      <Notice state={state} me={me} open={(id) => go(`/app/projects/${id}`)} />
    </div>
  );
}

function ProfileTab({ me, state, onWork, onOpenProject }: { me: Profile; state: AppState; onWork: (id: string) => void; onOpenProject: (id: string) => void }) {
  const [seg, setSeg] = useState<'postings' | 'profile'>('postings');
  const np = me.kind === 'nonprofit';
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-4xl leading-none">{me.name}</h1>
      {np && (
        <div className="flex rounded-full bg-plum/10 p-1" role="tablist" aria-label="Profile sections">
          {(['postings', 'profile'] as const).map((s) => <button key={s} role="tab" aria-selected={seg === s} onClick={() => setSeg(s)} className={`min-h-10 flex-1 rounded-full py-2 text-xs font-semibold capitalize ${seg === s ? 'bg-plum text-cream' : 'text-plum/75'}`}>{s === 'profile' ? 'Organization' : 'Postings'}</button>)}
        </div>
      )}
      {np && seg === 'postings' ? <Postings state={state} me={me} onWork={onWork} onOpenProject={onOpenProject} /> : <ProfileEditor key={me.id} profile={me} state={state} />}
    </div>
  );
}

// The moments that change what you're doing get a pop-up you acknowledge with OK.
function Notice({ state, me, open }: { state: AppState; me: Profile; open: (id: string) => void }) {
  const { run, pending } = useAct();
  const [dismissed, setDismissed] = useState<string>('');
  const n = state.notice;
  const proj = n ? state.projects.find((p) => p.id === n.projectId) : undefined;
  if (!n || !proj) return null;
  const key = `${me.id}:${n.kind}:${proj.id}:${proj.status}`;
  if (dismissed === key) return null;
  const ok = (then?: () => void) => run({ action: 'acknowledge', projectId: proj.id }, { quiet: true, done: () => { setDismissed(key); then?.(); } });
  const vol = me.kind === 'volunteer';
  const other = vol ? proj.nonprofit : proj.volunteer;
  const theirNote = (vol ? proj.closing.nonprofit : proj.closing.volunteer)?.note;
  const cs = proj.status;
  const title = n.kind === 'mutual' ? "It's mutual" : n.kind === 'confirmed' ? 'Project confirmed'
    : cs === 'closed' ? 'Project complete' : cs === 'passed' ? 'Project passed' : cs === 'lapsed' ? 'Time ran out' : 'Project stopped';
  return (
    <Modal title={title}>
      {n.kind === 'mutual' && <p className="mb-5 text-plum/85">You and {other.name} are both interested. Next, agree a short work agreement together. You both have until {fmtDate(proj.pendingUntil, 'EEE, MMM d, h:mm a')} to accept the same version.</p>}
      {n.kind === 'confirmed' && <p className="mb-5 text-plum/85">You both accepted the agreement. Your project with {other.name} runs {fmtDate(proj.startDate)} to {fmtDate(proj.endDate)}.</p>}
      {n.kind === 'ended' && (
        <div className="mb-5 text-plum/85">
          <p>{cs === 'closed' ? `Your project with ${other.name} is complete. Thank you for the time.` : cs === 'passed' ? `${other.name} passed on this proposed project. Your profile stays open to others.` : cs === 'lapsed' ? `The 72 hours ended before you both accepted the agreement with ${other.name}.` : `The project with ${other.name} was stopped.`}</p>
          {cs === 'closed' && theirNote ? <p className="mt-4 border-l-2 border-apricot pl-3 font-serif text-lg italic">"{theirNote}"<span className="block text-xs not-italic text-plum/60">{other.name}</span></p> : null}
        </div>
      )}
      <div className="flex gap-3">
        <Btn v="ghost" className="flex-1" disabled={pending} onClick={() => ok()}>OK</Btn>
        <Btn className="flex-1" disabled={pending} onClick={() => ok(() => open(proj.id))}>{n.kind === 'ended' ? 'View project' : 'Open project'}</Btn>
      </div>
    </Modal>
  );
}
