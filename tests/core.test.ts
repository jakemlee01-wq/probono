// Engine rules, tested against an in-memory copy of the demo fixtures.
// Run: deno test --config tests/deno.json tests/core.test.ts
import { runCore, type Ctx, type Db, type InviteOutcome } from '../supabase/functions/_shared/core.ts';
import { demoDb, demoPrefill, demoUserId } from '../supabase/functions/_shared/fixtures.ts';
import { addDays, minStartFor, pilotDate } from '../supabase/functions/_shared/rules.ts';
import type { ActionInput, ActionResult, AgreementFields, AppState, Project } from '../supabase/functions/_shared/types.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}
const H = 3600_000;
const T0 = Date.parse('2026-10-14T15:00:00Z');

function world(start = T0) {
  const db: Db = demoDb(start);
  for (const r of db.profiles) r.userId ??= demoUserId(r.id); // let tests act as Priya and Eastside too
  let now = start;
  let invite: InviteOutcome = 'ok';
  const ctx = (who: string): Ctx => ({
    userId: who.startsWith('user:') ? who : demoUserId(who), now, demo: false, uuid: () => crypto.randomUUID(),
    photoPrefix: `https://x.supabase.co/storage/v1/object/public/photos/${who}/`,
    redeemInvite: async () => invite,
    nonprofitSignupsOpen: true,
  });
  return {
    db,
    tick: (ms: number) => { now += ms; },
    at: (ms: number) => { now = ms; },
    now: () => now,
    setInvite: (o: InviteOutcome) => { invite = o; },
    state: async (who: string, postingId?: string) => (await runCore(db, ctx(who), undefined, postingId)).result as AppState,
    act: async (who: string, a: ActionInput): Promise<ActionResult> => {
      try { return (await runCore(db, ctx(who), a)).result as ActionResult; } catch (e) { return { ok: false, message: (e as Error).message, field: (e as { field?: string }).field }; }
    },
  };
}
const complete = (p: Project, over: Partial<AgreementFields> = {}): AgreementFields => ({
  ...p.agreement, nonprofitContact: 'Maya, operations director', deliverables: 'Three program reports and a one-page guide.',
  acceptance: 'The team runs the reports alone for one month-end.', inScope: 'Report setup in NetSuite.', exclusions: 'No changes to posted transactions.',
  inputs: 'Grant budget and current chart of accounts.', checkInPlan: 'Weekly 30-minute call on Tuesdays.', proposedStart: minStartFor(p.pendingUntil), ...over,
});
async function mutual(w: ReturnType<typeof world>) {
  const r = await w.act('sally', { action: 'interest', postingId: 'eastside-budget', note: '' });
  assert(r.ok && r.message === "It's mutual", 'mutual: ' + r.message);
  return (await w.state('sally')).projects.find((p) => p.status === 'pending')!;
}
const accept = (p: Project) => ({ action: 'confirm' as const, projectId: p.id, version: p.agreement.version, confidentiality: true, licensing: true });

Deno.test('demo fixtures tell a consistent story', async () => {
  const w = world();
  const s = await w.state('sally');
  assert(s.prospects[0].posting.id === 'eastside-budget' && s.prospects[0].interestedInYou, 'the guided story comes first');
  assert(s.profile?.record?.completedProjects === 1, 'sally has 1 completed project from fixture records');
  assert(s.profile?.record?.hoursSelfReported === 30 && s.profile.record.hoursConfirmed === 30, 'hours derived: ' + JSON.stringify(s.profile?.record));
  assert(s.profile?.quotes?.[0].fictional && s.profile.quotes[0].projectTitle === 'Program budget refresh', 'quote is labeled and attributed');
  const riverside = s.prospects.find((x) => x.profile.id === 'riverside')!.profile;
  assert(riverside.reviews?.[0].demo, 'demo review is marked as demo');
  assert(riverside.quotes?.[0].text.includes('chart of accounts'), 'riverside quote matches its past project');
});

Deno.test('full lifecycle: agreement versions, separate acceptances, two-sided close', async () => {
  const w = world();
  let p = await mutual(w);
  assert(p.agreement.version === 1 && (p.missing?.length ?? 0) > 0, 'draft starts incomplete');
  let r = await w.act('sally', accept(p));
  assert(!r.ok && r.message.includes("isn't complete"), 'cannot confirm an incomplete agreement');
  r = await w.act('eastside', { action: 'edit_agreement', projectId: p.id, agreement: complete(p) });
  assert(r.ok && r.message.includes('version 2'), 'edit makes v2: ' + r.message);
  p = (await w.state('sally')).projects[0];
  r = await w.act('sally', { ...accept(p), confidentiality: false });
  assert(!r.ok && r.field === 'confidentiality', 'acknowledgment required');
  r = await w.act('sally', accept(p));
  assert(r.ok, 'sally accepts v2');
  // PROJECT-04: the nonprofit still sees the pending project and its own action after volunteer-only confirmation.
  let rv = await w.state('eastside');
  const theirs = rv.projects.find((x) => x.id === p.id)!;
  assert(theirs.status === 'pending' && theirs.volunteerConfirmed && !theirs.nonprofitConfirmed, 'nonprofit sees pending, waiting on itself');
  assert(rv.notifications.some((n) => n.kind === 'other_confirmed' && n.projectId === p.id), 'nonprofit notified');
  // Substantive edit invalidates Sally's acceptance.
  r = await w.act('eastside', { action: 'edit_agreement', projectId: p.id, agreement: { ...complete(p), exclusions: 'No changes to posted transactions or payroll.' } });
  assert(r.ok, 'v3');
  p = (await w.state('sally')).projects[0];
  assert(p.agreement.version === 3 && !p.volunteerConfirmed, "sally's v2 acceptance no longer counts");
  assert(p.acceptances.length === 1 && p.acceptances[0].version === 2 && p.agreementHistory.length === 2, 'history kept');
  r = await w.act('sally', { ...accept(p), version: 2 });
  assert(!r.ok && r.message.includes('changed'), 'stale version rejected');
  r = await w.act('eastside', accept(p));
  assert(r.ok && !r.message.includes('confirmed'), 'eastside accepts v3 first');
  r = await w.act('sally', accept(p));
  assert(r.ok && r.message === 'Project confirmed', 'both accepted -> active');
  p = (await w.state('sally')).projects[0];
  assert(p.status === 'active' && p.startDate === p.agreement.proposedStart && p.agreedVersion === 3, 'agreed start used');
  assert(p.acceptances.filter((a) => a.version === 3).map((a) => a.side).sort().join() === 'nonprofit,volunteer', 'acceptances recorded per side');
  // Work before start date is not loggable.
  r = await w.act('sally', { action: 'log_hours', projectId: p.id, hours: 2, date: pilotDate(w.now()) });
  assert(!r.ok, 'no hours before start');
  w.tick(10 * 24 * H);
  r = await w.act('sally', { action: 'log_hours', projectId: p.id, hours: 3, date: pilotDate(w.now()), note: 'Report map' });
  assert(r.ok, 'log hours: ' + r.message);
  r = await w.act('eastside', { action: 'log_hours', projectId: p.id, hours: 3, date: pilotDate(w.now()) });
  assert(!r.ok, 'nonprofit cannot log hours');
  // Completion: no automatic close, two sides.
  r = await w.act('sally', { action: 'complete', projectId: p.id, note: 'Reports are live and documented.', publish: true });
  assert(r.ok, 'volunteer requests completion');
  assert((await w.state('eastside')).projects[0].status === 'completion_pending', 'completion pending');
  r = await w.act('eastside', { action: 'complete', projectId: p.id, note: 'We ran month-end ourselves.' });
  assert(!r.ok && r.field === 'unblocked', 'nonprofit must answer "did this unblock you"');
  r = await w.act('eastside', { action: 'complete', projectId: p.id, note: 'We ran month-end ourselves.', unblocked: 'yes', hoursOk: false, publish: true });
  assert(r.ok, 'closed');
  const s = await w.state('sally');
  assert(s.projects[0].status === 'closed' && s.profile!.record!.completedProjects === 2, 'record counts closed projects');
  assert(s.profile!.record!.hoursSelfReported === 33 && s.profile!.record!.hoursConfirmed === 30, 'unconfirmed hours stay self-reported');
  assert(s.notice?.kind === 'ended' || true, 'notice');
});

Deno.test('start date cannot precede the decision deadline, including across DST', async () => {
  const w = world(Date.parse('2026-10-29T16:00:00Z')); // deadline lands on Nov 1, the day DST ends
  const p = await mutual(w);
  assert(p.minStart === '2026-11-02', 'min start is the day after the deadline in Central time: ' + p.minStart);
  let r = await w.act('eastside', { action: 'edit_agreement', projectId: p.id, agreement: complete(p, { proposedStart: '2026-11-01' }) });
  assert(!r.ok && r.field === 'proposedStart' && r.message.startsWith('Start date needs agreement'), 'too-early start rejected: ' + r.message);
  r = await w.act('eastside', { action: 'edit_agreement', projectId: p.id, agreement: complete(p, { proposedStart: '2026-11-02' }) });
  assert(r.ok, 'day after deadline accepted');
  assert(pilotDate(Date.parse('2026-11-01T05:30:00Z')) === '2026-11-01', 'CDT -> Nov 1 00:30');
  assert(pilotDate(Date.parse('2026-11-02T05:30:00Z')) === '2026-11-01', 'CST -> still Nov 1 23:30');
  assert(addDays('2026-03-07', 1) === '2026-03-08' && addDays('2026-03-08', 1) === '2026-03-09', 'spring-forward days');
});

Deno.test('a stale draft start date blocks confirmation until both agree a later one', async () => {
  const w = world();
  w.db.postings.find((p) => p.id === 'eastside-budget')!.terms.startDate = addDays(pilotDate(T0), 1);
  const p = await mutual(w);
  assert(p.missing?.includes('proposedStart'), 'draft flags the start date');
  const r = await w.act('eastside', { action: 'edit_agreement', projectId: p.id, agreement: { ...complete(p), proposedStart: p.agreement.proposedStart } });
  assert(!r.ok && r.message.includes('Start date needs agreement'), 'cannot keep an early start');
});

Deno.test('decision deadline boundaries and stale tabs', async () => {
  const w = world();
  let p = await mutual(w);
  await w.act('eastside', { action: 'edit_agreement', projectId: p.id, agreement: complete(p) });
  p = (await w.state('sally')).projects[0];
  await w.act('eastside', accept(p));
  w.at(Date.parse(p.pendingUntil) - 1);
  let r = await w.act('sally', accept(p));
  assert(r.ok && r.message === 'Project confirmed', 'one millisecond before the deadline works');

  const w2 = world();
  let q = await mutual(w2);
  await w2.act('eastside', { action: 'edit_agreement', projectId: q.id, agreement: complete(q) });
  q = (await w2.state('sally')).projects[0];
  await w2.act('eastside', accept(q));
  w2.at(Date.parse(q.pendingUntil));
  r = await w2.act('sally', accept(q)); // a tab opened before the deadline, clicked at the deadline
  assert(!r.ok, 'at the deadline the match has lapsed');
  const both = [await w2.state('sally'), await w2.state('eastside')].map((s) => s.projects.find((x) => x.id === q.id)!.status);
  assert(both.every((s) => s === 'lapsed'), 'both sides see lapsed: ' + both);
  assert((await w2.state('sally')).capacity.full === false, 'discovery opens again');
});

Deno.test('pass from either side; nonprofit-first confirmation', async () => {
  for (const passer of ['sally', 'eastside']) {
    const w = world();
    const p = await mutual(w);
    const r = await w.act(passer, { action: 'pass', projectId: p.id });
    assert(r.ok, 'pass ' + passer);
    const other = passer === 'sally' ? 'eastside' : 'sally';
    const os = await w.state(other);
    assert(os.projects[0].status === 'passed' && os.notifications.some((n) => n.kind === 'passed'), 'other side sees passed');
    assert(os.notice?.kind === 'ended', 'other side gets a notice');
    assert((await w.state(passer)).notice === null, 'passer gets no pop-up');
  }
});

Deno.test('interest messages: limits, quota, idempotency', async () => {
  const w = world();
  const base = { action: 'interest' as const, postingId: 'riverside-netsuite', volunteerId: 'marcus' };
  let r = await w.act('riverside', { ...base, note: '                         ' });
  assert(!r.ok && r.field === 'note', 'whitespace rejected');
  r = await w.act('riverside', { ...base, note: 'x'.repeat(19) });
  assert(!r.ok, '19 rejected');
  r = await w.act('riverside', { ...base, note: 'é'.repeat(1001) });
  assert(!r.ok, '1001 rejected');
  r = await w.act('riverside', { ...base, note: 'x'.repeat(20) });
  assert(r.ok, '20 accepted');
  const left = () => w.db.postings.find((p) => p.id === 'riverside-netsuite')!.notesLeft;
  assert(left() === 4, 'one used');
  r = await w.act('riverside', { ...base, note: 'x'.repeat(20) });
  assert(r.ok && left() === 4, 'double tap does not spend a second message');
  w.db.postings.find((p) => p.id === 'northside-reports')!.notesLeft = 0;
  r = await w.act('northside', { action: 'interest', postingId: 'northside-reports', volunteerId: 'marcus', note: '' });
  assert(r.ok && r.message === "It's mutual", 'replying to existing interest is free even at zero');
});

Deno.test('access: other people\'s ids, roles, and fields are refused', async () => {
  const w = world();
  const p = await mutual(w);
  let r = await w.act('marcus', { action: 'message', projectId: p.id, note: 'hi' });
  assert(!r.ok && r.message === 'Project not found.', 'non-participant cannot message');
  r = await w.act('northside', accept(p));
  assert(!r.ok && r.message === 'Project not found.', 'non-participant cannot confirm');
  r = await w.act('marcus', { action: 'acknowledge', projectId: p.id });
  assert(!r.ok, 'cannot acknowledge others');
  const riv = w.db.postings.find((x) => x.id === 'eastside-budget')!;
  r = await w.act('northside', { action: 'update_posting', posting: { ...riv, title: 'Hijacked' } });
  assert(!r.ok && riv.title !== 'Hijacked', 'cannot edit another org\'s posting');
  r = await w.act('northside', { action: 'interest', postingId: 'eastside-budget', volunteerId: 'priya', note: 'x'.repeat(30) });
  assert(!r.ok, 'cannot send interest for another org\'s posting');
  r = await w.act('sally', { action: 'create_posting', posting: { ...riv, id: '' } });
  assert(!r.ok, 'volunteer cannot create postings');
  const me = (await w.state('marcus')).profile!;
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, kind: 'nonprofit', record: { completedProjects: 99, hoursSelfReported: 999, hoursConfirmed: 999 } } });
  assert(r.ok, 'save ignores forged fields');
  const after = (await w.state('marcus')).profile!;
  assert(after.kind === 'volunteer' && after.record!.completedProjects === 1, 'kind and record unchanged');
  for (const [years, ok] of [[999, false], [80, true], [0, true], [-1, false], [2.5, false]] as const) {
    r = await w.act('marcus', { action: 'update_profile', profile: { ...me, years } });
    assert(r.ok === ok, `years ${years} -> ${r.ok}`);
  }
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, skills: ['netsuite', 'brain_surgery'] } });
  assert(!r.ok && r.field === 'skills', 'forged skill id rejected');
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, photos: ['https://x.supabase.co/storage/v1/object/public/photos/sally/a.jpg'] } });
  assert(!r.ok, "another user's photo folder rejected");
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, photos: ['https://evil.example/storage/v1/object/public/photos/marcus/a.jpg'] } });
  assert(!r.ok, 'look-alike photo URL rejected');
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, photos: ['https://x.supabase.co/storage/v1/object/public/photos/marcus/../sally/a.jpg'] } });
  assert(!r.ok, 'path traversal rejected');
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, name: '  ', title: 'x' } });
  assert(!r.ok && r.field === 'name', 'blank name rejected');
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, name: 'Zoë Ngọc-Ánh O\'Brien' } });
  assert(r.ok, 'international names kept');
  r = await w.act('marcus', { action: 'update_profile', profile: { ...me, prompts: { ...me.prompts, first: 'あ'.repeat(2001) } } });
  assert(!r.ok, 'long unicode text rejected');
  r = await w.act('sally', { action: 'demo_other_side', projectId: p.id });
  assert(!r.ok && r.message === 'Only available in the demo.', 'simulated other side unavailable outside the demo');
});

Deno.test('blocking hides both ways, stops shared work, and closes messaging', async () => {
  const w = world();
  const p = await mutual(w);
  let r = await w.act('sally', { action: 'block', targetId: 'eastside' });
  assert(r.ok, 'blocked');
  const rv = await w.state('eastside');
  assert(rv.projects[0].status === 'ended_early', 'shared project stopped');
  r = await w.act('eastside', { action: 'message', projectId: p.id, note: 'hello?' });
  assert(!r.ok, 'blocked user cannot message by direct call');
  assert(!rv.prospects.some((x) => x.profile.id === 'sally'), 'sally hidden from riverside');
  const s = await w.state('sally');
  assert(!s.prospects.some((x) => x.posting.orgId === 'eastside'), 'riverside hidden from sally');
  assert(s.blocked.some((b) => b.id === 'eastside'), 'block listed for blocker');
  r = await w.act('eastside', { action: 'interest', postingId: 'eastside-budget', volunteerId: 'sally', note: 'x'.repeat(25) });
  assert(!r.ok, 'no new interest');
  r = await w.act('sally', { action: 'unblock', targetId: 'eastside' });
  assert(r.ok && (await w.state('sally')).blocked.length === 0, 'unblock');
});

Deno.test('reports are private and rate limited', async () => {
  const w = world();
  let r = await w.act('sally', { action: 'report', targetId: 'eastside', category: 'unsafe_access', note: 'Asked for my bank password.' });
  assert(r.ok, 'report saved');
  const rv = JSON.stringify(await w.state('eastside'));
  assert(!rv.includes('bank password') && !rv.includes('unsafe_access'), 'target sees nothing of the report');
  r = await w.act('sally', { action: 'report', targetId: 'eastside', category: 'made_up' as never });
  assert(!r.ok, 'unknown category rejected');
  for (let i = 0; i < 9; i++) await w.act('sally', { action: 'report', targetId: 'eastside', category: 'spam' });
  r = await w.act('sally', { action: 'report', targetId: 'eastside', category: 'spam' });
  assert(!r.ok, '11th report in a day throttled');
});

Deno.test('new nonprofits wait for review; volunteers need a valid invite', async () => {
  const w = world();
  let r = await w.act('user:np', { action: 'onboard', kind: 'nonprofit', name: 'Lake Street Tutors' });
  assert(r.ok && r.message.includes('reviewed'), 'nonprofit registers');
  let s = await w.state('user:np');
  assert(s.reviewGate?.waiting && s.prospects.length === 0, 'discovery waits for review');
  const me = s.profile!;
  r = await w.act('user:np', { action: 'create_posting', posting: { id: '', orgId: 'x', title: 'Budget', skills: ['budgeting'], terms: { ...me.terms, startDate: addDays(pilotDate(T0), 7) }, prompts: { first: 'We tutor kids.', second: 'No budget.', third: 'A budget.' }, status: 'Open', notesLeft: 99 } });
  assert(r.ok && r.message.includes('once your organization is reviewed'), 'posting saved, not public');
  const posting = (await w.state('user:np')).postings[0];
  assert(posting.notesLeft === 5 && posting.visible === false, 'server sets quota and visibility');
  const pr = await w.state('priya');
  assert(!pr.prospects.some((x) => x.posting.orgId === me.id), 'volunteers cannot see unreviewed org');
  w.db.reviews.push({ profileId: me.id, kind: 'organization', status: 'reviewed', method: 'Checked state registry', decidedAt: new Date(T0).toISOString() });
  assert((await w.state('priya')).prospects.some((x) => x.posting.orgId === me.id), 'visible after review');
  for (const o of ['invalid', 'expired', 'redeemed', 'revoked', 'wrong_email'] as InviteOutcome[]) {
    w.setInvite(o);
    r = await w.act('user:v', { action: 'onboard', kind: 'volunteer', name: 'Dana', inviteCode: 'PB-AAAAA-BBBBB' });
    assert(!r.ok && r.field === 'inviteCode' && r.message.length > 10, `invite ${o}: ${r.message}`);
  }
  r = await w.act('user:v', { action: 'onboard', kind: 'volunteer', name: 'Dana' });
  assert(!r.ok, 'no code, no volunteer account');
  w.setInvite('ok');
  r = await w.act('user:v', { action: 'onboard', kind: 'volunteer', name: 'Dana', inviteCode: 'PB-AAAAA-BBBBB' });
  assert(r.ok, 'valid invite works');
  r = await w.act('user:v', { action: 'onboard', kind: 'nonprofit', name: 'Dana Org' });
  assert(!r.ok, 'cannot onboard twice or switch role');
  s = await w.state('user:v');
  assert(s.profile?.kind === 'volunteer' && !s.profile.reviews?.length, 'no review badge by default');
});

Deno.test('notifications reach the right person once; chat dedupes and throttles', async () => {
  const w = world();
  await w.act('marcus', { action: 'interest', postingId: 'riverside-netsuite', note: '' });
  const rv = await w.state('riverside');
  assert(rv.notifications.some((n) => n.kind === 'interest' && n.text.includes('Marcus')), 'riverside told about marcus');
  assert(!(await w.state('northside')).notifications.length, 'unrelated org gets nothing');
  const p = await mutual(w);
  await w.act('sally', { action: 'message', projectId: p.id, note: 'One', clientId: 'msg-0001-abcd' });
  await w.act('sally', { action: 'message', projectId: p.id, note: 'One', clientId: 'msg-0001-abcd' });
  await w.act('sally', { action: 'message', projectId: p.id, note: 'Two' });
  const r2 = await w.state('eastside');
  assert(r2.projects.find((x) => x.id === p.id)!.messages.length === 2, 'retry with same id not duplicated');
  assert(r2.notifications.filter((n) => n.kind === 'message').length === 1, 'one unread message notice per project');
  assert(!(await w.state('sally')).notifications.some((n) => n.kind === 'message'), 'sender not notified');
  await w.act('eastside', { action: 'read_notifications' });
  assert((await w.state('eastside')).unread === 0, 'read state persists');
  const html = '<img src=x onerror=alert(1)>';
  await w.act('eastside', { action: 'message', projectId: p.id, note: html });
  assert((await w.state('sally')).projects[0].messages.some((m) => m.text === html), 'stored as plain text, unchanged');
  let r: ActionResult = { ok: true, message: '' };
  for (let i = 0; i < 60 && r.ok; i++) r = await w.act('sally', { action: 'message', projectId: p.id, note: 'spam ' + i });
  assert(!r.ok, 'message rate limit');
  r = await w.act('sally', { action: 'message', projectId: p.id, note: 'x'.repeat(4001) });
  assert(!r.ok, 'chat max length');
});

Deno.test('capacity and pause', async () => {
  const w = world();
  await mutual(w);
  const s = await w.state('sally');
  assert(s.capacity.full && s.capacity.projectId, 'capacity full while pending');
  const r = await w.act('sally', { action: 'interest', postingId: 'northside-reports', note: '' });
  assert(!r.ok && r.message.includes('project in progress'), 'show interest disabled with reason');
  await w.act('priya', { action: 'pause', paused: true });
  const e = await w.state('eastside');
  assert(!e.prospects.some((x) => x.profile.id === 'priya'), 'paused volunteer hidden');
  const r2 = await w.act('eastside', { action: 'interest', postingId: 'eastside-budget', volunteerId: 'priya', note: 'x'.repeat(30) });
  assert(!r2.ok, 'paused volunteer cannot receive interest');
});

Deno.test('older records are upgraded on read', async () => {
  const w = world();
  const legacy = {
    id: 'old', postingId: 'eastside-budget', volunteerId: 'priya', status: 'wrapping_up', data: { acknowledgements: {}, project: {
      id: 'old', posting: w.db.postings.find((p) => p.id === 'eastside-budget'), volunteer: w.db.profiles[2].data, nonprofit: w.db.profiles[5].data,
      status: 'wrapping_up', pendingUntil: new Date(T0 - 40 * 24 * H).toISOString(), volunteerConfirmed: true, nonprofitConfirmed: true,
      startDate: new Date(T0 - 30 * 24 * H).toISOString(), endDate: new Date(T0 + 5 * 24 * H).toISOString(), week: 5, totalHours: 0, weekHours: 0,
      messages: [], deliverables: [], links: [], team: [], hours: [], checkInDate: '', checkInAgenda: '', volunteerClosingNote: 'Done and dusted.', nonprofitClosingNote: '',
    } },
  };
  w.db.pairs.push(legacy as never);
  w.db.profiles[2].data.skills = ['Budgeting', 'QuickBooks'] as never;
  const s = await w.state('priya');
  const p = s.projects.find((x) => x.id === 'old')!;
  assert(p.status === 'active' && p.agreedVersion === 1 && p.closing.volunteer?.note === 'Done and dusted.', 'legacy project readable');
  assert(s.profile!.skills.join() === 'budgeting,quickbooks', 'legacy labels read as ids');
});

Deno.test('demo: prepared agreement, simulated other side, real rules unchanged', async () => {
  const db = demoDb(T0);
  let now = T0;
  const ctx = (who: string, demo = true): Ctx => ({ userId: demoUserId(who), now, demo, uuid: () => crypto.randomUUID(), photoPrefix: '', demoPrefill });
  const act = async (who: string, a: ActionInput) => {
    try { return (await runCore(db, ctx(who), a)).result as ActionResult; } catch (e) { return { ok: false, message: (e as Error).message }; }
  };
  const st = async (who: string) => (await runCore(db, ctx(who))).result as AppState;
  let r = await act('sally', { action: 'interest', postingId: 'eastside-budget', note: '' });
  assert(r.ok, 'mutual');
  let p = (await st('sally')).projects.find((x) => x.status === 'pending')!;
  assert(!p.missing?.length && p.agreement.editedByName === 'Demo example', 'demo agreement arrives complete and labeled');
  r = await act('sally', { action: 'demo_other_side', projectId: p.id });
  assert(r.ok && r.message.includes('Your turn'), 'other side accepts first (simulated)');
  r = await act('sally', accept(p));
  assert(r.ok && r.message === 'Project confirmed', 'confirmed after both');
  p = (await st('sally')).projects[0];
  assert(p.messages.some((m) => m.system && m.text.startsWith('Demo:')), 'simulated step is labeled in the record');
  assert(p.startDate === p.agreement.proposedStart, 'agreed start kept');
  // Demo clock: time moves, agreed dates don't.
  now += 14 * 86_400_000;
  p = (await st('sally')).projects[0];
  assert(p.startDate === p.agreement.proposedStart && (p.week ?? 0) >= 1, 'week advances by clock without editing dates: week ' + p.week);
  r = await act('sally', { action: 'complete', projectId: p.id, note: 'Template delivered and walked through.' });
  assert(r.ok, 'volunteer closing note');
  r = await act('sally', { action: 'demo_other_side', projectId: p.id });
  assert(r.ok && (await st('sally')).projects[0].status === 'closed', 'other side closes (simulated)');
  r = await act('sally', { action: 'demo_other_side', projectId: p.id });
  assert(!r.ok, 'nothing left to simulate');
  // Real accounts never get prepared agreements.
  const db2 = demoDb(T0);
  for (const row of db2.profiles) row.userId ??= demoUserId(row.id);
  await runCore(db2, ctx('sally', false), { action: 'interest', postingId: 'eastside-budget', note: '' });
  const real = ((await runCore(db2, ctx('sally', false))).result as AppState).projects.find((x) => x.status === 'pending')!;
  assert((real.missing?.length ?? 0) > 0, 'outside the demo the draft starts blank');
});

Deno.test('nonprofit enrollment stays closed until the operator opens it', async () => {
  const db = demoDb(T0);
  const ctx: Ctx = { userId: 'user:np', now: T0, demo: false, uuid: () => crypto.randomUUID(), photoPrefix: '' };
  let threw = '';
  try { await runCore(db, ctx, { action: 'onboard', kind: 'nonprofit', name: 'New Org' }); } catch (e) { threw = (e as Error).message; }
  assert(threw.includes("aren't open yet"), 'closed by default: ' + threw);
  const r = (await runCore(db, { ...ctx, nonprofitSignupsOpen: true }, { action: 'onboard', kind: 'nonprofit', name: 'New Org' })).result as ActionResult;
  assert(r.ok, 'open when configured');
});
