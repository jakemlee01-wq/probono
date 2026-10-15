import type { Profile } from '../_shared/types.ts';

export const LOCK_ID = 772601;
export const DAY = 86_400_000;

export function isDemoMode() {
  return ['on', 'true', '1'].includes((Deno.env.get('DEMO_MODE') ?? '').toLowerCase());
}

export const DEMO_IDS: string[] = ['sally', 'marcus', 'priya', 'northside', 'riverside', 'eastside'];

export function baseProfile(id: string, kind: Profile['kind'], name: string): Profile {
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 120 * DAY).toISOString().slice(0, 10);
  return {
    id, kind, name, title: '', years: 0, credential: '', photos: [], skills: [], causes: [],
    terms: { hoursPerWeek: 5, weeks: 5, minWeeks: 4, maxWeeks: 6, startDate: today, availableUntil: until, format: 'Remote' },
    prompts: { first: '', second: '', third: '' }, paused: false, completedProjects: 0, hoursGiven: 0, quotes: [],
  };
}
