import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { PostingStatus, ProjectStatus, Project, ReviewBadge } from '@shared/types';
import { PILOT_TZ } from '@shared/rules';
import { appNow } from './demo-store';

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
// An exact instant, shown in the pilot's time zone with the zone named, e.g. "Sat, Oct 17, 3:00 PM CDT".
export function fmtInstant(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone: PILOT_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d);
}
export function timeLeft(ms: number): string {
  if (ms <= 0) return 'Time is up';
  const h = Math.floor(ms / 3600_000);
  if (h >= 24) return `${Math.floor(h / 24)} days ${h % 24} hrs left`;
  if (h >= 1) return `${h} hrs left`;
  return 'Less than an hour left';
}
export function useNow(ms = 1000): number {
  const [n, setN] = useState(() => appNow());
  useEffect(() => {
    setN(appNow());
    const t = setInterval(() => setN(appNow()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}
export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message;
  return 'Something went wrong';
}

export const POSTING_LABEL: Record<PostingStatus, string> = {
  Open: 'Accepting volunteers',
  Pending: 'Proposed project',
  'Active project': 'Active project',
  Complete: 'Completed',
};

// Where a project stands and whose move it is, in the same words everywhere.
export function projectLabel(p: Project, side: 'volunteer' | 'nonprofit'): { label: string; next: string; yours: boolean } {
  const mine = side === 'volunteer' ? p.volunteerConfirmed : p.nonprofitConfirmed;
  const theirs = side === 'volunteer' ? p.nonprofitConfirmed : p.volunteerConfirmed;
  const other = (side === 'volunteer' ? p.nonprofit : p.volunteer).name;
  const s: ProjectStatus = p.status;
  if (s === 'pending') {
    if (p.missing?.length) return { label: 'Proposed project', next: 'Finish the agreement together', yours: true };
    if (!mine) return { label: 'Waiting for your review', next: theirs ? `${other} accepted. Review the agreement` : 'Review the agreement', yours: true };
    return { label: 'Waiting for the other side', next: `Waiting for ${other} to accept`, yours: false };
  }
  if (s === 'active') {
    if (p.agreedVersion !== p.agreement.version) return mine ? { label: 'Change proposed', next: `Waiting for ${other} to accept the change`, yours: false } : { label: 'Change proposed', next: 'Review the proposed change', yours: true };
    if ((p.week ?? 0) === 0) return { label: `Confirmed, starts ${fmtDate(p.startDate, 'MMM d')}`, next: 'Prepare the kickoff', yours: false };
    return { label: 'Active', next: side === 'volunteer' ? 'Log progress and keep in touch' : 'Answer questions and follow progress', yours: false };
  }
  if (s === 'completion_pending') {
    const done = side === 'volunteer' ? p.closing.volunteer : p.closing.nonprofit;
    return done ? { label: 'Waiting for the other side', next: `Waiting for ${other}'s closing note`, yours: false } : { label: 'Waiting for your closing note', next: 'Add your closing note to finish', yours: true };
  }
  const ended: Record<string, { label: string; next: string }> = {
    closed: { label: 'Completed', next: 'Read the closing record' },
    passed: { label: 'Passed', next: 'This proposed project was closed' },
    lapsed: { label: 'Expired', next: 'The decision window ended' },
    ended_early: { label: 'Stopped', next: 'This project was stopped' },
  };
  return { ...(ended[s] ?? { label: s, next: '' }), yours: false };
}

export function badgeText(b: ReviewBadge): string {
  const what = { organization: 'Organization', identity: 'Identity', credential: 'Credential' }[b.kind];
  const status = { reviewed: 'reviewed', pending: 'review pending', rejected: 'not approved', needs_update: 'needs an update', not_submitted: 'not reviewed' }[b.status];
  return `${what} ${status}`;
}
