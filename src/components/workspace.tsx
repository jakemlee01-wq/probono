import { useState } from 'react';
import { AlertTriangle, Link2, Trash2 } from 'lucide-react';
import type { Profile, Project } from '@shared/types';
import { LIMITS, pilotDate, textError } from '@shared/rules';
import { Btn, Field, Modal, inputCls } from './bits';
import { Chat } from './chat';
import { AcceptSheet, AgreementEditor, AgreementView, ExportButton } from './agreement';
import { SafetyButton } from './safety';
import { DemoNext } from './demo';
import { useAct } from '@/lib/act';
import { fmtDate, fmtInstant, projectLabel } from '@/lib/util';
import { appNow } from '@/lib/demo-store';

const card = 'rounded-3xl border border-plum/15 bg-white/50 p-5';
const h = 'mb-3 font-serif text-2xl';

export function Workspace({ project, me, demo }: { project: Project; me: Profile; demo: boolean }) {
  const [tab, setTab] = useState<'project' | 'messages' | 'agreement' | 'people'>('project');
  const vol = me.kind === 'volunteer';
  const other = vol ? project.nonprofit : project.volunteer;
  const total = project.agreement.weeks || 1;
  const week = project.week ?? 0;
  const status = projectLabel(project, me.kind);
  const tabs = [['project', 'Project'], ['messages', 'Messages'], ['agreement', 'Agreement'], ['people', 'People']] as const;
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 text-plum">
      <div className="-mx-4 -mt-2 rounded-b-[2rem] bg-plum px-5 pb-5 pt-3 text-cream">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cream/70">{status.label}</p>
        <h1 className="mt-1 font-serif text-4xl leading-none">{other.name}</h1>
        <p className="mt-1 text-sm text-cream/80">{project.agreement.title} · {fmtDate(project.startDate)} to {fmtDate(project.endDate)}</p>
        <p className="mt-2 text-sm font-semibold">Next: {status.next}.</p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-semibold"><span>{week === 0 ? `Starts ${fmtDate(project.startDate, 'MMM d')}` : `Week ${week} of ${total}`}</span><span>{project.finalWeek ? 'Final week' : ''}</span></div>
          <div className="flex gap-1" aria-hidden>{Array.from({ length: total }, (_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < week ? 'bg-cream' : 'bg-cream/25'}`} />)}</div>
        </div>
      </div>
      <div role="tablist" aria-label="Project sections" className="flex rounded-full bg-plum/10 p-1">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 flex-1 rounded-full py-2 text-xs font-semibold transition ${tab === k ? 'bg-plum text-cream' : 'text-plum/75'}`}>{l}</button>
        ))}
      </div>
      {tab === 'project' && <ProjectTab project={project} me={me} demo={demo} />}
      {tab === 'messages' && <Chat project={project} meId={me.id} />}
      {tab === 'agreement' && <AgreementTab project={project} />}
      {tab === 'people' && <People project={project} />}
      <div className="text-right"><SafetyButton targetId={other.id} targetName={other.name} projectId={project.id} /></div>
    </div>
  );
}

function AgreementTab({ project }: { project: Project }) {
  const [edit, setEdit] = useState(false);
  return (
    <section className={card}>
      <h2 className={h}>Agreed scope</h2>
      <p className="mb-2 text-xs text-plum/65">Version {project.agreedVersion} agreed by both sides{project.agreement.version !== project.agreedVersion ? `. Version ${project.agreement.version} is proposed and shown below.` : '.'}</p>
      <AgreementView a={project.agreement} pending={false} />
      <ul className="mt-3 space-y-1 text-xs text-plum/65">
        {project.acceptances.map((x, i) => <li key={i}>{x.actorName} accepted version {x.version}, {fmtInstant(x.at)}</li>)}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {project.status === 'active' && <Btn v="ghost" onClick={() => setEdit(true)}>Propose a change</Btn>}
        <ExportButton project={project} />
      </div>
      {edit && <AgreementEditor project={project} onClose={() => setEdit(false)} />}
    </section>
  );
}

function ProjectTab({ project, me, demo }: { project: Project; me: Profile; demo: boolean }) {
  const { run, pending } = useAct();
  const vol = me.kind === 'volunteer';
  const commit = project.agreement.hoursPerWeek;
  const today = pilotDate(appNow());
  const [hrs, setHrs] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const toLocal = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [ci, setCi] = useState(toLocal(project.checkInDate));
  const [agenda, setAgenda] = useState(project.checkInAgenda);
  const [del, setDel] = useState('');
  const [stop, setStop] = useState(false);
  const [accept, setAccept] = useState(false);
  const hn = Number(hrs);
  const over = hn > 0 && (project.weekHours ?? 0) + hn > commit;
  const pct = Math.min(100, ((project.weekHours ?? 0) / commit) * 100);
  const recent = [...project.hours].reverse().slice(0, 6);
  const changeProposed = project.agreedVersion !== project.agreement.version;
  const iAccepted = vol ? project.volunteerConfirmed : project.nonprofitConfirmed;
  const started = (project.week ?? 0) > 0;
  const checklist = [['contact', 'Main contact agreed'], ['scope', 'Scope reviewed together'], ['inputs', 'Inputs and documents ready'], ['access', 'Access plan reviewed']] as const;

  return (
    <div className="space-y-5">
      <DemoNext project={project} me={me} />
      {!started && <p className="rounded-2xl bg-sage/25 p-4 text-sm">The project starts {fmtDate(project.startDate)}. Use the time to finish the kickoff checklist.</p>}
      {changeProposed && (
        <section className={`${card} border-apricot bg-apricot/15`}>
          <h2 className={h}>Change proposed</h2>
          <p className="text-sm text-plum/80">Version {project.agreement.version} was proposed by {project.agreement.editedByName}. Work continues under version {project.agreedVersion} until you both accept.</p>
          {iAccepted ? <p className="mt-3 text-sm font-semibold">You've accepted. Waiting for the other side.</p> : <Btn className="mt-3" onClick={() => setAccept(true)}>Review and accept</Btn>}
        </section>
      )}
      <Completion project={project} me={me} />

      <section className={card}>
        <h2 className={h}>Kickoff checklist</h2>
        <ul className="space-y-1">
          {checklist.map(([k, l]) => (
            <li key={k}>
              <button aria-pressed={project.kickoff[k]} disabled={pending} onClick={() => run({ action: 'kickoff', projectId: project.id, itemId: k }, { quiet: true })} className="flex min-h-11 w-full items-center gap-3 text-left text-sm">
                <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-plum text-xs ${project.kickoff[k] ? 'bg-plum text-cream' : ''}`}>{project.kickoff[k] && '✓'}</span>{l}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-plum/65">Checking these off doesn't grant anyone access. Access follows the agreement: {project.agreement.accessLevel === 'none' ? 'no system access' : 'a named, limited account set up by the nonprofit'}.</p>
      </section>

      <section className={card}>
        <h2 className={h}>This week</h2>
        <p className="font-serif text-4xl">{project.weekHours ?? 0}<span className="text-xl text-plum/60"> of {commit} hrs</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-plum/15" aria-hidden><div className="h-full rounded-full bg-apricot" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-xs text-plum/65">{project.totalHours ?? 0} hours logged so far. Hours are self-reported by the volunteer; the nonprofit confirms them at the end.</p>
        {vol ? (
          started ? (
            <div className="mt-4 space-y-3 border-t border-plum/10 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hours" name="hours">{(f) => <input {...f} name="hours" type="number" inputMode="decimal" min="0.25" max="24" step="0.25" className={inputCls} value={hrs} onChange={(e) => setHrs(e.target.value)} />}</Field>
                <Field label="Date" name="date">{(f) => <input {...f} name="date" type="date" min={project.startDate} max={today < project.endDate ? today : project.endDate} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
              </div>
              <Field label="What did you work on?" name="note" count={note} max={LIMITS.headline.max}>{(f) => <input {...f} name="note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
              {over && <p className="flex gap-2 rounded-xl bg-apricot/25 p-3 text-xs"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />That's more than the {commit} hours agreed for this week. It happens, but check in so it stays sustainable.</p>}
              <Btn disabled={pending || !(hn > 0) || !date} onClick={() => run({ action: 'log_hours', projectId: project.id, hours: hn, date, note }, { done: () => { setHrs(''); setNote(''); } })}>Log hours</Btn>
            </div>
          ) : <p className="mt-3 text-xs text-plum/65">You can log hours from the start date.</p>
        ) : <p className="mt-3 text-xs text-plum/65">Your volunteer logs hours here, so you can follow along.</p>}
        {recent.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-plum/10 pt-3 text-sm">
            {recent.map((e) => <li key={e.id} className="flex justify-between gap-3"><span className="truncate text-plum/80">{fmtDate(e.date, 'MMM d')} · {e.note || 'Work session'}</span><b>{e.hours}h</b></li>)}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className={h}>Next check-in</h2>
        {project.checkInDate && <p className="mb-3 text-sm">{fmtInstant(project.checkInDate)}{project.checkInAgenda ? ` · ${project.checkInAgenda}` : ''}</p>}
        <div className="space-y-3">
          <Field label="Date and time" name="date">{(f) => <input {...f} name="date" type="datetime-local" className={inputCls} value={ci} onChange={(e) => setCi(e.target.value)} />}</Field>
          <Field label="Agenda" name="note" count={agenda} max={LIMITS.longText.max}>{(f) => <textarea {...f} name="note" rows={2} className={inputCls} value={agenda} onChange={(e) => setAgenda(e.target.value)} />}</Field>
          <Btn v="ghost" disabled={pending || !ci} onClick={() => run({ action: 'check_in', projectId: project.id, date: new Date(ci).toISOString(), note: agenda })}>Save check-in</Btn>
        </div>
      </section>

      <section className={card}>
        <h2 className={h}>Task checklist</h2>
        <p className="mb-3 text-xs text-plum/65">Break the agreed deliverables into steps. Changing this list doesn't change the agreement.</p>
        {project.deliverables.length === 0 && <p className="mb-3 text-sm text-plum/60">No tasks yet.</p>}
        <ul className="space-y-1">
          {project.deliverables.map((d) => (
            <li key={d.id}>
              <button aria-pressed={d.done} disabled={pending} onClick={() => run({ action: 'toggle_deliverable', projectId: project.id, itemId: d.id }, { quiet: true })} className="flex min-h-11 w-full items-center gap-3 text-left text-sm">
                <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-plum text-xs ${d.done ? 'bg-plum text-cream' : ''}`}>{d.done && '✓'}</span>
                <span className={d.done ? 'text-plum/55 line-through' : ''}>{d.text}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <input aria-label="New task" name="note" maxLength={LIMITS.headline.max} className={inputCls} placeholder="Add a task" value={del} onChange={(e) => setDel(e.target.value)} />
          <Btn disabled={pending || !del.trim()} onClick={() => run({ action: 'add_deliverable', projectId: project.id, note: del.trim() }, { quiet: true, done: () => setDel('') })}>Add</Btn>
        </div>
      </section>

      <button onClick={() => setStop(true)} className="min-h-11 w-full py-2 text-sm text-plum/70 underline underline-offset-4">Stop this project</button>
      {stop && <StopSheet project={project} onClose={() => setStop(false)} />}
      {accept && <AcceptSheet project={project} side={me.kind} onClose={() => setAccept(false)} />}
    </div>
  );
}

function StopSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const { run, pending } = useAct();
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const err = textError(note, 'A short note', LIMITS.closing, true);
  return (
    <Modal title="Stop this project?" onClose={onClose}>
      <p className="mb-2 text-sm">The project stops for both of you now and the posting reopens. The other side is told. You don't need their agreement to stop.</p>
      <p className="mb-4 text-sm">If you granted any system access, remove it in that system. If something unsafe happened, use Report instead of explaining here.</p>
      <Field label="A short note for the other side" name="note" required error={tried ? err : ''} hint={`At least ${LIMITS.closing.min} characters`} count={note} max={LIMITS.closing.max}>
        {(f) => <textarea {...f} name="note" className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div className="mt-4 flex gap-3">
        <Btn v="ghost" className="flex-1" onClick={onClose}>Keep working</Btn>
        <Btn v="danger" className="flex-1" disabled={pending} onClick={() => { setTried(true); if (!err) run({ action: 'end_early', projectId: project.id, note: note.trim() }, { done: onClose }); }}>Stop project</Btn>
      </div>
    </Modal>
  );
}

function Completion({ project, me }: { project: Project; me: Profile }) {
  const vol = me.kind === 'volunteer';
  const mine = vol ? project.closing.volunteer : project.closing.nonprofit;
  const theirs = vol ? project.closing.nonprofit : project.closing.volunteer;
  const [open, setOpen] = useState(false);
  const { run, pending } = useAct();
  const [note, setNote] = useState(mine?.note ?? '');
  const [publish, setPublish] = useState(mine?.publish ?? true);
  const [unblocked, setUnblocked] = useState<'' | 'yes' | 'partly' | 'no'>(mine?.unblocked ?? '');
  const [hoursOk, setHoursOk] = useState<'' | 'yes' | 'no'>(mine?.hoursOk === undefined ? '' : mine.hoursOk ? 'yes' : 'no');
  const [tried, setTried] = useState(false);
  const errs: Record<string, string> = {};
  const e1 = textError(note, 'Your closing note', LIMITS.closing, true);
  if (e1) errs.note = e1;
  if (!vol && !unblocked) errs.unblocked = 'Choose one.';
  if (!vol && !hoursOk) errs.hoursOk = 'Choose one.';
  const submit = () => {
    setTried(true);
    if (Object.keys(errs).length) return;
    run({ action: 'complete', projectId: project.id, note: note.trim(), publish, unblocked: unblocked || undefined, hoursOk: vol ? undefined : hoursOk === 'yes' }, { done: () => setOpen(false) });
  };
  return (
    <section className={`${card} ${project.status === 'completion_pending' || project.finalWeek ? 'border-apricot bg-apricot/15' : ''}`}>
      <h2 className={h}>Finishing up</h2>
      <p className="text-sm text-plum/80">
        {project.status === 'completion_pending'
          ? mine ? 'Your closing note is in. The project completes when they add theirs.' : 'They marked the work complete. Add your closing note to finish the project.'
          : 'When the agreed deliverables are handed over, add your closing note. The project finishes only after both of you have added one.'}
      </p>
      {theirs && <p className="mt-2 text-xs text-plum/65">Their note is in. You'll see it when the project completes.</p>}
      <Btn v={project.status === 'completion_pending' && !mine ? 'primary' : 'ghost'} className="mt-3" onClick={() => setOpen(true)}>{mine ? 'Edit my closing note' : 'Add closing note'}</Btn>
      {open && (
        <Modal title="Your closing note" onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-plum/75">This records your side of the hand-off. {theirs ? 'Theirs is already in, so saving this completes the project.' : 'The project completes when the other side adds theirs too.'}</p>
          <div className="space-y-4">
            {!vol && (
              <>
                <fieldset>
                  <legend className="mb-2 font-semibold">Did this unblock you?</legend>
                  <div className="flex gap-2">
                    {(['yes', 'partly', 'no'] as const).map((v) => (
                      <label key={v} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border text-sm capitalize ${unblocked === v ? 'border-plum bg-plum text-cream' : 'border-plum/25'}`}>
                        <input type="radio" name="unblocked" className="sr-only" checked={unblocked === v} onChange={() => setUnblocked(v)} />{v}
                      </label>
                    ))}
                  </div>
                  {tried && errs.unblocked && <p className="mt-1 text-xs font-semibold text-[#8a2f25]">{errs.unblocked}</p>}
                </fieldset>
                <fieldset>
                  <legend className="mb-2 font-semibold">{project.volunteer.name} logged {project.totalHours ?? 0} hours. Do they look right?</legend>
                  <div className="flex gap-2">
                    {([['yes', 'Yes, confirm them'], ['no', 'They need a correction']] as const).map(([v, l]) => (
                      <label key={v} className={`flex min-h-11 flex-1 items-center justify-center rounded-full border px-2 text-center text-xs ${hoursOk === v ? 'border-plum bg-plum text-cream' : 'border-plum/25'}`}>
                        <input type="radio" name="hoursOk" className="sr-only" checked={hoursOk === v} onChange={() => setHoursOk(v)} />{l}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-plum/60">Unconfirmed hours stay labeled as self-reported.</p>
                  {tried && errs.hoursOk && <p className="mt-1 text-xs font-semibold text-[#8a2f25]">{errs.hoursOk}</p>}
                </fieldset>
              </>
            )}
            <Field label="Closing note" name="note" required error={tried ? errs.note : ''} hint="What got done, and what comes next." count={note} max={LIMITS.closing.max}>
              {(f) => <textarea {...f} name="note" rows={4} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <label className="flex gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
              <span>Show my note on {vol ? project.nonprofit.name : project.volunteer.name}'s probono profile, with this project's name.</span>
            </label>
            <Btn className="w-full" disabled={pending} onClick={submit}>{pending ? 'Saving…' : 'Save closing note'}</Btn>
          </div>
        </Modal>
      )}
    </section>
  );
}

function People({ project }: { project: Project }) {
  const { run, pending } = useAct();
  const [m, setM] = useState({ name: '', role: '', email: '' });
  const [l, setL] = useState({ name: '', url: '' });
  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className={h}>Team</h2>
        <ul className="space-y-2">
          {[{ id: 'v', name: project.volunteer.name, role: 'Volunteer' }, { id: 'n', name: project.nonprofit.name, role: 'Nonprofit' }, { id: 'c', name: project.agreement.nonprofitContact, role: 'Nonprofit contact' }].filter((p) => p.name).map((p) => (
            <li key={p.id} className="text-sm"><b>{p.name}</b> <span className="text-plum/60">{p.role}</span></li>
          ))}
          {project.team.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span><b>{t.name}</b> <span className="text-plum/60">{t.role}</span>{t.email && <><br /><span className="text-xs text-plum/60">{t.email}</span></>}</span>
              <button aria-label={`Remove ${t.name}`} disabled={pending} onClick={() => run({ action: 'remove_member', projectId: project.id, itemId: t.id }, { quiet: true })} className="flex h-11 w-11 items-center justify-center text-plum/55 hover:text-[#8a2f25]"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2 border-t border-plum/10 pt-4">
          <input aria-label="Name" name="name" className={inputCls} placeholder="Name" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Role" className={inputCls} placeholder="Role" value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })} />
            <input aria-label="Email" name="email" type="email" className={inputCls} placeholder="Email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} />
          </div>
          <p className="text-xs text-plum/65">This saves a private contact note, visible only to the two of you. It doesn't invite the person or give them access to anything.</p>
          <Btn v="ghost" disabled={pending || !m.name.trim()} onClick={() => run({ action: 'add_member', projectId: project.id, member: { id: '', ...m } }, { done: () => setM({ name: '', role: '', email: '' }) })}>Add person</Btn>
        </div>
      </section>
      <section className={card}>
        <h2 className={h}>Systems and links</h2>
        <p className="mb-3 text-xs text-plum/65">Point to where the work lives. Files stay in your own systems; probono only keeps the link. Adding a link here doesn't give anyone permission to open it. Never paste passwords.</p>
        <ul className="space-y-2">
          {project.links.length === 0 && <li className="text-sm text-plum/60">No links yet.</li>}
          {project.links.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={k.url} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-center gap-2 font-semibold underline underline-offset-4"><Link2 size={14} className="shrink-0" aria-hidden /><span className="truncate">{k.name}</span></a>
              <button aria-label={`Remove ${k.name}`} disabled={pending} onClick={() => run({ action: 'remove_link', projectId: project.id, itemId: k.id }, { quiet: true })} className="flex h-11 w-11 items-center justify-center text-plum/55 hover:text-[#8a2f25]"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2 border-t border-plum/10 pt-4">
          <input aria-label="Link name" name="name" className={inputCls} placeholder="Name (e.g. Budget workbook)" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
          <input aria-label="Link address" name="url" className={inputCls} placeholder="https://" value={l.url} onChange={(e) => setL({ ...l, url: e.target.value })} />
          <Btn v="ghost" disabled={pending || !l.name.trim() || !l.url.trim()} onClick={() => run({ action: 'add_link', projectId: project.id, name: l.name.trim(), url: l.url.trim() }, { done: () => setL({ name: '', url: '' }) })}>Add link</Btn>
        </div>
      </section>
    </div>
  );
}

// Read-only view for completed, passed, expired, and stopped projects.
export function ProjectSummary({ project, me }: { project: Project; me: Profile }) {
  const vol = me.kind === 'volunteer';
  const other = vol ? project.nonprofit : project.volunteer;
  const status = projectLabel(project, me.kind);
  const theirs = vol ? project.closing.nonprofit : project.closing.volunteer;
  const mine = vol ? project.closing.volunteer : project.closing.nonprofit;
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 text-plum">
      <DemoNext project={project} me={me} />
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-plum/65">{status.label}</p>
      <h1 className="font-serif text-4xl leading-none">{other.name}</h1>
      <p className="text-sm text-plum/75">{project.agreement.title}{project.endedAt ? ` · ${fmtDate(project.endedAt)}` : ''}</p>
      {project.status === 'ended_early' && project.endedReason && <p className={card}>{project.endedBy === me.id ? 'You stopped this project' : 'Stopped by the other side'}: {project.endedReason}</p>}
      {project.status === 'lapsed' && <p className={card}>The 72-hour decision window ended on {fmtInstant(project.pendingUntil)} before both sides accepted the same version.</p>}
      {project.status === 'passed' && <p className={card}>{project.endedBy === me.id ? 'You passed on this proposed project.' : 'They passed on this proposed project. Your profile stays open to others.'}</p>}
      {project.status === 'closed' && (
        <section className={card}>
          <h2 className={h}>Closing notes</h2>
          {theirs && <p className="border-l-2 border-apricot pl-3 font-serif text-lg italic">"{theirs.note}"<span className="block text-xs not-italic text-plum/60">{other.name}</span></p>}
          {mine && <p className="mt-3 border-l-2 border-plum/30 pl-3 text-sm">"{mine.note}"<span className="block text-xs text-plum/60">You</span></p>}
          <p className="mt-3 text-xs text-plum/65">{project.totalHours} hours logged{project.closing.nonprofit?.hoursOk ? ', confirmed by the nonprofit' : ', self-reported'}. {project.closing.nonprofit?.unblocked ? `Did it unblock them? ${project.closing.nonprofit.unblocked}.` : ''}</p>
        </section>
      )}
      {project.agreedVersion && (
        <section className={card}>
          <h2 className={h}>Agreement</h2>
          <AgreementView a={project.agreement} pending={false} />
          <div className="mt-4"><ExportButton project={project} /></div>
        </section>
      )}
      {project.messages.length > 0 && <Chat project={project} meId={me.id} readOnly />}
    </div>
  );
}
