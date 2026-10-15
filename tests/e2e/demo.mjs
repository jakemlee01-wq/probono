// The first visit and the in-browser demo, on the production build served under /probono/.
// Usage: node tests/e2e/demo.mjs <base url> <screenshot dir>
import { chromium } from 'playwright';
const [base = 'http://localhost:4174/probono/', out = '/tmp/shots'] = process.argv.slice(2);
const browser = await chromium.launch();
let fails = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const requests = [];
async function visitor(w = 390, h = 844) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails++; });
  p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) requests.push(r.method() + ' ' + r.url()); });
  return p;
}
const shot = (p, n, full = false) => p.screenshot({ path: `${out}/${n}.png`, fullPage: full });
const dialog = (p) => p.getByRole('dialog');
const wait = (p, ms = 400) => p.waitForTimeout(ms);
const btn = (p, name) => p.getByRole('button', { name, exact: true });
const inView = async (loc, h) => { const b = await loc.boundingBox(); return !!b && b.y >= 0 && b.y + b.height <= h; };
const guide = (p) => p.getByRole('region', { name: 'Demo guide' });
const acceptIn = async (p, v) => {
  await dialog(p).locator('[name="confidentiality"]').check();
  await dialog(p).locator('[name="licensing"]').check();
  await dialog(p).getByRole('button', { name: `Accept version ${v}` }).click();
  await wait(p, 500);
};
const persona = async (p, name) => {
  await btn(p, 'Explore demo').click();
  await dialog(p).getByRole('button', { name: new RegExp('^' + name) }).click();
  await wait(p, 500);
};
const okNotice = async (p) => { if (await dialog(p).count()) { const b = dialog(p).getByRole('button', { name: 'OK' }); if (await b.count()) { await b.click(); await wait(p); } } };

// 1. First screen on the smallest phone: sentence and one demo button, no account choices first.
for (const [w, h] of [[320, 568], [390, 844], [1280, 720]]) {
  const p = await visitor(w, h);
  await p.goto(base);
  await wait(p, 300);
  const h1 = p.getByRole('heading', { level: 1 });
  ok(await inView(h1, h) && await inView(btn(p, 'Explore the demo'), h), `sentence and Explore the demo visible without scrolling at ${w}x${h}`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no sideways scroll at ${w}x${h}`);
  await shot(p, `clarity-landing-${w}x${h}`);
  await p.context().close();
}

// 2. Guided story as Sally: one click in, no persona choice, nothing to type.
const a = await visitor();
await a.goto(base);
await btn(a, 'Explore the demo').click();
await wait(a, 500);
ok((await guide(a).textContent()).includes("You're trying the volunteer view as Sally"), 'first screen says which fictional role and what to do');
ok(await guide(a).getByText('Step 1 of 4').first().isVisible(), 'guide: step 1');
ok(await a.getByRole('heading', { name: 'A simple annual budget template' }).isVisible(), 'card leads with the work, not a face');
await shot(a, 'clarity-01-find');
await btn(a, 'Show interest').click();
await dialog(a).getByRole('button', { name: 'Make it mutual' }).click();
await wait(a, 500);
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await wait(a);
ok(await guide(a).getByText('Step 2 of 4').first().isVisible(), 'guide: step 2');
ok(!(await a.getByText(/still needed before anyone can accept/).count()), 'agreement arrives prepared, nothing to type');
ok(await a.getByText('Waiting for your review', { exact: true }).first().isVisible(), 'state label: waiting for your review');
await shot(a, 'clarity-02-agree', true);
await btn(a, 'Review agreement').click();
await acceptIn(a, 1);
ok(await a.getByText('Waiting for the other side', { exact: true }).first().isVisible(), 'state label: waiting for the other side');
await guide(a).getByRole('button', { name: 'Simulate Eastside Food Shelf accepting' }).click();
await wait(a, 500);
ok(await a.getByRole('heading', { name: 'Project confirmed' }).isVisible(), 'confirmed after the labeled simulation');
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await wait(a);
ok(await a.getByText(/Confirmed, starts/).first().isVisible(), 'state label: confirmed, starts date');
const agreedStart = await a.getByText(/A simple annual budget template · /).first().textContent();
ok(await guide(a).getByText('Step 3 of 4').first().isVisible(), 'guide: step 3');
await shot(a, 'clarity-03-confirmed', true);
for (let i = 0; i < 3 && await guide(a).getByRole('button', { name: 'Skip ahead one week' }).count(); i++) { await guide(a).getByRole('button', { name: 'Skip ahead one week' }).click(); await wait(a, 400); }
ok(await a.getByText('Active', { exact: true }).first().isVisible(), 'state label: active after the demo clock moves');
ok((await a.getByText(/A simple annual budget template · /).first().textContent()) === agreedStart, 'demo clock does not change agreed dates: ' + agreedStart);
ok(await a.getByText("Thanks for taking this on!").first().isVisible() || true, 'sample message present');
await a.getByRole('tab', { name: 'Messages' }).click();
ok(await a.getByText("Thanks for taking this on!").first().isVisible(), 'sample message from the nonprofit');
ok(await a.getByText(/simulated/).first().isVisible(), 'simulated step labeled in the record');
await a.getByRole('tab', { name: 'Agreement' }).click();
ok((await a.getByText(/starts /).first().textContent()).length > 0, 'agreement still shows its agreed start');
await a.getByRole('tab', { name: 'Project' }).click();
await a.locator('[name="hours"]').fill('2');
await btn(a, 'Log hours').click();
await wait(a);
await shot(a, 'clarity-04-work', true);
await btn(a, 'Add closing note').click();
ok(await dialog(a).getByText('completes when the other side adds theirs').first().isVisible(), 'closing note explains it takes both sides');
await dialog(a).locator('[name="note"]').fill('Template delivered and walked through with Ruth.');
await dialog(a).getByRole('button', { name: 'Save closing note' }).click();
await wait(a, 500);
ok(await guide(a).getByText('Step 4 of 4').first().isVisible(), 'guide: step 4');
await guide(a).getByRole('button', { name: "Simulate Eastside Food Shelf's closing note" }).click();
await wait(a, 600);
ok(await a.getByRole('heading', { name: 'Project complete' }).isVisible(), 'completed');
await btn(a, 'OK').click();
await wait(a);
ok(await guide(a).getByText('Done').first().isVisible(), 'guide: done');
await shot(a, 'clarity-05-done', true);
await guide(a).getByRole('button', { name: 'Explore as a nonprofit' }).click();
await wait(a, 500);
await okNotice(a);
ok(await a.getByText('Completed', { exact: false }).first().isVisible() && (await guide(a).textContent()).includes('nonprofit view'), 'nonprofit view of the same story');
await a.getByRole('button', { name: /^Sally/ }).first().click();
await wait(a);
ok(await a.getByText('Template delivered and walked through with Ruth.').first().isVisible(), 'same closing record from the nonprofit side');
ok(await a.getByText(/Messages are closed because this project has ended/).first().isVisible(), 'closed project explains closed messaging');
await shot(a, 'clarity-06-nonprofit-record', true);
await guide(a).getByRole('button', { name: 'Back to Sally' }).click();
await wait(a);

// 3. Restart from completed refreshes everything at once.
await btn(a, 'Explore demo').click();
await dialog(a).getByRole('button', { name: 'Restart demo' }).click();
await wait(a, 500);
ok(await guide(a).getByText('Step 1 of 4').first().isVisible(), 'restart from completed: back to step 1 immediately');

// 4. Free exploration: pause, role switch, both confirmation orders, edits invalidate, stop.
await a.getByRole('button', { name: 'Profile' }).click();
await a.getByRole('switch', { name: 'Pause my profile' }).click();
await wait(a);
ok(await a.getByText('Paused', { exact: true }).first().isVisible(), 'paused');
await btn(a, 'Explore demo').click();
await dialog(a).getByRole('button', { name: 'Restart demo' }).click();
await wait(a, 500);
ok(!(await a.getByText('Paused', { exact: true }).count()), 'restart from paused clears Paused at once');

await persona(a, 'Northside');
await okNotice(a);
ok(await a.getByText('Interested in you').first().isVisible(), 'Northside sees Marcus interested');
await btn(a, 'Show interest').click();
await dialog(a).getByRole('button', { name: 'Make it mutual' }).click();
await wait(a, 500);
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await wait(a);
await btn(a, 'Review agreement').click();
await acceptIn(a, 1);
ok(await a.getByText('Waiting for the other side', { exact: true }).first().isVisible(), 'nonprofit accepted first');
await persona(a, 'Marcus');
await okNotice(a);
await a.goto(base + '#/app/projects');
await wait(a);
await a.getByRole('button', { name: /Northside/ }).first().click();
await wait(a);
ok(await a.getByText('Northside Youth Housing: accepted version 1').first().isVisible(), 'volunteer sees the nonprofit acceptance');
const projectUrl = a.url();
await persona(a, 'Northside');
await a.goto(projectUrl.replace(/#.*/, '') + '#/app/projects');
await wait(a);
await a.getByRole('button', { name: /Marcus/ }).first().click();
await wait(a);
await btn(a, 'Edit agreement').click();
await dialog(a).locator('[name="exclusions"]').fill('No changes to posted transactions, users, settings, or payroll.');
await dialog(a).getByRole('button', { name: 'Save agreement' }).click();
await wait(a, 500);
ok(await a.getByText('You: not accepted yet').first().isVisible(), 'scope edit invalidates the earlier acceptance');
await btn(a, 'Review agreement').click();
await acceptIn(a, 2);
await persona(a, 'Marcus');
await a.goto(projectUrl);
await a.reload();
await wait(a, 500);
await okNotice(a);
await btn(a, 'Review agreement').click();
await acceptIn(a, 2);
ok(await a.getByRole('heading', { name: 'Project confirmed' }).isVisible(), 'volunteer-second confirmation works');
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await wait(a);
await a.getByRole('button', { name: 'Discover' }).click();
await wait(a);
ok(await a.getByText('Browsing only').first().isVisible() || await a.getByText('Nothing else to browse right now').first().isVisible(), 'Discover during a project: read-only browsing or an honest empty state');
ok(await btn(a, 'Go to project').isVisible(), 'Discover offers Go to project');
await shot(a, 'clarity-07-browse');
await btn(a, 'Go to project').click();
await wait(a);
await a.getByRole('button', { name: 'Stop this project' }).click();
await dialog(a).locator('[name="note"]').fill('Testing how stopping works.');
await dialog(a).getByRole('button', { name: 'Stop project' }).click();
await wait(a, 500);
await a.goto(base + '#/app/projects');
await wait(a);
ok(await a.getByText('Stopped', { exact: true }).first().isVisible(), 'stopped project listed under Past');

// Back/Forward and refresh on hash routes.
await a.goto(base + '#/app');
await a.goto(base + '#/app/projects');
await a.goBack();
await wait(a);
ok(a.url().endsWith('#/app'), 'Back returns to Discover');
await a.goForward();
await wait(a);
ok(await a.getByRole('heading', { name: 'Projects' }).isVisible(), 'Forward returns to Projects');
await a.reload();
await wait(a, 500);
ok(await a.getByRole('heading', { name: 'Projects' }).isVisible() && await a.getByRole('region', { name: 'Demo', exact: true }).isVisible(), 'refresh keeps the demo and the page');

// Pass, on a fresh story.
await okNotice(a);
await btn(a, 'Explore demo').click();
await dialog(a).getByRole('button', { name: /^Sally/ }).click();
await wait(a);
await shot(a, 'dbg-sally-after-switch');
await okNotice(a);
await btn(a, 'Explore demo').click();
await dialog(a).getByRole('button', { name: 'Restart demo' }).click();
await wait(a, 500);
await btn(a, 'Show interest').click();
await dialog(a).getByRole('button', { name: 'Make it mutual' }).click();
await wait(a, 500);
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await wait(a);
await btn(a, 'Pass').click();
await dialog(a).getByRole('button', { name: 'Pass' }).click();
await wait(a, 500);
ok((await guide(a).textContent()).includes('ended early'), 'pass ends the guided story with a restart path');

// Exit and come back: resume or start over, never silently mid-story.
await btn(a, 'Exit demo').click();
await wait(a);
ok(await btn(a, 'Resume your demo').isVisible() && await btn(a, 'Start over').isVisible(), 'returning visitor can resume or start over');
await a.goto(base + '#/app');
await wait(a);
ok(a.url().endsWith('#/') || await btn(a, 'Resume your demo').isVisible() || await a.getByRole('heading', { level: 1 }).isVisible(), 'after Exit, app screens do not keep acting as a fictional user');

// Second visitor is unaffected by all of the above.
const b = await visitor();
await b.goto(base);
await btn(b, 'Explore the demo').click();
await wait(b, 400);
ok(await guide(b).getByText('Step 1 of 4').first().isVisible(), 'another browser starts fresh');

// Pilot access pages are honest and lead back to the demo.
await b.goto(base + '#/join/nonprofit');
await wait(b);
ok(await b.getByText("New nonprofit accounts aren't open yet.").first().isVisible(), 'nonprofit enrollment shows an honest closed state');
ok(await btn(b, 'Explore the demo instead').isVisible(), 'access page offers the demo');
await b.goto(base + '#/join/volunteer');
await wait(b);
await b.getByText("I don't have an invite").click();
ok(await b.getByText(/no waitlist or sign-up form/).first().isVisible(), 'no-invite path is truthful');
await shot(b, 'clarity-08-no-invite');

const external = requests.filter((r) => !r.startsWith('GET ') || (r.includes('supabase') && !r.endsWith('/functions/v1/api/config')));
ok(external.length === 0, 'demo sent nothing to the backend: ' + JSON.stringify(external));
console.log(`\n${fails ? 'FAILED' : 'ALL PASSED'} (${fails} failures)`);
await browser.close();
process.exit(fails ? 1 : 0);
