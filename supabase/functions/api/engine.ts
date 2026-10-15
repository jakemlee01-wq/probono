// The probono state machine. Every read and write goes through runEngine inside one
// database transaction, serialized with an advisory lock so two people can't both
// grab the same volunteer or posting at the same moment.
//
// Engagement lifecycle (per posting + volunteer pair):
//   interest -> pending (mutual, 72 h to confirm) -> active -> wrapping_up (final week) -> closed
//   exits: passed (not now / pass), lapsed (72 h ran out), ended_early
import type postgres from 'npm:postgres@3.4.4';
import {
  CAUSES, SKILLS,
  type ActionInput, type ActionResult, type AppState, type Posting, type Profile, type Project,
} from '../_shared/types.ts';
import { baseProfile, DAY, DEMO_IDS, isDemoMode, LOCK_ID } from './common.ts';

type Tx = postgres.TransactionSql;
type EngagementData = {
  volunteerInterested?: boolean;
  nonprofitInterested?: boolean;
  volunteerNote?: string;
  nonprofitNote?: string;
  acknowledgements: Record<string, string>;
  project?: Project;
};
type Pair = { id: string; posting_id: string; volunteer_id: string; status: string; data: EngagementData };

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function need(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AppError(message);
}

const busy = (status: string) => ['pending', 'active', 'wrapping_up'].includes(status);
const validDate = (v: string) => Number.isFinite(Date.parse(v));


function validateTerms(t: Posting['terms']) {
  need(t && t.hoursPerWeek > 0 && t.hoursPerWeek <= 40, 'Choose between 1 and 40 hours per week.');
  need(t.weeks >= 1 && t.weeks <= 52 && t.minWeeks >= 1 && t.maxWeeks >= t.minWeeks, 'Please check the project length.');
  need(validDate(t.startDate) && validDate(t.availableUntil) && Date.parse(t.startDate) < Date.parse(t.availableUntil), 'Please check your available dates.');
}

// A volunteer fits a posting when every required skill matches and the posting sits inside their terms.
function fits(v: Profile, p: Posting) {
  const start = Date.parse(p.terms.startDate);
  return !v.paused && p.status === 'Open' &&
    p.skills.every((s) => v.skills.includes(s)) &&
    p.terms.hoursPerWeek <= v.terms.hoursPerWeek &&
    p.terms.weeks >= v.terms.minWeeks && p.terms.weeks <= v.terms.maxWeeks &&
    p.terms.format === v.terms.format &&
    start >= Date.parse(v.terms.startDate) &&
    start + p.terms.weeks * 7 * DAY <= Date.parse(v.terms.availableUntil) + DAY;
}

// Only allow photos that are bundled demo assets or that this user uploaded to their own storage folder.
function photoAllowed(path: string, userId: string) {
  if (path.startsWith('/assets/demo-photos/')) return true;
  return path.includes(`/storage/v1/object/public/photos/${userId}/`);
}

export async function runEngine(tx: Tx, userId: string, action?: ActionInput, selectedPostingId?: string): Promise<AppState | ActionResult> {
  await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
  const profileRows = await tx<{ id: string; user_id: string | null; data: Profile }[]>`select id, user_id, data from profiles`;
  const roleRows = await tx<{ id: string; data: Posting }[]>`select id, data from postings`;
  const pairs = await tx<Pair[]>`select id, posting_id, volunteer_id, status, data from engagements`;
  const people = new Map(profileRows.map((r) => [r.id, r.data]));
  const roles = new Map(roleRows.map((r) => [r.id, r.data]));
  let me = people.get(profileRows.find((r) => r.user_id === userId)?.id ?? '');

  const saveProfile = async (p: Profile) => { people.set(p.id, p); await tx`update profiles set data = ${tx.json(p)} where id = ${p.id}`; };
  const saveRole = async (p: Posting) => { roles.set(p.id, p); await tx`update postings set data = ${tx.json(p)} where id = ${p.id}`; };
  const savePair = async (r: Pair) => { await tx`update engagements set status = ${r.status}, data = ${tx.json(r.data)} where id = ${r.id}`; };
  const refreshRole = async (id: string) => {
    const p = roles.get(id);
    if (!p) return;
    const occupied = pairs.find((r) => r.posting_id === id && busy(r.status));
    p.status = occupied ? (occupied.status === 'pending' ? 'Pending' : 'Active project')
      : pairs.some((r) => r.posting_id === id && r.status === 'closed') ? 'Complete' : 'Open';
    await saveRole(p);
  };
  const finish = async (r: Pair) => {
    const p = r.data.project!;
    if (r.status === 'closed' || !p.volunteerClosingNote || !p.nonprofitClosingNote || Date.now() < Date.parse(p.endDate)) return;
    r.status = p.status = 'closed';
    p.totalHours = p.hours.reduce((n, h) => n + h.hours, 0);
    const credits: [string, string, string][] = [
      [r.volunteer_id, p.nonprofitClosingNote, p.nonprofit.name],
      [p.posting.orgId, p.volunteerClosingNote, p.volunteer.name],
    ];
    for (const [id, note, author] of credits) {
      const profile = people.get(id);
      if (!profile) continue;
      profile.completedProjects += 1;
      if (profile.kind === 'volunteer') profile.hoursGiven += p.totalHours;
      profile.quotes.push({ author, text: note });
      await saveProfile(profile);
    }
    await savePair(r);
    await refreshRole(r.posting_id);
  };

  // Time-based transitions run on every request, so nothing needs a scheduler.
  for (const r of pairs) {
    const p = r.data.project;
    if (!p) continue;
    if (r.status === 'pending' && Date.now() >= Date.parse(p.pendingUntil)) {
      r.status = p.status = 'lapsed';
      await savePair(r); await refreshRole(r.posting_id);
    }
    if (r.status === 'active' && Date.now() >= Date.parse(p.endDate) - 7 * DAY) {
      r.status = p.status = 'wrapping_up';
      await savePair(r);
    }
    if (['active', 'wrapping_up'].includes(r.status)) await finish(r);
  }

  if (action) {
    const a = action;
    if (a.action === 'onboard') {
      need(!me, 'Your profile is already set up.');
      need(a.kind && a.name && a.name.trim(), 'Choose your account type and name.');
      if (a.kind === 'volunteer') {
        const code = (a.inviteCode ?? '').trim().toUpperCase();
        const [invite] = await tx<{ code: string; remaining: number }[]>`select code, remaining from invites where code = ${code}`;
        need(invite && invite.remaining > 0, "That invite code isn't available.");
        await tx`update invites set remaining = remaining - 1 where code = ${invite.code}`;
      }
      me = baseProfile(crypto.randomUUID(), a.kind, a.name.trim().slice(0, 120));
      await tx`insert into profiles (id, user_id, data) values (${me.id}, ${userId}, ${tx.json(me)})`;
      return { ok: true, message: 'Welcome to probono.' };
    }
    need(me, 'Set up your profile first.');

    if (a.action === 'update_profile') {
      need(a.profile, 'Profile is required.');
      validateTerms(a.profile.terms);
      need(a.profile.name.trim(), 'Please add your name.');
      need(a.profile.skills.every((s) => SKILLS.includes(s)) && a.profile.causes.every((s) => CAUSES.includes(s)), 'Choose skills and causes from the list.');
      need(a.profile.photos.length <= 8 && a.profile.photos.every((p) => photoAllowed(p, userId) || me!.photos.includes(p)), 'Please upload photos using your own account.');
      const next: Profile = {
        ...a.profile, id: me.id, kind: me.kind,
        completedProjects: me.completedProjects, hoursGiven: me.hoursGiven, quotes: me.quotes,
      };
      await saveProfile(next);
      return { ok: true, message: 'Profile saved.' };
    }

    if (a.action === 'pause') {
      need(me.kind === 'volunteer', 'Only volunteers can pause their profile.');
      await saveProfile({ ...me, paused: !!a.paused });
      return { ok: true, message: a.paused ? 'Your profile is paused.' : "You're open to projects again." };
    }

    if (a.action === 'create_posting' || a.action === 'update_posting') {
      need(me.kind === 'nonprofit' && a.posting, 'A nonprofit posting is required.');
      validateTerms(a.posting.terms);
      need(a.posting.title.trim() && a.posting.skills.length > 0 && a.posting.skills.every((s) => SKILLS.includes(s)), 'Add a title and at least one skill.');
      if (a.action === 'create_posting') {
        const p: Posting = { ...a.posting, id: crypto.randomUUID(), orgId: me.id, status: 'Open', notesLeft: 5 };
        await tx`insert into postings (id, org_id, data) values (${p.id}, ${p.orgId}, ${tx.json(p)})`;
      } else {
        const existing = roles.get(a.posting.id);
        need(existing?.orgId === me.id && existing.status === 'Open', 'Only your open postings can be edited.');
        await saveRole({ ...a.posting, id: existing.id, orgId: me.id, status: existing.status, notesLeft: existing.notesLeft });
      }
      return { ok: true, message: 'Posting saved.' };
    }

    if (a.action === 'interest' || a.action === 'not_now') {
      const role = roles.get(a.postingId ?? '');
      const v = people.get(me.kind === 'volunteer' ? me.id : a.volunteerId ?? '');
      need(role && v?.kind === 'volunteer' && (me.kind === 'volunteer' || role.orgId === me.id), "This prospect isn't available.");
      need(!pairs.some((r) => busy(r.status) && (r.volunteer_id === v.id || r.posting_id === role.id)), 'There is already a pending or active project.');
      need(fits(v, role), 'The skills or availability no longer fit this project.');
      let pair = pairs.find((r) => r.posting_id === role.id && r.volunteer_id === v.id);
      if (!pair) {
        pair = { id: crypto.randomUUID(), posting_id: role.id, volunteer_id: v.id, status: 'interest', data: { acknowledgements: {} } };
        await tx`insert into engagements (id, posting_id, volunteer_id, status, data) values (${pair.id}, ${pair.posting_id}, ${pair.volunteer_id}, ${pair.status}, ${tx.json(pair.data)})`;
        pairs.push(pair);
      }
      need(pair.status === 'interest', 'This prospect has already been considered.');
      if (a.action === 'not_now') {
        pair.status = 'passed';
        await savePair(pair);
        return { ok: true, message: "We'll show you someone else." };
      }
      const volunteerSide = me.kind === 'volunteer';
      need(!pair.data[volunteerSide ? 'volunteerInterested' : 'nonprofitInterested'], "You've already shown interest.");
      const theyAlreadyAsked = volunteerSide ? pair.data.nonprofitInterested : pair.data.volunteerInterested;
      if (!volunteerSide && !theyAlreadyAsked) {
        // Nonprofits write a real note and get five per posting. Answering someone who already
        // showed interest is free.
        need((a.note ?? '').trim().length >= 20, 'Write a note of at least 20 characters.');
        need(role.notesLeft > 0, "You've used the five interest notes for this posting.");
        role.notesLeft -= 1;
        await saveRole(role);
      }
      pair.data[volunteerSide ? 'volunteerInterested' : 'nonprofitInterested'] = true;
      pair.data[volunteerSide ? 'volunteerNote' : 'nonprofitNote'] = (a.note ?? '').trim().slice(0, 3000);
      if (pair.data.volunteerInterested && pair.data.nonprofitInterested) {
        pair.status = 'pending';
        pair.data.project = {
          id: pair.id, posting: structuredClone(role), volunteer: structuredClone(v), nonprofit: structuredClone(people.get(role.orgId)!),
          status: 'pending', pendingUntil: new Date(Date.now() + 3 * DAY).toISOString(), volunteerConfirmed: false, nonprofitConfirmed: false,
          startDate: role.terms.startDate, endDate: new Date(Date.parse(role.terms.startDate) + role.terms.weeks * 7 * DAY).toISOString(),
          week: 1, totalHours: 0, weekHours: 0, messages: [], deliverables: [], links: [], team: [], hours: [],
          checkInDate: '', checkInAgenda: '', volunteerClosingNote: '', nonprofitClosingNote: '',
        };
        await savePair(pair);
        await refreshRole(role.id);
      } else {
        await savePair(pair);
      }
      return { ok: true, message: pair.status === 'pending' ? "It's mutual" : 'Interest sent', projectId: pair.data.project?.id };
    }

    const pair = pairs.find((r) => r.id === a.projectId);
    need(pair?.data.project, 'Project not found.');
    const p = pair.data.project;
    need(me.id === pair.volunteer_id || me.id === p.posting.orgId, "This project isn't yours.");
    const isVolunteer = me.id === pair.volunteer_id;

    if (a.action === 'acknowledge') {
      pair.data.acknowledgements[me.id] = pair.status;
      await savePair(pair);
      return { ok: true, message: 'Noted.' };
    }
    if (a.action === 'pass') {
      need(pair.status === 'pending', 'Only pending projects can be passed.');
      pair.status = p.status = 'passed';
      await savePair(pair); await refreshRole(pair.posting_id);
      return { ok: true, message: "You're back to discovery." };
    }
    if (a.action === 'confirm') {
      need(pair.status === 'pending', 'This confirmation window has closed.');
      if (isVolunteer) p.volunteerConfirmed = true; else p.nonprofitConfirmed = true;
      if (p.volunteerConfirmed && p.nonprofitConfirmed) {
        pair.status = p.status = 'active';
        p.startDate = new Date(Math.max(Date.now(), Date.parse(p.posting.terms.startDate))).toISOString();
        p.endDate = new Date(Date.parse(p.startDate) + p.posting.terms.weeks * 7 * DAY).toISOString();
      }
      await savePair(pair); await refreshRole(pair.posting_id);
      return { ok: true, message: pair.status === 'active' ? 'Project confirmed' : "You're confirmed. We'll let the other side know." };
    }
    if (a.action === 'demo_advance_week') {
      // Demo-only time travel so the hand-off and close can be tried without waiting weeks.
      need(isDemoMode() && DEMO_IDS.includes(me.id), 'Only available in the demo.');
      need(['active', 'wrapping_up'].includes(pair.status), 'Confirm the project first.');
      p.startDate = new Date(Date.parse(p.startDate) - 7 * DAY).toISOString();
      p.endDate = new Date(Date.parse(p.endDate) - 7 * DAY).toISOString();
      for (const h of p.hours) h.date = new Date(Date.parse(h.date) - 7 * DAY).toISOString().slice(0, 10);
      if (Date.now() >= Date.parse(p.endDate) - 7 * DAY) pair.status = p.status = 'wrapping_up';
      await savePair(pair);
      await finish(pair);
      return { ok: true, message: 'Moved ahead one week.' };
    }

    need(busy(pair.status), 'This project has ended.');
    const note = (a.note ?? '').trim().slice(0, 3000);
    if (a.action === 'message') {
      need(note, 'Write a message first.');
      p.messages.push({ id: crypto.randomUUID(), senderId: me.id, senderName: me.name, text: note, createdAt: new Date().toISOString() });
    } else {
      need(pair.status !== 'pending', 'Confirm the project before using the workspace.');
      if (a.action === 'log_hours') {
        need(isVolunteer, 'Only the volunteer can log hours.');
        need(a.hours && a.hours > 0 && a.hours <= 24 && a.date && validDate(a.date), 'Add valid hours and a date.');
        need(Date.parse(a.date) >= Date.parse(p.startDate.slice(0, 10)) && Date.parse(a.date) <= Math.min(Date.now(), Date.parse(p.endDate)), 'Log hours within the project dates, not in the future.');
        p.hours.push({ id: crypto.randomUUID(), date: a.date, hours: a.hours, note });
      } else if (a.action === 'add_deliverable') {
        need(note, 'Add a deliverable.');
        p.deliverables.push({ id: crypto.randomUUID(), text: note, done: false });
      } else if (a.action === 'toggle_deliverable') {
        const item = p.deliverables.find((x) => x.id === a.itemId);
        need(item, 'Deliverable not found.');
        item.done = !item.done;
      } else if (a.action === 'check_in') {
        need(a.date && validDate(a.date), 'Add a check-in date and time.');
        p.checkInDate = a.date; p.checkInAgenda = note;
      } else if (a.action === 'add_link') {
        let url: URL;
        try { url = new URL(a.url ?? ''); } catch { throw new AppError('Add a valid web address.'); }
        need(['https:', 'http:'].includes(url.protocol) && a.name && a.name.trim(), 'Use a web link with a name.');
        p.links.push({ id: crypto.randomUUID(), name: a.name.trim().slice(0, 120), url: url.toString() });
      } else if (a.action === 'remove_link') {
        p.links = p.links.filter((x) => x.id !== a.itemId);
      } else if (a.action === 'add_member') {
        need(a.member && a.member.name.trim(), "Add a team member's name.");
        p.team.push({ id: crypto.randomUUID(), name: a.member.name.trim(), role: a.member.role ?? '', email: a.member.email ?? '' });
      } else if (a.action === 'remove_member') {
        p.team = p.team.filter((x) => x.id !== a.itemId);
      } else if (a.action === 'close') {
        need(Date.now() >= Date.parse(p.endDate) - 7 * DAY, 'Hand-off opens in the final week.');
        need(note.length >= 10, 'Leave a short closing note of at least 10 characters.');
        if (isVolunteer) p.volunteerClosingNote = note; else p.nonprofitClosingNote = note;
        await finish(pair);
      } else if (a.action === 'end_early') {
        need(note.length >= 10, 'Leave a short note about ending the project.');
        pair.status = p.status = 'ended_early';
        p.messages.push({ id: crypto.randomUUID(), senderId: me.id, senderName: me.name, text: `Project ended early: ${note}`, createdAt: new Date().toISOString() });
        await savePair(pair);
        await refreshRole(pair.posting_id);
      } else {
        throw new AppError('Unknown action.');
      }
    }
    await savePair(pair);
    return {
      ok: true,
      message: a.action === 'close'
        ? pair.status === 'closed' ? 'Project complete. Thank you for giving your time.' : 'Closing note saved. The project closes after its end date once both notes are in.'
        : 'Saved.',
    };
  }

  if (!me) {
    return { profile: null, needsOnboarding: true, mode: 'discovery', postings: [], prospects: [], projects: [], currentProject: null, lastClosedProject: null, notification: '' };
  }
  const viewer = me;
  const myRoles = [...roles.values()].filter((p) => p.orgId === viewer.id);
  const selected = myRoles.find((p) => p.id === selectedPostingId) ?? myRoles.find((p) => p.status !== 'Complete') ?? myRoles[0];
  const myPairs = pairs.filter((r) => r.volunteer_id === viewer.id || roles.get(r.posting_id)?.orgId === viewer.id);
  const hydrate = (r: Pair): Project => {
    const p = structuredClone(r.data.project!);
    p.volunteer = people.get(r.volunteer_id) ?? p.volunteer;
    p.nonprofit = people.get(p.posting.orgId) ?? p.nonprofit;
    p.week = Math.min(p.posting.terms.weeks, Math.max(1, Math.floor((Date.now() - Date.parse(p.startDate)) / (7 * DAY)) + 1));
    p.totalHours = p.hours.reduce((sum, h) => sum + h.hours, 0);
    const weekStart = Date.parse(p.startDate.slice(0, 10)) + (p.week - 1) * 7 * DAY;
    p.weekHours = p.hours.filter((h) => Date.parse(h.date) >= weekStart && Date.parse(h.date) < weekStart + 7 * DAY).reduce((sum, h) => sum + h.hours, 0);
    return p;
  };
  const current = myPairs.find((r) => busy(r.status) && (viewer.kind === 'volunteer' || r.posting_id === selected?.id));
  const closed = myPairs.find((r) => ['closed', 'lapsed', 'ended_early', 'passed'].includes(r.status) && r.data.project && r.data.acknowledgements[viewer.id] !== r.status);

  const prospects: AppState['prospects'] = [];
  if (!current && !viewer.paused) {
    for (const role of roles.values()) {
      if (viewer.kind === 'nonprofit' && role.id !== selected?.id) continue;
      if (role.status !== 'Open' || pairs.some((r) => r.posting_id === role.id && busy(r.status))) continue;
      for (const v of people.values()) {
        if (v.kind !== 'volunteer' || (viewer.kind === 'volunteer' && v.id !== viewer.id)) continue;
        if (!fits(v, role) || pairs.some((r) => r.volunteer_id === v.id && busy(r.status))) continue;
        const r = pairs.find((x) => x.posting_id === role.id && x.volunteer_id === v.id);
        if (r && (r.status !== 'interest' || (viewer.kind === 'volunteer' ? r.data.volunteerInterested : r.data.nonprofitInterested))) continue;
        const org = people.get(role.orgId);
        if (!org) continue;
        prospects.push({
          profile: viewer.kind === 'volunteer' ? org : v,
          posting: role,
          interestedInYou: !!(viewer.kind === 'volunteer' ? r?.data.nonprofitInterested : r?.data.volunteerInterested),
          note: (viewer.kind === 'volunteer' ? r?.data.nonprofitNote : r?.data.volunteerNote) ?? '',
        });
      }
    }
  }
  prospects.sort((x, y) => Number(y.interestedInYou) - Number(x.interestedInYou));

  return {
    profile: viewer,
    needsOnboarding: false,
    mode: current ? (current.status === 'pending' ? 'pending' : 'project') : 'discovery',
    postings: myRoles,
    prospects,
    projects: myPairs.filter((r) => r.data.project).map(hydrate),
    currentProject: current ? hydrate(current) : null,
    lastClosedProject: closed ? hydrate(closed) : null,
    notification: current && current.data.acknowledgements[viewer.id] !== current.status
      ? current.status === 'pending' ? 'mutual' : current.status === 'active' ? 'confirmed' : ''
      : closed ? 'closed' : '',
  };
}
