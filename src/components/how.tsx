import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import type { Kind } from '@shared/types';
import { Modal } from './bits';

export const STEPS: Record<Kind, string[]> = {
  volunteer: [
    'You see one nonprofit posting at a time, only ones that fit your skills and terms.',
    'Show interest if it fits. A message is optional. The nonprofit can also show interest in you first.',
    'When interest is mutual, you have 72 hours to agree a one-page work agreement together: deliverables, scope, access, check-ins.',
    'Both of you accept the same version of the agreement. Then the project starts on the agreed date.',
    'Work together, log your hours (they show as self-reported until the nonprofit confirms them), and keep in touch here.',
    'When the work is handed over, each side adds a closing note. The project completes once both are in.',
  ],
  nonprofit: [
    'Your postings become visible once the probono pilot team has reviewed your organization.',
    'You see one volunteer at a time, only people whose skills and availability fit the posting.',
    'Each posting has 5 interest messages (at least 20 characters each). They don\'t reset. Replying to a volunteer who is already interested is free.',
    'When interest is mutual, you have 72 hours to agree a one-page work agreement together. Access defaults to "No system access".',
    'Both of you accept the same version. Either side can propose changes later, and both must accept them again.',
    'At the end, add a closing note, say whether the work unblocked you, and confirm the volunteer\'s hours.',
  ],
};

export function HowItWorks({ kind, tone = 'light' }: { kind: Kind; tone?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={`inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold underline underline-offset-4 ${tone === 'dark' ? 'text-white/80' : 'text-plum/70'}`}>
        <HelpCircle size={14} aria-hidden />How this works
      </button>
      {open && (
        <Modal title="How this works" onClose={() => setOpen(false)}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-plum/85">{STEPS[kind].map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="mt-4 text-xs text-plum/65">You can be part of one proposed or active project at a time{kind === 'nonprofit' ? ' per posting' : ''}. Passing closes that one proposed project, nothing else.</p>
        </Modal>
      )}
    </>
  );
}
