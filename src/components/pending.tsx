import { useState } from 'react';
import { Check, Clock } from 'lucide-react';
import type { Profile, Project } from '@shared/types';
import { AGREEMENT_LABELS, LIMITS } from '@shared/rules';
import { Btn, Confirm, Modal, Tile } from './bits';
import { Chat } from './chat';
import { AcceptSheet, AgreementEditor, AgreementView, ExportButton } from './agreement';
import { SafetyButton } from './safety';
import { useAct } from '@/lib/act';
import { fmtInstant, photoUrl, projectLabel, timeLeft, useNow } from '@/lib/util';

// A proposed project: 72 hours to agree one version of the work agreement, together.
export function Pending({ project, me }: { project: Project; me: Profile }) {
  const { run, pending } = useAct();
  const [pass, setPass] = useState(false);
  const [edit, setEdit] = useState(false);
  const [accept, setAccept] = useState(false);
  const [missing, setMissing] = useState(false);
  const now = useNow(60_000);
  const vol = me.kind === 'volunteer';
  const other = vol ? project.nonprofit : project.volunteer;
  const mine = vol ? project.volunteerConfirmed : project.nonprofitConfirmed;
  const theirs = vol ? project.nonprofitConfirmed : project.volunteerConfirmed;
  const rem = Date.parse(project.pendingUntil) - now;
  const total = LIMITS.decisionHours * 3600_000;
  const pct = Math.min(100, Math.max(0, (1 - rem / total) * 100));
  const a = project.agreement;
  const status = projectLabel(project, me.kind);
  const gaps = project.missing ?? [];
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 text-plum">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-plum/65">Proposed project · {status.label}</p>
        <div className="mt-3 flex items-center gap-4">
          <Tile name={other.name} alt="" src={other.photos[0] ? photoUrl(other.photos[0]) : undefined} className="h-20 w-20 shrink-0 rounded-2xl text-3xl" />
          <div className="min-w-0">
            <h1 className="font-serif text-4xl leading-none">{other.name}</h1>
            <p className="mt-1 text-sm text-plum/75">{a.title}</p>
          </div>
        </div>
      </div>

      <section aria-label="Decision deadline" className="rounded-3xl bg-plum p-5 text-cream">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/70"><Clock size={14} aria-hidden />Decide by</div>
        <p className="mt-1 font-serif text-3xl">{fmtInstant(project.pendingUntil)}</p>
        <p className="mt-1 text-sm text-cream/80">{timeLeft(rem)}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream/20" aria-hidden><div className="h-full rounded-full bg-apricot" style={{ width: `${pct}%` }} /></div>
        <p className="mt-3 text-xs text-cream/75">If you don't both accept the same version by then, this closes and the posting reopens. Editing the agreement doesn't move the deadline. Email reminders aren't set up yet, so check back here.</p>
      </section>

      <div className="flex flex-wrap gap-2">
        {[{ n: 'You', c: mine }, { n: other.name, c: theirs }].map((x) => (
          <span key={x.n} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${x.c ? 'bg-sage/30' : 'bg-plum/10 text-plum/75'}`}>
            {x.c ? <Check size={12} aria-hidden /> : <Clock size={12} aria-hidden />}{x.n}: {x.c ? `accepted version ${a.version}` : 'not accepted yet'}
          </span>
        ))}
      </div>

      <section className="rounded-3xl border border-plum/15 bg-white/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl">Work agreement</h2>
          <span className="shrink-0 rounded-full bg-plum/10 px-2.5 py-1 text-xs font-semibold">Version {a.version}</span>
        </div>
        <p className="mt-1 text-xs text-plum/65">{a.editedBy === 'system' ? 'Started from the posting.' : `Last edited by ${a.editedByName}, ${fmtInstant(a.editedAt)}.`} Both of you see this same version.</p>
        {gaps.length > 0 && (
          <p className="mt-3 rounded-2xl bg-apricot/25 p-3 text-sm" role="status">
            {gaps.length} {gaps.length === 1 ? 'thing' : 'things'} still needed before anyone can accept: {gaps.map((k) => AGREEMENT_LABELS[k as keyof typeof AGREEMENT_LABELS] ?? k).join(', ')}.
          </p>
        )}
        <div className="mt-3"><AgreementView a={a} minStart={project.minStart} pending /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn v="ghost" onClick={() => setEdit(true)}>Edit agreement</Btn>
          <ExportButton project={project} />
        </div>
      </section>

      <Chat project={project} meId={me.id} />
      <div className="text-right"><SafetyButton targetId={other.id} targetName={other.name} projectId={project.id} /></div>

      <div className="pb-safe sticky bottom-16 z-20 -mx-4 flex gap-3 border-t border-plum/15 bg-cream px-4 py-3">
        <Btn v="ghost" className="flex-1" disabled={pending} onClick={() => setPass(true)}>Pass</Btn>
        <Btn className="flex-1" disabled={pending || mine} onClick={() => (gaps.length ? setMissing(true) : setAccept(true))}>{mine ? 'Waiting for them' : 'Review and accept'}</Btn>
      </div>
      {edit && <AgreementEditor project={project} onClose={() => setEdit(false)} />}
      {accept && <AcceptSheet project={project} side={me.kind} onClose={() => setAccept(false)} />}
      {missing && (
        <Modal title="Not ready to accept yet" onClose={() => setMissing(false)}>
          <p className="mb-4 text-sm">Fill in: {gaps.map((k) => AGREEMENT_LABELS[k as keyof typeof AGREEMENT_LABELS] ?? k).join(', ')}.</p>
          <Btn className="w-full" onClick={() => { setMissing(false); setEdit(true); }}>Edit agreement</Btn>
        </Modal>
      )}
      {pass && <Confirm title="Pass on this project?" body={`This closes the proposed project with ${other.name}. Your profile and other postings stay as they are, and they'll be told politely.`} cta="Pass" danger busy={pending} onNo={() => setPass(false)} onYes={() => run({ action: 'pass', projectId: project.id }, { done: () => setPass(false) })} />}
    </div>
  );
}
