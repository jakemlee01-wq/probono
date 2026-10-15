import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { Project } from '@shared/types';
import { LIMITS, len } from '@shared/rules';
import { useAct } from '@/lib/act';
import { fmtDate } from '@/lib/util';
import { inputCls } from './bits';

// Messages are always rendered as plain text, never as HTML.
export function Chat({ project, meId, readOnly }: { project: Project; meId: string; readOnly?: boolean }) {
  const { run, pending } = useAct();
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [project.messages.length]);
  const over = len(text.trim()) > LIMITS.chat.max;
  const send = () => {
    const t = text.trim();
    if (!t || over) return;
    // The same id on a retry means a flaky connection can't post a message twice.
    run({ action: 'message', projectId: project.id, note: t, clientId }, { quiet: true, done: () => { setText(''); setClientId(crypto.randomUUID()); } });
  };
  return (
    <section aria-label="Messages" className="rounded-3xl border border-plum/15 bg-white/50 p-4">
      <div className="mb-3 max-h-80 min-h-24 space-y-2 overflow-y-auto" role="log" aria-live="polite">
        {project.messages.length === 0 && <p className="py-6 text-center text-sm text-plum/60">{
          project.status === 'pending' ? 'No messages yet. Say hello and settle any questions about the agreement.'
          : ['active', 'completion_pending'].includes(project.status) ? 'No messages yet. Use this for questions and weekly updates.'
          : 'No messages were sent on this project.'}</p>}
        {project.messages.map((m) => {
          const mine = m.senderId === meId;
          if (m.system) return <p key={m.id} className="py-1 text-center text-xs text-plum/60">{m.text}</p>;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-plum text-cream' : 'bg-cream2 text-plum'}`}>
                {!mine && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{m.senderName}</p>}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className="mt-1 text-[10px] opacity-60">{fmtDate(m.createdAt, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {readOnly ? <p className="text-center text-xs text-plum/60">Messages are closed because this project has ended. {project.status === 'closed' ? 'The closing record is at the top of this page.' : ''}</p> : (
        <>
          <div className="flex gap-2">
            <textarea aria-label="Message" rows={1} className={`${inputCls} resize-none`} value={text} placeholder="Write a message" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button aria-label="Send message" disabled={pending || !text.trim() || over} onClick={send} className="min-h-11 shrink-0 rounded-full bg-plum px-4 text-cream disabled:opacity-40"><Send size={16} /></button>
          </div>
          <p className="mt-2 text-[11px] text-plum/60">{over ? <span className="font-semibold text-[#8a2f25]">Messages can be up to {LIMITS.chat.max} characters.</span> : 'Never send passwords, bank details, or account numbers here.'}</p>
        </>
      )}
    </section>
  );
}
