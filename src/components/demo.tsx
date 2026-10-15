import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DEMO_PERSONAS, type DemoPersonaId } from '@shared/fixtures';
import { Btn, Confirm, Modal } from './bits';
import { demo } from '@/lib/demo-store';
import { useToast } from '@/lib/toast';

export const DEMO_LABEL = 'Demo · fictional people and projects';

function Picker({ onPick, current }: { onPick: (id: DemoPersonaId) => void; current?: DemoPersonaId | null }) {
  return (
    <div className="space-y-2">
      {DEMO_PERSONAS.map((a) => (
        <button key={a.id} onClick={() => onPick(a.id)} aria-current={current === a.id || undefined}
          className={`flex min-h-14 w-full flex-col items-start rounded-2xl border px-4 py-3 text-left ${current === a.id ? 'border-plum bg-plum text-cream' : 'border-plum/20 hover:bg-plum/5'}`}>
          <span className="font-semibold">{a.name}</span>
          <span className={`text-xs ${current === a.id ? 'text-cream/75' : 'text-plum/65'}`}>{a.blurb}</span>
        </button>
      ))}
    </div>
  );
}

// "Try the demo" on signed-out pages. The demo runs in this browser only and creates no account.
export function DemoLink({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [, go] = useLocation();
  const qc = useQueryClient();
  const pick = (id: DemoPersonaId) => { demo.start(id); qc.removeQueries({ queryKey: ['state'] }); setOpen(false); go('/app'); };
  return (
    <>
      <button onClick={() => setOpen(true)} className={`min-h-11 text-sm underline underline-offset-4 ${className}`}>Try the demo</button>
      {open && (
        <Modal title="Try the demo" onClose={() => setOpen(false)}>
          <p className="mb-2 text-sm text-plum/75">Everyone in the demo is fictional. It runs only in this browser: no account, no email, and nothing you do is sent to probono or seen by anyone else.</p>
          <p className="mb-4 text-sm text-plum/75">Pick who to be:</p>
          <Picker onPick={pick} />
        </Modal>
      )}
    </>
  );
}

// Shown on every demo screen.
export function DemoBanner({ persona }: { persona: DemoPersonaId }) {
  const [switching, setSwitching] = useState(false);
  const [restart, setRestart] = useState(false);
  const [, go] = useLocation();
  const qc = useQueryClient();
  const toast = useToast();
  const name = DEMO_PERSONAS.find((p) => p.id === persona)?.name ?? persona;
  const refresh = () => qc.removeQueries({ queryKey: ['state'] });
  return (
    <>
      <div role="region" aria-label="Demo controls" className="relative z-40 bg-apricot px-3 py-2 text-center text-xs text-plum">
        <p className="font-bold">{DEMO_LABEL}</p>
        <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-3">
          <span>Viewing as {name}</span>
          <button className="min-h-8 font-semibold underline underline-offset-2" onClick={() => setSwitching(true)}>Switch</button>
          <button className="min-h-8 font-semibold underline underline-offset-2" onClick={() => setRestart(true)}>Restart my demo</button>
          <button className="min-h-8 font-semibold underline underline-offset-2" onClick={() => { demo.exit(); refresh(); go('/'); }}>Exit demo</button>
        </p>
      </div>
      {switching && (
        <Modal title="Switch demo person" onClose={() => setSwitching(false)}>
          <p className="mb-4 text-sm text-plum/70">Your demo keeps its progress when you switch, so you can play both sides of a project.</p>
          <Picker current={persona} onPick={(id) => { demo.switchTo(id); refresh(); setSwitching(false); go('/app'); }} />
        </Modal>
      )}
      {restart && (
        <Confirm title="Restart my demo?" body="This resets the demo in this browser only, back to the starting story. Other visitors are not affected." cta="Restart"
          onNo={() => setRestart(false)} onYes={() => { demo.restart(); refresh(); setRestart(false); go('/app'); toast('Your demo is back at the start.'); }} />
      )}
    </>
  );
}
