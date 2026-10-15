import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AppConfig, Posting, Profile } from '@shared/types';
import { Btn, Chips, Field, Modal, inputCls } from './bits';
import { ProspectCard, termsLine } from './prospect-card';
import { PromptsEditor, TermsEditor } from './profile-editor';
import { useAct } from '@/lib/act';

export function Postings({ postings, me, config, onWork }: { postings: Posting[]; me: Profile; config?: AppConfig; onWork: (id: string) => void }) {
  const [edit, setEdit] = useState<Posting | null>(null);
  const [preview, setPreview] = useState<Posting | null>(null);
  const blank = (): Posting => ({ id: '', orgId: me.id, title: '', skills: [], terms: me.terms, prompts: { first: me.prompts.first, second: '', third: '' }, status: 'Open', notesLeft: 5 });
  return (
    <div className="space-y-4 text-plum">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-3xl">Your postings</h2>
        <Btn onClick={() => setEdit(blank())}><Plus size={16} />New</Btn>
      </div>
      {postings.length === 0 && <div className="rounded-3xl border border-dashed border-plum/30 p-8 text-center text-sm text-plum/65">No postings yet. Describe one piece of work where a few hours would change something for you.</div>}
      {postings.map((p) => (
        <div key={p.id} className="rounded-3xl border border-plum/15 bg-white/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-2xl leading-tight">{p.title}</h3>
            <span className="shrink-0 rounded-full bg-plum px-3 py-1 text-xs font-semibold text-cream">{p.status}</span>
          </div>
          <p className="mt-1 text-sm text-plum/65">{termsLine(p.terms)} · {p.notesLeft} of 5 interest notes left</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.status === 'Open' && <Btn v="ghost" className="!px-4 !py-2" onClick={() => setEdit(p)}>Edit</Btn>}
            <Btn v="ghost" className="!px-4 !py-2" onClick={() => setPreview(p)}>Volunteer view</Btn>
            <Btn className="!px-4 !py-2" onClick={() => onWork(p.id)}>Open</Btn>
          </div>
        </div>
      ))}
      {edit && <PostingForm key={edit.id || 'new'} initial={edit} config={config} onClose={() => setEdit(null)} />}
      {preview && (
        <Modal onClose={() => setPreview(null)} title="How volunteers see it">
          <div className="-mx-2 rounded-3xl bg-plum p-2">
            <ProspectCard viewer="volunteer" prospect={{ profile: me, posting: preview, interestedInYou: false, note: '' }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function PostingForm({ initial, config, onClose }: { initial: Posting; config?: AppConfig; onClose: () => void }) {
  const [d, setD] = useState(initial);
  const { run, pending } = useAct();
  const isNew = !initial.id;
  return (
    <Modal onClose={onClose} title={isNew ? 'New posting' : 'Edit posting'}>
      <div className="space-y-4">
        <Field label="Title"><input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Build our first annual budget" /></Field>
        <Field label="Skills needed"><Chips options={config?.skills ?? d.skills} value={d.skills} onChange={(skills) => setD({ ...d, skills })} /></Field>
        <TermsEditor value={d.terms} onChange={(terms) => setD({ ...d, terms })} />
        <PromptsEditor kind="nonprofit" value={d.prompts} onChange={(prompts) => setD({ ...d, prompts })} />
        <Btn className="w-full" disabled={pending || !d.title.trim() || d.skills.length === 0} onClick={() => run({ action: isNew ? 'create_posting' : 'update_posting', posting: d }, { done: onClose })}>{pending ? 'Saving...' : isNew ? 'Publish posting' : 'Save changes'}</Btn>
      </div>
    </Modal>
  );
}
