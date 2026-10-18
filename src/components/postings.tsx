import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SKILL_OPTIONS, type AppState, type Posting, type Profile } from '@shared/types';
import { LIMITS, postingErrors } from '@shared/rules';
import { Btn, Chips, ErrorSummary, Field, Modal, inputCls } from './bits';
import { ProspectCard, termsLine } from './prospect-card';
import { PromptsEditor, TermsEditor } from './profile-editor';
import { useAct } from '@/lib/act';
import { POSTING_LABEL } from '@/lib/util';

export function Postings({ state, me, onWork, onOpenProject }: { state: AppState; me: Profile; onWork: (id: string) => void; onOpenProject: (id: string) => void }) {
  const [edit, setEdit] = useState<Posting | null>(null);
  const [preview, setPreview] = useState<Posting | null>(null);
  const blank = (): Posting => ({ id: '', orgId: me.id, title: '', skills: [], terms: me.terms, prompts: { first: me.prompts.first, second: '', third: '' }, status: 'Open', notesLeft: LIMITS.interestNotesPerPosting });
  return (
    <div className="space-y-4 text-plum">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">Your postings</h2>
        <Btn onClick={() => setEdit(blank())}><Plus size={16} aria-hidden />New posting</Btn>
      </div>
      {state.reviewGate?.waiting && <p className="rounded-2xl bg-apricot/25 p-3 text-sm">Volunteers can't see your postings until the probono pilot team has reviewed your organization.</p>}
      {state.postings.length === 0 && <div className="rounded-3xl border border-dashed border-plum/35 p-8 text-center text-sm text-plum/70">No postings yet. Describe one piece of finance or accounting work where a few hours would change something for you.</div>}
      {state.postings.map((p) => (
        <div key={p.id} className="rounded-3xl border border-plum/15 bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-2xl leading-tight">{p.title}</h3>
            <span className="shrink-0 rounded-full bg-plum px-3 py-1 text-xs font-semibold text-cream">{p.visible === false && p.status === 'Open' ? 'Waiting for review' : POSTING_LABEL[p.status]}</span>
          </div>
          <p className="mt-1 text-sm text-plum/70">{termsLine(p.terms)}</p>
          <p className="mt-1 text-xs text-plum/65">{p.notesLeft} interest message{p.notesLeft === 1 ? '' : 's'} remaining for this posting. They don't reset; replying to interested volunteers is free.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.status === 'Open' && <Btn v="ghost" className="!px-4 !py-2" onClick={() => setEdit(p)}>Edit</Btn>}
            <Btn v="ghost" className="!px-4 !py-2" onClick={() => setPreview(p)}>Preview as a volunteer</Btn>
            {(() => {
              const live = state.projects.find((x) => x.posting.id === p.id && ['pending', 'active', 'completion_pending'].includes(x.status));
              return live
                ? <Btn className="!px-4 !py-2" onClick={() => onOpenProject(live.id)}>Open project</Btn>
                : p.status === 'Open' ? <Btn className="!px-4 !py-2" onClick={() => onWork(p.id)}>Find volunteers</Btn> : null;
            })()}
          </div>
          {p.status !== 'Open' && p.status !== 'Complete' && <p className="mt-2 text-xs text-plum/60">Editing is locked while a project is proposed or in progress. The agreed scope lives on the project.</p>}
        </div>
      ))}
      {edit && <PostingForm key={edit.id || 'new'} initial={edit} onClose={() => setEdit(null)} />}
      {preview && (
        <Modal onClose={() => setPreview(null)} title="How volunteers see it">
          <div className="-mx-2 rounded-3xl bg-plum p-2">
            <ProspectCard preview viewer="volunteer" prospect={{ profile: me, posting: preview, interestedInYou: false, note: '' }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function PostingForm({ initial, onClose }: { initial: Posting; onClose: () => void }) {
  const [d, setD] = useState(initial);
  const [tried, setTried] = useState(false);
  const { run, pending } = useAct();
  const isNew = !initial.id;
  const errs = postingErrors(d);
  const shown = tried ? errs : {};
  const missing = [!d.title.trim() && 'a title', !d.skills.length && 'at least one skill'].filter(Boolean);
  const submit = () => {
    setTried(true);
    if (Object.keys(errs).length) return;
    run({ action: isNew ? 'create_posting' : 'update_posting', posting: d }, { done: onClose });
  };
  return (
    <Modal onClose={onClose} title={isNew ? 'New posting' : 'Edit posting'}>
      <div className="space-y-4">
        <ErrorSummary errors={shown} />
        <Field label="Title" name="title" required error={shown.title} count={d.title} max={LIMITS.title.max} hint={`${LIMITS.title.min} to ${LIMITS.title.max} characters`}>
          {(f) => <input {...f} name="title" className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Build our first annual budget" />}
        </Field>
        <Field label="Done when" name="doneWhen" error={shown.doneWhen} count={d.doneWhen ?? ''} max={LIMITS.headline.max}>
          {(f) => <input {...f} name="doneWhen" className={inputCls} value={d.doneWhen ?? ''} onChange={(e) => setD({ ...d, doneWhen: e.target.value })} placeholder="e.g. Our director updates the budget alone next quarter" />}
        </Field>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-plum/65">Skills needed <span className="normal-case tracking-normal text-plum/50">(required)</span></p>
          <Chips label="Skills needed" options={SKILL_OPTIONS} value={d.skills} onChange={(skills) => setD({ ...d, skills })} />
          {shown.skills && <p className="mt-1 text-xs font-semibold text-[#8a2f25]">{shown.skills}</p>}
        </div>
        <TermsEditor kind="posting" value={d.terms} onChange={(terms) => setD({ ...d, terms })} errors={shown} />
        <PromptsEditor kind="nonprofit" value={d.prompts} onChange={(prompts) => setD({ ...d, prompts })} errors={shown} />
        {!isNew && <p className="text-xs text-plum/65">Volunteers who already showed interest stay attached after you edit.</p>}
        <p className="text-xs text-plum/70" aria-live="polite">{missing.length ? `Add ${missing.join(' and ')} to publish.` : 'Ready to publish.'}</p>
        <Btn className="w-full" disabled={pending} onClick={submit}>{pending ? 'Saving…' : isNew ? 'Publish posting' : 'Save changes'}</Btn>
      </div>
    </Modal>
  );
}
