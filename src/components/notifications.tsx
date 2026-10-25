import { useState } from 'react';
import { Bell } from 'lucide-react';
import type { AppNotification } from '@shared/types';
import { Modal } from './bits';
import { useAct } from '@/lib/act';
import { fmtDate } from '@/lib/util';

// In-app notices. They're stored on the server, so nothing is missed between visits.
export function Notifications({ items, unread, dark, onOpen, onApricot }: { items: AppNotification[]; unread: number; dark: boolean; onOpen: (n: AppNotification) => void; onApricot?: boolean }) {
  const [open, setOpen] = useState(false);
  const { run } = useAct();
  const go = (n: AppNotification) => {
    if (!n.readAt) run({ action: 'read_notifications', ids: [n.id] }, { quiet: true });
    setOpen(false);
    onOpen(n);
  };
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={`relative flex h-11 w-11 items-center justify-center rounded-full ${dark ? 'hover:bg-white/10' : 'hover:bg-plum/10'}`}>
        <Bell size={20} aria-hidden />
        {unread > 0 && <span aria-hidden className={`absolute right-1 top-1 min-w-5 rounded-full ${onApricot ? 'bg-plum text-cream' : 'bg-apricot text-plum'} px-1 text-center text-[11px] font-bold leading-5`}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <Modal title="Notifications" onClose={() => setOpen(false)}>
          {items.length === 0 ? <p className="text-sm text-plum/70">Nothing yet.</p> : (
            <>
              {unread > 0 && <button className="mb-3 min-h-11 text-sm font-semibold underline underline-offset-4" onClick={() => run({ action: 'read_notifications' }, { quiet: true })}>Mark all read</button>}
              <ul className="space-y-2">
                {items.map((n) => (
                  <li key={n.id}>
                    <button onClick={() => go(n)} className={`w-full rounded-2xl border p-3 text-left text-sm ${n.readAt ? 'border-plum/10' : 'border-plum/30 bg-white/70'}`}>
                      {!n.readAt && <span className="mr-2 inline-block rounded-full bg-apricot px-2 text-[11px] font-bold">New</span>}
                      {n.text}
                      <span className="mt-1 block text-xs text-plum/60">{fmtDate(n.createdAt, 'MMM d, h:mm a')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 text-xs text-plum/60">Email notifications aren't set up yet.</p>
        </Modal>
      )}
    </>
  );
}
