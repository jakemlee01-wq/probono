import { useState } from 'react';
import { AlertTriangle, FastForward, Link2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Profile, Project } from '@shared/types';
import { Btn, Modal, Field, inputCls } from './bits';
import { Chat } from './chat';
import { useAct } from '@/lib/act';
import { fmtDate } from '@/lib/util';

const card = 'rounded-3xl border border-plum/15 bg-white/50 p-5';
const h = 'mb-3 font-serif text-2xl';

export function Workspace({ project, me, demo }: { project: Project; me: Profile; demo: boolean }) {
  const [tab, setTab] = useState<'project' | 'messages' | 'people'>('project');
  const vol = me.kind === 'volunteer';
  const other = vol ? project.nonprofit : project.volunteer;
  const total = project.posting.terms.weeks || 1;
  const week = Math.min(project.week, total);
  const tabs = [['project', 'Project'], ['messages', 'Messages'], ['people', 'People & links']] as const;
  return (
    <div className="mx-auto w-full max-w-lg space-y-5 text-plum">
      <div className="-mx-4 -mt-2 rounded-b-[2rem] bg-plum px-5 pb-5 pt-3 text-cream">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cream/60">Partnership</p>
        <h1 className="mt-1 font-serif text-4xl leading-none">{other.name}</h1>
        <p className="mt-1 text-sm text-cream/75">{project.posting.title} · ends {fmtDate(project.endDate)}</p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-semibold"><span>Week {week} of {total}</span><span>{project.status === 'wrapping_up' ? 'Final week' : `${Math.round((week / total) * 100)}%`}</span></div>
          <div className="flex gap-1">{Array.from({ length: total }, (_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < week ? 'bg-cream' : 'bg-cream/25'}`} />)}</div>
        </div>
      </div>
      <div className="flex rounded-full bg-plum/10 p-1">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`min-h-10 flex-1 rounded-full py-2 text-xs font-semibold transition ${tab === k ? 'bg-plum text-cream' : 'text-plum/70'}`}>{l}</button>
        ))}
      </div>
      {tab === 'project' && <ProjectTab project={project} me={me} demo={demo} />}
      {tab === 'messages' && <Chat project={project} meId={me.id} />}
      {tab === 'people' && <People project={project} />}
    </div>
  );
}

function ProjectTab({ project, me, demo }: { project: Project; me: Profile; demo: boolean }) {
  const { run, pending } = useAct();
  const vol = me.kind === 'volunteer';
  const commit = project.posting.terms.hoursPerWeek;
  const [hrs, setHrs] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const toLocal = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : format(d, "yyyy-MM-dd'T'HH:mm"); };
  const [ci, setCi] = useState(toLocal(project.checkInDate));
  const [agenda, setAgenda] = useState(project.checkInAgenda);
  const [del, setDel] = useState('');
  const [early, setEarly] = useState(false);
  const [earlyNote, setEarlyNote] = useState('');
  const myNote = vol ? project.volunteerClosingNote : project.nonprofitClosingNote;
  const theirNote = vol ? project.nonprofitClosingNote : project.volunteerClosingNote;
  const [closing, setClosing] = useState(myNote);
  const final = project.status === 'wrapping_up';
  const hn = Number(hrs);
  const over = hn > 0 && project.weekHours + hn > commit;
  const pct = Math.min(100, (project.weekHours / commit) * 100);
  const recent = [...project.hours].reverse().slice(0, 6);

  return (
    <div className="space-y-5">
      {final && (
        <section className={`${card} border-apricot bg-apricot/15`}>
          <h2 className={h}>Time to hand it off</h2>
          <p className="mb-3 text-sm text-plum/75">This is the final week. Each of you leaves a short closing note. The project closes after the end date once both notes are in, and each note goes on the other side's track record.</p>
          <p className="mb-3 text-xs font-semibold">{project.volunteerClosingNote ? 'Volunteer note: in' : 'Volunteer note: waiting'} · {project.nonprofitClosingNote ? 'Nonprofit note: in' : 'Nonprofit note: waiting'}</p>
          <textarea aria-label="Closing note" rows={4} className={inputCls} value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="What got done, what you learned, what comes next" />
          <Btn className="mt-3" disabled={pending || closing.trim().length < 10} onClick={() => run({ action: 'close', projectId: project.id, note: closing.trim() })}>{myNote ? 'Update my note' : 'Submit my note'}</Btn>
          {theirNote && <p className="mt-3 text-xs text-plum/60">Their note is in. You'll see it when the project closes.</p>}
        </section>
      )}

      <section className={card}>
        <h2 className={h}>This week</h2>
        <p className="font-serif text-4xl">{project.weekHours}<span className="text-xl text-plum/55"> of {commit} hrs</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-plum/15"><div className="h-full rounded-full bg-apricot" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-xs text-plum/60">{project.totalHours} hours given across the whole project</p>
        {vol ? (
          <div className="mt-4 space-y-3 border-t border-plum/10 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hours"><input type="number" inputMode="decimal" min="0" step="0.25" className={inputCls} value={hrs} onChange={(e) => setHrs(e.target.value)} /></Field>
              <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            </div>
            <Field label="What did you work on?"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {over && <p className="flex gap-2 rounded-xl bg-apricot/25 p-3 text-xs"><AlertTriangle size={14} className="mt-0.5 shrink-0" />That's more than the {commit} hours you agreed to this week. It happens, but check in with them so it stays sustainable.</p>}
            <Btn disabled={pending || !(hn > 0) || !date} onClick={() => run({ action: 'log_hours', projectId: project.id, hours: hn, date, note }, { done: () => { setHrs(''); setNote(''); } })}>Log hours</Btn>
          </div>
        ) : <p className="mt-3 text-xs text-plum/60">Your volunteer logs hours here, so you can follow along.</p>}
        {recent.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-plum/10 pt-3 text-sm">
            {recent.map((e) => <li key={e.id} className="flex justify-between gap-3"><span className="truncate text-plum/75">{fmtDate(e.date, 'MMM d')} · {e.note || 'Work session'}</span><b>{e.hours}h</b></li>)}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className={h}>Next check-in</h2>
        {project.checkInDate && <p className="mb-3 text-sm">{fmtDate(project.checkInDate, 'EEE, MMM d · h:mm a')}{project.checkInAgenda ? ` · ${project.checkInAgenda}` : ''}</p>}
        <div className="space-y-3">
          <Field label="Date and time"><input type="datetime-local" className={inputCls} value={ci} onChange={(e) => setCi(e.target.value)} /></Field>
          <Field label="Agenda"><textarea rows={2} className={inputCls} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></Field>
          <Btn v="ghost" disabled={pending || !ci} onClick={() => run({ action: 'check_in', projectId: project.id, date: new Date(ci).toISOString(), note: agenda })}>Save check-in</Btn>
        </div>
      </section>

      <section className={card}>
        <h2 className={h}>What we're delivering</h2>
        {project.deliverables.length === 0 && <p className="mb-3 text-sm text-plum/55">Nothing listed yet. Add the first thing you're working toward.</p>}
        <ul className="space-y-1">
          {project.deliverables.map((d) => (
            <li key={d.id}>
              <button aria-pressed={d.done} disabled={pending} onClick={() => run({ action: 'toggle_deliverable', projectId: project.id, itemId: d.id }, { quiet: true })} className="flex min-h-11 w-full items-center gap-3 text-left text-sm">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-plum text-xs ${d.done ? 'bg-plum text-cream' : ''}`}>{d.done && '✓'}</span>
                <span className={d.done ? 'text-plum/45 line-through' : ''}>{d.text}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <input aria-label="New deliverable" className={inputCls} placeholder="Add a deliverable" value={del} onChange={(e) => setDel(e.target.value)} />
          <Btn disabled={pending || !del.trim()} onClick={() => run({ action: 'add_deliverable', projectId: project.id, note: del.trim() }, { quiet: true, done: () => setDel('') })}>Add</Btn>
        </div>
      </section>

      {demo && (
        <section className="rounded-3xl border border-dashed border-plum/30 p-4 text-sm">
          <p className="font-semibold">Demo only</p>
          <p className="mt-1 text-plum/65">Move the project forward a week to try the hand-off and closing notes without waiting.</p>
          <Btn v="ghost" className="mt-3" disabled={pending} onClick={() => run({ action: 'demo_advance_week', projectId: project.id })}><FastForward size={16} />Skip ahead a week</Btn>
        </section>
      )}

      <button onClick={() => setEarly(true)} className="min-h-11 w-full py-2 text-sm text-plum/60 underline underline-offset-4">End this project early</button>
      {early && (
        <Modal title="End early?" onClose={() => setEarly(false)}>
          <p className="mb-4">The project ends for both of you now, and the posting reopens. Completed-project totals won't change.</p>
          <Field label="A short note for the other side" hint="At least 10 characters">
            <textarea className={inputCls} rows={3} value={earlyNote} onChange={(e) => setEarlyNote(e.target.value)} />
          </Field>
          <div className="mt-4 flex gap-3">
            <Btn v="ghost" onClick={() => setEarly(false)}>Keep working</Btn>
            <Btn v="danger" disabled={pending || earlyNote.trim().length < 10} onClick={() => run({ action: 'end_early', projectId: project.id, note: earlyNote.trim() }, { done: () => setEarly(false) })}>End project</Btn>
          </div>
        </Modal>
      )}
    </div>
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
          {[{ id: 'v', name: project.volunteer.name, role: 'Volunteer' }, { id: 'n', name: project.nonprofit.name, role: 'Nonprofit' }].map((p) => (
            <li key={p.id} className="text-sm"><b>{p.name}</b> <span className="text-plum/55">{p.role}</span></li>
          ))}
          {project.team.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
              <span><b>{t.name}</b> <span className="text-plum/55">{t.role}</span>{t.email && <><br /><span className="text-xs text-plum/55">{t.email}</span></>}</span>
              <button aria-label={`Remove ${t.name}`} disabled={pending} onClick={() => run({ action: 'remove_member', projectId: project.id, itemId: t.id }, { quiet: true })} className="p-2 text-plum/50 hover:text-[#8a2f25]"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2 border-t border-plum/10 pt-4">
          <input aria-label="Name" className={inputCls} placeholder="Name" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Role" className={inputCls} placeholder="Role" value={m.role} onChange={(e) => setM({ ...m, role: e.target.value })} />
            <input aria-label="Email" type="email" className={inputCls} placeholder="Email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} />
          </div>
          <Btn v="ghost" disabled={pending || !m.name.trim()} onClick={() => run({ action: 'add_member', projectId: project.id, member: { id: '', ...m } }, { done: () => setM({ name: '', role: '', email: '' }) })}>Add team member</Btn>
        </div>
      </section>
      <section className={card}>
        <h2 className={h}>Systems and links</h2>
        <p className="mb-3 text-xs text-plum/60">Point to where the work lives. Files stay in your own systems; probono only keeps the links.</p>
        <ul className="space-y-2">
          {project.links.length === 0 && <li className="text-sm text-plum/55">No links yet.</li>}
          {project.links.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 text-sm">
              <a href={k.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-semibold underline underline-offset-4"><Link2 size={14} className="shrink-0" /><span className="truncate">{k.name}</span></a>
              <button aria-label={`Remove ${k.name}`} disabled={pending} onClick={() => run({ action: 'remove_link', projectId: project.id, itemId: k.id }, { quiet: true })} className="p-2 text-plum/50 hover:text-[#8a2f25]"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2 border-t border-plum/10 pt-4">
          <input aria-label="Link name" className={inputCls} placeholder="Name (e.g. Budget workbook)" value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
          <input aria-label="Link address" className={inputCls} placeholder="https://" value={l.url} onChange={(e) => setL({ ...l, url: e.target.value })} />
          <Btn v="ghost" disabled={pending || !l.name.trim() || !/^https?:\/\//.test(l.url)} onClick={() => run({ action: 'add_link', projectId: project.id, name: l.name.trim(), url: l.url.trim() }, { done: () => setL({ name: '', url: '' }) })}>Add link</Btn>
        </div>
      </section>
    </div>
  );
}
