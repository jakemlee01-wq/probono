# probono

Lend your skills to a Twin Cities nonprofit, a few hours at a time.

A phone-first app that connects volunteers (finance and accounting to start) with local nonprofits for short, scoped pro bono projects. Volunteers set their own terms: hours a week, how many weeks, when they're free. Both sides only see people and postings that fit.

## How it works

The app has three modes, and only one shows at a time:

1. **Discovery** (plum). One prospect at a time: photos and their own words, swipe through, then **Not now** or **Show interest**. Volunteers join by invite code. Nonprofits write a real note and get five per posting; answering someone who's already interested is free.
2. **Pending** (cream). When interest is mutual, an "It's mutual" pop-up appears, then a pending project replaces discovery: a 3-day countdown, the agreed terms, a chat, and **Pass** or **Confirm project**. If time runs out, it lapses and the role reopens.
3. **Partnership** (cream with a plum header). Once both confirm: weekly hours against the commitment, next check-in, deliverables, messages, team and links. In the final week each side writes a closing note. After the end date, the project closes, the notes go on each other's track record, and both return to discovery.

One pending or active project at a time per volunteer, and per nonprofit posting.

## Stack

- **Website:** React 18, TypeScript, Vite, Tailwind 4, hash routing. Hosted on GitHub Pages.
- **Backend:** Supabase (free tier). Auth for sign-in, Postgres for data, Storage for profile photos, and one Edge Function (`api`) that holds all the rules.
- The website never reads tables directly. Every change goes through `supabase/functions/api/engine.ts`, inside a transaction with a lock, so two people can't grab the same volunteer at once.

## Where things live

```text
src/pages/                 landing, sign-in/up, password reset, the app shell
src/components/            discovery card, pending, partnership workspace, profile, postings, demo bar
src/lib/                   Supabase client, API calls, session, toasts
supabase/functions/_shared/types.ts   data shapes shared by the site and the function
supabase/functions/api/engine.ts      the state machine: matching, interest, pending, projects
supabase/functions/api/seed.ts        demo data and demo accounts (dates are relative to today)
supabase/functions/api/index.ts       routes: /config, /state, /actions, /demo/sign-in, /demo/reset
supabase/migrations/       tables, row level security, photo bucket
public/assets/demo-photos/ photos for the six demo profiles (AI-generated, fictional people)
.github/workflows/deploy.yml  migrations + function to Supabase, site to GitHub Pages
```

## Demo mode

On by default (`DEMO_MODE=on`). The sign-in screens get a **Try the demo** link that drops you into Sally, Marcus, Riverside, or Northside with one tap, no password. A bar at the top switches accounts or resets the demo data. Inside a project, **Skip ahead a week** lets you try the hand-off and close without waiting.

Riverside is already interested in Sally, and Marcus is already interested in Northside's NetSuite posting, so the full flow works right away.

To turn it off before real users join: in GitHub, Settings, Secrets and variables, Actions, Variables, set `DEMO_MODE` to `off` and re-run the deploy.

Invite codes for new volunteers: `TWINCITIES`, `GIVE5`, `FINANCEFORGOOD` (25 uses each).

## One-time setup

1. **Supabase:** create a free project. Note the project ref (the part of the URL before `.supabase.co`), the Project URL, the anon public key, and the database password.
2. **Supabase personal access token:** supabase.com, Account, Access Tokens, generate one.
3. **GitHub repo settings**, Secrets and variables, Actions:
   - Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
   - Variables: `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
4. **GitHub Pages:** Settings, Pages, Source: **GitHub Actions**.
5. **Supabase Auth URLs:** Authentication, URL Configuration. Set Site URL to `https://jakemlee01-wq.github.io/probono/` and add the same address under Redirect URLs. This makes confirmation and password-reset emails come back to the site.
6. Push to `main` (or re-run the Deploy workflow). The first request seeds the demo data.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

The function runs on Supabase, so local development talks to the real project.

## Costs

Everything here fits the free tiers: GitHub Pages, Supabase (500 MB database, 1 GB storage, 500k function calls a month). The app checks for updates every 8 seconds while open, which is roughly 3,600 calls per hour of active use.

Supabase's built-in email sender is rate limited (a few emails an hour). That's fine for testing. Before launch, connect a real email provider under Authentication, SMTP.

Free Supabase projects pause after a week with no activity. Opening the dashboard and clicking Restore brings it back.
