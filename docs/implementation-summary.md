# Fix brief: implementation summary

Branch `fixes`, pull request #1. Nothing is deployed until it's merged into `main`. Not launch-ready: the owner gates in `docs/operations.md` are still open.

## Implemented, by ID

| ID | What changed | Main files |
| --- | --- | --- |
| SAFE-01 | The demo runs the real engine in each visitor's browser against fictional fixtures. No accounts, no server writes, no email, no uploads. `/demo/sign-in`, `/demo/reset`, and the global reset are deleted. Old demo rows in the database are ignored. Every demo screen shows "Demo · fictional people and projects" with Switch, Restart my demo, and Exit demo. | `_shared/core.ts`, `_shared/fixtures.ts`, `src/lib/demo-store.ts`, `components/demo.tsx`, `api/index.ts` |
| SAFE-02 | Inventory below. Table grants revoked from `anon` and `authenticated` on top of RLS. The photo URL check now requires the exact project prefix (a look-alike domain used to pass). Unknown and other people's project ids get the same "Project not found". A build check fails CI on any non-anon key. | `migrations/20261015000000_safety.sql`, `tests/db/access.sql`, `tests/check-build-secrets.sh` |
| SCOPE-01 | Copy names the pilot boundary: Twin Cities, accounting and finance. One catalog with stable ids; older label-based records are read as ids without being rewritten. | `_shared/types.ts`, `_shared/rules.ts`, `pages/landing.tsx` |
| COPY-02 | Demo photos are labeled "Fictional person · AI-generated photo". Demo quotes are labeled fictional and name their project. Provenance note added. | `prospect-card.tsx`, `public/assets/demo-photos/README.md` |
| JOIN-01 | Separate routes: `#/join/volunteer` (invite code, link pre-fill), `#/join/nonprofit` (review gate explained up front), and a chooser. The server sets the role; it can't be changed afterward. | `pages/join.tsx`, `components/onboarding.tsx` |
| JOIN-02 | One-time hashed invites with expiry, optional email binding, revocation, and an operator SQL tool. Redemption is atomic in the profile transaction, so a form error doesn't use up the code. Checks are rate limited by hashed IP and failed attempts per user. | `migrations/...safety.sql`, `api/engine.ts` |
| AUTH-01 | Error codes mapped to plain words. Neutral sign-up and reset copy. Expired, reused, and cross-device links land on a page with resend options. Resend has a cooldown. Password confirmation on reset. | `lib/auth-errors.ts`, `pages/auth.tsx`, `lib/session.tsx` |
| PROJECT-01 | One-page work agreement with every required field, defaulting to "No system access". Each edit is a new version, with history kept. Each side's acceptance records who, when, which version, and both acknowledgments. Edits invalidate earlier acceptances. Downloadable as text. Accounting cautions and the licensing statement are shown. | `core.ts`, `components/agreement.tsx` |
| PROJECT-02 | States: pending (scope pending, then awaiting confirmations), active, completion pending, closed, passed, lapsed, stopped. Kickoff checklist, change requests, stop at any time, and two-sided close with "Did this unblock you?". Nothing closes just because a date passed. Retries and double taps are harmless. | `core.ts`, `components/workspace.tsx`, `components/projects.tsx` |
| PROJECT-03 | The deadline is 72 hours from mutual interest, server time (UTC). The start date must fall after the deadline's day in Central time, and is shown as "proposed" until agreed. The deadline shows with its time zone, and edits don't extend it. | `rules.ts` (`minStartFor`, `pilotDate`), `pending.tsx` |
| PROJECT-04 | Retested in clean state: after only the volunteer confirms, the nonprofit still sees the project and its own action. Not reproduced. Covered by engine and browser tests. | `tests/core.test.ts`, `tests/e2e/demo.mjs` |
| TRUST-01 | Operator review records (kind, status, method, reviewer, date). Nonprofits are hidden from volunteers until their organization is reviewed. Badges say exactly what was checked; volunteers show "identity not reviewed" and self-reported credentials. | `core.ts`, `prospect-card.tsx`, `admin.set_review` |
| TRUST-02 | Report and block on cards and projects. Blocking hides both sides, refuses interest and messages on the server, and stops shared work. Private moderation queue with an audit trail. Rate limits on interest, messages, reports, and invites. | `core.ts`, `components/safety.tsx`, `admin.*` |
| TRUST-03 | Terms, Privacy, Community, and Support pages show "Not yet published" or "isn't set up yet" until configured. Account deletion requires the password, refuses an old session, stops shared work, scrubs the name from the other side's records, and removes photos and the sign-in. It is safe to retry. | `pages/info.tsx`, `api/engine.ts` (`deleteAccount`), `profile-editor.tsx`, `docs/policies-draft.md` |
| TRUST-04 | Stored in-app notifications for every lifecycle event, sent to the right person, deduplicated for chat, with unread state and deep links. Offline and unreachable banners. Chat retries reuse an id. No email. | `core.ts`, `components/notifications.tsx`, `pages/app.tsx` |
| TRUST-05 | Track records are counted from closed projects: self-reported hours, confirmed hours, and completed projects. They can't be edited. Quotes come from closing notes only when the writer opts in. | `core.ts` (`publicProfile`) |
| UX-01 | Stable nav: Discover, Projects, Profile, with direct links. Discover stays available and explains capacity when a project is in progress. | `pages/app.tsx`, `discovery.tsx` |
| UX-02 | The name and role sit above the photo, and the action bar is sticky in the page flow, so it can't cover them. Fit chips wrap. | `prospect-card.tsx`, `discovery.tsx` |
| UX-03 | Required labels, readiness summary ("Add a title and at least one skill to publish"), error summary with links, `aria-describedby` errors, focus on the field the server rejected. | `bits.tsx`, `postings.tsx`, `profile-editor.tsx`, `agreement.tsx` |
| UX-04 | "N interest messages remaining for this posting" with the real rule. "Accepting volunteers" status and a "View details" action. A role-specific "How this works". Respectful Pass copy. | `discovery.tsx`, `postings.tsx`, `how.tsx` |
| UX-05 | Landing sections: who it's for, how it works, a labeled example project, what review means and doesn't, joining, and "no results to share yet". | `pages/landing.tsx` |
| COPY-01 | Fixtures rewritten into one consistent story: Riverside's NetSuite need is explained by a grant. Founding years are real fixture values, and counts come from fixture records. Real records show "Not provided". | `_shared/fixtures.ts` |
| UI-01 | The hero image has its size reserved, the call-to-action renders immediately with no animation, and reduced motion is honored. | `pages/landing.tsx`, `index.css` |
| UI-02 | Dialogs: named, focus trapped and restored, Escape closes them, background scroll locked. Keyboard carousel. 44px targets. Visible focus. Assertive error announcements. | `bits.tsx`, `toast.tsx`, `tests/e2e/keyboard.mjs` |
| DATA-01 | One set of rules (years 0 to 80 whole numbers, title 3 to 120, headline 160, long text 2,000, note 20 to 1,000, chat 1 to 4,000, hours 1 to 40, weeks 1 to 52, dates, founded year) enforced in forms and the engine, counting characters the way people see them. Existing records aren't truncated or rewritten. | `_shared/rules.ts` |
| DATA-02 | The bucket enforces 5 MB and JPEG/PNG/WebP (tested). Photos are re-encoded in the browser: metadata stripped, 1600px cap, 200px minimum, corrupt files rejected. Six at most. Removed photos are deleted from storage. Initials when there's no photo. Uploads are off in the demo. | `profile-editor.tsx`, `api/index.ts` |

## Access inventory (SAFE-02)

| Surface | Client access | Enforcement |
| --- | --- | --- |
| `public.*` tables (12) | none | RLS on, no policies, `revoke all from anon, authenticated` |
| `admin` schema (functions, views) | none | not exposed by the API; usage and execute revoked |
| `photos` bucket | public read by URL; insert/delete only in own `uid/` folder; no listing | storage policies, 5 MB limit, image types only |
| Edge Function `api` | `/config`, `/invites/check` public; everything else needs a valid user token checked with `auth.getUser` | engine checks membership on every read and write |

## Test results (all run on October 14, 2026)

| Suite | Command | Result |
| --- | --- | --- |
| Engine rules | `deno test --config tests/deno.json tests/core.test.ts` | 14 passed |
| Database access | `tests/db/run.sh` (`access.sql`) | 28 role checks + bucket + invite tools passed |
| Postgres adapter | `tests/db/run.sh` (`adapter.test.ts`) | passed: concurrent invite race, email binding, review gate, persistence, report privacy, deletion |
| Demo in browser | `tests/e2e/demo.mjs` on the production build under `/probono/` | 20 passed, including two independent visitors and restart isolation |
| Real flows in browser | `tests/e2e/live.mjs` against the real engine on a local database | all passed, including layout at 1280x720, 390x844, 320x568, 844x390, and 640x360 (200%) |
| Keyboard | `tests/e2e/keyboard.mjs` | 12 passed |
| CI | GitHub Actions on PR #1 | test job passed; deploy jobs skipped |

Browser tests inject sessions and use a local stand-in for the API, so they don't exercise Supabase Auth, email, or Storage.

## Not verified

- Email delivery, confirmation, and reset against a real mailbox (needs SMTP and an owner mailbox).
- Photo upload against real Supabase Storage, including oversized and forged files. The bucket limits are tested; the upload round trip isn't.
- Account deletion end to end with real Auth and Storage. The database part is tested.
- The deployed function on Supabase. This release hasn't been deployed.

## Deferred, and why

- **Email notifications:** need a verified provider and recipient preferences.
- **Final policies and a support contact:** need owner decisions. Drafts are in `docs/policies-draft.md`.
- **Server-side image content checks** (beyond the bucket's type and size limits): needs an image-processing function. The browser re-encodes, but a direct API upload could still send a mislabeled file into the user's own folder.
- **Scheduled data retention:** needs an approved retention policy.
- **Volunteer review gating:** volunteers are invite-gated, not review-gated, and the badges say so. The owner can decide to gate them.
- **Bundle size:** up from about 502 KB to 620 KB because the engine now ships for the demo. It could be lazy-loaded later.
- **Taxonomy expansion (brief section 10):** intentionally deferred until the pilot gates pass.
