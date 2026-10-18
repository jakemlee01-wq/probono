// Fictional people, organizations, and projects for the demo. They live only in each visitor's
// browser (src/lib/demo-store.ts) and are never written to the real database.
// Dates are relative to "now" so the demo always tells a coherent story.
import type { Db, Pair, ReviewRow } from './core.ts';
import { draftAgreement } from './core.ts';
import { addDays, pilotDate } from './rules.ts';
import type { AgreementFields, Posting, Profile, Project, Terms } from './types.ts';

// The guided story is Sally (volunteer) and Eastside Food Shelf (nonprofit) on a budget template.
// Marcus and Northside are there for free exploration.
export const DEMO_PERSONAS = [
  { id: 'sally', name: 'Sally', kind: 'volunteer', blurb: 'The volunteer in the guided story.' },
  { id: 'eastside', name: 'Eastside Food Shelf', kind: 'nonprofit', blurb: 'The nonprofit in the guided story.' },
  { id: 'marcus', name: 'Marcus', kind: 'volunteer', blurb: "Another volunteer. He's interested in Northside's posting." },
  { id: 'northside', name: 'Northside Youth Housing', kind: 'nonprofit', blurb: 'Another nonprofit, with two postings.' },
] as const;
export const GUIDED_POSTING = 'eastside-budget';

// Prepared agreements, so visitors can read and accept one instead of writing a contract.
// Real projects start from a blank draft and need both sides to fill it in.
export function demoPrefill(postingId: string): Partial<AgreementFields> | undefined {
  const common = { accessLevel: 'none' as const, checkInPlan: '30-minute video call every Tuesday at 4 pm. Either of us can pause or stop the project there.' };
  const by: Record<string, Partial<AgreementFields>> = {
    'eastside-budget': {
      nonprofitContact: 'Ruth, executive director',
      deliverables: "A one-page budget template in our shared spreadsheet, with last year's actual spending filled in, plus a 30-minute walkthrough for Ruth and our treasurer.",
      acceptance: 'Ruth updates the template for next quarter without help, and the board can read it at its next meeting.',
      inScope: "Grouping last year's spending into budget categories, building the template, and the walkthrough.",
      exclusions: 'No changes to bank or bookkeeping records, no tax filings, and no grant reports.',
      inputs: "An export of last year's spending and the current grant list, sent by Ruth before the first call.",
      accessSystems: 'Spending export and grant list, shared as files. No logins.',
    },
    'northside-reports': {
      nonprofitContact: 'Dana, finance manager',
      deliverables: 'Three saved monthly report templates and a one-page guide for running them.',
      acceptance: 'Dana runs one month-end set of reports from the templates without help.',
      inScope: 'Designing and saving the three report templates, and the guide.',
      exclusions: 'No changes to posted transactions, users, or system settings.',
      inputs: 'Exports of last month\'s reports and a list of what the board asks for.',
      accessSystems: 'Report exports shared as files. A screen share for the walkthrough.',
    },
    'northside-budget': {
      nonprofitContact: 'Dana, finance manager',
      deliverables: 'One combined program budget workbook and a short note on how to update it.',
      acceptance: 'The board finance committee reviews it without asking for a rebuild.',
      inScope: 'Combining the three program spreadsheets into one budget.',
      exclusions: 'No payroll changes and no grant reports.',
      inputs: 'The three current program spreadsheets.',
      accessSystems: 'Spreadsheets shared as files.',
    },
    'riverside-netsuite': {
      nonprofitContact: 'Maya, operations director',
      deliverables: 'Program reports for the new grant set up in NetSuite, and a one-page guide.',
      acceptance: 'Maya runs the grant report for one month without help.',
      inScope: 'Report setup and a walkthrough.',
      exclusions: 'No changes to posted transactions, users, or integrations.',
      inputs: 'The grant budget and the current chart of accounts.',
      accessSystems: 'Screen share only. Maya makes any changes in the system herself.',
    },
  };
  return by[postingId] ? { ...common, ...by[postingId] } : undefined;
}
export type DemoPersonaId = (typeof DEMO_PERSONAS)[number]['id'];
export const demoUserId = (id: string) => `demo:${id}`;

const photo = (n: string) => `/assets/demo-photos/${n}.jpg`;

export function demoDb(now: number): Db {
  const today = pilotDate(now);
  const year = new Date(now).getUTCFullYear();
  const volunteerTerms: Terms = { hoursPerWeek: 5, weeks: 5, minWeeks: 4, maxWeeks: 6, startDate: today, availableUntil: addDays(today, 120), format: 'Remote' };
  const postingTerms = (startIn: number, weeks = 5): Terms => ({ ...volunteerTerms, weeks, startDate: addDays(today, startIn), availableUntil: addDays(today, startIn + 90) });
  const person = (id: string, kind: Profile['kind'], name: string, extra: Partial<Profile>): Profile => ({
    id, kind, name, title: '', years: null, credential: '', foundedYear: null, photos: [], skills: [], causes: [],
    terms: volunteerTerms, prompts: { first: '', second: '', third: '' }, paused: false, fictional: true, ...extra,
  });

  const people: Profile[] = [
    person('sally', 'volunteer', 'Sally', {
      title: 'Controller', years: 12, credential: 'CPA', photos: [photo('sally-1'), photo('sally-2')],
      skills: ['netsuite', 'accounting_systems', 'financial_reporting', 'budgeting', 'month_end_close'], causes: ['housing', 'youth', 'arts'],
      prompts: {
        first: 'Making NetSuite feel less overwhelming. I untangle systems so small teams can trust their reports.',
        second: 'Every young person deserves a safe place to call home.',
        third: 'A calm plan, a weekly call, and no question too small.',
      },
    }),
    person('marcus', 'volunteer', 'Marcus', {
      title: 'Systems accounting manager', years: 9, photos: [photo('marcus-1'), photo('marcus-2')],
      skills: ['netsuite', 'accounting_systems', 'financial_reporting', 'internal_controls'], causes: ['housing', 'youth', 'arts'],
      prompts: {
        first: 'Turning messy month-end steps into routines anyone on the team can run.',
        second: 'Housing and opportunity for young people. I coach youth basketball on Saturdays.',
        third: 'Practical and patient. I write down every step so nothing depends on me.',
      },
    }),
    person('priya', 'volunteer', 'Priya', {
      title: 'Senior FP&A analyst', years: 7, photos: [photo('priya-1'), photo('priya-2')],
      skills: ['budgeting', 'financial_reporting', 'grant_accounting', 'quickbooks'], causes: ['food_security', 'education', 'youth'],
      prompts: {
        first: 'Budgets that tell a story your whole board can follow.',
        second: 'Good food and a fair start for everyone.',
        third: 'Curious questions and one shared spreadsheet with a clear purpose.',
      },
    }),
    person('northside', 'nonprofit', 'Northside Youth Housing', {
      title: 'A steadier start for young people', foundedYear: 2009, causes: ['housing', 'youth'],
      photos: [photo('northside-team'), photo('northside-dana')],
      prompts: {
        first: 'We help young people in North Minneapolis find stable housing and build a future.',
        second: 'Our two-person finance team spends the first week of every month rebuilding the same reports by hand.',
        third: 'Monthly reports that run in an afternoon, and a short guide our team can follow.',
      },
    }),
    person('riverside', 'nonprofit', 'Riverside Arts Collective', {
      title: 'Room for creativity, for everyone', foundedYear: 2014, causes: ['arts'],
      photos: [photo('riverside-maya'), photo('riverside-studio')],
      prompts: {
        first: 'We run free studio programs for neighbors across the Twin Cities.',
        second: 'A new grant requires program-level financial reports, so we moved from spreadsheets to NetSuite. The setup stalled halfway.',
        third: 'Program reports we trust, and a team that knows how to run them.',
      },
    }),
    person('eastside', 'nonprofit', 'Eastside Food Shelf', {
      title: 'Good food. Stronger neighbors.', foundedYear: year - 28, causes: ['food_security'],
      photos: [photo('eastside-ruth'), photo('eastside-distribution')],
      prompts: {
        first: 'We help neighbors put good food on the table, with dignity.',
        second: "We've never had a full annual budget, and our board has asked for one.",
        third: 'A simple budget we can update ourselves each quarter.',
      },
    }),
  ];
  const byId = (id: string) => people.find((p) => p.id === id)!;

  const posting = (id: string, orgId: string, title: string, skills: string[], terms: Terms, status: Posting['status'] = 'Open'): Posting => {
    const org = byId(orgId);
    return { id, orgId, title, skills, terms, prompts: { ...org.prompts }, status, notesLeft: status === 'Open' ? 5 : 3 };
  };
  const postings: Posting[] = [
    posting('northside-reports', 'northside', 'Month-end reporting cleanup', ['netsuite', 'financial_reporting'], postingTerms(7)),
    { ...posting('northside-budget', 'northside', 'Program budget for next year', ['budgeting'], postingTerms(14)),
      prompts: { first: byId('northside').prompts.first, second: 'Our program budgets live in three spreadsheets that disagree with each other.', third: 'One board-ready budget, and a team who knows how to update it.' } },
    posting('riverside-netsuite', 'riverside', 'Finish our NetSuite setup for grant reporting', ['netsuite', 'accounting_systems'], postingTerms(10)),
    { ...posting('eastside-budget', 'eastside', 'A simple annual budget template', ['budgeting'], { ...postingTerms(10, 4), hoursPerWeek: 3 }),
      prompts: { first: byId('eastside').prompts.first, second: "We've never had a full annual budget, and our board has asked for one.", third: 'A one-page budget template we can update ourselves each quarter.' } },
    // Past, completed work. The track records on each profile are counted from these.
    posting('riverside-coa', 'riverside', 'Chart of accounts for our new system', ['accounting_systems'], postingTerms(-150, 4), 'Complete'),
    posting('riverside-grants', 'riverside', 'Grant tracking workbook', ['grant_accounting'], postingTerms(-120, 4), 'Complete'),
    posting('northside-2024-budget', 'northside', 'Program budget refresh', ['budgeting'], postingTerms(-200, 5), 'Complete'),
  ];

  const doneWhen: Record<string, string> = {
    'eastside-budget': 'Ruth updates it for next quarter without help.',
    'northside-reports': 'Dana runs one month-end from the templates on her own.',
    'northside-budget': 'The board finance committee signs off on it.',
    'riverside-netsuite': 'Maya runs the grant report for one month on her own.',
  };
  for (const p of postings) if (doneWhen[p.id]) p.doneWhen = doneWhen[p.id];

  const pairs: Pair[] = [
    { id: 'eastside-budget-sally', postingId: 'eastside-budget', volunteerId: 'sally', status: 'interest', data: {
      nonprofitInterested: true, nonprofitInterestAt: new Date(now - 3600_000 * 20).toISOString(), acknowledgements: {},
      nonprofitNote: "You've built budgets for small teams before, and that's exactly what we need. A few hours a week would get us there.",
    } },
    { id: 'northside-reports-marcus', postingId: 'northside-reports', volunteerId: 'marcus', status: 'interest', data: {
      volunteerInterested: true, volunteerInterestAt: new Date(now - 3600_000 * 30).toISOString(), acknowledgements: {},
      volunteerNote: "Rebuilding month-end reports by hand is a problem I've fixed before. I'd like to help your team get that week back.",
    } },
    pastProject('riverside-coa', 'marcus', 'riverside', 150, 4, [
      ['volunteer', 'A clear, welcoming team. They knew their programs well, which made the chart of accounts easy to design.'],
      ['nonprofit', 'Marcus built a chart of accounts that matches how our programs actually run, and walked us through every line.', 'yes', true],
    ], [3, 4, 5, 4, 4]),
    pastProject('riverside-grants', 'priya', 'riverside', 120, 4, [
      ['volunteer', 'Organized, kind, and quick to answer questions. The workbook came together fast.'],
      ['nonprofit', 'Priya turned our grant notes into a workbook we update in ten minutes. Our last report went out on time.', 'yes', true],
    ], [6, 5, 6, 7]),
    pastProject('northside-2024-budget', 'sally', 'northside', 200, 5, [
      ['volunteer', 'Thoughtful people doing work that really matters. They made time for every check-in.'],
      ['nonprofit', 'Sally helped us rebuild our program budget so the board could finally follow it.', 'partly', true],
    ], [5, 6, 5, 6, 8]),
  ];

  function pastProject(postingId: string, volunteerId: string, orgId: string, daysAgo: number, weeks: number,
    notes: [string, string, ('yes' | 'partly' | 'no')?, boolean?][], hoursByWeek: number[]): Pair {
    const p = postings.find((x) => x.id === postingId)!;
    const created = now - (daysAgo + 5) * 86_400_000;
    const start = addDays(today, -daysAgo);
    const end = addDays(start, weeks * 7);
    const agreement = {
      ...draftAgreement(p, created), nonprofitContact: `${byId(orgId).name} finance lead`,
      deliverables: p.prompts.third, acceptance: 'The team can run it without help.', inScope: p.title, exclusions: 'Changes to live records.',
      inputs: 'Current files and a weekly call.', checkInPlan: 'Weekly 30-minute call.', version: 1,
    };
    const project: Project = {
      id: `${postingId}-${volunteerId}`, posting: structuredClone(p), volunteer: structuredClone(byId(volunteerId)), nonprofit: structuredClone(byId(orgId)),
      status: 'closed', createdAt: new Date(created).toISOString(), pendingUntil: new Date(created + 72 * 3600_000).toISOString(),
      agreement, agreementHistory: [], agreedVersion: 1,
      acceptances: (['volunteer', 'nonprofit'] as const).map((side) => ({ side, actorId: side === 'volunteer' ? volunteerId : orgId, actorName: side === 'volunteer' ? byId(volunteerId).name : byId(orgId).name, version: 1, at: new Date(created + 3600_000).toISOString(), confidentiality: true, licensing: true })),
      startDate: start, endDate: end, kickoff: { contact: true, scope: true, inputs: true, access: true },
      messages: [], deliverables: [], links: [], team: [], checkInDate: '', checkInAgenda: '',
      hours: hoursByWeek.map((h, i) => ({ id: `${postingId}-h${i}`, date: addDays(start, i * 7 + 2), hours: h, note: 'Work session' })),
      closing: Object.fromEntries(notes.map(([side, note, unblocked, hoursOk]) => [side, { note, at: new Date(Date.parse(end)).toISOString(), publish: true, ...(side === 'nonprofit' ? { unblocked, hoursOk } : {}) }])),
      endedAt: `${end}T18:00:00.000Z`,
    };
    return { id: project.id, postingId, volunteerId, status: 'closed', data: { acknowledgements: { [volunteerId]: 'closed', [orgId]: 'closed' }, project } };
  }

  const reviews: ReviewRow[] = ['northside', 'riverside', 'eastside'].map((profileId) => ({
    profileId, kind: 'organization', status: 'reviewed', method: 'Demo record. No real review took place.', decidedAt: addDays(today, -300), demo: true,
  }));

  return {
    profiles: people.map((p) => ({ id: p.id, userId: DEMO_PERSONAS.some((d) => d.id === p.id) ? demoUserId(p.id) : null, data: p })),
    postings, pairs, reviews, restricted: [], blocks: [], reports: [], notifications: [],
  };
}
