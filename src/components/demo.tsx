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
    return <Btn v="light" className="w-full !min-h-14 text-base" onClick={() => enter(true)}>Explore the demo</Btn>;
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Btn v="light" className="!min-h-14 text-base" onClick={() => enter(false)}>Resume your demo</Btn>
      <Btn v="ghost" className="!min-h-14 text-base text-cream" onClick={() => enter(true)}>Start over</Btn>
    </div>
  );
}

// Compact bar on every demo screen. Everything else lives in the Explore menu.
export function DemoBar({ persona }: { persona: DemoPersonaId }) {
  const [open, setOpen] = useState(false);
  const [, go] = useLocation();
  const name = DEMO_PERSONAS.find((p) => p.id === persona)?.name ?? persona;
  return (
    <>
      <div role="region" aria-label="Demo" className="relative z-40 flex min-h-11 items-center justify-between gap-2 bg-apricot px-3 text-xs text-plum">
        <span className="min-w-0"><b>Demo</b> · fictional · <span className="truncate">as {name}</span></span>
        <span className="flex shrink-0 items-center gap-1">
          <button className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-2" onClick={() => setOpen(true)}>Explore demo</button>
          <button className="min-h-11 rounded-full px-3 font-semibold underline underline-offset-2" onClick={() => { demo.exit(); go('/'); }}>Exit demo</button>
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

// A short, dismissible guide through the story: find, agree, work, finish.
export function DemoGuide({ state, me, dark }: { state: AppState; me: Profile; dark: boolean }) {
  const [, go] = useLocation();
  const { run, pending } = useAct();
  const vol = me.kind === 'volunteer';
  const p = state.projects.find((x) => x.posting.id === GUIDED_POSTING);
  const inStory = me.id === 'sally' || me.id === 'eastside';
  const other = vol ? 'Eastside Food Shelf' : 'Sally';
  const simulate = (label: string) => p && <Btn v="apricot" disabled={pending} onClick={() => run({ action: 'demo_other_side', projectId: p.id })}>{label}</Btn>;
  const open = p && <Btn v={dark ? 'light' : 'primary'} onClick={() => go(`/app/projects/${p.id}`)}>Open the project</Btn>;
  let step = 1, title = '', body = '', actions: ReactNode = null;
  if (!inStory) {
    title = 'Free exploration';
    body = `You're ${me.name}, outside the guided story. Try showing interest, editing an agreement, passing, or pausing. Switch people or restart from Explore demo.`;
  } else if (!p) {
    title = 'Find a project';
    body = vol ? 'Eastside Food Shelf needs a simple budget template, about 3 hours a week for 4 weeks. Read the card, then tap Show interest.'
      : "You're Eastside Food Shelf. You posted a budget-template project and showed interest in Sally. Switch to Sally in Explore demo to answer as her.";
  } else if (p.status === 'pending') {
    step = 2; title = 'Agree the work';
    const mine = vol ? p.volunteerConfirmed : p.nonprofitConfirmed;
    const theirs = vol ? p.nonprofitConfirmed : p.volunteerConfirmed;
    body = !mine
      ? `A prepared agreement is waiting: deliverables, what's excluded, access (none), and check-ins. Real projects need both sides to accept the same version. ${theirs ? `${other} already accepted (simulated).` : ''}`
      : `You accepted. In a real project you'd wait for ${other}. Here you can play their part.`;
    actions = <>{open}{mine && !theirs && simulate(`Simulate ${other} accepting`)}</>;
  } else if (p.status === 'active') {
    step = 3; title = 'Work together';
    body = (p.week ?? 0) === 0
      ? `Confirmed. It starts ${fmtDate(p.startDate, 'MMM d')}. Move the demo clock to the first week to see the work begin.`
      : vol ? "Read Ruth's message, tick off the task, and log a few hours. When the template is handed over, add your closing note." : "Sally is working. Message her and follow the hours she logs. You'll confirm them at the end.";
    actions = <>{open}{(p.week ?? 0) === 0 && <Btn v="apricot" onClick={() => demo.advanceWeek()}>Skip ahead one week</Btn>}</>;
  } else if (p.status === 'completion_pending') {
    step = 4; title = 'Finish';
    const mine = vol ? p.closing.volunteer : p.closing.nonprofit;
    body = mine ? `Your closing note is in. A project finishes when both sides add one.` : `${other} added a closing note. Add yours to finish the project.`;
    actions = <>{open}{mine && simulate(`Simulate ${other}'s closing note`)}</>;
  } else if (p.status === 'closed') {
    step = 4; title = 'Done';
    body = vol ? 'Eastside said the work unblocked them and confirmed your hours. The closing notes are on the project and your track record.' : "This is the same project from Eastside's side: the agreement, Sally's hours, and both closing notes.";
    actions = <>{open}{vol ? <Btn v="apricot" onClick={() => { demo.switchTo('eastside'); go('/app/projects'); }}>Explore as a nonprofit</Btn> : <Btn v="apricot" onClick={() => { demo.switchTo('sally'); go('/app'); }}>Back to Sally</Btn>}<Btn v="ghost" onClick={() => { demo.restart(); go('/app'); }}>Restart demo</Btn></>;
  } else {
    title = 'This story ended early';
    body = 'The project was passed, stopped, or ran out of time. Restart to see it again.';
    actions = <Btn v="apricot" onClick={() => { demo.restart(); go('/app'); }}>Restart demo</Btn>;
  }
  return (
    <section aria-label="Demo guide" className={`relative mx-auto mb-4 max-w-2xl rounded-3xl border p-4 pr-12 ${dark ? 'border-white/25 bg-plum2 text-white' : 'border-plum/20 bg-white/70 text-plum'}`}>
      <button aria-label="Hide the guide" onClick={() => demo.setGuide(false)} className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full"><X size={16} /></button>
      <p className="text-xs opacity-80">You're trying the {vol ? 'volunteer' : 'nonprofit'} view as {me.name}, a fictional {vol ? 'volunteer' : 'organization'}.</p>
      {inStory && <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">Step {step} of 4 · {['Find a project', 'Agree the work', 'Work together', 'Finish'][step - 1]}</p>}
      <p className="mt-1 font-serif text-2xl leading-tight">{title}</p>
      <p className="mt-1 text-sm opacity-90">{body}</p>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
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
