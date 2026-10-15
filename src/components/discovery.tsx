import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AppState, Profile } from '@shared/types';
import { LIMITS, textError } from '@shared/rules';
import { ProspectCard } from './prospect-card';
import { Btn, Field, Modal, inputCls } from './bits';
import { HowItWorks } from './how';
import { useAct } from '@/lib/act';

export function Discovery({ state, me, postingId, goProfile, goProject }: { state: AppState; me: Profile; postingId?: string; goProfile: () => void; goProject: (id: string) => void }) {
  const { run, pending } = useAct();
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [browse, setBrowse] = useState(0);
  const isNp = me.kind === 'nonprofit';
  const posting = isNp ? state.postings.find((x) => x.id === postingId) : undefined;
  const full = state.capacity.full;

  if (isNp && state.reviewGate?.waiting)
    return <Empty title="Waiting for review" body={`Before volunteers can see your postings, the probono pilot team reviews your organization (status: ${state.reviewGate.status.replace('_', ' ')}). You can write postings now. There's no set review time yet.`} cta="Write a posting" onCta={goProfile} />;
  if (isNp && state.postings.length === 0)
    return <Empty title="Post your first need" body="Describe one piece of finance or accounting work where a few volunteer hours would help. Volunteers who fit will show up here." cta="Write a posting" onCta={goProfile} />;
  if (me.paused)
    return <Empty title="Your profile is paused" body="You're hidden from discovery and can't receive new interest. Current projects continue as normal." cta="Go to profile" onCta={goProfile} />;
  const list = state.prospects;
  const p = list[full ? browse % Math.max(1, list.length) : 0];
  if (!p && full)
    return <Empty title="Nothing else to browse right now" body={state.capacity.reason} cta="Go to project" onCta={() => goProject(state.capacity.projectId!)} />;
  if (!p)
    return <Empty title={isNp ? 'No matching volunteers yet' : 'No matching projects yet'} body={isNp ? "Nobody in the pilot fits this posting right now. Widening the skills or terms can help." : "Nothing in the pilot fits your skills and terms right now. New postings show up here as they're reviewed."} cta={isNp ? 'Edit postings' : 'Review my terms'} onCta={goProfile} />;

  const ids = { postingId: p.posting.id, volunteerId: isNp ? p.profile.id : me.id };
  const free = p.interestedInYou;
  const needsNote = isNp && !free;
  const notesLeft = posting?.notesLeft ?? 0;
  const noteErr = textError(note, 'Your message', needsNote ? LIMITS.note : LIMITS.optionalNote, needsNote);
  const first = p.profile.name.split(' ')[0];
  const send = () => {
    setTried(true);
    if (noteErr) return;
    run({ action: 'interest', ...ids, note: note.trim() }, { quiet: free, done: () => { setSheet(false); setNote(''); setTried(false); } });
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <HowItWorks kind={me.kind} tone="dark" />
        {isNp && posting && <span className="text-xs text-white/75">{notesLeft} interest message{notesLeft === 1 ? '' : 's'} remaining for this posting</span>}
      </div>
      <ProspectCard key={p.profile.id + p.posting.id} prospect={p} viewer={isNp ? 'nonprofit' : 'volunteer'} readOnly={full ? state.capacity.reason : undefined} />
      {/* In the page flow and sticky, so it reserves its own space and never covers the card. */}
      <div className="pb-safe sticky bottom-16 z-20 -mx-4 mt-3 bg-gradient-to-t from-plum via-plum to-plum/0 px-4 pb-3 pt-4">
        {full ? (
          <div className="mx-auto max-w-md rounded-3xl border border-white/25 bg-plum2 p-3 text-center">
            <p className="text-xs text-white/85">You're browsing. {state.capacity.reason}</p>
            <div className="mt-2 flex gap-2">
              <Btn v="ghost" className="flex-1 text-white" disabled={list.length < 2} onClick={() => setBrowse((b) => b + 1)}>Next</Btn>
              <Btn v="light" className="flex-1" onClick={() => goProject(state.capacity.projectId!)}>Go to project</Btn>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-md overflow-hidden rounded-full border border-white/25 bg-plum2">
            <button disabled={pending} onClick={() => run({ action: 'not_now', ...ids }, { quiet: true })} className="min-h-12 flex-1 py-4 text-sm font-semibold text-white/85 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-apricot disabled:opacity-50">Not now</button>
            <div className="w-px bg-white/25" />
            <button disabled={pending} onClick={() => setSheet(true)} className="flex min-h-12 flex-1 items-center justify-center gap-2 bg-white py-4 text-sm font-semibold text-plum hover:bg-cream focus-visible:outline-2 focus-visible:outline-apricot disabled:opacity-50">
              <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-plum"><Plus size={12} /></span>Show interest
            </button>
          </div>
        )}
      </div>
      {sheet && (
        <Modal onClose={() => setSheet(false)} title={`Show interest in ${first}`}>
          <p className="mb-3 text-sm text-plum/75">
            {free
              ? `${first} is already interested, so this makes it mutual. You'll then have 72 hours to agree a work agreement together. Replying doesn't use an interest message.`
              : isNp
                ? `Say why this looks like a fit. At least ${LIMITS.note.min} characters. This uses 1 of the ${notesLeft} interest messages remaining for this posting; they don't reset.`
                : 'A message is optional, but a line about why this work speaks to you helps.'}
          </p>
          {isNp && !free && notesLeft <= 0 ? (
            <p role="alert" className="rounded-2xl bg-apricot/25 p-3 text-sm">This posting has used its five interest messages. Volunteers can still show interest in you, and replying to them is free.</p>
          ) : (
            <>
              <Field label={needsNote ? 'Your message' : 'Message (optional)'} required={needsNote} name="note" count={note} max={needsNote ? LIMITS.note.max : LIMITS.optionalNote.max}
                error={tried ? noteErr : ''} hint={needsNote ? `${Math.max(0, LIMITS.note.min - note.trim().length)} more characters needed` : undefined}>
                {(f) => <textarea {...f} name="note" data-autofocus rows={4} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={needsNote ? 'What made you want to work with them?' : 'Optional'} />}
              </Field>
              <Btn className="mt-4 w-full" disabled={pending} onClick={send}>{pending ? 'Sending…' : free ? 'Make it mutual' : 'Send'}</Btn>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Empty({ title, body, cta, onCta }: { title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="rise mx-auto mt-10 max-w-sm rounded-[2rem] border border-white/20 bg-plum2 p-8 text-center">
      <div aria-hidden className="mx-auto mb-5 h-14 w-14 rounded-full border border-apricot/60 bg-apricot/15" />
      <h2 className="font-serif text-3xl text-white">{title}</h2>
      <p className="mt-3 text-sm text-white/75">{body}</p>
      <Btn v="light" className="mt-6" onClick={onCta}>{cta}</Btn>
    </div>
  );
}
