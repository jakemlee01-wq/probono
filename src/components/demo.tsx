import { useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { X } from 'lucide-react';
import { DEMO_PERSONAS, GUIDED_POSTING, type DemoPersonaId } from '@shared/fixtures';
import type { AppState, Profile } from '@shared/types';
import { Btn, Modal } from './bits';
import { demo, useDemoPersona } from '@/lib/demo-store';
import { useAct } from '@/lib/act';
import { useToast } from '@/lib/toast';
import { fmtDate, useNow } from '@/lib/util';

export const DEMO_LABEL = 'Demo · fictional people and projects';

// Landing-page entry: one button for a new visitor; resume or start over for a returning one.
export function DemoEntry() {
  const [, go] = useLocation();
  const persona = useDemoPersona();
  const saved = persona !== null || demo.saved();
  const enter = (fresh: boolean) => { if (fresh) demo.start('sally'); else demo.resume(); go('/app'); };
  if (!saved) {
    return <Btn v="light" className="w-full !min-h-14 text-base" onClick={() => enter(true)}>Try the demo</Btn>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Btn v="light" className="!min-h-14 text-base" onClick={() => enter(false)}>Resume your demo</Btn>
      <Btn v="ghost" className="!min-h-14 text-base text-cream" onClick={() => enter(true)}>Start over</Btn>
    </div>
  );
}

// Compact bar on every demo screen. Everything else lives in the Explore menu.
export function DemoBar({ persona, children }: { persona: DemoPersonaId; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, go] = useLocation();
  const name = DEMO_PERSONAS.find((p) => p.id === persona)?.name ?? persona;
  return (
    <>
      <div role="region" aria-label="Demo" className="relative z-40 flex min-h-11 items-center justify-between gap-2 bg-apricot px-3 text-xs text-plum">
        <span className="min-w-0 truncate"><span className="mr-1 hidden font-serif text-lg leading-none min-[360px]:inline">probono</span><b>Demo</b> · fictional {name.split(' ')[0]}</span>
        <span className="flex shrink-0 items-center">
          {children}
          <button aria-label="Explore demo" className="min-h-11 rounded-full px-2 font-semibold underline underline-offset-2" onClick={() => setOpen(true)}>Explore</button>
          <button aria-label="Exit demo" className="min-h-11 rounded-full px-2 font-semibold underline underline-offset-2" onClick={() => { demo.exit(); go('/'); }}>Exit</button>
        </span>
      </div>
      {open && <ExploreMenu persona={persona} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExploreMenu({ persona, onClose }: { persona: DemoPersonaId; onClose: () => void }) {
  const [, go] = useLocation();
  const toast = useToast();
  const now = useNow(60_000);
  const offset = demo.clockOffset();
  return (
    <Modal title="Explore the demo" onClose={onClose}>
      <p className="text-sm text-plum/75">{DEMO_LABEL}. It runs only in this browser: no account, no email, and nothing is sent to probono.</p>
      <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-plum/65">View as</h3>
      <div className="mt-2 space-y-2">
        {DEMO_PERSONAS.map((a) => (
          <button key={a.id} onClick={() => { demo.switchTo(a.id); onClose(); go('/app'); }} aria-current={persona === a.id || undefined}
            className={`flex min-h-14 w-full flex-col items-start rounded-2xl border px-4 py-2.5 text-left ${persona === a.id ? 'border-plum bg-plum text-cream' : 'border-plum/20 hover:bg-plum/5'}`}>
            <span className="font-semibold">{a.name} <span className="font-normal opacity-75">· {a.kind}</span></span>
            <span className={`text-xs ${persona === a.id ? 'text-cream/80' : 'text-plum/65'}`}>{a.blurb}</span>
          </button>
        ))}
      </div>
      <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-plum/65">Demo clock</h3>
      <p className="mt-1 text-sm">{offset ? `Demo date: ${fmtDate(new Date(now).toISOString(), 'EEE, MMM d')}. ` : ''}Moves time forward for this demo only. Agreed dates don't change.</p>
      <Btn v="ghost" className="mt-2" onClick={() => { demo.advanceWeek(); toast('The demo clock moved ahead one week.'); }}>Skip ahead one week</Btn>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Btn v="ghost" onClick={() => { demo.setGuide(true); onClose(); }}>Show the guide</Btn>
        <Btn v="ghost" onClick={() => { demo.restart(); onClose(); go('/app'); toast('Your demo is back at the start.'); }}>Restart demo</Btn>
      </div>
      <Btn v="ghost" className="mt-2 w-full" onClick={() => { demo.exit(); go('/'); }}>Exit demo</Btn>
    </Modal>
  );
}

// The guide through the story (find, agree, work, finish) is one line with the next action.
// "More" opens the explanation and every option for that step.
export function DemoGuide({ state, me, dark, overlay }: { state: AppState; me: Profile; dark: boolean; overlay?: boolean }) {
  const [loc, go] = useLocation();
  const [more, setMore] = useState(false);
  const { run, pending } = useAct();
  const vol = me.kind === 'volunteer';
  const p = state.projects.find((x) => x.posting.id === GUIDED_POSTING);
  const inStory = me.id === 'sally' || me.id === 'eastside';
  const other = vol ? 'Eastside Food Shelf' : 'Sally';
  const short = vol ? 'Eastside' : 'Sally';
  const onProject = !!p && loc === `/app/projects/${p.id}`;
  const small = 'min-h-9 !px-3 !py-1.5 text-xs';
  const simulate = (label: string) => p && <Btn v="apricot" className={small} disabled={pending} aria-label={label} onClick={() => run({ action: 'demo_other_side', projectId: p.id })}>{`Simulate ${short}`}</Btn>;
  const open = (label = 'Open') => p && !onProject && <Btn v={dark ? 'light' : 'primary'} className={small} onClick={() => go(`/app/projects/${p.id}`)}>{label}</Btn>;
  const restart = <Btn v="ghost" className={small} onClick={() => { demo.restart(); go('/app'); }}>Restart demo</Btn>;
  let step = 0, line = '', body = '', primary: ReactNode = null, extra: ReactNode = null;
  if (!inStory) {
    line = 'Free exploration. Switch people or restart in Explore demo.';
    body = `You're ${me.name}, outside the guided story. Try showing interest, editing an agreement, passing, or pausing.`;
  } else if (!p) {
    step = 1;
    line = vol ? 'Tap Show interest below.' : 'Waiting for Sally. Switch to her in Explore demo.';
    body = vol ? 'Eastside Food Shelf needs a simple budget template, about 3 hours a week for 4 weeks. '
      : "You're Eastside Food Shelf. You posted a budget-template project and showed interest in Sally.";
  } else if (p.status === 'pending') {
    step = 2;
    const mine = vol ? p.volunteerConfirmed : p.nonprofitConfirmed;
    const theirs = vol ? p.nonprofitConfirmed : p.volunteerConfirmed;
    if (!mine) { line = 'Review and accept the prepared agreement.'; primary = open('Review'); }
    else if (!theirs) { line = `You accepted. Play ${short}'s part:`; primary = simulate(`Simulate ${other} accepting`); }
    body = `The agreement is prepared for the demo: deliverables, what's excluded, access (none), and check-ins. Real projects need both sides to accept the same version.${theirs ? ` ${other} already accepted (simulated).` : ''}`;
  } else if (p.status === 'active') {
    step = 3;
    if ((p.week ?? 0) === 0) { line = `Confirmed for ${fmtDate(p.startDate, 'MMM d')}. Move the clock to the start.`; primary = <Btn v="apricot" className={small} aria-label="Skip ahead one week" onClick={() => demo.advanceWeek()}>Skip a week</Btn>; }
    else { line = vol ? 'Log some hours, then add your closing note.' : 'Sally is working. Follow her hours and messages.'; primary = open(); }
    body = vol ? "Read Ruth's message, tick off the task, and log a few hours. When the template is handed over, add your closing note. The demo clock moves time without changing agreed dates." : "Message Sally and follow the hours she logs. You'll confirm them at the end.";
  } else if (p.status === 'completion_pending') {
    step = 4;
    const mine = vol ? p.closing.volunteer : p.closing.nonprofit;
    if (mine) { line = `Your note is in. Play ${short}'s part:`; primary = simulate(`Simulate ${other}'s closing note`); }
    else { line = 'Add your closing note to finish.'; primary = open(); }
    body = 'A project finishes only when both sides add a closing note.';
  } else if (p.status === 'closed') {
    step = 4;
    line = vol ? "Done. That's the whole cycle." : "Done. This is Eastside's side of the same project.";
    primary = vol
      ? <Btn v="apricot" className={small} onClick={() => { demo.switchTo('eastside'); go('/app/projects'); }}>Explore as a nonprofit</Btn>
      : <Btn v="apricot" className={small} onClick={() => { demo.switchTo('sally'); go('/app'); }}>Back to Sally</Btn>;
    extra = <>{open('Open the project')}{restart}</>;
    body = vol ? 'Eastside said the work unblocked them and confirmed your hours. The closing notes are on the project and your track record.' : "The agreement, Sally's hours, and both closing notes, seen from the nonprofit's side.";
  } else {
    line = 'This story ended early.';
    primary = restart;
    body = 'The project was passed, stopped, or ran out of time. Restart to see it again.';
  }
  // One slim line, collapsed by default. Tapping it shows the explanation and the step's action.
  return (
    <section aria-label="Demo guide" className={`${overlay ? 'border-white/25 bg-plum/80 text-white backdrop-blur-sm' : `mx-auto mb-2 max-w-2xl ${dark ? 'border-white/20 bg-white/5 text-white' : 'border-plum/15 bg-white/60 text-plum'}`} rounded-full border px-3 ${more ? 'rounded-2xl pb-2' : ''}`}>
      <div className="flex min-h-8 items-center gap-1">
        <button aria-expanded={more} onClick={() => setMore((m) => !m)} className="min-h-8 min-w-0 flex-1 truncate text-left text-xs">
          {step > 0 && <b className="mr-1">Step {step} of 4 ·</b>}{line}
        </button>
        <button aria-label="Hide the guide" onClick={() => demo.setGuide(false)} className="flex h-8 w-8 shrink-0 items-center justify-center opacity-70"><X size={13} /></button>
      </div>
      {more && (
        <div className="pt-1 text-sm">
          <p className="opacity-90">{body}</p>
          <p className="mt-1 text-xs opacity-75">You're trying the {vol ? 'volunteer' : 'nonprofit'} view as {me.name}, a fictional {vol ? 'volunteer' : 'organization'}.</p>
          {(primary || extra) && <div className="mt-2 flex flex-wrap gap-2">{primary}{extra}</div>}
        </div>
      )}
    </section>
  );
}

// A quiet link back to the demo from sign-in and access pages.
export function DemoLink({ className = '' }: { className?: string }) {
  const [, go] = useLocation();
  return (
    <button onClick={() => { if (demo.saved()) demo.resume(); else demo.start('sally'); go('/app'); }} className={`min-h-11 text-sm underline underline-offset-4 ${className}`}>
      Explore the demo instead
    </button>
  );
}

// Demo only: the next step for the other side, shown right where it's needed so one visitor can see
// the whole story. Each simulated step is labeled in the project record.
export function DemoNext({ project, me }: { project: import('@shared/types').Project; me: Profile }) {
  const persona = useDemoPersona();
  const [, go] = useLocation();
  const { run, pending } = useAct();
  if (!persona) return null;
  const vol = me.kind === 'volunteer';
  const other = (vol ? project.nonprofit : project.volunteer).name;
  const mine = vol ? project.volunteerConfirmed : project.nonprofitConfirmed;
  const theirs = vol ? project.nonprofitConfirmed : project.volunteerConfirmed;
  const sim = (label: string) => <Btn v="apricot" className="min-h-10 !py-2 text-xs" disabled={pending} onClick={() => run({ action: 'demo_other_side', projectId: project.id })}>{label}</Btn>;
  let action: ReactNode = null;
  if (project.status === 'pending' && mine && !theirs) action = sim(`Simulate ${other} accepting`);
  else if (project.status === 'active' && (project.week ?? 0) === 0) action = <Btn v="apricot" className="min-h-10 !py-2 text-xs" onClick={() => demo.advanceWeek()}>Skip ahead one week</Btn>;
  else if (project.status === 'completion_pending' && (vol ? project.closing.volunteer : project.closing.nonprofit) && !(vol ? project.closing.nonprofit : project.closing.volunteer)) action = sim(`Simulate ${other}'s closing note`);
  else if (project.status === 'closed' && project.posting.id === GUIDED_POSTING) {
    action = <>
      {vol ? <Btn v="apricot" className="min-h-10 !py-2 text-xs" onClick={() => { demo.switchTo('eastside'); go('/app/projects'); }}>See it as the nonprofit</Btn>
        : <Btn v="apricot" className="min-h-10 !py-2 text-xs" onClick={() => { demo.switchTo('sally'); go('/app/projects'); }}>Back to Sally</Btn>}
      <Btn v="ghost" className="min-h-10 !py-2 text-xs" onClick={() => { demo.restart(); go('/app'); }}>Restart demo</Btn>
    </>;
  }
  if (!action) return null;
  return (
    <div role="region" aria-label="Demo shortcut" className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-plum/40 bg-white/60 p-3 text-plum">
      <p className="mr-auto text-xs font-semibold">Demo only. The other side is simulated.</p>
      {action}
    </div>
  );
}
