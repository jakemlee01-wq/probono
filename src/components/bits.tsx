import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { len } from '@shared/rules';
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
  return <button type="button" {...p} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot disabled:opacity-50 ${vs[v]} ${className}`} />;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Rendered at the top of the page so it sits above the bottom bar and nav. Traps focus while open
// and gives focus back to whatever opened it.
export function Modal({ children, onClose, title }: { children: ReactNode; onClose?: () => void; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = box.current!;
    (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && close.current) { e.stopPropagation(); close.current(); }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; opener?.focus?.(); };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-plum/70 md:items-center" onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}
        className="sheet-in pb-safe relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-6 text-plum outline-none md:rounded-3xl">
        {onClose && (
          <button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full hover:bg-plum/10"><X size={18} /></button>
        )}
        <h2 id={titleId} className="mb-4 pr-10 font-serif text-3xl leading-tight">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ title, body, cta, danger, busy, onYes, onNo }: { title: string; body: ReactNode; cta: string; danger?: boolean; busy?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <Modal onClose={onNo} title={title}>
      <div className="mb-6 text-plum/80">{body}</div>
      <div className="flex gap-3">
        <Btn v="ghost" className="flex-1" onClick={onNo}>Not now</Btn>
        <Btn v={danger ? 'danger' : 'primary'} className="flex-1" disabled={busy} onClick={onYes}>{busy ? 'Working…' : cta}</Btn>
      </div>
    </Modal>
  );
}

export const inputCls = 'w-full rounded-xl border border-plum/25 bg-white/60 px-3 py-2.5 text-base text-plum placeholder:text-plum/40 focus:border-plum focus:outline-none focus-visible:ring-2 focus-visible:ring-apricot aria-[invalid=true]:border-[#8a2f25]';

type FieldProps = { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; name?: string };
// A labelled control with an optional hint, character counter, and error, all linked for screen readers.
export function Field({ label, hint, error, count, max, required, name, children }: {
  label: string; hint?: string; error?: string; count?: string; max?: number; required?: boolean; name?: string;
  children: (p: FieldProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const n = count !== undefined ? len(count) : 0;
  const near = max !== undefined && n > max * 0.8;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-plum/65">
        {label}{required && <span className="normal-case tracking-normal text-plum/50"> (required)</span>}
      </label>
      {children({ id, name, 'aria-describedby': [errId, hintId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? true : undefined })}
      <div className="flex justify-between gap-3">
        <span>
          {error && <span id={errId} className="mt-1 block text-xs font-semibold text-[#8a2f25]">{error}</span>}
          {hint && <span id={hintId} className="mt-1 block text-xs text-plum/60">{hint}</span>}
        </span>
        {near && <span className={`mt-1 shrink-0 text-xs tabular-nums ${n > max! ? 'font-semibold text-[#8a2f25]' : 'text-plum/55'}`} aria-live="polite">{n}/{max}</span>}
      </div>
    </div>
  );
}

// Listed at the top of a form after a failed submit. Links move focus to the field.
export function ErrorSummary({ errors, labels }: { errors: Record<string, string>; labels?: Record<string, string> }) {
  const keys = Object.keys(errors);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (keys.length) ref.current?.focus(); }, [keys.join()]);
  if (!keys.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="rounded-2xl border border-[#8a2f25]/40 bg-[#8a2f25]/10 p-4 text-sm outline-none">
      <p className="font-semibold">{keys.length === 1 ? 'One thing to fix' : `${keys.length} things to fix`}</p>
      <ul className="mt-1 list-disc pl-5">
        {keys.map((k) => (
          <li key={k}><button type="button" className="text-left underline underline-offset-2" onClick={() => document.querySelector<HTMLElement>(`[name="${k}"]`)?.focus()}>{labels?.[k] ? `${labels[k]}: ` : ''}{errors[k]}</button></li>
        ))}
      </ul>
    </div>
  );
}
export const focusField = (name?: string) => { if (name) setTimeout(() => document.querySelector<HTMLElement>(`[name="${name}"]`)?.focus(), 0); };

export function Chips({ options, value, onChange, label }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button type="button" key={o.id} aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-apricot ${on ? 'border-plum bg-plum text-cream' : 'border-plum/30 text-plum hover:bg-plum/10'}`}>{on ? '✓ ' : ''}{o.label}</button>
        );
      })}
    </div>
  );
}

export function Tile({ name, src, className = '', alt }: { name: string; src?: string; className?: string; alt?: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img src={src} alt={alt ?? name} draggable={false} onError={() => setBad(true)} className={`object-cover ${className}`} />
  ) : (
    <div role="img" aria-label={alt ?? name} className={`flex items-center justify-center bg-gradient-to-br from-[#8d8590] to-plum3 font-serif text-cream/85 ${className}`}>{initials(name)}</div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-current/10 ${className}`} />;
}

export function ErrorBox({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-[#8a2f25]/40 bg-[#8a2f25]/10 p-5 text-center">
      <p className="mb-3 text-sm">{text || 'We could not load this just now.'}</p>
      {onRetry && <Btn v="ghost" onClick={onRetry}>Try again</Btn>}
    </div>
  );
}
