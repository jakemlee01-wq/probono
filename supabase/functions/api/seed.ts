// Demo data and demo accounts. Seeds once on the first request, and "Reset demo" restores it.
// Dates are relative to today so the demo always works, whatever day someone opens it.
import type postgres from 'npm:postgres@3.4.4';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';
import type { DemoAccount, Posting, Profile } from '../_shared/types.ts';
import { baseProfile, isDemoMode, LOCK_ID } from './common.ts';

export { isDemoMode };

export const INVITE_CODES = ['TWINCITIES', 'GIVE5', 'FINANCEFORGOOD'];
export const DEMO_ACCOUNTS: (DemoAccount & { email: string })[] = [
  { id: 'sally', name: 'Sally', kind: 'volunteer', email: 'sally.demo@probono.example.com' },
  { id: 'marcus', name: 'Marcus', kind: 'volunteer', email: 'marcus.demo@probono.example.com' },
  { id: 'riverside', name: 'Riverside', kind: 'nonprofit', email: 'riverside.demo@probono.example.com' },
  { id: 'northside', name: 'Northside', kind: 'nonprofit', email: 'northside.demo@probono.example.com' },
];
const photos: Record<string, string[]> = {
  sally: ['/assets/demo-photos/sally-1.jpg', '/assets/demo-photos/sally-2.jpg'],
  marcus: ['/assets/demo-photos/marcus-1.jpg', '/assets/demo-photos/marcus-2.jpg'],
  priya: ['/assets/demo-photos/priya-1.jpg', '/assets/demo-photos/priya-2.jpg'],
  northside: ['/assets/demo-photos/northside-team.jpg', '/assets/demo-photos/northside-dana.jpg'],
  riverside: ['/assets/demo-photos/riverside-maya.jpg', '/assets/demo-photos/riverside-studio.jpg'],
  eastside: ['/assets/demo-photos/eastside-ruth.jpg', '/assets/demo-photos/eastside-distribution.jpg'],
};

function demoData() {
  const p = (id: string, kind: Profile['kind'], name: string, extra: Partial<Profile>): Profile =>
    ({ ...baseProfile(id, kind, name), photos: photos[id] ?? [], ...extra });
  const people: Profile[] = [
    p('sally', 'volunteer', 'Sally', {
      title: 'Controller', years: 12, credential: 'CPA',
      skills: ['NetSuite', 'Accounting systems', 'Financial reporting', 'Budgeting', 'Month-end close'],
      causes: ['Housing', 'Youth', 'Arts'], completedProjects: 4, hoursGiven: 96,
      prompts: {
        first: 'Making NetSuite feel less overwhelming. I untangle systems so your team can get back to what matters.',
        second: 'Every young person deserves a safe place to call home.',
        third: 'A calm plan, a weekly conversation, and no question too small.',
      },
      quotes: [{ author: 'A past nonprofit partner', text: 'Sally helped us understand our numbers, not just fix them.' }],
    }),
    p('marcus', 'volunteer', 'Marcus', {
      title: 'Systems accounting manager', years: 9,
      skills: ['NetSuite', 'Accounting systems', 'Financial reporting', 'Internal controls'],
      causes: ['Housing', 'Youth', 'Arts'], completedProjects: 3, hoursGiven: 72,
      prompts: {
        first: 'Turning messy systems into reliable routines.',
        second: 'Housing and opportunity for young people. I coach youth basketball on Saturdays.',
        third: 'Practical, patient, and happy to document everything.',
      },
    }),
    p('priya', 'volunteer', 'Priya', {
      title: 'Senior FP&A', years: 7,
      skills: ['Budgeting', 'Financial reporting', 'Grant accounting', 'QuickBooks'],
      causes: ['Food security', 'Education', 'Youth'], completedProjects: 2, hoursGiven: 48,
      prompts: {
        first: 'Budgets that tell a story your whole team can understand.',
        second: 'Good food and a fair start for everyone.',
        third: 'Curious questions and a shared spreadsheet with a clear purpose.',
      },
    }),
    p('northside', 'nonprofit', 'Northside Youth Housing', {
      title: 'A steadier start for young people', causes: ['Housing', 'Youth'], completedProjects: 2,
      quotes: [{ author: 'A past volunteer', text: 'A thoughtful team doing work that really matters.' }],
      prompts: {
        first: 'We help young people in North Minneapolis find stable housing and build a future.',
        second: 'Our finance team is small. We need reliable reports without the late nights.',
        third: 'More time for young people, less time chasing numbers.',
      },
    }),
    p('riverside', 'nonprofit', 'Riverside Arts Collective', {
      title: 'Room for creativity, for everyone', causes: ['Arts'], completedProjects: 3,
      quotes: [{ author: 'A past volunteer', text: 'Creative, welcoming people who made every hour worthwhile.' }],
      prompts: {
        first: 'We make art accessible to our neighbors across the Twin Cities.',
        second: 'Our NetSuite migration stalled and we need a patient guide.',
        third: 'A confident team and reports we can trust.',
      },
    }),
    p('eastside', 'nonprofit', 'Eastside Food Shelf', {
      title: 'Good food. Stronger neighbors.', causes: ['Food security'],
      prompts: {
        first: 'We help neighbors put good food on the table, with dignity.',
        second: "We have never had a full annual budget and don't know where to begin.",
        third: 'A simple, useful budget we can maintain ourselves.',
      },
    }),
  ];
  const terms = people[0].terms;
  const role = (id: string, orgId: string, title: string, skills: string[], second: string, third: string, first?: string): Posting => ({
    id, orgId, title, skills, terms,
    prompts: { first: first ?? people.find((x) => x.id === orgId)!.prompts.first, second, third },
    status: 'Open', notesLeft: 5,
  });
  const roles: Posting[] = [
    role('northside-netsuite', 'northside', 'NetSuite cleanup & reporting', ['NetSuite', 'Financial reporting'],
      'Help us untangle our NetSuite reports and tidy up our month-end process.', 'Clear monthly reports and a short guide our team can use.'),
    role('northside-budget', 'northside', 'Annual budget', ['Budgeting'],
      'Help us build a practical annual budget for our housing programs.', 'A board-ready budget and a team who knows how to update it.'),
    role('riverside-netsuite', 'riverside', 'NetSuite migration rescue', ['NetSuite', 'Accounting systems'],
      'Our NetSuite migration stalled and we need a patient guide.', 'A confident team and reports we can trust.'),
    role('eastside-budget', 'eastside', 'Our first annual budget', ['Budgeting'],
      "We have never had a full annual budget and don't know where to begin.", 'A simple, useful budget we can maintain ourselves.'),
  ];
  const interests: [string, string, 'volunteer' | 'nonprofit', string][] = [
    ['riverside-netsuite', 'sally', 'nonprofit', "Your calm approach to NetSuite is exactly what our small team needs. We'd love to work with you."],
    ['northside-netsuite', 'marcus', 'volunteer', "I'd love to help make your month-end reports easier so your team can focus on young people."],
  ];
  return { people, roles, interests };
}

export async function writeDemoRows(tx: postgres.TransactionSql) {
  const { people, roles, interests } = demoData();
  const orgIds = people.filter((p) => p.kind === 'nonprofit').map((p) => p.id);
  const volunteerIds = people.filter((p) => p.kind === 'volunteer').map((p) => p.id);
  await tx`delete from engagements where volunteer_id in ${tx(volunteerIds)} or posting_id in (select id from postings where org_id in ${tx(orgIds)})`;
  await tx`delete from postings where org_id in ${tx(orgIds)}`;
  for (const p of people) {
    await tx`insert into profiles (id, data) values (${p.id}, ${tx.json(p)}) on conflict (id) do update set data = excluded.data`;
  }
  for (const r of roles) {
    await tx`insert into postings (id, org_id, data) values (${r.id}, ${r.orgId}, ${tx.json(r)})`;
  }
  for (const [postingId, volunteerId, side, note] of interests) {
    const data = {
      volunteerInterested: side === 'volunteer', nonprofitInterested: side === 'nonprofit',
      volunteerNote: side === 'volunteer' ? note : '', nonprofitNote: side === 'nonprofit' ? note : '',
      acknowledgements: {},
    };
    await tx`insert into engagements (id, posting_id, volunteer_id, status, data) values (${`${postingId}-${volunteerId}`}, ${postingId}, ${volunteerId}, 'interest', ${tx.json(data)})`;
  }
  for (const code of INVITE_CODES) {
    await tx`insert into invites (code, remaining) values (${code}, 25) on conflict (code) do update set remaining = 25`;
  }
}

async function findUserId(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureDemoUsers(sql: postgres.Sql, admin: SupabaseClient) {
  for (const account of DEMO_ACCOUNTS) {
    const [row] = await sql<{ user_id: string | null }[]>`select user_id from profiles where id = ${account.id}`;
    if (row?.user_id) continue;
    let id = await findUserId(admin, account.email);
    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email, email_confirm: true, password: crypto.randomUUID() + 'Aa1!',
        user_metadata: { demo: true, name: account.name },
      });
      if (error) throw error;
      id = data.user.id;
    }
    await sql`update profiles set user_id = ${id} where id = ${account.id}`;
  }
}

// Runs on first use. Cheap afterward: one count query.
export async function ensureSeeded(sql: postgres.Sql, admin: SupabaseClient) {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from invites`;
  if (n === 0) {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
      const [{ m }] = await tx<{ m: number }[]>`select count(*)::int as m from invites`;
      if (m === 0) await writeDemoRows(tx);
    });
  }
  if (isDemoMode()) await ensureDemoUsers(sql, admin);
}

export async function resetDemo(sql: postgres.Sql, admin: SupabaseClient) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
    await writeDemoRows(tx);
  });
  await ensureDemoUsers(sql, admin);
}
