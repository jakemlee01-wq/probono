// Demo isolation and the full demo flow, on the production build served under /probono/.
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

const a = await visitor();
await a.goto(base);
await a.waitForTimeout(300);
ok(await a.getByRole('link', { name: 'Join with an invite' }).isVisible(), 'landing CTA renders immediately');
await shot(a, 'demo-01-landing');
await a.getByRole('button', { name: 'Try the demo' }).click();
await shot(a, 'demo-02-picker');
await dialog(a).getByRole('button', { name: /^Sally/ }).click();
await a.waitForTimeout(500);
ok(await a.getByText('Demo · fictional people and projects').isVisible(), 'demo label visible');
ok(await a.getByText('Fictional person · AI-generated photo').isVisible(), 'photo labeled fictional');
await shot(a, 'demo-03-sally-discover');
await a.getByRole('button', { name: 'Show interest' }).click();
await dialog(a).getByRole('button', { name: 'Make it mutual' }).click();
await a.waitForTimeout(500);
ok(await a.getByRole('heading', { name: "It's mutual" }).isVisible(), 'mutual pop-up');
await shot(a, 'demo-04-mutual');

// A second visitor starts the demo in another browser: untouched by A.
const b = await visitor();
await b.goto(base);
await b.getByRole('button', { name: 'Try the demo' }).click();
await dialog(b).getByRole('button', { name: /^Sally/ }).click();
await b.waitForTimeout(500);
ok(await b.getByText('Interested in you').isVisible() && !(await b.getByRole('heading', { name: "It's mutual" }).count()), 'visitor B unaffected by A');

await dialog(a).getByRole('button', { name: 'Open project' }).click();
await a.waitForTimeout(400);
await shot(a, 'demo-05-pending', true);
ok(await a.getByText(/things? still needed before anyone can accept/).isVisible(), 'agreement needs details before accepting');
await a.getByRole('button', { name: 'Review and accept' }).click();
ok(await a.getByRole('heading', { name: 'Not ready to accept yet' }).isVisible(), 'accept explains what is missing');
await dialog(a).getByRole('button', { name: 'Edit agreement' }).click();
const fill = async (name, v) => { await dialog(a).locator(`[name="${name}"]`).fill(v); };
await fill('nonprofitContact', 'Maya, operations director');
await fill('deliverables', 'Three program reports and a one-page guide.');
await fill('acceptance', 'The team runs the reports alone for one month-end.');
await fill('inScope', 'Report setup in NetSuite.');
await fill('exclusions', 'No changes to posted transactions.');
await fill('inputs', 'Grant budget and current chart of accounts.');
await fill('checkInPlan', 'Weekly 30-minute call on Tuesdays.');
await shot(a, 'demo-06-editor');
await dialog(a).getByRole('button', { name: 'Save agreement' }).click();
await a.waitForTimeout(500);
ok(await a.getByText('Version 2', { exact: true }).isVisible(), 'saved as version 2');
await a.getByRole('button', { name: 'Review and accept' }).click();
await dialog(a).getByRole('button', { name: 'Accept version 2' }).click();
ok(await dialog(a).getByText('Please confirm this to continue.').first().isVisible(), 'acknowledgments required');
await dialog(a).locator('[name="confidentiality"]').check();
await dialog(a).locator('[name="licensing"]').check();
await shot(a, 'demo-07-accept');
await dialog(a).getByRole('button', { name: 'Accept version 2' }).click();
await a.waitForTimeout(500);
ok(await a.getByRole('button', { name: 'Waiting for them' }).isVisible(), 'volunteer accepted');

// Switch sides inside the same demo: Riverside still sees the pending project and its own action.
await a.getByRole('button', { name: 'Switch' }).click();
await dialog(a).getByRole('button', { name: /^Riverside/ }).click();
await a.waitForTimeout(500);
ok(await a.getByRole('heading', { name: "It's mutual" }).isVisible(), 'nonprofit gets its own mutual notice');
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await a.waitForTimeout(400);
ok(await a.getByText('Sally: accepted version 2').isVisible() && await a.getByRole('button', { name: 'Review and accept' }).isVisible(), 'nonprofit sees pending with its own action (PROJECT-04)');
await a.getByRole('button', { name: 'Review and accept' }).click();
await dialog(a).locator('[name="confidentiality"]').check();
await dialog(a).locator('[name="licensing"]').check();
await dialog(a).getByRole('button', { name: 'Accept version 2' }).click();
await a.waitForTimeout(600);
ok(await a.getByRole('heading', { name: 'Project confirmed' }).isVisible(), 'project confirmed');
await dialog(a).getByRole('button', { name: 'Open project' }).click();
await a.waitForTimeout(400);
await shot(a, 'demo-08-workspace', true);
ok(await a.getByRole('link', { name: 'Discover' }).count() === 0 && await a.getByRole('button', { name: 'Discover' }).isVisible(), 'Discover stays in the nav');
await a.getByRole('button', { name: 'Discover' }).click();
await a.waitForTimeout(300);
ok(await a.getByText('This posting has a project in progress').isVisible(), 'capacity explained on Discover');
await shot(a, 'demo-09-capacity');

// Restart A: back to the fixtures. B still has its own state.
await a.getByRole('button', { name: 'Restart my demo' }).click();
await dialog(a).getByRole('button', { name: 'Restart' }).click();
await a.waitForTimeout(500);
await a.goto(base + '#/app/projects');
await a.waitForTimeout(400);
ok(!(await a.getByText('In progress').count()), 'restart cleared the project in A');
await b.getByRole('button', { name: 'Show interest' }).click();
await dialog(b).getByRole('button', { name: 'Make it mutual' }).click();
await b.waitForTimeout(300);
ok(await b.getByRole('heading', { name: "It's mutual" }).isVisible(), 'B can still run its own flow');

// Refresh keeps the demo; Exit ends it.
await b.reload();
await b.waitForTimeout(500);
ok(await b.getByText('Demo · fictional people and projects').isVisible(), 'demo survives refresh');
await b.getByRole('button', { name: 'Exit demo' }).click().catch(async () => { await dialog(b).getByRole('button', { name: 'OK' }).click(); await b.getByRole('button', { name: 'Exit demo' }).click(); });
await b.waitForTimeout(400);
ok(await b.getByRole('link', { name: 'Sign in' }).isVisible(), 'exit returns to the landing page');

const external = requests.filter((r) => !r.startsWith('GET ') || (r.includes('supabase') && !r.endsWith('/functions/v1/api/config')));
ok(external.length === 0, 'demo sent nothing to the backend: ' + JSON.stringify(external));
console.log(`\n${fails ? 'FAILED' : 'ALL PASSED'} (${fails} failures)`);
await browser.close();
process.exit(fails ? 1 : 0);
