import { useState } from 'react';
import { Download } from 'lucide-react';
import { ACCESS_LEVELS, FORMATS, type Agreement, type AgreementFields, type Kind, type Project } from '@shared/types';
import { AGREEMENT_LABELS, agreementErrors, LIMITS } from '@shared/rules';
import { Btn, ErrorSummary, Field, Modal, inputCls } from './bits';
import { useAct } from '@/lib/act';
import { useConfig } from '@/lib/api';
import { fmtDate, fmtInstant } from '@/lib/util';

export const LICENSING = 'Volunteering through probono does not create a professional engagement, does not make the volunteer your accountant of record, and does not authorize regulated work such as signing tax returns or issuing audit opinions. Credentials shown in profiles are self-reported unless a badge says they were reviewed.';
export const ACCOUNTING_CAUTION = 'For finance work: no passwords, bank details, or full account numbers in chat. Use named accounts with the least access the work needs. The volunteer should not move money or change posted records unless your own approval process says so.';

const accessLabel = (id: string) => ACCESS_LEVELS.find((a) => a.id === id)?.label ?? id;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-plum/10 py-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-plum/60">{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-wrap text-sm ${value ? '' : 'italic text-plum/45'}`}>{value || 'Not filled in yet'}</dd>
    </div>
  );
}

export function AgreementView({ a, minStart, pending }: { a: Agreement; minStart?: string; pending: boolean }) {
  const startNote = pending && minStart && a.proposedStart < minStart ? ' (Start date needs agreement: too early)' : pending ? ' (proposed)' : '';
  return (
    <dl>
      <Row label={AGREEMENT_LABELS.title} value={a.title} />
      <Row label={AGREEMENT_LABELS.nonprofitContact} value={a.nonprofitContact} />
      <Row label={AGREEMENT_LABELS.problem} value={a.problem} />
      <Row label={AGREEMENT_LABELS.outcome} value={a.outcome} />
      <Row label={AGREEMENT_LABELS.deliverables} value={a.deliverables} />
      <Row label={AGREEMENT_LABELS.acceptance} value={a.acceptance} />
      <Row label={AGREEMENT_LABELS.inScope} value={a.inScope} />
      <Row label={AGREEMENT_LABELS.exclusions} value={a.exclusions} />
      <Row label={AGREEMENT_LABELS.inputs} value={a.inputs} />
      <Row label="Time" value={`${a.hoursPerWeek} hrs/wk for ${a.weeks} weeks · ${a.format} · starts ${fmtDate(a.proposedStart)}${startNote}`} />
      <Row label={AGREEMENT_LABELS.accessLevel} value={accessLabel(a.accessLevel) + (a.accessLevel === 'none' ? '' : `\nSystems: ${a.accessSystems}\nGranted by: ${a.accessGrantedBy}\nRemoved at the end by: ${a.accessRemovedBy}`)} />
      {a.accessLevel === 'none' && a.accessSystems && <Row label={AGREEMENT_LABELS.accessSystems} value={a.accessSystems} />}
      <Row label={AGREEMENT_LABELS.checkInPlan} value={a.checkInPlan} />
    </dl>
  );
}

export function exportAgreement(p: Project) {
  const a = p.agreement;
  const lines = [
    `probono work agreement, version ${a.version}`,
    `${p.nonprofit.name} and ${p.volunteer.name}`, '',
    ...(Object.keys(AGREEMENT_LABELS) as (keyof AgreementFields)[]).map((k) => `${AGREEMENT_LABELS[k]}: ${a[k] ?? ''}`), '',
    'Acceptances:',
    ...(p.acceptances.length ? p.acceptances.map((x) => `  ${x.actorName} (${x.side}) accepted version ${x.version} on ${fmtInstant(x.at)}`) : ['  none yet']),
    '', `Earlier versions: ${p.agreementHistory.length}`, '', LICENSING,
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `probono-agreement-v${a.version}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButton({ project }: { project: Project }) {
  return <Btn v="ghost" onClick={() => exportAgreement(project)}><Download size={16} aria-hidden />Download agreement</Btn>;
}

const TEXT: { k: keyof AgreementFields; hint: string; rows?: number }[] = [
  { k: 'title', hint: '', rows: 1 },
  { k: 'nonprofitContact', hint: 'The person at the nonprofit who answers questions and approves the work.', rows: 1 },
  { k: 'problem', hint: 'In plain words, what is stuck today.' },
  { k: 'outcome', hint: 'What should be true when this is done.' },
  { k: 'deliverables', hint: 'What will be handed over: files, reports, a guide, a walkthrough.' },
  { k: 'acceptance', hint: 'How the nonprofit will judge that it is complete.' },
  { k: 'inScope', hint: 'The work included.' },
  { k: 'exclusions', hint: 'Work that is not included, so nobody is surprised.' },
  { k: 'inputs', hint: 'Documents, exports, or time the nonprofit provides.' },
  { k: 'checkInPlan', hint: 'For example: a 30-minute call every Tuesday. Either side can stop or change the project here.' },
];

export function AgreementEditor({ project, onClose }: { project: Project; onClose: () => void }) {
  const active = project.status !== 'pending';
  const [d, setD] = useState<AgreementFields>(() => {
    const { version: _v, editedBy: _b, editedByName: _n, editedAt: _a, ...f } = project.agreement;
    return f;
  });
  const [tried, setTried] = useState(false);
  const { run, pending } = useAct();
  const all = agreementErrors(d, active ? '0000-00-00' : project.minStart ?? '');
  // While drafting, only show problems other than "still empty" until they try to finish.
  const shown = tried ? all : Object.fromEntries(Object.entries(all).filter(([, m]) => !m.startsWith('Add ')));
  const set = <K extends keyof AgreementFields>(k: K, v: AgreementFields[K]) => setD({ ...d, [k]: v });
  const save = () => {
    // A pending draft may be saved incomplete; an active change must be complete.
    const blocking = active ? Object.keys(all) : Object.entries(all).filter(([k, m]) => !m.startsWith('Add ') && !(k === 'proposedStart' && !d.proposedStart));
    if (blocking.length) { setTried(true); return; }
    run({ action: 'edit_agreement', projectId: project.id, agreement: d }, { done: onClose });
  };
  return (
    <Modal title={active ? 'Propose a change' : 'Edit the work agreement'} onClose={onClose}>
      <p className="mb-4 text-sm text-plum/75">
        {active ? 'Work continues under the agreed version until you both accept the change. The start date stays as agreed.'
          : `Saving creates version ${project.agreement.version + 1}. Any earlier acceptance stops counting, and you both review the new version. You can save a partial draft.`}
      </p>
      <div className="space-y-4">
        <ErrorSummary errors={tried ? all : {}} labels={AGREEMENT_LABELS} />
        {TEXT.map(({ k, hint, rows }) => (
          <Field key={k} name={k} label={AGREEMENT_LABELS[k]} hint={hint || undefined} error={shown[k]} count={String(d[k])} max={k === 'title' ? LIMITS.title.max : k === 'nonprofitContact' ? LIMITS.name.max : LIMITS.longText.max} required>
            {(f) => rows === 1
              ? <input {...f} name={k} className={inputCls} value={String(d[k])} onChange={(e) => set(k, e.target.value as never)} />
              : <textarea {...f} name={k} rows={3} className={inputCls} value={String(d[k])} onChange={(e) => set(k, e.target.value as never)} />}
          </Field>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hours per week" name="hoursPerWeek" error={shown.hoursPerWeek} required>
            {(f) => <input {...f} name="hoursPerWeek" type="number" inputMode="numeric" min={1} max={40} step={1} className={inputCls} value={d.hoursPerWeek} onChange={(e) => set('hoursPerWeek', e.target.value === '' ? ('' as never) : Number(e.target.value))} />}
          </Field>
          <Field label="Weeks" name="weeks" error={shown.weeks} required>
            {(f) => <input {...f} name="weeks" type="number" inputMode="numeric" min={1} max={52} step={1} className={inputCls} value={d.weeks} onChange={(e) => set('weeks', e.target.value === '' ? ('' as never) : Number(e.target.value))} />}
          </Field>
          <Field label="Working location" name="format" error={shown.format} required>
            {(f) => <select {...f} name="format" className={inputCls} value={d.format} onChange={(e) => set('format', e.target.value as AgreementFields['format'])}>{FORMATS.map((x) => <option key={x}>{x}</option>)}</select>}
          </Field>
          <Field label={active ? 'Start date (agreed)' : 'Proposed start'} name="proposedStart" error={shown.proposedStart} hint={active ? undefined : `${fmtDate(project.minStart ?? '')} or later`} required>
            {(f) => <input {...f} name="proposedStart" type="date" disabled={active} min={project.minStart} className={inputCls} value={d.proposedStart} onChange={(e) => set('proposedStart', e.target.value)} />}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-plum/65">{AGREEMENT_LABELS.accessLevel} (required)</legend>
          <div className="space-y-2">
            {ACCESS_LEVELS.map((x) => (
              <label key={x.id} className={`flex gap-3 rounded-xl border p-3 text-sm ${d.accessLevel === x.id ? 'border-plum bg-plum/5' : 'border-plum/15'}`}>
                <input type="radio" name="accessLevel" className="mt-1" checked={d.accessLevel === x.id} onChange={() => set('accessLevel', x.id)} />
                <span><b>{x.label}</b><span className="block text-xs text-plum/65">{x.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={AGREEMENT_LABELS.accessSystems} name="accessSystems" error={shown.accessSystems} hint="Which systems or files are involved, even with no access." required={d.accessLevel !== 'none'}>
          {(f) => <textarea {...f} name="accessSystems" rows={2} className={inputCls} value={d.accessSystems} onChange={(e) => set('accessSystems', e.target.value)} />}
        </Field>
        {d.accessLevel !== 'none' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={AGREEMENT_LABELS.accessGrantedBy} name="accessGrantedBy" error={shown.accessGrantedBy} required>
              {(f) => <input {...f} name="accessGrantedBy" className={inputCls} value={d.accessGrantedBy} onChange={(e) => set('accessGrantedBy', e.target.value)} />}
            </Field>
            <Field label={AGREEMENT_LABELS.accessRemovedBy} name="accessRemovedBy" error={shown.accessRemovedBy} required>
              {(f) => <input {...f} name="accessRemovedBy" className={inputCls} value={d.accessRemovedBy} onChange={(e) => set('accessRemovedBy', e.target.value)} />}
            </Field>
          </div>
        )}
        <p className="rounded-2xl bg-apricot/20 p-3 text-xs">{ACCOUNTING_CAUTION}</p>
        <Btn className="w-full" disabled={pending} onClick={save}>{pending ? 'Saving…' : active ? 'Propose this change' : 'Save agreement'}</Btn>
      </div>
    </Modal>
  );
}

export function AcceptSheet({ project, side, onClose }: { project: Project; side: Kind; onClose: () => void }) {
  const [conf, setConf] = useState(false);
  const [lic, setLic] = useState(false);
  const [tried, setTried] = useState(false);
  const { run, pending } = useAct();
  const cfg = useConfig();
  const a = project.agreement;
  const go = () => {
    setTried(true);
    if (!conf || !lic) return;
    run({ action: 'confirm', projectId: project.id, version: a.version, confidentiality: true, licensing: true }, { done: onClose });
  };
  return (
    <Modal title={`Accept version ${a.version}`} onClose={onClose}>
      <p className="mb-3 text-sm text-plum/75">This is exactly what {side === 'volunteer' ? project.nonprofit.name : project.volunteer.name} sees. Accepting agrees to the work described, not to unrestricted access to any system.</p>
      <div className="rounded-2xl border border-plum/15 bg-white/50 px-4"><AgreementView a={a} minStart={project.minStart} pending={project.status === 'pending'} /></div>
      <p className="mt-4 rounded-2xl bg-apricot/20 p-3 text-xs">{ACCOUNTING_CAUTION}</p>
      <div className="mt-4 space-y-3 text-sm">
        <label className="flex gap-3">
          <input type="checkbox" name="confidentiality" checked={conf} onChange={(e) => setConf(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" aria-describedby={tried && !conf ? 'conf-err' : undefined} />
          <span>I'll keep the other side's information confidential, use it only for this project, and return or delete it when the project ends.
            {' '}{cfg.data?.policiesPublished ? 'See the data-handling policy in About.' : "probono's full data-handling policy isn't published yet, so this pilot acknowledgment is not a complete legal agreement."}</span>
        </label>
        {tried && !conf && <p id="conf-err" className="text-xs font-semibold text-[#8a2f25]">Please confirm this to continue.</p>}
        <label className="flex gap-3">
          <input type="checkbox" name="licensing" checked={lic} onChange={(e) => setLic(e.target.checked)} className="mt-1 h-5 w-5 shrink-0" aria-describedby={tried && !lic ? 'lic-err' : undefined} />
          <span>{LICENSING}</span>
        </label>
        {tried && !lic && <p id="lic-err" className="text-xs font-semibold text-[#8a2f25]">Please confirm this to continue.</p>}
      </div>
      <Btn className="mt-5 w-full" disabled={pending} onClick={go}>{pending ? 'Saving…' : `Accept version ${a.version}`}</Btn>
    </Modal>
  );
}
