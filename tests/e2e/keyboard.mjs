// Keyboard-only pass through the demo: enter, browse, send interest, open the agreement, report.
import { chromium } from 'playwright';
const [base = 'http://localhost:4174/probono/'] = process.argv.slice(2);
const browser = await chromium.launch();
const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let fails = 0;
const ok = (c, m) => { console.log(c ? 'PASS' : 'FAIL', m); if (!c) fails++; };
const focused = () => p.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 60));
async function tabTo(text, max = 40) {
  for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if ((await focused()).startsWith(text)) return true; }
  return false;
}
await p.goto(base);
ok(await tabTo('Explore the demo'), 'reach "Explore the demo" by Tab');
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
ok(await tabTo('Show details'), 'reach card details');
await p.keyboard.press('Enter');
ok(await p.evaluate(() => !!document.querySelector('details[open]')), 'details open from the keyboard');
ok(await tabTo('Show interest'), 'reach Show interest');
await p.keyboard.press('Enter');
await p.waitForTimeout(200);
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
ok((await focused()).includes('Show interest'), 'Escape closes and returns focus to the opener');
await p.keyboard.press('Enter');
await p.waitForTimeout(200);
ok(await tabTo('Make it mutual'), 'reach the send button inside the dialog');
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
ok(await tabTo('Open project'), 'reach Open project in the notice');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
ok(await tabTo('Edit agreement', 80), 'reach Edit agreement');
ok(await tabTo('Review agreement', 80), 'reach Review agreement');
ok(await tabTo('Report or block', 80), 'reach Report or block');
await p.keyboard.press('Enter');
await p.waitForTimeout(200);
ok(await tabTo('Report a problem'), 'report reachable by keyboard');
console.log(fails ? `FAILED (${fails})` : 'ALL PASSED');
await browser.close();
process.exit(fails ? 1 : 0);
