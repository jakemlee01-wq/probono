import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { Project } from '@shared/types';
import { useAct } from '@/lib/act';
import { fmtDate } from '@/lib/util';
import { inputCls } from './bits';

export function Chat({ project, meId }: { project: Project; meId: string }) {
  const { run, pending } = useAct();
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [project.messages.length]);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    run({ action: 'message', projectId: project.id, note: t }, { quiet: true, done: () => setText('') });
  };
  return (
    <div className="rounded-3xl border border-plum/15 bg-white/50 p-4">
      <div className="mb-3 max-h-80 min-h-24 space-y-2 overflow-y-auto">
        {project.messages.length === 0 && <p className="py-6 text-center text-sm text-plum/55">Nothing here yet. Say hello and ask what would help most.</p>}
        {project.messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-plum text-cream' : 'bg-cream2 text-plum'}`}>
                {!mine && <p className="mb-0.5 text-[11px] font-semibold opacity-60">{m.senderName}</p>}
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className="mt-1 text-[10px] opacity-50">{fmtDate(m.createdAt, 'MMM d, h:mm a')}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="flex gap-2">
        <input aria-label="Message" className={inputCls} value={text} placeholder="Write a message" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button aria-label="Send" disabled={pending || !text.trim()} onClick={send} className="min-h-11 rounded-full bg-plum px-4 text-cream disabled:opacity-40"><Send size={16} /></button>
      </div>
    </div>
  );
}
