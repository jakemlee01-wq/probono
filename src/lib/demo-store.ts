// The demo runs entirely in this browser. It uses the same engine as the real app, against a
// private copy of fictional fixtures saved in this browser only. Nothing is sent to the server:
// no accounts, no database writes, no email, no uploads. Two visitors never share demo data.
//
// Time travel uses a demo clock (an offset added to "now"), so agreed dates are never rewritten.
import { useSyncExternalStore } from 'react';
import { AppError, runCore, type Db } from '@shared/core';
import { DEMO_PERSONAS, demoDb, demoPrefill, demoUserId, type DemoPersonaId } from '@shared/fixtures';
import type { ActionInput, ActionResult, AppState } from '@shared/types';

const KEY = 'probono-demo-v3';
const WEEK = 7 * 86_400_000;
type Saved = { db: Db; persona: DemoPersonaId; startedAt: number; active: boolean; offset: number; guide: boolean };

function read(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Saved) : null;
    return v && v.db && DEMO_PERSONAS.some((p) => p.id === v.persona) ? v : null;
  } catch {
    return null;
  }
}
let current: Saved | null = read();
let version = 0; // bumps on every visible change, so screens refresh at once
const listeners = new Set<() => void>();
const emit = () => { version++; listeners.forEach((f) => f()); };
function persist() {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    // Private windows can refuse storage. The demo still works until the tab closes.
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { current = read(); emit(); } });
}

const fresh = (persona: DemoPersonaId): Saved => ({ db: demoDb(Date.now()), persona, startedAt: Date.now(), active: true, offset: 0, guide: true });
const ctx = () => ({ userId: demoUserId(current!.persona), now: Date.now() + current!.offset, demo: true, uuid: () => crypto.randomUUID(), photoPrefix: '', demoPrefill });

export const demo = {
  // The persona being shown, or null when the visitor isn't in the demo right now.
  persona: () => (current?.active ? current.persona : null),
  // A demo was started earlier and can be resumed.
  saved: () => !!current && !current.active,
  version: () => version,
  clockOffset: () => (current?.active ? current.offset : 0),
  guideOn: () => !!current?.active && current.guide,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  start(persona: DemoPersonaId = 'sally') { current = fresh(persona); persist(); emit(); },
  resume() { if (current) { current = { ...current, active: true }; persist(); emit(); } },
  switchTo(persona: DemoPersonaId) {
    if (!current) return demo.start(persona);
    current = { ...current, persona, active: true };
    persist(); emit();
  },
  restart() { const p = current?.persona ?? 'sally'; current = fresh(p); persist(); emit(); },
  // Leaves the demo but keeps it, so "Explore the demo" can offer to resume or start over.
  exit() { if (current) { current = { ...current, active: false }; persist(); } emit(); },
  discard() { current = null; persist(); emit(); },
  advanceWeek() { if (current) { current = { ...current, offset: current.offset + WEEK }; persist(); emit(); } },
  setGuide(on: boolean) { if (current) { current = { ...current, guide: on }; persist(); emit(); } },
  async state(postingId?: string): Promise<AppState> {
    if (!current) throw new Error('The demo has ended.');
    const { result } = await runCore(current.db, ctx(), undefined, postingId);
    persist();
    return result as AppState;
  },
  async act(a: ActionInput): Promise<ActionResult> {
    if (!current) throw new Error('The demo has ended.');
    // Work on a copy so a refused action leaves nothing half-done, like a database rollback.
    const draft = structuredClone(current.db);
    try {
      const { result } = await runCore(draft, ctx(), a);
      current = { ...current, db: draft };
      persist();
      return result as ActionResult;
    } catch (e) {
      if (e instanceof AppError) return { ok: false, message: e.message, field: e.field };
      throw e;
    }
  },
};

export function useDemoPersona(): DemoPersonaId | null {
  return useSyncExternalStore(demo.subscribe, demo.persona, () => null);
}
export function useDemoVersion(): number {
  return useSyncExternalStore(demo.subscribe, demo.version, () => 0);
}
// "Now" for countdowns and date defaults: the demo clock in the demo, real time otherwise.
export const appNow = () => Date.now() + demo.clockOffset();
