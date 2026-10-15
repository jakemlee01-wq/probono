// The Postgres adapter against a real local database with the real migrations applied.
// Run through tests/db/run.sh.
import postgres from 'npm:postgres@3.4.4';
import { deleteAccount, inviteStatus, runEngine, type User } from '../../supabase/functions/api/engine.ts';
import { addDays, pilotDate } from '../../supabase/functions/_shared/rules.ts';
import type { ActionInput, ActionResult, AppState, Project } from '../../supabase/functions/_shared/types.ts';

const env = (k: string, d: string) => Deno.env.get(k) ?? d;
const sql = postgres({ host: env('PGHOST', 'localhost'), port: Number(env('PGPORT', '5432')), user: env('PGUSER', 'postgres'), database: 'probono_test', prepare: false, max: 4, onnotice: () => {} });
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('Assertion failed: ' + m); }

const users: Record<string, User> = {};
async function user(name: string) {
  const u = { id: crypto.randomUUID(), email: `${name}@example.org` };
  await sql`insert into auth.users (id, email) values (${u.id}, ${u.email})`;
  users[name] = u;
  return u;
}
const prefix = (u: User) => `https://x.supabase.co/storage/v1/object/public/photos/${u.id}/`;
const state = async (n: string, postingId?: string) => (await sql.begin((tx) => runEngine(tx, users[n], prefix(users[n]), undefined, postingId))).result as AppState;
const act = async (n: string, a: ActionInput): Promise<ActionResult> => {
  try { return (await sql.begin((tx) => runEngine(tx, users[n], prefix(users[n]), a))).result as ActionResult; }
  catch (e) { return { ok: false, message: (e as Error).message, field: (e as { field?: string }).field }; }
};
const invite = async (email: string | null = null, days = 7) => (await sql<{ c: string }[]>`select admin.issue_invite(${email}, ${days}) as c`)[0].c;

Deno.test({ name: 'adapter: invites, review gate, full project, isolation, deletion', sanitizeOps: false, sanitizeResources: false, fn: async () => {
  for (const n of ['org', 'vol', 'vol2', 'racer1', 'racer2', 'stranger']) await user(n);

  // Leftover rows from the old shared demo are never shown.
  await sql`insert into profiles (id, data) values ('sally', ${sql.json({ id: 'sally', kind: 'volunteer', name: 'Old demo Sally', skills: ['budgeting'], causes: [], photos: [], prompts: {}, terms: {} })})`;

  let r = await act('org', { action: 'onboard', kind: 'nonprofit', name: 'Lake Street Tutors' });
  assert(r.ok, 'org onboard: ' + r.message);
  const code = await invite('vol@example.org');
  r = await act('vol2', { action: 'onboard', kind: 'volunteer', name: 'Wrong person', inviteCode: code });
  assert(!r.ok && r.message.includes('different email'), 'email-bound invite refuses others: ' + r.message);
  r = await act('vol', { action: 'onboard', kind: 'volunteer', name: '', inviteCode: code });
  assert(!r.ok && r.field === 'name', 'form error');
  assert((await inviteStatus(sql, code)).outcome === 'ok', 'a form error does not burn the invite');
  r = await act('vol', { action: 'onboard', kind: 'volunteer', name: 'Dana', inviteCode: code.toLowerCase().replace(/-/g, ' ') });
  assert(r.ok, 'code accepted regardless of case and dashes: ' + r.message);
  assert((await inviteStatus(sql, code)).outcome === 'redeemed', 'invite used');

  // Two people race for one invite: exactly one wins.
  const shared = await invite(null);
  const race = await Promise.all(['racer1', 'racer2'].map((n) => act(n, { action: 'onboard', kind: 'volunteer', name: n, inviteCode: shared })));
  assert(race.filter((x) => x.ok).length === 1 && race.some((x) => x.message.includes('already been used')), 'one redemption: ' + JSON.stringify(race));
  const expired = await invite(null, 1);
  await sql`update invite_tokens set expires_at = now() - interval '1 minute' where redeemed_at is null and revoked_at is null`;
  r = await act('stranger', { action: 'onboard', kind: 'volunteer', name: 'S', inviteCode: expired });
  assert(!r.ok && r.message.includes('expired'), 'expired');
  r = await act('stranger', { action: 'onboard', kind: 'volunteer', name: 'S', inviteCode: 'TWINCITIES' });
  assert(!r.ok && r.field === 'inviteCode', 'old public codes no longer work');

  // Set up both profiles.
  const today = pilotDate(Date.now());
  const terms = { hoursPerWeek: 5, weeks: 5, minWeeks: 4, maxWeeks: 6, startDate: today, availableUntil: addDays(today, 120), format: 'Remote' as const };
  const vs = await state('vol');
  r = await act('vol', { action: 'update_profile', profile: { ...vs.profile!, skills: ['budgeting'], terms } });
  assert(r.ok, 'volunteer profile');
  const os = await state('org');
  r = await act('org', { action: 'create_posting', posting: { id: '', orgId: '', title: 'First budget', skills: ['budgeting'], terms: { ...terms, startDate: addDays(today, 7) }, prompts: { first: 'We tutor.', second: 'No budget yet.', third: 'A budget we can keep.' }, status: 'Open', notesLeft: 5 } });
  assert(r.ok && r.message.includes('once your organization is reviewed'), 'posting waits for review');
  assert(!(await state('vol')).prospects.length, 'nothing visible before review');
  await sql`select admin.set_review(${os.profile!.id}, 'organization', 'reviewed', 'Checked the state charity registry', 'Test operator')`;
  const vp = await state('vol');
  assert(vp.prospects.length === 1 && vp.prospects[0].profile.name === 'Lake Street Tutors', 'visible after review; legacy demo rows hidden: ' + vp.prospects.map((p) => p.profile.name));
  assert(vp.prospects[0].profile.reviews?.[0].method === 'Checked the state charity registry', 'badge says what was checked');
  assert(!JSON.stringify(vp).includes('org@example.org'), 'no emails in discovery');
  const postingId = vp.prospects[0].posting.id;
  assert(!(await state('org', postingId)).prospects.some((p) => p.profile.name === 'Old demo Sally'), 'org never sees legacy demo rows');

  r = await act('vol', { action: 'interest', postingId, note: '' });
  r = await act('org', { action: 'interest', postingId, volunteerId: vs.profile!.id, note: '' });
  assert(r.ok && r.message === "It's mutual", 'mutual over postgres');
  let p: Project = (await state('org')).projects[0];
  r = await act('stranger', { action: 'message', projectId: p.id, note: 'hi' });
  assert(!r.ok, 'non-participant refused (no profile)');
  r = await act('racer1', { action: 'message', projectId: p.id, note: 'hi' });
  assert(!r.ok && r.message === 'Project not found.', 'other volunteer refused');
  r = await act('org', { action: 'edit_agreement', projectId: p.id, agreement: {
    ...p.agreement, nonprofitContact: 'Ana', deliverables: 'Budget workbook', acceptance: 'Board approves it', inScope: 'Budget', exclusions: 'Payroll',
    inputs: 'Last year actuals', checkInPlan: 'Weekly call', proposedStart: p.minStart!, accessLevel: 'none' } });
  assert(r.ok, 'agreement saved');
  p = (await state('vol')).projects[0];
  for (const n of ['vol', 'org']) {
    r = await act(n, { action: 'confirm', projectId: p.id, version: p.agreement.version, confidentiality: true, licensing: true });
    assert(r.ok, n + ' confirm: ' + r.message);
  }
  const row = (await sql<{ status: string; data: { project: Project } }[]>`select status, data from engagements where id = ${p.id}`)[0];
  assert(row.status === 'active' && row.data.project.acceptances.length === 2, 'persisted with both acceptances');
  r = await act('vol', { action: 'message', projectId: p.id, note: 'Hello from Dana' });
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from notifications where recipient_id = ${os.profile!.id} and kind = 'message'`;
  assert(n === 1, 'notification stored for the right recipient');

  // Reports are written for operators and not readable back through the app state.
  r = await act('org', { action: 'report', targetId: vs.profile!.id, category: 'other', note: 'Test report' });
  assert(r.ok, 'report');
  const [rep] = await sql<{ status: string }[]>`select status from admin.open_reports`;
  assert(rep?.status === 'open', 'report queued for operators');
  assert(!JSON.stringify(await state('vol')).includes('Test report'), 'report invisible to target');

  // Deletion: profile tombstoned, work stopped, name scrubbed for the other side.
  await sql.begin((tx) => deleteAccount(tx, users.vol.id));
  const after = await state('org');
  const proj = after.projects.find((x) => x.id === p.id)!;
  assert(proj.status === 'ended_early' && proj.volunteer.name === 'Deleted account', 'other side sees a stopped project with no name');
  assert(proj.messages.every((m) => m.senderName !== 'Dana'), 'name scrubbed from messages');
  const tomb = (await sql<{ user_id: string | null; data: { name: string; deleted: boolean } }[]>`select user_id, data from profiles where id = ${vs.profile!.id}`)[0];
  assert(tomb.user_id === null && tomb.data.deleted && tomb.data.name === 'Deleted account', 'tombstone');
  assert((await state('vol')).needsOnboarding, 'deleted user has no profile');
  await sql.begin((tx) => deleteAccount(tx, users.vol.id)); // safe to repeat
  await sql.end();
} });
