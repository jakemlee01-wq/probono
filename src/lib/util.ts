import { useEffect, useState } from 'react';
import { format } from 'date-fns';

export function photoUrl(p: string): string {
  if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('blob:')) return p;
  if (p.startsWith('/assets/')) return `${import.meta.env.BASE_URL}${p.slice(1)}`;
  return p;
}
export function initials(name: string): string {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}
export function fmtDate(iso: string, pat = 'MMM d, yyyy'): string {
  if (!iso) return '';
  // Plain dates (2026-11-03) are calendar days, not midnight UTC.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return isNaN(d.getTime()) ? '' : format(d, pat);
}
export function useNow(ms = 1000): number {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}
export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message;
  return 'Something went wrong';
}
