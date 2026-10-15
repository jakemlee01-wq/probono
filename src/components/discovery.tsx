import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AppState, Profile } from '@shared/types';
import { ProspectCard } from './prospect-card';
import { Btn, Modal, inputCls } from './bits';
import { useAct } from '@/lib/act';

export function Discovery({ state, me, postingId, goProfile }: { state: AppState; me: Profile; postingId?: string; goProfile: () => void }) {
  const { run, pending } = useAct();
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState('');
  const isNp = me.kind === 'nonprofit';
  const p = state.prospects[0];
  const posting = isNp ? state.postings.find((x) => x.id === postingId) : p?.posting;

  if (isNp && state.postings.length === 0)
    return <Empty title="Post your first need" body="Tell volunteers what a few hours could unlock for you, and people will start to show up here." cta="Write a posting" onCta={goProfile} />;
  if (me.paused)
    return <Empty title="Your profile is paused" body="Nonprofits can't see you right now. Unpause whenever you're ready." cta="Go to profile" onCta={goProfile} />;
  if (!p)
    return <Empty title="You're all caught up" body={isNp ? 'No new volunteers fit this posting right now. Check back soon, or adjust the posting.' : 'New nonprofits that fit your terms will show up here.'} cta={isNp ? 'Edit postings' : 'Review my terms'} onCta={goProfile} />;

  const ids = { postingId: p.posting.id, volunteerId: isNp ? p.profile.id : me.id };
  const notesLeft = posting?.notesLeft ?? 0;
  const free = p.interestedInYou;
  const needsNote = isNp && !free;
  const tooShort = needsNote && note.trim().length < 20;
  const first = p.profile.name.split(' ')[0];
  const send = () => run({ action: 'interest', ...ids, note: note.trim() }, { quiet: free, done: () => { setSheet(false); setNote(''); } });

  return (
    <div className="mx-auto w-full max-w-md">
      <ProspectCard key={p.profile.id + p.posting.id} prospect={p} viewer={isNp ? 'nonprofit' : 'volunteer'} />
      <div className="fixed inset-x-0 bottom-16 z-20 bg-gradient-to-t from-plum via-plum to-transparent px-4 pb-3 pt-6">
        <div className="mx-auto flex max-w-md overflow-hidden rounded-full border border-white/25 bg-plum2">
          <button disabled={pending} onClick={() => run({ action: 'not_now', ...ids }, { quiet: true })} className="min-h-12 flex-1 py-4 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-50">Not now</button>
          <div className="w-px bg-white/25" />
          <button disabled={pending} onClick={() => setSheet(true)} className="flex min-h-12 flex-1 items-center justify-center gap-2 bg-white py-4 text-sm font-semibold text-plum hover:bg-cream disabled:opacity-50">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-plum"><Plus size={12} /></span>Show interest
          </button>
        </div>
      </div>
      {sheet && (
        <Modal onClose={() => setSheet(false)} title={`Show interest in ${first}`}>
          <p className="mb-3 text-sm text-plum/70">
            {free
              ? `${first} is already interested, so this becomes a pending project. You'll both have 3 days to confirm.`
              : isNp
                ? `A short, real note goes a long way (at least 20 characters). You have ${notesLeft} left for this posting.`
                : 'A note is optional, but a line about why this work speaks to you is always welcome.'}
          </p>
          <textarea rows={4} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={needsNote ? 'What made you want to work with them?' : 'Optional note'} />
          {needsNote && <p className="mt-1 text-xs text-plum/55">{note.trim().length}/20 minimum</p>}
          <Btn className="mt-4 w-full" disabled={pending || tooShort || (needsNote && notesLeft <= 0)} onClick={send}>{pending ? 'Sending...' : free ? 'Show interest' : 'Send'}</Btn>
        </Modal>
      )}
    </div>
  );
}

function Empty({ title, body, cta, onCta }: { title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <div className="rise mx-auto mt-10 max-w-sm rounded-[2rem] border border-white/20 bg-plum2 p-8 text-center">
      <div className="mx-auto mb-5 h-14 w-14 rounded-full border border-apricot/60 bg-apricot/15" />
      <h2 className="font-serif text-3xl text-white">{title}</h2>
      <p className="mt-3 text-sm text-white/70">{body}</p>
      <Btn v="light" className="mt-6" onClick={onCta}>{cta}</Btn>
    </div>
  );
}
