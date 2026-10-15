import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { PostingStatus, ProjectStatus, Project, ReviewBadge } from '@shared/types';
import { PILOT_TZ } from '@shared/rules';

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

export const POSTING_LABEL: Record<PostingStatus, string> = {
  Open: 'Accepting volunteers',
  Pending: 'Proposed project',
  'Active project': 'Project in progress',
  Complete: 'Completed',
};

export function projectLabel(p: Project, side: 'volunteer' | 'nonprofit'): { label: string; next: string } {
  const mine = side === 'volunteer' ? p.volunteerConfirmed : p.nonprofitConfirmed;
  const theirs = side === 'volunteer' ? p.nonprofitConfirmed : p.volunteerConfirmed;
  const s: ProjectStatus = p.status;
  if (s === 'pending') {
    if (p.missing?.length) return { label: 'Scope pending', next: 'Fill in the work agreement together' };
    if (!mine) return { label: theirs ? 'Waiting for you' : 'Awaiting confirmations', next: 'Review and accept the agreement' };
    return { label: 'Waiting for them', next: 'They still need to accept this version' };
  }
  if (s === 'active') {
    if (p.agreedVersion !== p.agreement.version) return { label: 'Change proposed', next: mine ? 'Waiting for them to accept the change' : 'Review the proposed change' };
    return { label: 'Active', next: p.week === 0 ? `Starts ${fmtDate(p.startDate, 'MMM d')}` : 'Log progress and keep in touch' };
  }
  if (s === 'completion_pending') {
    const done = side === 'volunteer' ? p.closing.volunteer : p.closing.nonprofit;
    return { label: 'Completion pending', next: done ? 'Waiting for their closing note' : 'Add your closing note to finish' };
  }
  return {
    closed: { label: 'Completed', next: 'Read the closing notes' },
    passed: { label: 'Passed', next: 'This proposed project was closed' },
    lapsed: { label: 'Expired', next: 'The decision window ended' },
    ended_early: { label: 'Stopped', next: 'This project was stopped' },
  }[s as 'closed'] ?? { label: s, next: '' };
}

export function badgeText(b: ReviewBadge): string {
  const what = { organization: 'Organization', identity: 'Identity', credential: 'Credential' }[b.kind];
  const status = { reviewed: 'reviewed', pending: 'review pending', rejected: 'not approved', needs_update: 'needs an update', not_submitted: 'not reviewed' }[b.status];
  return `${what} ${status}`;
}
