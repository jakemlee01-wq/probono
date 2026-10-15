// Postgres adapter for the shared engine (../_shared/core.ts).
// Every request runs in one transaction, serialized with an advisory lock, so two people can't
// both grab the same volunteer or posting, or redeem the same invite, at the same moment.
import type postgres from 'npm:postgres@3.4.4';
import { AppError, runCore, type Block, type Changes, type Ctx, type Db, type InviteOutcome, type NotificationRow, type Pair, type Report, type ReviewRow } from '../_shared/core.ts';
import { normalizeInvite, RATE } from '../_shared/rules.ts';
import type { ActionInput, ActionResult, AppState, Posting, Profile } from '../_shared/types.ts';

export { AppError };
export const LOCK_ID = 772601;

// Rows left over from the first version's shared, server-side demo. They are never shown to
// real users and are never edited by the engine. docs/operations.md explains how to remove them.
export const LEGACY_DEMO_IDS = ['sally', 'marcus', 'priya', 'northside', 'riverside', 'eastside'];

type Tx = postgres.TransactionSql;
export type User = { id: string; email: string };

export async function sha256hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function recentEvents(sql: postgres.Sql | Tx, key: string, ms: number) {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from rate_events where key = ${key} and at > now() - ${`${Math.round(ms / 1000)} seconds`}::interval`;
  return n;
}
export async function addEvent(sql: postgres.Sql | Tx, key: string) {
  await sql`insert into rate_events (key) values (${key})`;
}

// Looks at an invite without using it. Used by the public "check my invite" step and by redemption.
export async function inviteStatus(tx: postgres.Sql | Tx, code: string, lock = false) {
  const norm = normalizeInvite(code);
  if (norm.length < 8 || norm.length > 64) return { outcome: 'invalid' as InviteOutcome, row: null };
  const hash = await sha256hex(norm);
  const rows = lock
    ? await tx<{ id: string; email: string | null; expires_at: Date; redeemed_at: Date | null; revoked_at: Date | null }[]>`select id, email, expires_at, redeemed_at, revoked_at from invite_tokens where token_hash = ${hash} for update`
    : await tx<{ id: string; email: string | null; expires_at: Date; redeemed_at: Date | null; revoked_at: Date | null }[]>`select id, email, expires_at, redeemed_at, revoked_at from invite_tokens where token_hash = ${hash}`;
  const row = rows[0];
  const outcome: InviteOutcome = !row ? 'invalid' : row.revoked_at ? 'revoked' : row.redeemed_at ? 'redeemed' : row.expires_at.getTime() <= Date.now() ? 'expired' : 'ok';
  return { outcome, row };
}

async function redeemInvite(tx: Tx, user: User, code: string): Promise<InviteOutcome> {
  if ((await recentEvents(tx, `invite_fail:${user.id}`, 3600_000)) >= RATE.inviteRedeemFailuresPerHour) return 'too_many';
  const { outcome, row } = await inviteStatus(tx, code, true);
  if (outcome !== 'ok' || !row) return outcome;
  if (row.email && row.email !== user.email.trim().toLowerCase()) return 'wrong_email';
  // Consumed inside the same transaction as the profile insert: if anything later fails, the invite is not used up.
  const done = await tx`update invite_tokens set redeemed_at = now(), redeemed_by = ${user.id} where id = ${row.id} and redeemed_at is null and revoked_at is null returning id`;
  return done.length ? 'ok' : 'redeemed';
}

async function load(tx: Tx, userId: string): Promise<Db> {
  const ids = LEGACY_DEMO_IDS;
  const profiles = await tx<{ id: string; user_id: string | null; data: Profile }[]>`select id, user_id, data from profiles where id not in ${tx(ids)}`;
  const postings = await tx<{ data: Posting }[]>`select data from postings where org_id not in ${tx(ids)}`;
  const pairs = await tx<{ id: string; posting_id: string; volunteer_id: string; status: string; data: Pair['data'] }[]>`
    select e.id, e.posting_id, e.volunteer_id, e.status, e.data from engagements e join postings p on p.id = e.posting_id
    where e.volunteer_id not in ${tx(ids)} and p.org_id not in ${tx(ids)}`;
  const mine = profiles.find((p) => p.user_id === userId)?.id ?? '';
  const reviews = await tx<{ profile_id: string; kind: ReviewRow['kind']; status: ReviewRow['status']; method: string; decided_at: Date }[]>`
    select distinct on (profile_id, kind) profile_id, kind, status, method, decided_at from reviews order by profile_id, kind, decided_at desc`;
  const restricted = await tx<{ profile_id: string }[]>`select profile_id from restrictions where lifted_at is null`;
  const blocks = await tx<{ id: string; blocker_id: string; blocked_id: string; created_at: Date }[]>`select id, blocker_id, blocked_id, created_at from blocks`;
  const reports = await tx<{ id: string; reporter_id: string; target_id: string; created_at: Date; category: string }[]>`
    select id, reporter_id, target_id, created_at, category from reports where reporter_id = ${mine} and created_at > now() - interval '1 day'`;
  const notes = await tx<{ id: string; recipient_id: string; kind: NotificationRow['kind']; text: string; project_id: string | null; posting_id: string | null; created_at: Date; read_at: Date | null }[]>`
    select id, recipient_id, kind, text, project_id, posting_id, created_at, read_at from notifications
    where recipient_id = ${mine} or read_at is null order by created_at desc limit 2000`;
  return {
    profiles: profiles.map((r) => ({ id: r.id, userId: r.user_id, data: r.data })),
    postings: postings.map((r) => r.data),
    pairs: pairs.map((r) => ({ id: r.id, postingId: r.posting_id, volunteerId: r.volunteer_id, status: r.status, data: r.data })),
    reviews: reviews.map((r) => ({ profileId: r.profile_id, kind: r.kind, status: r.status, method: r.method, decidedAt: r.decided_at.toISOString() })),
    restricted: restricted.map((r) => r.profile_id),
    blocks: blocks.map((b) => ({ id: b.id, blockerId: b.blocker_id, blockedId: b.blocked_id, createdAt: b.created_at.toISOString() })),
    reports: reports.map((r) => ({ id: r.id, reporterId: r.reporter_id, targetId: r.target_id, postingId: null, projectId: null, category: r.category, note: '', createdAt: r.created_at.toISOString() })),
    notifications: notes.map((n) => ({ id: n.id, recipientId: n.recipient_id, kind: n.kind, text: n.text, projectId: n.project_id ?? undefined, postingId: n.posting_id ?? undefined, createdAt: n.created_at.toISOString(), readAt: n.read_at?.toISOString() ?? null })),
  };
}

async function persist(tx: Tx, db: Db, ch: Changes) {
  for (const id of ch.newProfiles) {
    const r = db.profiles.find((x) => x.id === id)!;
    await tx`insert into profiles (id, user_id, data) values (${r.id}, ${r.userId}, ${tx.json(r.data)})`;
  }
  for (const id of ch.profiles) {
    if (ch.newProfiles.has(id)) continue;
    const r = db.profiles.find((x) => x.id === id)!;
    await tx`update profiles set data = ${tx.json(r.data)} where id = ${id}`;
  }
  for (const id of new Set([...ch.newPostings, ...ch.postings])) {
    const p = db.postings.find((x) => x.id === id)!;
    const { visible: _v, ...data } = p;
    await tx`insert into postings (id, org_id, data) values (${p.id}, ${p.orgId}, ${tx.json(data)}) on conflict (id) do update set data = excluded.data`;
  }
  for (const id of new Set([...ch.newPairs, ...ch.pairs])) {
    const r = db.pairs.find((x) => x.id === id)!;
    await tx`insert into engagements (id, posting_id, volunteer_id, status, data) values (${r.id}, ${r.postingId}, ${r.volunteerId}, ${r.status}, ${tx.json(r.data)})
      on conflict (id) do update set status = excluded.status, data = excluded.data`;
  }
  for (const b of ch.blocksAdded as Block[]) {
    await tx`insert into blocks (id, blocker_id, blocked_id, created_at) values (${b.id}, ${b.blockerId}, ${b.blockedId}, ${b.createdAt}) on conflict do nothing`;
  }
  if (ch.blocksRemoved.length) await tx`delete from blocks where id in ${tx(ch.blocksRemoved)}`;
  for (const r of ch.reports as Report[]) {
    await tx`insert into reports (id, reporter_id, target_id, posting_id, project_id, category, note, created_at)
      values (${r.id}, ${r.reporterId}, ${r.targetId}, ${r.postingId}, ${r.projectId}, ${r.category}, ${r.note}, ${r.createdAt})`;
    await tx`insert into report_events (report_id, actor, action) values (${r.id}, ${r.reporterId}, 'created')`;
  }
  for (const id of ch.notifications) {
    const n = db.notifications.find((x) => x.id === id)!;
    await tx`insert into notifications (id, recipient_id, kind, text, project_id, posting_id, created_at, read_at)
      values (${n.id}, ${n.recipientId}, ${n.kind}, ${n.text}, ${n.projectId ?? null}, ${n.postingId ?? null}, ${n.createdAt}, ${n.readAt})
      on conflict (id) do update set text = excluded.text, created_at = excluded.created_at, read_at = excluded.read_at`;
  }
}

export async function runEngine(tx: Tx, user: User, photoPrefix: string, action?: ActionInput, selectedPostingId?: string):
  Promise<{ result: AppState | ActionResult; removedPhotos: string[] }> {
  await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
  const db = await load(tx, user.id);
  const ctx: Ctx = {
    userId: user.id, now: Date.now(), demo: false, uuid: () => crypto.randomUUID(), photoPrefix,
    redeemInvite: (code) => redeemInvite(tx, user, code),
  };
  const { result, changes } = await runCore(db, ctx, action, selectedPostingId);
  await persist(tx, db, changes);
  return { result, removedPhotos: changes.removedPhotos.filter((p) => p.startsWith(photoPrefix)) };
}

// Account deletion. Removes the person from discovery, stops shared work, and scrubs their name
// from records the other side keeps. Safe to run again if a later step failed.
export async function deleteAccount(tx: Tx, userId: string) {
  await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
  const [row] = await tx<{ id: string; data: Profile }[]>`select id, data from profiles where user_id = ${userId}`;
  if (!row) return;
  const me = row.data;
  const now = new Date().toISOString();
  const pairs = await tx<{ id: string; posting_id: string; volunteer_id: string; status: string; data: Pair['data']; org_id: string }[]>`
    select e.id, e.posting_id, e.volunteer_id, e.status, e.data, p.org_id from engagements e join postings p on p.id = e.posting_id
    where e.volunteer_id = ${me.id} or p.org_id = ${me.id}`;
  const gone = 'Deleted account';
  for (const r of pairs) {
    const p = r.data.project;
    let status = r.status;
    if (['interest'].includes(status)) status = 'passed';
    if (p) {
      const otherId = r.volunteer_id === me.id ? r.org_id : r.volunteer_id;
      if (['pending', 'active', 'completion_pending', 'wrapping_up'].includes(status)) {
        status = 'ended_early';
        Object.assign(p, { endedBy: me.id, endedReason: 'The other account was deleted.', endedAt: now });
        await tx`insert into notifications (id, recipient_id, kind, text, project_id) values (${crypto.randomUUID()}, ${otherId}, 'ended', ${`"${p.agreement?.title ?? p.posting.title}" was stopped because the other account was deleted.`}, ${r.id})`;
      }
      p.status = status as typeof p.status;
      const scrub = (x: Profile) => Object.assign(x, { name: gone, photos: [], title: '', credential: '', prompts: { first: '', second: '', third: '' } });
      if (r.volunteer_id === me.id) scrub(p.volunteer); else scrub(p.nonprofit);
      for (const m of p.messages ?? []) if (m.senderId === me.id) m.senderName = gone;
      for (const a of p.acceptances ?? []) if (a.actorId === me.id) a.actorName = gone;
      if (p.agreement?.editedBy === me.id) p.agreement.editedByName = gone;
      for (const a of p.agreementHistory ?? []) if (a.editedBy === me.id) a.editedByName = gone;
    }
    if (r.volunteer_id === me.id) { r.data.volunteerNote = ''; } else { r.data.nonprofitNote = ''; }
    await tx`update engagements set status = ${status}, data = ${tx.json(r.data)} where id = ${r.id}`;
  }
  const tomb: Profile = {
    id: me.id, kind: me.kind, name: gone, title: '', years: null, credential: '', foundedYear: null, photos: [], skills: [], causes: [],
    terms: me.terms, prompts: { first: '', second: '', third: '' }, paused: true, deleted: true,
  };
  await tx`update profiles set user_id = null, data = ${tx.json(tomb)} where id = ${me.id}`;
  await tx`delete from notifications where recipient_id = ${me.id}`;
  await tx`delete from blocks where blocker_id = ${me.id} or blocked_id = ${me.id}`;
}
