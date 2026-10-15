// The probono state machine. Pure TypeScript with no database or browser imports, so the same
// rules run in two places:
//   - the Supabase Edge Function, against Postgres (supabase/functions/api/engine.ts), and
//   - the browser-only demo, against a private in-memory copy (src/lib/demo-store.ts).
//
// Project lifecycle (one record per posting + volunteer pair):
//   interest -> pending (mutual; scope pending, then awaiting confirmations; 72 h)
//            -> active -> completion_pending -> closed
//   exits: passed, lapsed (deadline passed), ended_early (stopped by either side)
import {
  ACCESS_LEVELS, REPORT_CATEGORIES,
  type Acceptance, type ActionInput, type ActionResult, type Agreement, type AgreementFields, type AppNotification, type AppState,
  type Kind, type NotificationKind, type Posting, type Profile, type Project, type ProjectStatus, type Prospect,
  type ReviewBadge, type ReviewKind, type ReviewStatus,
} from './types.ts';
import {
  addDays, agreementErrors, clean, DAY, intError, len, LIMITS, minStartFor, normalizeIds, pilotDate, postingErrors,
  profileErrors, RATE, textError,
} from './rules.ts';

export type PairData = {
  volunteerInterested?: boolean;
  nonprofitInterested?: boolean;
  volunteerNote?: string;
  nonprofitNote?: string;
  volunteerInterestAt?: string;
  nonprofitInterestAt?: string;
  acknowledgements: Record<string, string>;
  project?: Project;
};
export type ProfileRow = { id: string; userId: string | null; data: Profile };
export type Pair = { id: string; postingId: string; volunteerId: string; status: string; data: PairData };
export type Block = { id: string; blockerId: string; blockedId: string; createdAt: string };
export type Report = { id: string; reporterId: string; targetId: string; postingId: string | null; projectId: string | null; category: string; note: string; createdAt: string };
export type ReviewRow = { profileId: string; kind: ReviewKind; status: ReviewStatus; method: string; decidedAt: string; demo?: boolean };
export type NotificationRow = AppNotification & { recipientId: string };

export type Db = {
  profiles: ProfileRow[];
  postings: Posting[];
  pairs: Pair[];
  reviews: ReviewRow[]; // written only by the operator
  restricted: string[]; // profile ids restricted by the operator
  blocks: Block[];
  reports: Report[];
  notifications: NotificationRow[];
};

export type Changes = {
  profiles: Set<string>;
  newProfiles: Set<string>;
  postings: Set<string>;
  newPostings: Set<string>;
  pairs: Set<string>;
  newPairs: Set<string>;
  blocksAdded: Block[];
  blocksRemoved: string[];
  reports: Report[];
  notifications: Set<string>;
  removedPhotos: string[];
};

export type InviteOutcome = 'ok' | 'invalid' | 'expired' | 'redeemed' | 'revoked' | 'wrong_email' | 'too_many';
export type Ctx = {
  userId: string;
  now: number;
  demo: boolean;
  uuid: () => string;
  // Uploaded photos must live under this URL prefix (the user's own storage folder).
  photoPrefix: string;
  // Consumes an invite atomically. Absent in the demo.
  redeemInvite?: (code: string) => Promise<InviteOutcome>;
  // New nonprofit accounts are refused unless the operator has opened enrollment.
  nonprofitSignupsOpen?: boolean;
  // Demo only: a prepared fictional agreement for a posting, so visitors aren't asked to write one.
  demoPrefill?: (postingId: string) => Partial<AgreementFields> | undefined;
};

export class AppError extends Error {
  constructor(message: string, public status = 400, public field?: string) { super(message); }
}
function need(condition: unknown, message: string, field?: string): asserts condition {
  if (!condition) throw new AppError(message, 400, field);
}
function firstError(errors: Record<string, string>) {
  const k = Object.keys(errors)[0];
  if (k) throw new AppError(errors[k], 400, k);
}

export const BUSY: ProjectStatus[] = ['pending', 'active', 'completion_pending'];
export const ENDED: ProjectStatus[] = ['closed', 'passed', 'lapsed', 'ended_early'];
const busy = (s: string) => (BUSY as string[]).includes(s);

export function emptyChanges(): Changes {
  return {
    profiles: new Set(), newProfiles: new Set(), postings: new Set(), newPostings: new Set(), pairs: new Set(), newPairs: new Set(),
    blocksAdded: [], blocksRemoved: [], reports: [], notifications: new Set(), removedPhotos: [],
  };
}

export function baseProfile(id: string, kind: Kind, name: string, now: number): Profile {
  const today = pilotDate(now);
  return {
    id, kind, name, title: '', years: null, credential: '', foundedYear: null, photos: [], skills: [], causes: [],
    terms: { hoursPerWeek: 5, weeks: 5, minWeeks: 4, maxWeeks: 6, startDate: today, availableUntil: addDays(today, 120), format: 'Remote' },
    prompts: { first: '', second: '', third: '' }, paused: false,
  };
}

// --- Reading older records ------------------------------------------------------------------
// Records written before the work agreement existed are upgraded in memory, never rewritten blindly.

function upgradeProfile(p: Profile): Profile {
  const q = p as Profile & { completedProjects?: number; hoursGiven?: number };
  delete q.completedProjects; delete q.hoursGiven; delete (q as { quotes?: unknown }).quotes;
  delete q.record; delete q.reviews;
  return {
    ...q,
    years: typeof q.years === 'number' && Number.isFinite(q.years) ? q.years : null,
    foundedYear: typeof q.foundedYear === 'number' ? q.foundedYear : null,
    credential: q.credential ?? '',
    title: q.title ?? '',
    photos: Array.isArray(q.photos) ? q.photos : [],
    skills: normalizeIds(q.skills, 'skill'),
    causes: normalizeIds(q.causes, 'cause'),
    terms: { ...q.terms, startDate: (q.terms?.startDate ?? '').slice(0, 10), availableUntil: (q.terms?.availableUntil ?? '').slice(0, 10) },
    prompts: q.prompts ?? { first: '', second: '', third: '' },
    paused: !!q.paused,
  };
}
function upgradePosting(p: Posting): Posting {
  return { ...p, skills: normalizeIds(p.skills, 'skill'), terms: { ...p.terms, startDate: (p.terms?.startDate ?? '').slice(0, 10), availableUntil: (p.terms?.availableUntil ?? '').slice(0, 10) } };
}
export function draftAgreement(posting: Posting, now: number): Agreement {
  return {
    title: posting.title, nonprofitContact: '', problem: posting.prompts.second ?? '', outcome: posting.prompts.third ?? '',
    deliverables: '', acceptance: '', inScope: '', exclusions: '', inputs: '',
    hoursPerWeek: posting.terms.hoursPerWeek, weeks: posting.terms.weeks, format: posting.terms.format,
    proposedStart: posting.terms.startDate.slice(0, 10), accessLevel: 'none', accessSystems: '', accessGrantedBy: '', accessRemovedBy: '',
    checkInPlan: '', version: 1, editedBy: 'system', editedByName: 'probono', editedAt: new Date(now).toISOString(),
  };
}
function upgradeProject(r: Pair): void {
  const p = r.data.project as Project & Record<string, unknown> | undefined;
  if (!p) return;
  if (!p.agreement) {
    p.agreement = draftAgreement(p.posting, Date.parse(p.pendingUntil) - LIMITS.decisionHours * 3600_000);
    p.agreementHistory = [];
    p.acceptances = [];
    p.agreedVersion = ['active', 'wrapping_up', 'closed'].includes(p.status) ? 1 : null;
  }
  p.createdAt ??= new Date(Date.parse(p.pendingUntil) - LIMITS.decisionHours * 3600_000).toISOString();
  p.kickoff ??= { contact: false, scope: false, inputs: false, access: false };
  if (!p.closing) {
    p.closing = {};
    const vn = p.volunteerClosingNote as string | undefined, nn = p.nonprofitClosingNote as string | undefined;
    if (vn) p.closing.volunteer = { note: vn, at: p.createdAt, publish: true };
    if (nn) p.closing.nonprofit = { note: nn, at: p.createdAt, publish: true };
  }
  delete p.volunteerClosingNote; delete p.nonprofitClosingNote; delete p.volunteerConfirmed; delete p.nonprofitConfirmed;
  if (r.status === 'wrapping_up') r.status = 'active';
  p.status = r.status as ProjectStatus;
  p.startDate = (p.startDate ?? '').slice(0, 10);
  p.endDate = (p.endDate ?? '').slice(0, 10);
  p.messages ??= []; p.deliverables ??= []; p.links ??= []; p.team ??= []; p.hours ??= [];
}

// --- The engine -----------------------------------------------------------------------------

export async function runCore(db: Db, ctx: Ctx, action?: ActionInput, selectedPostingId?: string): Promise<{ result: AppState | ActionResult; changes: Changes }> {
  const ch = emptyChanges();
  const now = ctx.now;
  const iso = () => new Date(now).toISOString();
  const today = pilotDate(now);

  for (const row of db.profiles) row.data = upgradeProfile(row.data);
  db.postings = db.postings.map(upgradePosting);
  for (const r of db.pairs) upgradeProject(r);

  const people = new Map(db.profiles.map((r) => [r.id, r.data]));
  const roles = new Map(db.postings.map((p) => [p.id, p]));
  const meRow = db.profiles.find((r) => r.userId === ctx.userId && !r.data.deleted);
  let me = meRow?.data;
  const restricted = new Set(db.restricted);

  const touchProfile = (p: Profile) => { people.set(p.id, p); const row = db.profiles.find((r) => r.id === p.id); if (row) row.data = p; ch.profiles.add(p.id); };
  const touchRole = (p: Posting) => { roles.set(p.id, p); const i = db.postings.findIndex((x) => x.id === p.id); if (i >= 0) db.postings[i] = p; ch.postings.add(p.id); };
  const touchPair = (r: Pair) => { if (r.data.project) r.data.project.status = r.status as ProjectStatus; ch.pairs.add(r.id); };
  const orgOf = (r: Pair) => roles.get(r.postingId)?.orgId ?? r.data.project?.posting.orgId ?? '';

  const notify = (recipientId: string, kind: NotificationKind, text: string, ref: { projectId?: string; postingId?: string } = {}) => {
    if (!recipientId || people.get(recipientId)?.deleted) return;
    if (kind === 'message') {
      // One unread "new messages" notice per project, refreshed rather than repeated.
      const open = db.notifications.find((n) => n.recipientId === recipientId && n.kind === 'message' && n.projectId === ref.projectId && !n.readAt);
      if (open) { open.text = text; open.createdAt = iso(); ch.notifications.add(open.id); return; }
    }
    const n: NotificationRow = { id: ctx.uuid(), recipientId, kind, text, projectId: ref.projectId, postingId: ref.postingId, createdAt: iso(), readAt: null };
    db.notifications.push(n);
    ch.notifications.add(n.id);
  };
  const blockedBetween = (a: string, b: string) => db.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
  const latestReview = (profileId: string, kind: ReviewKind): ReviewRow | undefined =>
    db.reviews.filter((r) => r.profileId === profileId && r.kind === kind).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];
  const orgReviewed = (orgId: string) => latestReview(orgId, 'organization')?.status === 'reviewed';
  const available = (p: Profile | undefined) => !!p && !p.deleted && !restricted.has(p.id);

  const refreshRole = (id: string) => {
    const p = roles.get(id);
    if (!p) return;
    const occupied = db.pairs.find((r) => r.postingId === id && busy(r.status));
    const next = occupied ? (occupied.status === 'pending' ? 'Pending' : 'Active project')
      : db.pairs.some((r) => r.postingId === id && r.status === 'closed') ? 'Complete' : 'Open';
    if (p.status !== next) { p.status = next; touchRole(p); }
  };
  const sideOf = (r: Pair, profileId: string): Kind | null => (profileId === r.volunteerId ? 'volunteer' : profileId === orgOf(r) ? 'nonprofit' : null);
  const otherId = (r: Pair, side: Kind) => (side === 'volunteer' ? orgOf(r) : r.volunteerId);
  const accepted = (p: Project, side: Kind) => p.acceptances.some((a) => a.side === side && a.version === p.agreement.version);

  // A volunteer fits a posting when every required skill matches and the posting sits inside their terms.
  const fits = (v: Profile, p: Posting) => {
    const start = Date.parse(p.terms.startDate);
    return !v.paused && available(v) && p.status === 'Open' &&
      p.skills.every((s) => v.skills.includes(s)) &&
      p.terms.hoursPerWeek <= v.terms.hoursPerWeek &&
      p.terms.weeks >= v.terms.minWeeks && p.terms.weeks <= v.terms.maxWeeks &&
      p.terms.format === v.terms.format &&
      start >= Date.parse(v.terms.startDate) &&
      start + p.terms.weeks * 7 * DAY <= Date.parse(v.terms.availableUntil) + DAY;
  };
  const postingVisible = (p: Posting) => {
    const org = people.get(p.orgId);
    return available(org) && orgReviewed(p.orgId);
  };

  // Time-based transitions run on every request, so nothing needs a scheduler.
  // The server clock decides; a late click from a stale tab can't activate an expired match.
  for (const r of db.pairs) {
    const p = r.data.project;
    if (!p || r.status !== 'pending' || now < Date.parse(p.pendingUntil)) continue;
    r.status = 'lapsed';
    p.endedAt = p.pendingUntil;
    touchPair(r);
    refreshRole(r.postingId);
    for (const id of [r.volunteerId, orgOf(r)]) notify(id, 'expired', `The decision window for "${p.agreement.title}" ended before both sides confirmed.`, { projectId: p.id });
  }

  const finish = (r: Pair) => {
    r.status = 'closed';
    const p = r.data.project!;
    p.endedAt = iso();
    touchPair(r);
    refreshRole(r.postingId);
    for (const id of [r.volunteerId, orgOf(r)]) notify(id, 'completed', `"${p.agreement.title}" is complete. Thank you.`, { projectId: p.id });
  };

  const demoAgreement = (role: Posting) => {
    const base = draftAgreement(role, now);
    const pre = ctx.demo ? ctx.demoPrefill?.(role.id) : undefined;
    return pre ? { ...base, ...pre, editedBy: 'system', editedByName: 'Demo example' } : base;
  };

  const result = action ? await act(action) : buildState();
  return { result, changes: ch };

  // --- Actions ------------------------------------------------------------------------------
  async function act(a: ActionInput): Promise<ActionResult> {
    if (a.action === 'onboard') {
      need(!me, 'Your profile is already set up.');
      need(a.kind === 'volunteer' || a.kind === 'nonprofit', 'Choose whether you are a volunteer or a nonprofit.', 'kind');
      const nameErr = textError(a.name ?? '', a.kind === 'volunteer' ? 'Your name' : 'Organization name', LIMITS.name, true);
      need(!nameErr, nameErr, 'name');
      need(a.kind === 'volunteer' || ctx.nonprofitSignupsOpen, "New nonprofit accounts aren't open yet. The pilot team is still setting up review, support, and policies.", 'kind');
      if (a.kind === 'volunteer') {
        need(ctx.redeemInvite, 'Invites are not available here.', 'inviteCode');
        need(clean(a.inviteCode), 'Enter your invite code.', 'inviteCode');
        const outcome = await ctx.redeemInvite(a.inviteCode!);
        need(outcome === 'ok', INVITE_MESSAGES[outcome], 'inviteCode');
      }
      const profile = baseProfile(ctx.uuid(), a.kind, clean(a.name), now);
      db.profiles.push({ id: profile.id, userId: ctx.userId, data: profile });
      people.set(profile.id, profile);
      ch.newProfiles.add(profile.id);
      me = profile;
      return {
        ok: true,
        message: a.kind === 'volunteer' ? 'Welcome to probono.' : 'Welcome. Your organization will be reviewed before volunteers can see your postings.',
      };
    }
    need(me, 'Set up your profile first.');
    const self = me;
    const isRestricted = restricted.has(self.id);
    const always = ['acknowledge', 'read_notifications', 'report', 'block', 'unblock'];
    need(!isRestricted || always.includes(a.action), 'Your account is restricted while the pilot team looks into a report.');

    switch (a.action) {
      case 'acknowledge': {
        const r = myPair(a.projectId);
        r.data.acknowledgements[self.id] = r.status;
        touchPair(r);
        return { ok: true, message: '' };
      }
      case 'read_notifications': {
        for (const n of db.notifications) {
          if (n.recipientId !== self.id || n.readAt) continue;
          if (a.ids && !a.ids.includes(n.id)) continue;
          n.readAt = iso();
          ch.notifications.add(n.id);
        }
        return { ok: true, message: '' };
      }
      case 'update_profile': {
        need(a.profile, 'Profile is required.');
        const input = a.profile;
        const next: Profile = {
          ...self,
          name: clean(input.name), title: clean(input.title), credential: clean(input.credential),
          years: self.kind === 'volunteer' ? (input.years === null || (input.years as unknown) === '' ? null : Number(input.years)) : null,
          foundedYear: self.kind === 'nonprofit' ? (input.foundedYear === null || (input.foundedYear as unknown) === '' ? null : Number(input.foundedYear)) : null,
          skills: input.skills ?? [], causes: input.causes ?? [], terms: input.terms,
          prompts: { first: clean(input.prompts?.first), second: clean(input.prompts?.second), third: clean(input.prompts?.third) },
          photos: Array.isArray(input.photos) ? input.photos : [],
        };
        firstError(profileErrors(next, new Date(now).getUTCFullYear()));
        need(next.photos.length <= LIMITS.photos.max, `You can add up to ${LIMITS.photos.max} photos.`, 'photos');
        const photoOk = (p: string) => self.photos.includes(p) ||
          (ctx.photoPrefix !== '' && p.startsWith(ctx.photoPrefix) && !p.slice(ctx.photoPrefix.length).includes('..'));
        need(next.photos.every((p) => typeof p === 'string' && photoOk(p)), 'Please upload photos using your own account.', 'photos');
        ch.removedPhotos.push(...self.photos.filter((p) => !next.photos.includes(p)));
        touchProfile(next);
        me = next;
        return { ok: true, message: 'Profile saved.' };
      }
      case 'pause': {
        need(self.kind === 'volunteer', 'Only volunteers can pause their profile.');
        touchProfile({ ...self, paused: !!a.paused });
        return { ok: true, message: a.paused ? "Paused. You won't appear in discovery or receive new interest. Current projects continue." : "You're visible in discovery again." };
      }
      case 'create_posting':
      case 'update_posting': {
        need(self.kind === 'nonprofit' && a.posting, 'A nonprofit posting is required.');
        const input = a.posting;
        const draft = { title: clean(input.title), skills: input.skills ?? [], terms: input.terms, prompts: { first: clean(input.prompts?.first), second: clean(input.prompts?.second), third: clean(input.prompts?.third) } };
        firstError(postingErrors(draft));
        if (a.action === 'create_posting') {
          const p: Posting = { ...draft, id: ctx.uuid(), orgId: self.id, status: 'Open', notesLeft: LIMITS.interestNotesPerPosting };
          db.postings.push(p); roles.set(p.id, p); ch.newPostings.add(p.id);
          return { ok: true, message: orgReviewed(self.id) ? 'Posting published.' : 'Posting saved. Volunteers will see it once your organization is reviewed.' };
        }
        const existing = roles.get(input.id);
        need(existing && existing.orgId === self.id, 'Only your own postings can be edited.');
        need(existing.status === 'Open', 'This posting has a pending or active project, so it is locked until that ends.');
        // Existing interest stays attached. Agreed project scope lives on the project, so it doesn't change.
        touchRole({ ...existing, ...draft });
        return { ok: true, message: 'Posting saved.' };
      }
      case 'interest':
      case 'not_now': {
        const role = roles.get(a.postingId ?? '');
        const v = people.get(self.kind === 'volunteer' ? self.id : a.volunteerId ?? '');
        need(role && v?.kind === 'volunteer' && (self.kind === 'volunteer' || role.orgId === self.id), "This prospect isn't available.");
        const other = self.kind === 'volunteer' ? role.orgId : v.id;
        need(!blockedBetween(self.id, other) && postingVisible(role) && available(v), "This prospect isn't available.");
        need(!db.pairs.some((r) => busy(r.status) && (r.volunteerId === v.id || r.postingId === role.id)),
          self.kind === 'volunteer' ? 'You have a project in progress. Show interest opens again when it ends.' : 'This posting has a project in progress.');
        need(fits(v, role), 'The skills or availability no longer fit this project.');
        let pair = db.pairs.find((r) => r.postingId === role.id && r.volunteerId === v.id);
        if (!pair) {
          pair = { id: ctx.uuid(), postingId: role.id, volunteerId: v.id, status: 'interest', data: { acknowledgements: {} } };
          db.pairs.push(pair);
          ch.newPairs.add(pair.id);
        }
        need(pair.status === 'interest', 'This prospect has already been considered.');
        const vSide = self.kind === 'volunteer';
        if (a.action === 'not_now') {
          pair.status = 'passed';
          touchPair(pair);
          return { ok: true, message: '' };
        }
        // Double taps and retries are harmless.
        if (pair.data[vSide ? 'volunteerInterested' : 'nonprofitInterested']) return { ok: true, message: 'Interest already sent.' };
        const sentToday = db.pairs.filter((r) => {
          const at = r.data[vSide ? 'volunteerInterestAt' : 'nonprofitInterestAt'];
          return at && now - Date.parse(at) < DAY && (vSide ? r.volunteerId === self.id : roles.get(r.postingId)?.orgId === self.id);
        }).length;
        need(sentToday < RATE.interestsPerDay, "You've shown a lot of interest today. Please try again tomorrow.");
        const theyAsked = vSide ? pair.data.nonprofitInterested : pair.data.volunteerInterested;
        const note = clean(a.note);
        if (!vSide && !theyAsked) {
          // Nonprofits write a real message, five per posting. Replying to existing interest is free.
          const e = textError(note, 'Your message', LIMITS.note, true);
          need(!e, e, 'note');
          need(role.notesLeft > 0, "You've used this posting's five interest messages. They don't reset, but replying to volunteers who are already interested is free.", 'note');
          role.notesLeft -= 1;
          touchRole(role);
        } else {
          const e = textError(note, 'Your message', LIMITS.optionalNote);
          need(!e, e, 'note');
        }
        pair.data[vSide ? 'volunteerInterested' : 'nonprofitInterested'] = true;
        pair.data[vSide ? 'volunteerNote' : 'nonprofitNote'] = note;
        pair.data[vSide ? 'volunteerInterestAt' : 'nonprofitInterestAt'] = iso();
        if (pair.data.volunteerInterested && pair.data.nonprofitInterested) {
          pair.status = 'pending';
          const org = people.get(role.orgId)!;
          pair.data.project = {
            id: pair.id, posting: structuredClone(role), volunteer: structuredClone(v), nonprofit: structuredClone(org),
            status: 'pending', createdAt: iso(), pendingUntil: new Date(now + LIMITS.decisionHours * 3600_000).toISOString(),
            agreement: demoAgreement(role), agreementHistory: [], acceptances: [], agreedVersion: null,
            startDate: '', endDate: '', kickoff: { contact: false, scope: false, inputs: false, access: false },
            messages: [], deliverables: [], links: [], team: [], hours: [], checkInDate: '', checkInAgenda: '', closing: {},
          };
          touchPair(pair);
          refreshRole(role.id);
          notify(v.id, 'mutual', `You and ${org.name} are both interested. Agree the scope within 3 days.`, { projectId: pair.id });
          notify(org.id, 'mutual', `You and ${v.name} are both interested. Agree the scope within 3 days.`, { projectId: pair.id });
          return { ok: true, message: "It's mutual", projectId: pair.id };
        }
        touchPair(pair);
        notify(other, 'interest', vSide ? `${self.name} is interested in "${role.title}".` : `${self.name} is interested in working with you.`, { postingId: role.id });
        return { ok: true, message: 'Interest sent.' };
      }
      case 'report': {
        const target = people.get(a.targetId ?? '');
        need(target && target.id !== self.id, 'Choose who you are reporting.');
        need(REPORT_CATEGORIES.some((c) => c.id === a.category), 'Choose what happened.', 'category');
        const e = textError(a.note ?? '', 'Details', LIMITS.longText);
        need(!e, e, 'note');
        const recent = db.reports.filter((r) => r.reporterId === self.id && now - Date.parse(r.createdAt) < DAY).length;
        need(recent < RATE.reportsPerDay, "You've sent several reports today. Please try again tomorrow.");
        let projectId: string | null = null;
        if (a.projectId) { const r = db.pairs.find((x) => x.id === a.projectId); if (r && sideOf(r, self.id)) projectId = r.id; }
        const postingId = a.postingId && roles.has(a.postingId) ? a.postingId : null;
        const report: Report = { id: ctx.uuid(), reporterId: self.id, targetId: target.id, postingId, projectId, category: a.category!, note: clean(a.note), createdAt: iso() };
        db.reports.push(report);
        ch.reports.push(report);
        return { ok: true, message: "Report saved privately. The person you reported can't see it." };
      }
      case 'block': {
        const target = people.get(a.targetId ?? '');
        need(target && target.id !== self.id, 'Choose who to block.');
        if (!db.blocks.some((b) => b.blockerId === self.id && b.blockedId === target.id)) {
          const b: Block = { id: ctx.uuid(), blockerId: self.id, blockedId: target.id, createdAt: iso() };
          db.blocks.push(b);
          ch.blocksAdded.push(b);
        }
        // Shared projects stop, so nobody has to keep negotiating with someone they blocked. History is kept.
        for (const r of db.pairs) {
          const side = sideOf(r, self.id);
          if (!side || otherId(r, side) !== target.id || !busy(r.status) || !r.data.project) continue;
          r.status = 'ended_early';
          Object.assign(r.data.project, { endedBy: self.id, endedReason: 'Stopped by the other side.', endedAt: iso() });
          touchPair(r);
          refreshRole(r.postingId);
          notify(target.id, 'ended', `The project "${r.data.project.agreement.title}" was stopped.`, { projectId: r.id });
        }
        return { ok: true, message: "Blocked. You won't see each other in discovery, and neither of you can send interest or messages." };
      }
      case 'unblock': {
        const hit = db.blocks.filter((b) => b.blockerId === self.id && b.blockedId === a.targetId);
        db.blocks = db.blocks.filter((b) => !hit.includes(b));
        ch.blocksRemoved.push(...hit.map((b) => b.id));
        return { ok: true, message: 'Unblocked.' };
      }
    }

    // Everything below acts on one project the caller belongs to.
    const pair = myPair(a.projectId);
    const p = pair.data.project!;
    const side = sideOf(pair, self.id)!;
    const otherSide: Kind = side === 'volunteer' ? 'nonprofit' : 'volunteer';
    const them = otherId(pair, side);
    const themName = (side === 'volunteer' ? p.nonprofit : p.volunteer).name;
    const stillTogether = () => need(!blockedBetween(self.id, them), 'This project is closed to new activity.');
    const activate = () => {
      p.agreedVersion = p.agreement.version;
      pair.status = 'active';
      p.startDate = p.agreement.proposedStart;
      p.endDate = addDays(p.startDate, p.agreement.weeks * 7);
      touchPair(pair);
      refreshRole(pair.postingId);
      for (const id of [pair.volunteerId, orgOf(pair)]) notify(id, 'confirmed', `"${p.agreement.title}" is confirmed. It starts ${p.startDate}.`, { projectId: p.id });
    };
    const demoNote = (text: string) => p.messages.push({ id: ctx.uuid(), senderId: 'system', senderName: 'probono demo', text, createdAt: iso(), system: true });

    switch (a.action) {
      case 'pass': {
        need(pair.status === 'pending', 'Only a proposed project can be passed.');
        pair.status = 'passed';
        Object.assign(p, { endedBy: self.id, endedAt: iso() });
        touchPair(pair);
        refreshRole(pair.postingId);
        notify(them, 'passed', `${self.name} passed on "${p.agreement.title}". Your profile stays open to others.`, { projectId: p.id });
        return { ok: true, message: 'Passed. This proposed project is closed; everything else stays as it was.' };
      }
      case 'edit_agreement': {
        need(pair.status === 'pending' || pair.status === 'active', 'The agreement can only change while a project is proposed or active.');
        stillTogether();
        need(a.agreement, 'Agreement is required.');
        const cur = p.agreement;
        const f = a.agreement;
        const nextFields: AgreementFields = {
          title: clean(f.title), nonprofitContact: clean(f.nonprofitContact), problem: clean(f.problem), outcome: clean(f.outcome),
          deliverables: clean(f.deliverables), acceptance: clean(f.acceptance), inScope: clean(f.inScope), exclusions: clean(f.exclusions),
          inputs: clean(f.inputs), hoursPerWeek: Number(f.hoursPerWeek), weeks: Number(f.weeks), format: f.format,
          proposedStart: pair.status === 'active' ? cur.proposedStart : clean(f.proposedStart),
          accessLevel: ACCESS_LEVELS.some((x) => x.id === f.accessLevel) ? f.accessLevel : 'none',
          accessSystems: clean(f.accessSystems), accessGrantedBy: clean(f.accessGrantedBy), accessRemovedBy: clean(f.accessRemovedBy),
          checkInPlan: clean(f.checkInPlan),
        };
        // Drafts may be incomplete, but nothing may be over-long or malformed.
        const errs = agreementErrors(nextFields, pair.status === 'active' ? '0000-00-00' : minStartFor(p.pendingUntil));
        for (const [k, m] of Object.entries(errs)) {
          if (m.startsWith('Add ')) continue;
          if (k === 'proposedStart' && !nextFields.proposedStart) continue;
          throw new AppError(m, 400, k);
        }
        if (pair.status === 'active') firstError(errs);
        const changed = (Object.keys(nextFields) as (keyof AgreementFields)[]).some((k) => nextFields[k] !== cur[k]);
        if (!changed) return { ok: true, message: 'No changes to save.' };
        p.agreementHistory.push(cur);
        p.agreement = { ...nextFields, version: cur.version + 1, editedBy: self.id, editedByName: self.name, editedAt: iso() };
        // Prior acceptances stay in the record but no longer count: both sides accept the new version.
        touchPair(pair);
        notify(them, 'agreement_changed', `${self.name} updated the agreement for "${p.agreement.title}" (version ${p.agreement.version}). Please review it.`, { projectId: p.id });
        return { ok: true, message: `Saved as version ${p.agreement.version}. Both of you need to accept this version.` };
      }
      case 'confirm': {
        const amending = pair.status === 'active' && p.agreement.version !== p.agreedVersion;
        need(pair.status === 'pending' || amending, pair.status === 'lapsed' ? 'The decision window has closed.' : 'There is nothing to confirm right now.');
        stillTogether();
        need(a.version === p.agreement.version, 'The agreement changed since you opened it. Please review the latest version.');
        const errs = agreementErrors(p.agreement, pair.status === 'pending' ? minStartFor(p.pendingUntil) : '0000-00-00');
        if (Object.keys(errs).length) throw new AppError(`The agreement isn't complete yet: ${Object.values(errs)[0]}`, 400, Object.keys(errs)[0]);
        need(a.confidentiality === true, 'Please acknowledge the confidentiality and data-handling terms.', 'confidentiality');
        need(a.licensing === true, 'Please acknowledge the note about professional licensing.', 'licensing');
        if (accepted(p, side)) return { ok: true, message: 'You already accepted this version.' };
        const acc: Acceptance = { side, actorId: self.id, actorName: self.name, version: p.agreement.version, at: iso(), confidentiality: true, licensing: true };
        p.acceptances.push(acc);
        if (!accepted(p, otherSide)) {
          touchPair(pair);
          notify(them, 'other_confirmed', `${self.name} accepted version ${p.agreement.version} of "${p.agreement.title}". It's your turn.`, { projectId: p.id });
          return { ok: true, message: "You've accepted. We'll let them know it's their turn." };
        }
        if (pair.status === 'pending') { activate(); return { ok: true, message: 'Project confirmed' }; }
        p.agreedVersion = p.agreement.version;
        p.endDate = addDays(p.startDate, p.agreement.weeks * 7);
        p.messages.push({ id: ctx.uuid(), senderId: 'system', senderName: 'probono', text: `Both sides accepted version ${p.agreement.version} of the agreement.`, createdAt: iso(), system: true });
        touchPair(pair);
        notify(them, 'confirmed', `Version ${p.agreement.version} of "${p.agreement.title}" is agreed.`, { projectId: p.id });
        return { ok: true, message: `Version ${p.agreement.version} is agreed.` };
      }
      case 'message': {
        need(busy(pair.status), 'This project has ended, so messages are closed.');
        stillTogether();
        const text = clean(a.note);
        const e = textError(text, 'Message', LIMITS.chat, true);
        need(!e, e, 'note');
        if (a.clientId && p.messages.some((m) => m.id === a.clientId)) return { ok: true, message: '' };
        const lastHour = db.pairs.reduce((n, r) => n + (r.data.project?.messages.filter((m) => m.senderId === self.id && now - Date.parse(m.createdAt) < 3600_000).length ?? 0), 0);
        need(lastHour < RATE.messagesPerHour, "You've sent a lot of messages in the last hour. Please wait a little.");
        const id = a.clientId && /^[\w-]{8,64}$/.test(a.clientId) ? a.clientId : ctx.uuid();
        p.messages.push({ id, senderId: self.id, senderName: self.name, text, createdAt: iso() });
        touchPair(pair);
        notify(them, 'message', `New message from ${self.name} about "${p.agreement.title}".`, { projectId: p.id });
        return { ok: true, message: '' };
      }
      case 'end_early': {
        need(pair.status === 'active' || pair.status === 'completion_pending', 'Only an active project can be stopped. A proposed project can be passed.');
        const note = clean(a.note);
        const e = textError(note, 'A short note', LIMITS.closing, true);
        need(!e, e, 'note');
        pair.status = 'ended_early';
        Object.assign(p, { endedBy: self.id, endedReason: note, endedAt: iso() });
        p.messages.push({ id: ctx.uuid(), senderId: 'system', senderName: 'probono', text: `${self.name} stopped the project: ${note}`, createdAt: iso(), system: true });
        touchPair(pair);
        refreshRole(pair.postingId);
        notify(them, 'ended', `${self.name} stopped "${p.agreement.title}".`, { projectId: p.id });
        return { ok: true, message: 'The project is stopped. Remember to remove any system access you granted.' };
      }
      case 'complete': {
        need(pair.status === 'active' || pair.status === 'completion_pending', 'Only an active project can be completed.');
        const note = clean(a.note);
        const e = textError(note, 'Your closing note', LIMITS.closing, true);
        need(!e, e, 'note');
        if (side === 'nonprofit') {
          need(['yes', 'partly', 'no'].includes(a.unblocked ?? ''), 'Tell us whether this unblocked you.', 'unblocked');
          need(typeof a.hoursOk === 'boolean', 'Tell us whether the logged hours look right.', 'hoursOk');
        }
        p.closing[side] = { note, at: iso(), publish: !!a.publish, ...(side === 'nonprofit' ? { unblocked: a.unblocked, hoursOk: a.hoursOk } : {}) };
        if (p.closing[otherSide]) { finish(pair); return { ok: true, message: 'Project complete. Thank you for giving your time.' }; }
        pair.status = 'completion_pending';
        touchPair(pair);
        notify(them, 'completion_requested', `${self.name} marked "${p.agreement.title}" complete. Add your closing note to finish it.`, { projectId: p.id });
        return { ok: true, message: 'Closing note saved. The project completes when they add theirs.' };
      }
      case 'demo_other_side': {
        // Demo only: plays the other side's next step so one visitor can see the whole story.
        // Every simulated step is written into the project as a labeled demo note.
        need(ctx.demo, 'Only available in the demo.');
        if (pair.status === 'pending') {
          need(!accepted(p, otherSide), `${themName} has already accepted this version.`);
          need(!Object.keys(agreementErrors(p.agreement, minStartFor(p.pendingUntil))).length, 'The agreement needs every required field before anyone can accept it.');
          p.acceptances.push({ side: otherSide, actorId: them, actorName: themName, version: p.agreement.version, at: iso(), confidentiality: true, licensing: true });
          demoNote(`Demo: ${themName} accepting version ${p.agreement.version} was simulated.`);
          if (!accepted(p, side)) { touchPair(pair); return { ok: true, message: `Simulated: ${themName} accepted version ${p.agreement.version}. Your turn.` }; }
          activate();
          p.messages.push({ id: ctx.uuid(), senderId: them, senderName: themName, createdAt: iso(),
            text: side === 'volunteer' ? "Thanks for taking this on! I'll send last year's spending export before our first call." : "Looking forward to it. I'll read the export before our first call." });
          p.deliverables.push({ id: ctx.uuid(), text: 'Draft budget categories from last year\'s spending', done: false });
          p.checkInDate = `${p.startDate}T15:00:00.000Z`;
          p.checkInAgenda = 'Kickoff: walk through last year\'s spending together';
          touchPair(pair);
          return { ok: true, message: 'Project confirmed' };
        }
        if (pair.status === 'completion_pending' && !p.closing[otherSide]) {
          p.closing[otherSide] = otherSide === 'nonprofit'
            ? { note: 'We have a budget we can actually keep up, and the board approved it. Thank you.', at: iso(), publish: true, unblocked: 'yes', hoursOk: true }
            : { note: 'A prepared, generous team. It was a pleasure to work together.', at: iso(), publish: true };
          demoNote(`Demo: ${themName}'s closing note was simulated.`);
          finish(pair);
          return { ok: true, message: 'Project complete.' };
        }
        throw new AppError(`There's nothing for ${themName} to do right now.`);
      }
    }

    // Workspace tools: only while the project is active.
    need(pair.status === 'active' || pair.status === 'completion_pending', pair.status === 'pending' ? 'Confirm the project before using the workspace.' : 'This project has ended.');
    stillTogether();
    const note = clean(a.note);
    switch (a.action) {
      case 'log_hours': {
        need(side === 'volunteer', 'Only the volunteer logs hours.');
        const h = Number(a.hours);
        need(Number.isFinite(h) && h >= LIMITS.hoursPerEntry.min && h <= LIMITS.hoursPerEntry.max, 'Add between 0.25 and 24 hours.', 'hours');
        need(/^\d{4}-\d{2}-\d{2}$/.test(a.date ?? ''), 'Add a valid date.', 'date');
        const last = p.endDate < today ? p.endDate : today;
        need(a.date! >= p.startDate && a.date! <= last, 'Log hours within the project dates, not in the future.', 'date');
        const e = textError(note, 'Note', LIMITS.headline);
        need(!e, e, 'note');
        p.hours.push({ id: ctx.uuid(), date: a.date!, hours: Math.round(h * 100) / 100, note });
        break;
      }
      case 'add_deliverable': {
        const e = textError(note, 'Task', { min: 1, max: LIMITS.headline.max }, true);
        need(!e, e, 'note');
        need(p.deliverables.length < 40, 'That is a lot of tasks. Combine a few first.');
        p.deliverables.push({ id: ctx.uuid(), text: note, done: false });
        break;
      }
      case 'toggle_deliverable': {
        const item = p.deliverables.find((x) => x.id === a.itemId);
        need(item, 'Task not found.');
        item.done = !item.done;
        break;
      }
      case 'kickoff': {
        const k = a.itemId as keyof Project['kickoff'];
        need(['contact', 'scope', 'inputs', 'access'].includes(k), 'Unknown checklist item.');
        p.kickoff[k] = !p.kickoff[k];
        break;
      }
      case 'check_in': {
        need(a.date && Number.isFinite(Date.parse(a.date)), 'Add a check-in date and time.', 'date');
        const e = textError(note, 'Agenda', LIMITS.longText);
        need(!e, e, 'note');
        p.checkInDate = new Date(Date.parse(a.date)).toISOString();
        p.checkInAgenda = note;
        break;
      }
      case 'add_link': {
        let url: URL;
        try { url = new URL(clean(a.url)); } catch { throw new AppError('Add a valid web address.', 400, 'url'); }
        need(['https:', 'http:'].includes(url.protocol), 'Use a web link that starts with https://.', 'url');
        const e = textError(a.name ?? '', 'Link name', LIMITS.name, true);
        need(!e, e, 'name');
        need(p.links.length < 20, 'You can keep up to 20 links.');
        p.links.push({ id: ctx.uuid(), name: clean(a.name), url: url.toString() });
        break;
      }
      case 'remove_link': p.links = p.links.filter((x) => x.id !== a.itemId); break;
      case 'add_member': {
        const e = textError(a.member?.name ?? '', 'Name', LIMITS.name, true);
        need(!e, e, 'name');
        const email = clean(a.member?.email);
        need(!email || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && len(email) <= 160), 'Check the email address.', 'email');
        need(p.team.length < 20, 'You can list up to 20 people.');
        p.team.push({ id: ctx.uuid(), name: clean(a.member!.name), role: clean(a.member!.role).slice(0, 120), email });
        break;
      }
      case 'remove_member': p.team = p.team.filter((x) => x.id !== a.itemId); break;
      default: throw new AppError('Unknown action.');
    }
    touchPair(pair);
    return { ok: true, message: 'Saved.' };
  }

  function myPair(projectId?: string): Pair {
    const r = db.pairs.find((x) => x.id === projectId);
    // The same answer for "doesn't exist" and "not yours", so ids can't be probed.
    need(r?.data.project && me && sideOf(r, me.id), 'Project not found.');
    return r;
  }

  // --- Reading ------------------------------------------------------------------------------
  function reviewsFor(id: string): ReviewBadge[] {
    const kinds: ReviewKind[] = ['organization', 'identity', 'credential'];
    return kinds.map((k) => latestReview(id, k)).filter((r): r is ReviewRow => !!r)
      .map((r) => ({ kind: r.kind, status: r.status, method: r.method, decidedAt: r.decidedAt, demo: r.demo }));
  }
  function publicProfile(p: Profile): Profile {
    const closed = db.pairs.filter((r) => r.status === 'closed' && r.data.project && (r.volunteerId === p.id || orgOf(r) === p.id));
    let selfReported = 0, confirmed = 0;
    const quotes: Profile['quotes'] = [];
    for (const r of closed) {
      const proj = r.data.project!;
      const hours = proj.hours.reduce((n, h) => n + h.hours, 0);
      if (p.kind === 'volunteer') { selfReported += hours; if (proj.closing.nonprofit?.hoursOk) confirmed += hours; }
      const fromOther = p.kind === 'volunteer' ? proj.closing.nonprofit : proj.closing.volunteer;
      if (fromOther?.publish && fromOther.note) {
        quotes.push({ author: (p.kind === 'volunteer' ? proj.nonprofit : proj.volunteer).name, text: fromOther.note, projectTitle: proj.agreement.title, fictional: !!(proj.volunteer.fictional || proj.nonprofit.fictional) });
      }
    }
    return {
      ...structuredClone(p),
      record: { completedProjects: closed.length, hoursSelfReported: selfReported, hoursConfirmed: confirmed },
      reviews: reviewsFor(p.id),
      quotes: quotes.slice(-3),
    };
  }
  function hydrate(r: Pair): Project {
    const p = structuredClone(r.data.project!);
    const v = people.get(r.volunteerId), o = people.get(orgOf(r));
    p.volunteer = v && !v.deleted ? publicProfile(v) : { ...p.volunteer, name: v?.deleted ? 'Deleted account' : p.volunteer.name, photos: v?.deleted ? [] : p.volunteer.photos };
    p.nonprofit = o && !o.deleted ? publicProfile(o) : { ...p.nonprofit, name: o?.deleted ? 'Deleted account' : p.nonprofit.name, photos: o?.deleted ? [] : p.nonprofit.photos };
    p.status = r.status as ProjectStatus;
    p.volunteerConfirmed = accepted(p, 'volunteer');
    p.nonprofitConfirmed = accepted(p, 'nonprofit');
    p.minStart = minStartFor(p.pendingUntil);
    p.missing = Object.keys(agreementErrors(p.agreement, r.status === 'pending' ? p.minStart : '0000-00-00'));
    p.totalHours = p.hours.reduce((sum, h) => sum + h.hours, 0);
    if (p.startDate) {
      const weeks = p.agreement.weeks || 1;
      const elapsed = Math.floor((Date.parse(today) - Date.parse(p.startDate)) / (7 * DAY));
      p.week = Math.min(weeks, Math.max(0, elapsed + 1)); // 0 means "starts soon"
      const weekStart = addDays(p.startDate, Math.max(0, p.week - 1) * 7);
      const weekEnd = addDays(weekStart, 7);
      p.weekHours = p.hours.filter((h) => h.date >= weekStart && h.date < weekEnd).reduce((s, h) => s + h.hours, 0);
      p.finalWeek = today >= addDays(p.endDate, -7);
    }
    return p;
  }

  function buildState(): AppState {
    const empty: AppState = {
      profile: null, needsOnboarding: true, postings: [], prospects: [], capacity: { full: false, reason: '' }, reviewGate: null,
      projects: [], notice: null, notifications: [], unread: 0, blocked: [], demo: ctx.demo, now: iso(),
    };
    if (!me) return empty;
    const viewer = me;
    const np = viewer.kind === 'nonprofit';
    const myRoles = db.postings.filter((p) => p.orgId === viewer.id).map((p) => ({ ...p, visible: postingVisible(p) }));
    const selected = myRoles.find((p) => p.id === selectedPostingId) ?? myRoles.find((p) => p.status !== 'Complete') ?? myRoles[0];
    const mine = db.pairs.filter((r) => r.data.project && sideOf(r, viewer.id));
    const busyPair = np ? mine.find((r) => busy(r.status) && r.postingId === selected?.id) : mine.find((r) => busy(r.status));
    const reviewStatus = np ? latestReview(viewer.id, 'organization')?.status ?? 'not_submitted' : null;
    const waiting = np && reviewStatus !== 'reviewed';

    const prospects: Prospect[] = [];
    if (!viewer.paused && !restricted.has(viewer.id) && !waiting) {
      for (const role of db.postings) {
        if (np && role.id !== selected?.id) continue;
        if (role.status !== 'Open' || !postingVisible(role) || db.pairs.some((r) => r.postingId === role.id && busy(r.status))) continue;
        if (!np && blockedBetween(viewer.id, role.orgId)) continue;
        for (const v of people.values()) {
          if (v.kind !== 'volunteer' || (!np && v.id !== viewer.id)) continue;
          if (np && blockedBetween(viewer.id, v.id)) continue;
          if (!fits(v, role) || db.pairs.some((r) => r.volunteerId === v.id && busy(r.status) && (np || r.postingId !== role.id))) continue;
          const r = db.pairs.find((x) => x.postingId === role.id && x.volunteerId === v.id);
          if (r && (r.status !== 'interest' || (np ? r.data.nonprofitInterested : r.data.volunteerInterested))) continue;
          const org = people.get(role.orgId)!;
          prospects.push({
            profile: publicProfile(np ? v : org),
            posting: { ...role, notesLeft: np ? role.notesLeft : 0 },
            interestedInYou: !!(np ? r?.data.volunteerInterested : r?.data.nonprofitInterested),
            note: (np ? r?.data.volunteerNote : r?.data.nonprofitNote) ?? '',
          });
        }
      }
    }
    prospects.sort((x, y) => Number(y.interestedInYou) - Number(x.interestedInYou));

    const ordered = [...mine].sort((x, y) => Number(busy(y.status)) - Number(busy(x.status)) || (y.data.project!.createdAt).localeCompare(x.data.project!.createdAt));
    const unacked = (r: Pair) => r.data.acknowledgements[viewer.id] !== r.status;
    const n1 = mine.find((r) => r.status === 'pending' && unacked(r));
    const n2 = mine.find((r) => r.status === 'active' && unacked(r) && r.data.acknowledgements[viewer.id] !== 'active');
    // No pop-up for an ending you caused yourself.
    const n3 = mine.find((r) => (ENDED as string[]).includes(r.status) && r.status !== 'passed' && unacked(r) && r.data.acknowledgements[viewer.id] !== undefined && r.data.project?.endedBy !== viewer.id);
    const n3b = mine.find((r) => r.status === 'passed' && r.data.project && unacked(r) && r.data.project.endedBy !== viewer.id);
    const notice: AppState['notice'] = n1 ? { kind: 'mutual', projectId: n1.id } : n2 ? { kind: 'confirmed', projectId: n2.id }
      : n3 ? { kind: 'ended', projectId: n3.id } : n3b ? { kind: 'ended', projectId: n3b.id } : null;

    const myNotes = db.notifications.filter((n) => n.recipientId === viewer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      profile: publicProfile(viewer),
      needsOnboarding: false,
      postings: myRoles,
      prospects,
      capacity: busyPair
        ? { full: true, projectId: busyPair.id, reason: np ? 'This posting already has a proposed or active project. Showing interest opens again when it ends.' : 'You already have a proposed or active project. Showing interest opens again when it ends.' }
        : { full: false, reason: '' },
      reviewGate: np ? { waiting, status: reviewStatus! } : null,
      projects: ordered.map(hydrate),
      notice,
      notifications: myNotes.slice(0, 30).map(({ recipientId: _r, ...n }) => n),
      unread: myNotes.filter((n) => !n.readAt).length,
      blocked: db.blocks.filter((b) => b.blockerId === viewer.id).map((b) => ({ id: b.blockedId, name: people.get(b.blockedId)?.name ?? 'Deleted account' })),
      demo: ctx.demo,
      now: iso(),
    };
  }
}

export const INVITE_MESSAGES: Record<InviteOutcome, string> = {
  ok: '',
  invalid: "We couldn't find that invite code. Check for typos, or ask the person who invited you.",
  expired: 'That invite has expired. Ask the person who invited you for a new one.',
  redeemed: 'That invite has already been used.',
  revoked: 'That invite is no longer active.',
  wrong_email: 'That invite was issued for a different email address. Sign up with the address it was sent to.',
  too_many: 'Too many attempts. Please wait an hour and try again.',
};

// Helpers the server uses to keep a project's agreement valid when read for export.
export function intOk(v: unknown, r: { min: number; max: number }) { return !intError(v, 'x', r); }
