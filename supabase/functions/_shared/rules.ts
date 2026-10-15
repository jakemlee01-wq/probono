// One set of field rules, used by the website forms and enforced again by the engine.
// These are pilot defaults, not promises; change them here and both sides follow.
import { CAUSE_OPTIONS, FORMATS, SKILL_OPTIONS, type AgreementFields, type Option, type Terms } from './types.ts';

export const LIMITS = {
  years: { min: 0, max: 80 },
  title: { min: 3, max: 120 },
  name: { min: 1, max: 120 },
  headline: { max: 160 },
  longText: { max: 2000 },
  note: { min: 20, max: 1000 }, // nonprofit interest message
  optionalNote: { max: 1000 }, // volunteer interest message
  chat: { min: 1, max: 4000 },
  closing: { min: 10, max: 2000 },
  hoursPerWeek: { min: 1, max: 40 },
  weeks: { min: 1, max: 52 },
  hoursPerEntry: { min: 0.25, max: 24 },
  photos: { max: 6, bytes: 5 * 1024 * 1024 },
  interestNotesPerPosting: 5,
  decisionHours: 72,
};

// Abuse limits, counted from stored records on the server.
export const RATE = {
  interestsPerDay: 25,
  messagesPerHour: 60,
  reportsPerDay: 10,
  inviteChecksPerHour: 20,
  inviteRedeemFailuresPerHour: 10,
};

export const PILOT_TZ = 'America/Chicago';
export const DAY = 86_400_000;

const byLabel = (opts: Option[]) => new Map(opts.map((o) => [o.label.toLowerCase(), o.id]));
const skillLabels = byLabel(SKILL_OPTIONS);
const causeLabels = byLabel(CAUSE_OPTIONS);
const skillIds = new Set(SKILL_OPTIONS.map((o) => o.id));
const causeIds = new Set(CAUSE_OPTIONS.map((o) => o.id));

// Older records stored display labels. Read them as ids without rewriting the record.
export function normalizeIds(values: unknown, kind: 'skill' | 'cause'): string[] {
  if (!Array.isArray(values)) return [];
  const ids = kind === 'skill' ? skillIds : causeIds;
  const labels = kind === 'skill' ? skillLabels : causeLabels;
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const id = ids.has(v) ? v : labels.get(v.toLowerCase());
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
export const validIds = (values: string[], kind: 'skill' | 'cause') =>
  Array.isArray(values) && values.every((v) => (kind === 'skill' ? skillIds : causeIds).has(v));
export const optionLabel = (id: string) =>
  SKILL_OPTIONS.find((o) => o.id === id)?.label ?? CAUSE_OPTIONS.find((o) => o.id === id)?.label ?? id;

// Unicode-aware length: counts characters as people see them, not UTF-16 units.
export const len = (s: string) => [...(s ?? '')].length;
export const clean = (s: unknown) => (typeof s === 'string' ? s.trim() : '');

export type Errors = Record<string, string>;

export function textError(value: string, label: string, r: { min?: number; max?: number }, required = false): string {
  const v = clean(value);
  if (!v) return required || r.min ? `Add ${label.toLowerCase()}.` : '';
  if (r.min && len(v) < r.min) return `${label} needs at least ${r.min} characters.`;
  if (r.max && len(v) > r.max) return `${label} can be up to ${r.max} characters.`;
  return '';
}

export function intError(value: unknown, label: string, r: { min: number; max: number }, required = true): string {
  if (value === null || value === undefined || value === '') return required ? `Add ${label.toLowerCase()}.` : '';
  const n = Number(value);
  if (typeof value === 'number' ? !Number.isFinite(value) : !Number.isFinite(n)) return `${label} must be a number.`;
  if (!Number.isInteger(n)) return `${label} must be a whole number.`;
  if (n < r.min || n > r.max) return `${label} must be between ${r.min} and ${r.max}.`;
  return '';
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? '') && Number.isFinite(Date.parse(v));

export function termsErrors(t: Terms | undefined): Errors {
  const e: Errors = {};
  if (!t) return { terms: 'Add your terms.' };
  const set = (k: string, m: string) => { if (m) e[k] = m; };
  set('hoursPerWeek', intError(t.hoursPerWeek, 'Hours per week', LIMITS.hoursPerWeek));
  set('weeks', intError(t.weeks, 'Weeks', LIMITS.weeks));
  set('minWeeks', intError(t.minWeeks, 'Fewest weeks', LIMITS.weeks));
  set('maxWeeks', intError(t.maxWeeks, 'Most weeks', LIMITS.weeks));
  if (!e.minWeeks && !e.maxWeeks && t.maxWeeks < t.minWeeks) e.maxWeeks = 'Most weeks must be at least the fewest weeks.';
  if (!isDate(t.startDate)) e.startDate = 'Add a valid start date.';
  if (!isDate(t.availableUntil)) e.availableUntil = 'Add a valid end of availability.';
  else if (!e.startDate && t.availableUntil <= t.startDate) e.availableUntil = 'Available until must be after the start date.';
  if (!FORMATS.includes(t.format)) e.format = 'Choose a format.';
  return e;
}

export function profileErrors(p: { kind: string; name: string; title: string; years: number | null; credential: string; foundedYear: number | null; prompts: Record<string, string>; skills: string[]; causes: string[]; terms: Terms }, thisYear: number): Errors {
  const e: Errors = {};
  const set = (k: string, m: string) => { if (m) e[k] = m; };
  set('name', textError(p.name, 'Name', LIMITS.name, true));
  set('title', textError(p.title, p.kind === 'volunteer' ? 'Role' : 'Mission line', LIMITS.headline));
  if (p.kind === 'volunteer') set('years', intError(p.years, 'Years of experience', LIMITS.years, false));
  else set('foundedYear', intError(p.foundedYear, 'Year founded', { min: 1800, max: thisYear }, false));
  set('credential', textError(p.credential, 'Credential', LIMITS.headline));
  for (const k of ['first', 'second', 'third']) set(k, textError(p.prompts?.[k] ?? '', 'This answer', LIMITS.longText));
  if (!validIds(p.skills, 'skill')) e.skills = 'Choose skills from the list.';
  if (!validIds(p.causes, 'cause')) e.causes = 'Choose causes from the list.';
  Object.assign(e, termsErrors(p.terms));
  return e;
}

export function postingErrors(p: { title: string; skills: string[]; prompts: Record<string, string>; terms: Terms }): Errors {
  const e: Errors = {};
  const set = (k: string, m: string) => { if (m) e[k] = m; };
  set('title', textError(p.title, 'Title', LIMITS.title, true));
  if (!p.skills?.length) e.skills = 'Choose at least one skill.';
  else if (!validIds(p.skills, 'skill')) e.skills = 'Choose skills from the list.';
  for (const k of ['first', 'second', 'third']) set(k, textError(p.prompts?.[k] ?? '', 'This answer', LIMITS.longText));
  Object.assign(e, termsErrors(p.terms));
  return e;
}

export const AGREEMENT_LABELS: Record<keyof AgreementFields, string> = {
  title: 'Project title',
  nonprofitContact: 'Nonprofit contact',
  problem: 'The problem',
  outcome: 'Desired outcome',
  deliverables: 'Deliverables',
  acceptance: 'How completion is judged',
  inScope: 'In scope',
  exclusions: 'Not included',
  inputs: 'What the nonprofit provides',
  hoursPerWeek: 'Hours per week',
  weeks: 'Weeks',
  format: 'Working location',
  proposedStart: 'Start date',
  accessLevel: 'System access',
  accessSystems: 'Systems and data involved',
  accessGrantedBy: 'Who grants access',
  accessRemovedBy: 'Who removes access at the end',
  checkInPlan: 'Check-in plan',
};

// Field-level problems with a draft agreement. `minStart` is the earliest allowed start date.
export function agreementErrors(a: AgreementFields, minStart: string): Errors {
  const e: Errors = {};
  const set = (k: string, m: string) => { if (m) e[k] = m; };
  set('title', textError(a.title, 'Project title', LIMITS.title, true));
  set('nonprofitContact', textError(a.nonprofitContact, 'Nonprofit contact', LIMITS.name, true));
  for (const k of ['problem', 'outcome', 'deliverables', 'acceptance', 'inScope', 'exclusions', 'inputs', 'checkInPlan'] as const) {
    set(k, textError(a[k], AGREEMENT_LABELS[k], LIMITS.longText, true));
  }
  set('hoursPerWeek', intError(a.hoursPerWeek, 'Hours per week', LIMITS.hoursPerWeek));
  set('weeks', intError(a.weeks, 'Weeks', LIMITS.weeks));
  if (!FORMATS.includes(a.format)) e.format = 'Choose a working location.';
  if (!isDate(a.proposedStart)) e.proposedStart = 'Add a start date.';
  else if (a.proposedStart < minStart) e.proposedStart = `Start date needs agreement: pick ${minStart} or later, after the decision deadline.`;
  if (!['none', 'read_only', 'limited'].includes(a.accessLevel)) e.accessLevel = 'Choose an access level.';
  if (a.accessLevel !== 'none') {
    set('accessSystems', textError(a.accessSystems, AGREEMENT_LABELS.accessSystems, LIMITS.longText, true));
    set('accessGrantedBy', textError(a.accessGrantedBy, AGREEMENT_LABELS.accessGrantedBy, LIMITS.name, true));
    set('accessRemovedBy', textError(a.accessRemovedBy, AGREEMENT_LABELS.accessRemovedBy, LIMITS.name, true));
  } else {
    set('accessSystems', textError(a.accessSystems, AGREEMENT_LABELS.accessSystems, LIMITS.longText));
  }
  return e;
}

// Calendar date (YYYY-MM-DD) of an instant in the pilot's time zone. DST-safe because Intl does the work.
export function pilotDate(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PILOT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// A project can't start until the day after its decision deadline.
export const minStartFor = (pendingUntil: string) => addDays(pilotDate(Date.parse(pendingUntil)), 1);

// Normalized invite code: letters and digits only, upper case, with the PB prefix whether or not it was typed.
export const normalizeInvite = (code: string) => {
  const c = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 20 && !c.startsWith('PB') ? 'PB' + c : c;
};
