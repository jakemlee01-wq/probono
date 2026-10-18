# probono

Lend your skills to a Twin Cities nonprofit, a few hours at a time.

A small, phone-first pilot that introduces accounting and finance volunteers to local nonprofits for short, scoped pro bono projects. Volunteers join by invite. Nonprofits register freely and are reviewed by hand before volunteers can see them.

## How it works

1. **Match** (plum). One prospect at a time, only ones that fit: skills, hours, weeks, dates, and format. **Not now** or **Show interest**. Nonprofits write a real message (20 to 1,000 characters) and get five per posting; replying to someone already interested is free.
2. **Proposed project.** When interest is mutual, both sides have 72 hours to agree a one-page work agreement: deliverables, how completion is judged, scope and exclusions, inputs, time, system access (defaults to none), and check-ins. Every edit makes a new version. Each side accepts a specific version, with a confidentiality and licensing acknowledgment, and the project starts only when both accept the same one.
3. **Partnership.** Kickoff checklist, hours (self-reported until the nonprofit confirms them), check-ins, tasks, messages, people and links. Either side can propose a change (both re-accept) or stop the project.
4. **Completion.** Either side marks the work complete with a closing note. It completes when both notes are in. The nonprofit says whether it unblocked them and confirms the hours.

Navigation stays the same throughout: Match, Projects, Profile. One proposed or active project at a time per volunteer and per posting; Discover explains this instead of disappearing.

Safety: report and block on every profile, card, and project; blocking stops shared work and hides both sides. Reports are private. Operators review organizations, handle reports, and issue invites from the Supabase SQL editor (`docs/operations.md`).

## The demo

"Try the demo" on the landing page runs the real engine in the visitor's own browser against fictional fixtures. It creates no account and sends nothing to the server, so visitors never see each other's demo.

It opens straight into a guided volunteer story (Sally and Eastside Food Shelf, a budget template) in four steps: find a project, agree the work, work together, finish. The agreement arrives prepared, the other side's steps can be simulated with one labeled tap, and a demo clock moves time forward without changing agreed dates. "Explore demo" in the top bar switches people (Sally, Eastside, Marcus, Northside), moves the clock, restarts, or exits. Real accounts get none of these shortcuts.

## Stack

- **Website:** React 18, TypeScript, Vite, Tailwind 4, hash routing, on GitHub Pages.
- **Backend:** Supabase: Auth, Postgres, Storage (profile photos), and one Edge Function, `api`.
- The website never reads tables directly. Row level security is on with no policies and table grants are revoked, so only the function (connected as the owner) can. Every change goes through the shared engine inside a locked transaction.

## Where things live

```text
supabase/functions/_shared/core.ts      the engine: matching, interest, agreement, lifecycle, safety (pure TypeScript)
supabase/functions/_shared/rules.ts     field limits and validation, used by forms and the engine
supabase/functions/_shared/types.ts     data shapes and the skill/cause catalog
supabase/functions/_shared/fixtures.ts  fictional demo data (browser only)
supabase/functions/api/engine.ts        Postgres adapter, invite redemption, account deletion
supabase/functions/api/index.ts         routes: /config, /invites/check, /state, /actions, /account/delete
supabase/migrations/                    tables, locked-down access, photo bucket, admin tools
src/lib/demo-store.ts                   the in-browser demo
src/pages, src/components               screens
tests/                                  engine, database access, and browser tests
docs/operations.md                      running the pilot: invites, reviews, reports, release gates
docs/policies-draft.md                  policy drafts for owner review (not published)
```

## Tests

```bash
deno test --config tests/deno.json tests/core.test.ts          # engine rules (no database needed)
PGHOST=... PGPORT=... PGUSER=postgres tests/db/run.sh          # access checks + adapter, on a fresh local database
tests/check-build-secrets.sh dist                              # no privileged keys in the build
```

Browser tests (`tests/e2e/`) need Playwright and a local server; see the comments at the top of each file. The Deploy workflow runs the first three on every push and pull request, and deploys only from `main` after they pass.

## Setup and deploy

See `docs/operations.md`. In short: GitHub secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`, GitHub Pages set to GitHub Actions, Supabase Auth URLs pointing at the site, then push to `main`.

## Costs

Built to fit free tiers. The app checks for updates every 8 seconds while open. Check Supabase's current free-plan terms for inactivity pausing before relying on it for real users.
