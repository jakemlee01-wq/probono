import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import type { Profile, Project } from '@shared/types';
import { Btn, Confirm, Tile } from './bits';
import { Chat } from './chat';
import { termsLine } from './prospect-card';
import { useAct } from '@/lib/act';
import { fmtDate, photoUrl, useNow } from '@/lib/util';

const H72 = 72 * 3600 * 1000;

// Pending mode replaces discovery: one possible project, 72 hours, decide together.
export function Pending({ project, me }: { project: Project; me: Profile }) {
  const { run, pending } = useAct();
  const [pass, setPass] = useState(false);
  const now = useNow();
  const vol = me.kind === 'volunteer';
  const other = vol ? project.nonprofit : project.volunteer;
  const mine = vol ? project.volunteerConfirmed : project.nonprofitConfirmed;
  const rem = Math.max(0, new Date(project.pendingUntil).getTime() - now);
  const pct = Math.min(100, Math.max(0, (1 - rem / H72) * 100));
  const hh = Math.floor(rem / 3600000), mm = Math.floor((rem % 3600000) / 60000);
  const t = project.posting.terms;
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 text-plum">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-plum/60">Pending project</p>
      <div className="flex items-center gap-4">
        <Tile name={other.name} src={other.photos[0] ? photoUrl(other.photos[0]) : undefined} className="h-20 w-20 shrink-0 rounded-2xl text-3xl" />
        <div>
          <h1 className="font-serif text-4xl leading-none">{other.name}</h1>
          <p className="mt-1 text-sm text-plum/70">{vol ? project.posting.title : other.title}</p>
        </div>
      </div>
      <div className="rounded-3xl bg-plum p-5 text-cream">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/60"><Clock size={14} />Time left to decide</div>
        <p className="mt-1 font-serif text-4xl tabular-nums">{Math.floor(hh / 24)} days {hh % 24} hrs {String(mm).padStart(2, '0')} min</p>
        <p className="mt-2 text-sm text-cream/75">If you don't both confirm in time, this closes and the role reopens.</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cream/20"><div className="h-full rounded-full bg-apricot" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="rounded-3xl border border-plum/15 bg-white/50 p-5">
        <p className="font-serif text-xl">What you're both saying yes to</p>
        <p className="mt-1 font-serif text-2xl">{termsLine(t)}</p>
        <p className="mt-1 text-sm text-plum/65">Starting {fmtDate(t.startDate || project.startDate)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[{ n: vol ? 'You' : project.volunteer.name, c: project.volunteerConfirmed }, { n: !vol ? 'You' : project.nonprofit.name, c: project.nonprofitConfirmed }].map((x) => (
            <span key={x.n} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${x.c ? 'bg-sage/30 text-plum' : 'bg-plum/10 text-plum/60'}`}>
              {x.c ? <Check size={12} /> : <Clock size={12} />}{x.n}: {x.c ? 'confirmed' : 'waiting'}
            </span>
          ))}
        </div>
      </div>
      <Chat project={project} meId={me.id} />
      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-2xl gap-3 border-t border-plum/15 bg-cream px-4 py-3">
        <Btn v="ghost" className="flex-1" disabled={pending} onClick={() => setPass(true)}>Pass</Btn>
        <Btn className="flex-1" disabled={pending || mine} onClick={() => run({ action: 'confirm', projectId: project.id })}>{mine ? 'Waiting for them' : 'Confirm project'}</Btn>
      </div>
      {pass && <Confirm title="Pass on this project?" body="This ends the pending project and takes you back to discovery. It can't be undone." cta="Pass" danger busy={pending} onNo={() => setPass(false)} onYes={() => run({ action: 'pass', projectId: project.id }, { done: () => setPass(false) })} />}
    </div>
  );
}
