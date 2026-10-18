// Real-account flows in the browser, against tests/e2e/devserver.ts (the real engine on the local
// test database). Sessions are injected, so this does not exercise Supabase Auth or email.
// Usage: node tests/e2e/live.mjs <site base> <api base> <screenshot dir>
import { chromium } from 'playwright';
const [base = 'http://localhost:4173/probono/', api = 'http://localhost:8787', out = '/tmp/shots'] = process.argv.slice(2);
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const sqlq = async (q) => (await fetch(api + '/__admin/sql', { method: 'POST', body: q })).json();
const uuid = () => crypto.randomUUID();
const session = (id) => JSON.stringify({ access_token: `x.${id}.y`, token_type: 'bearer', expires_in: 360000, expires_at: Math.floor(Date.now() / 1000) + 360000, refresh_token: 'r', user: { id, aud: 'authenticated', email: id + '@example.org', app_metadata: {}, user_metadata: {}, created_at: '' } });
async function as(id, w = 390, h = 844) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (id) await ctx.addInitScript((s) => localStorage.setItem('sb-localhost-auth-token', s), session(id));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails++; });
  return p;
}
const shot = (p, n, full = false) => p.screenshot({ path: `${out}/${n}.png`, fullPage: full });
const dialog = (p) => p.getByRole('dialog');
const wait = (p, ms = 500) => p.waitForTimeout(ms);
const noOverflow = async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

await sqlq(`truncate notifications, reports, report_events, blocks, reviews, restrictions, rate_events, invite_tokens, engagements, postings, profiles cascade; delete from auth.users;`);
const [{ code }] = await sqlq(`select admin.issue_invite(null, 7) as code`);
const [{ code: code2 }] = await sqlq(`select admin.issue_invite(null, 7) as code`);

// Join flow: distinct entry points and invite outcomes.
let p = await as(null);
await p.goto(base + '#/join/volunteer');
await p.locator('[name="inviteCode"]').fill('PB-00000-00000-00000-00000');
await p.getByRole('button', { name: 'Check invite' }).click();
await wait(p);
ok(await p.getByText("We couldn't find that invite code").isVisible(), 'invalid invite explained');
await p.goto(base + `#/join/volunteer?code=${code}`);
await p.reload();
await p.getByRole('button', { name: 'Check invite' }).click();
await wait(p);
ok(await p.getByText('That invite is valid.').isVisible(), 'invite link pre-fills and validates');
await shot(p, 'live-01-join-volunteer');
await p.goto(base + '#/join/nonprofit');
await wait(p, 300);
ok(await p.getByText('reviews your organization').first().isVisible(), 'nonprofit flow explains review');
await shot(p, 'live-02-join-nonprofit');

// Nonprofit sets up, writes a posting, and waits for review.
const orgId = uuid(), volId = uuid(), vol2 = uuid();
const org = await as(orgId);
await org.goto(base + '#/app');
await wait(org, 800);
await org.getByRole('radio', { name: "We're a nonprofit" }).click();
await org.locator('[name="name"]').fill('Lake Street Tutors');
await org.getByRole('button', { name: 'Continue' }).click();
await wait(org, 800);
await org.getByRole('button', { name: 'New posting' }).click();
ok(await dialog(org).getByText('Add a title and at least one skill to publish.').isVisible(), 'readiness summary explains publish');
await dialog(org).getByRole('button', { name: 'Publish posting' }).click();
ok(await dialog(org).getByText('2 things to fix').isVisible(), 'submit attempt lists problems');
await shot(org, 'live-03-posting-errors');
await dialog(org).locator('[name="title"]').fill('Our first annual budget');
await dialog(org).getByRole('button', { name: 'Budgeting' }).click();
await dialog(org).locator('[name="startDate"]').fill(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
await dialog(org).locator('[name="second"]').fill("We've never had a full annual budget.");
await dialog(org).getByRole('button', { name: 'Publish posting' }).click();
await wait(org, 800);
ok(await org.getByText('Waiting for review', { exact: true }).first().isVisible(), 'posting waits for review');
await org.getByRole('button', { name: 'Match' }).click();
await wait(org);
ok(await org.getByRole('heading', { name: 'Waiting for review' }).isVisible(), 'discovery gated for unreviewed org');
const [{ id: orgProfile }] = await sqlq(`select id from profiles where user_id = '${orgId}'`);
await sqlq(`select admin.set_review('${orgProfile}', 'organization', 'reviewed', 'Checked the state charity registry', 'Test operator')`);

// Volunteer redeems the invite and fixes validation errors.
const vol = await as(volId);
await vol.goto(base + '#/app');
await wait(vol, 800);
await vol.locator('[name="name"]').fill('Dana');
await vol.locator('[name="inviteCode"]').fill(code.toLowerCase());
await vol.getByRole('button', { name: 'Continue' }).click();
await wait(vol, 800);
await vol.locator('[name="years"]').fill('999');
await vol.getByRole('button', { name: 'Budgeting' }).click();
await vol.getByRole('button', { name: 'Save profile' }).click();
await wait(vol);
ok(await vol.getByText('Years of experience must be between 0 and 80.').first().isVisible(), '999 years rejected with a clear message');
await shot(vol, 'live-04-profile-error');
await vol.locator('[name="years"]').fill('9');
await vol.locator('[name="credential"]').fill('CPA');
await vol.getByRole('button', { name: 'Save profile' }).click();
await wait(vol, 800);
const v2 = await as(vol2);
await v2.goto(base + '#/app');
await wait(v2, 800);
await v2.locator('[name="name"]').fill('Reuse Test');
await v2.locator('[name="inviteCode"]').fill(code);
await v2.getByRole('button', { name: 'Continue' }).click();
await wait(v2, 800);
ok(await v2.getByText('That invite has already been used.').first().isVisible(), 'redeemed invite refused');

await vol.getByRole('button', { name: 'Match' }).click();
await wait(vol, 800);
ok(await vol.getByRole('heading', { name: 'Our first annual budget' }).isVisible(), 'reviewed posting visible to volunteer');
ok(await vol.getByRole('heading', { name: 'Our first annual budget' }).isVisible(), 'reviewed organization visible');
await shot(vol, 'live-05-volunteer-discover');
await vol.getByRole('button', { name: 'Show interest' }).click();
await dialog(vol).getByRole('button', { name: 'Send' }).click();
await wait(vol, 800);

await org.goto(base + '#/app');
await org.reload();
await wait(org, 1000);
ok(await org.getByText('Wants to help you').isVisible(), 'org sees interested volunteer first');
ok(await org.getByText('CPA, self-reported').isVisible(), 'credential labeled self-reported on the card');
ok(await org.getByLabel(/Notifications, 1 unread/).isVisible(), 'org has an unread notification');
await org.getByRole('button', { name: 'Show interest' }).click();
await dialog(org).getByRole('button', { name: 'Make it mutual' }).click();
await wait(org, 800);
await dialog(org).getByRole('button', { name: 'Open project' }).click();
await wait(org);
// Nonprofit fills in and accepts first.
await org.getByRole('button', { name: 'Edit agreement' }).click();
for (const [k, v] of Object.entries({ outcome: 'A budget the board can approve', nonprofitContact: 'Ana, director', deliverables: 'A budget workbook', acceptance: 'Board approves it', inScope: 'Annual budget', exclusions: 'Payroll', inputs: 'Last year actuals', checkInPlan: 'Weekly call' })) await dialog(org).locator(`[name="${k}"]`).fill(v);
await dialog(org).getByRole('button', { name: 'Save agreement' }).click();
await wait(org, 800);
await org.getByRole('button', { name: 'Review agreement' }).click();
await dialog(org).locator('[name="confidentiality"]').check();
await dialog(org).locator('[name="licensing"]').check();
await dialog(org).getByRole('button', { name: 'Accept version 2' }).click();
await wait(org, 800);
ok(await org.getByRole('button', { name: 'Waiting for Dana' }).isVisible(), 'nonprofit-first acceptance recorded');
await org.reload();
await wait(org, 1000);
ok(await org.getByText(/accepted version 2/).first().isVisible(), 'state survives reload');

await vol.goto(base + '#/app/projects');
await vol.reload();
await wait(vol, 1000);
if (await vol.getByRole('heading', { name: "It's mutual" }).count()) await dialog(vol).getByRole('button', { name: 'OK' }).click();
await vol.getByRole('button', { name: /Lake Street Tutors/ }).click();
await wait(vol);
ok(await vol.getByText('Lake Street Tutors: accepted version 2').isVisible(), 'volunteer sees the same version accepted by the nonprofit');
await vol.getByRole('textbox', { name: 'Message' }).fill('<img src=x onerror=alert(1)> hello');
await vol.getByRole('button', { name: 'Send message' }).click();
await wait(vol, 800);
ok(await vol.getByText('<img src=x onerror=alert(1)> hello').isVisible(), 'chat shows HTML as text');
await vol.getByRole('button', { name: 'Review agreement' }).click();
await dialog(vol).locator('[name="confidentiality"]').check();
await dialog(vol).locator('[name="licensing"]').check();
await dialog(vol).getByRole('button', { name: 'Accept version 2' }).click();
await wait(vol, 800);
ok(await vol.getByRole('heading', { name: 'Project confirmed' }).isVisible(), 'confirmed after both accept');
await dialog(vol).getByRole('button', { name: 'Open project' }).click();
await wait(vol);
await shot(vol, 'live-06-workspace', true);

await org.goto(base + '#/app/projects');
await org.reload();
await wait(org, 1000);
if (await org.getByRole('heading', { name: 'Project confirmed' }).count()) await dialog(org).getByRole('button', { name: 'Open project' }).click();
else await org.getByRole('button', { name: /Dana/ }).click();
await wait(org);
await org.getByRole('tab', { name: 'Messages' }).click();
ok(await org.getByText('<img src=x onerror=alert(1)> hello').isVisible(), 'nonprofit reads the volunteer message');
await org.getByRole('textbox', { name: 'Message' }).fill('Thanks Dana');
await org.getByRole('button', { name: 'Send message' }).click();
await wait(org, 600);

// Report and block from the project.
await org.getByRole('button', { name: 'Report or block' }).click();
await dialog(org).getByRole('button', { name: 'Report a problem' }).click();
await dialog(org).getByRole('button', { name: 'Send report' }).click();
ok(await dialog(org).getByText('Choose what happened.').isVisible(), 'report needs a category');
await dialog(org).getByLabel('Spam').check();
await dialog(org).getByRole('button', { name: 'Send report' }).click();
await wait(org, 800);
const reports = await sqlq(`select count(*)::int as n from reports`);
ok(reports[0].n === 1, 'report stored');
await vol.reload();
await wait(vol, 1000);
ok(!(await vol.content()).includes('Spam'), 'reported person sees nothing');

// Offline banner.
await vol.context().setOffline(true);
await wait(vol, 600);
ok(await vol.getByText("You're offline.").isVisible(), 'offline state shown');
await shot(vol, 'live-07-offline');
await vol.context().setOffline(false);

// Layout: no horizontal overflow, card name visible above the action bar.
const sizes = [[1280, 720], [390, 844], [320, 568], [844, 390], [640, 360]];
const v3 = uuid();
for (const [w, h] of sizes) {
  const q = await as(orgId, w, h);
  await q.goto(base + '#/app/projects');
  await wait(q, 900);
  ok(await noOverflow(q), `no horizontal overflow at ${w}x${h} (projects)`);
  await shot(q, `live-layout-projects-${w}x${h}`);
  await q.context().close();
}
const [{ code: code3 }] = await sqlq(`select admin.issue_invite(null, 7) as code`);
const fresh = await as(v3);
await fresh.goto(base + '#/app');
await wait(fresh, 800);
await fresh.locator('[name="name"]').fill('Sam Okonkwo-Lindqvist');
await fresh.locator('[name="inviteCode"]').fill(code3);
await fresh.getByRole('button', { name: 'Continue' }).click();
await wait(fresh, 800);
await fresh.getByRole('button', { name: 'Budgeting' }).click();
await fresh.getByRole('button', { name: 'Save profile' }).click();
await wait(fresh, 600);
await sqlq(`update engagements set status = 'passed' where status in ('active')`); // free the posting so it shows again
await sqlq(`update postings set data = jsonb_set(data, '{status}', '"Open"')`);
for (const [w, h] of sizes) {
  const q = await as(v3, w, h);
  await q.goto(base + '#/app');
  await wait(q, 1000);
  const name = q.getByRole('heading', { name: 'Our first annual budget' });
  const bar = q.getByRole('button', { name: 'Show interest' });
  const nb = await name.boundingBox(), bb = await bar.boundingBox();
  ok(nb && bb && nb.y + nb.height <= bb.y && nb.y + nb.height <= h, `card name visible above the bar at ${w}x${h}`);
  ok(await noOverflow(q), `no horizontal overflow at ${w}x${h} (discover)`);
  await shot(q, `live-layout-discover-${w}x${h}`);
  await q.context().close();
}
console.log(`\n${fails ? 'FAILED' : 'ALL PASSED'} (${fails} failures)`);
await browser.close();
process.exit(fails ? 1 : 0);
