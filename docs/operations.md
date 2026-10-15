# Running the probono pilot

Practical notes for the people operating the pilot. Everything here runs from the Supabase dashboard (SQL editor, Authentication settings) or GitHub. Nothing needs a separate admin app.

## Before real users: release gates

These are open until someone does them. The code is in place; the decisions and setup are not.

| Gate | Status | What it takes |
| --- | --- | --- |
| Email delivery | Not verified | Supabase's built-in sender is for testing and is rate limited. Connect a real provider under Authentication, SMTP. Then, with a mailbox you own, run the auth checklist below. |
| Terms, privacy, community guidelines | Drafts only | Review `docs/policies-draft.md`. Publish final text in `src/pages/info.tsx`, then set the function secret `POLICIES_PUBLISHED=yes`. |
| Support contact | Not configured | Decide who answers. Set the function secret `SUPPORT_URL` (a `mailto:` or form link). Until then the app says support isn't set up. |
| Moderation owner | Not named | Someone must check `admin.open_reports` regularly. The app doesn't promise a response time. |
| Organization review | Manual, no owner yet | Every nonprofit stays hidden from volunteers until reviewed (see below). |
| Hosting availability | Not verified | Check Supabase's current free-plan terms for inactivity pausing and limits, and decide whether the pilot needs a paid plan. |
| Old demo leftovers | Hidden, not removed | See "Old demo rows" below. |

## Deploying this release

1. Merge the `fixes` branch into `main` once you're happy with it. The Deploy workflow then runs the tests, applies the new migration (`20261015000000_safety.sql`, additive only), deploys the `api` function, and publishes the site.
2. The workflow no longer sets `DEMO_MODE`. The demo now runs in each visitor's browser, so there's nothing to turn on or off on the server. You can delete the old `DEMO_MODE` secret: Supabase dashboard, Edge Functions, Secrets.
3. Optional function secrets (Edge Functions, Secrets): `SUPPORT_URL`, `POLICIES_PUBLISHED`.
4. No new GitHub secrets are needed. The workflow still uses `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`.

Rollback: revert the merge commit on `main`. The migration only adds tables and an `admin` schema, so the previous function keeps working with them in place.

## Inviting volunteers

Invites are one-time codes. Only a hash is stored, so a code can't be looked up later: copy it when you create it.

```sql
-- Bound to one email address, valid 14 days:
select admin.issue_invite('person@example.org', 14, 'From Greta');
-- Anyone can use it once, valid 7 days:
select admin.issue_invite(null, 7, 'Pilot cohort 1');
```

Send the code, or a link: `https://jakemlee01-wq.github.io/probono/#/join/volunteer?code=PB-XXXXX-XXXXX-XXXXX-XXXXX`

```sql
select * from admin.invites;                -- state: active, redeemed, expired, revoked
select admin.revoke_invite('AB12');         -- by the last four characters (hint column)
```

The old shared codes from the first version (TWINCITIES, GIVE5, FINANCEFORGOOD) no longer work.

## Reviewing organizations and people

```sql
select * from admin.people where kind = 'nonprofit' and review_status is distinct from 'reviewed';
select admin.set_review('<profile id>', 'organization', 'reviewed', 'Checked IRS exempt-organization record and spoke with the executive director', 'Jake');
```

The `method` text is shown to users next to the badge, so write exactly what was checked. Kinds: `organization`, `identity`, `credential`. Statuses: `pending`, `reviewed`, `rejected`, `needs_update`. Each call adds a row; the latest one counts, and the history stays.

Volunteers aren't gated by review. Their cards say "Joined by pilot invite · identity not reviewed" and show credentials as self-reported until you record an `identity` or `credential` review.

## Reports, blocks, and restrictions

```sql
select * from admin.open_reports;
select admin.assign_report('<report id>', 'Jake');
select admin.resolve_report('<report id>', 'resolved', 'Spoke with both sides; no further action', 'Jake');
select admin.restrict('<profile id>', 'Investigating a report', 'Jake');   -- hides them and blocks actions
select admin.lift_restriction('<profile id>');
```

Every step is written to `report_events`. Reports are never shown to the person reported.

## Stalled work

```sql
select * from admin.stalled_projects order by pending_until nulls last;
```

Shows titles, deadlines, and the time of the last message, not message contents.

## Old demo rows

The first version stored its demo (Sally, Marcus, Priya, Northside, Riverside, Eastside) in the real tables and created four demo sign-ins. The new engine ignores those rows completely, so real users never see them. To remove them, which is optional and not undoable, run this yourself in the SQL editor:

```sql
begin;
delete from engagements where volunteer_id in ('sally','marcus','priya') or posting_id in (select id from postings where org_id in ('northside','riverside','eastside'));
delete from postings where org_id in ('northside','riverside','eastside');
delete from profiles where id in ('sally','marcus','priya','northside','riverside','eastside');
commit;
```

Then delete the four `*.demo@probono.example.com` users under Authentication, Users.

## Auth checklist (needs a real mailbox you own)

Not yet run. Record the result of each step, and note that "request accepted" doesn't prove an email arrived.

1. Authentication, URL Configuration: Site URL `https://jakemlee01-wq.github.io/probono/`, Redirect URLs include `https://jakemlee01-wq.github.io/probono/**`.
2. Create a nonprofit account from "Create a nonprofit account". Confirm the email arrives, the link opens the site, and you land on setup.
3. Open the same confirmation link a second time. You should see "That link didn't work" with resend options.
4. Sign out, then "Forgot password". Confirm the email, set a new password, sign in with it.
5. Open a reset link in a different browser. You should get the same-browser explanation, not a blank page.
6. Issue an invite bound to a second address you own and join as a volunteer with it.

## Health checklist

Check monthly, or before inviting a new group.

- The project isn't paused (Supabase dashboard home).
- The last Deploy run on `main` is green, including the test job.
- Storage use is within plan limits.
- `admin.open_reports` is empty or assigned.
- `admin.invites` has no long-unused active invites you meant to revoke.
