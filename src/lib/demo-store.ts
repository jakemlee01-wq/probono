// The demo runs entirely in this browser. It uses the same engine as the real app, against a
// private copy of fictional fixtures saved in this browser only. Nothing is sent to the server:
// no accounts, no database writes, no email, no uploads. Two visitors never share demo data.
import { useSyncExternalStore } from 'react';
import { AppError, runCore, type Db } from '@shared/core';
import { DEMO_PERSONAS, demoDb, demoUserId, type DemoPersonaId } from '@shared/fixtures';
import type { ActionInput, ActionResult, AppState } from '@shared/types';

const KEY = 'probono-demo-v2';
type Saved = { db: Db; persona: DemoPersonaId; startedAt: number };

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
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
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

const ctx = () => ({ userId: demoUserId(current!.persona), now: Date.now(), demo: true, uuid: () => crypto.randomUUID(), photoPrefix: '' });

export const demo = {
  persona: () => current?.persona ?? null,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  start(persona: DemoPersonaId) {
    current = { db: demoDb(Date.now()), persona, startedAt: Date.now() };
    persist(); emit();
  },
  switchTo(persona: DemoPersonaId) {
    if (!current) return demo.start(persona);
    current = { ...current, persona };
    persist(); emit();
  },
  // Restores the fixtures for this browser only.
  restart() {
    if (!current) return;
    current = { db: demoDb(Date.now()), persona: current.persona, startedAt: Date.now() };
    persist(); emit();
  },
  exit() { current = null; persist(); emit(); },
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
