import { useState } from 'react';
import { Flag } from 'lucide-react';
import { REPORT_CATEGORIES, type ReportCategory } from '@shared/types';
import { LIMITS } from '@shared/rules';
import { Btn, Field, Modal, inputCls } from './bits';
import { useAct } from '@/lib/act';

// One entry point for both actions. Reporting doesn't force blocking, and vice versa.
export function SafetyButton({ targetId, targetName, postingId, projectId, tone = 'light' }: { targetId: string; targetName: string; postingId?: string; projectId?: string; tone?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={`inline-flex min-h-11 items-center gap-1.5 px-2 text-xs font-semibold underline underline-offset-4 ${tone === 'dark' ? 'text-white/75' : 'text-plum/65'}`}>
        <Flag size={14} aria-hidden />Report or block
      </button>
      {open && <SafetySheet targetId={targetId} targetName={targetName} postingId={postingId} projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

function SafetySheet({ targetId, targetName, postingId, projectId, onClose }: { targetId: string; targetName: string; postingId?: string; projectId?: string; onClose: () => void }) {
  const [mode, setMode] = useState<'choose' | 'report' | 'block'>('choose');
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const { run, pending } = useAct();
  if (mode === 'choose') {
    return (
      <Modal title={`${targetName}`} onClose={onClose}>
        <div className="space-y-3">
          <Btn v="ghost" className="w-full" onClick={() => setMode('report')}>Report a problem</Btn>
          <Btn v="ghost" className="w-full" onClick={() => setMode('block')}>Block {targetName}</Btn>
          <p className="text-xs text-plum/65">Never share passwords, bank details, or full financial records in chat. Use your organization's own secure sharing and named accounts.</p>
        </div>
      </Modal>
    );
  }
  if (mode === 'block') {
    return (
      <Modal title={`Block ${targetName}?`} onClose={onClose}>
        <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-plum/80">
          <li>You won't see each other in discovery.</li>
          <li>Neither of you can send interest or messages.</li>
          <li>Any proposed or active project between you stops now. Past messages stay readable to each of you.</li>
          <li>If you gave them access to any system, remove it in that system.</li>
        </ul>
        <div className="flex gap-3">
          <Btn v="ghost" className="flex-1" onClick={onClose}>Cancel</Btn>
          <Btn v="danger" className="flex-1" disabled={pending} onClick={() => run({ action: 'block', targetId }, { done: onClose })}>Block</Btn>
        </div>
      </Modal>
    );
  }
  const err = tried && !category ? 'Choose what happened.' : '';
  return (
    <Modal title="Report a problem" onClose={onClose}>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-plum/75">What happened with {targetName}?</legend>
        {REPORT_CATEGORIES.map((c) => (
          <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-plum/15 px-3 text-sm">
            <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} aria-describedby={err ? 'cat-err' : undefined} />{c.label}
          </label>
        ))}
        {err && <p id="cat-err" className="text-xs font-semibold text-[#8a2f25]">{err}</p>}
      </fieldset>
      <div className="mt-4">
        <Field label="Details (optional)" hint="Don't include passwords or account numbers." count={note} max={LIMITS.longText.max}>
          {(p) => <textarea {...p} rows={3} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
      <p className="mt-3 text-xs text-plum/65">Reports are private: {targetName} can't see them. probono doesn't yet promise a response time.</p>
      <Btn className="mt-4 w-full" disabled={pending} onClick={() => { setTried(true); if (category) run({ action: 'report', targetId, postingId, projectId, category, note }, { done: onClose }); }}>Send report</Btn>
    </Modal>
  );
}
