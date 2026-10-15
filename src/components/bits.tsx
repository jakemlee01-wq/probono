import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { initials } from '@/lib/util';

type V = 'primary' | 'light' | 'ghost' | 'danger' | 'apricot';
const vs: Record<V, string> = {
  primary: 'bg-plum text-cream hover:bg-plum2',
  light: 'bg-cream text-plum hover:bg-white/90',
  ghost: 'border border-current/30 hover:bg-current/10',
  danger: 'bg-[#8a2f25] text-cream hover:bg-[#742720]',
  apricot: 'bg-apricot text-plum hover:brightness-95',
};
export function Btn({ v = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: V }) {
  return <button type="button" {...p} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50 ${vs[v]} ${className}`} />;
}

// Rendered at the top of the page so it always sits above the bottom bar and the nav.
export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-plum/70 md:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="sheet-in pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-6 text-plum md:rounded-3xl">
        {onClose && (
          <button aria-label="Close" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 hover:bg-plum/10"><X size={18} /></button>
        )}
        {title && <h2 className="mb-4 pr-8 font-serif text-3xl leading-tight">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ title, body, cta, danger, busy, onYes, onNo }: { title: string; body: string; cta: string; danger?: boolean; busy?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal onClose={onNo} title={title}>
      <p className="mb-6 text-plum/80">{body}</p>
      <div className="flex gap-3">
        <Btn v="ghost" className="flex-1" onClick={onNo}>Not yet</Btn>
        <Btn v={danger ? 'danger' : 'primary'} className="flex-1" disabled={busy} onClick={onYes}>{busy ? 'Working...' : cta}</Btn>
      </div>
    </Modal>
  );
}

export const inputCls = 'w-full rounded-xl border border-plum/25 bg-white/60 px-3 py-2.5 text-base text-plum placeholder:text-plum/40 focus:border-plum focus:outline-none';
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-plum/60">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-plum/55">{hint}</span>}
    </label>
  );
}

export function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? 'border-plum bg-plum text-cream' : 'border-plum/25 text-plum hover:bg-plum/10'}`}>{o}</button>
        );
      })}
    </div>
  );
}

export function Tile({ name, src, className = '' }: { name: string; src?: string; className?: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img src={src} alt={name} draggable={false} onError={() => setBad(true)} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center bg-gradient-to-br from-[#8d8590] to-plum3 font-serif text-cream/80 ${className}`}>{initials(name)}</div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-current/10 ${className}`} />;
}

export function ErrorBox({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  return (
    <div className="rounded-2xl border border-[#8a2f25]/40 bg-[#8a2f25]/10 p-5 text-center">
      <p className="mb-3 text-sm">{text || 'We could not load this just now.'}</p>
      {onRetry && <Btn v="ghost" onClick={onRetry}>Try again</Btn>}
    </div>
  );
}
