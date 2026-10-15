-- probono safety release. Additive only: no existing rows are changed or deleted.
-- Rollback: these tables are new and nothing outside them depends on them; drop them and the
-- admin schema to return to the previous version. Existing profiles, postings, and engagements
-- are untouched (the engine upgrades older records in memory when it reads them).

-- One-time, expiring, revocable volunteer invites. Only a SHA-256 hash of the code is stored.
create table if not exists public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  hint text not null, -- last four characters, so an operator can tell invites apart
  email text, -- optional: the normalized address the invite was issued to
  note text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid,
  revoked_at timestamptz
);

-- Operator reviews. Ordinary users have no way to write here. Latest row per (profile, kind) wins.
create table if not exists public.reviews (
  id bigserial primary key,
  profile_id text not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('organization', 'identity', 'credential')),
  status text not null check (status in ('not_submitted', 'pending', 'reviewed', 'rejected', 'needs_update')),
  method text not null, -- what was actually checked, shown to users with the badge
  reviewer text not null,
  note text, -- private to operators
  decided_at timestamptz not null default now()
);
create index if not exists reviews_profile_idx on public.reviews (profile_id, kind, decided_at desc);

-- Operator restrictions (for example while a report is investigated).
create table if not exists public.restrictions (
  profile_id text primary key references public.profiles (id) on delete cascade,
  reason text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz
);

create table if not exists public.blocks (
  id text primary key,
  blocker_id text not null references public.profiles (id) on delete cascade,
  blocked_id text not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

-- Reports are private: never returned to the reported person or anyone but operators.
create table if not exists public.reports (
  id text primary key,
  reporter_id text not null,
  target_id text not null,
  posting_id text,
  project_id text,
  category text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  assigned_to text,
  decision text,
  decided_at timestamptz
);
create table if not exists public.report_events (
  id bigserial primary key,
  report_id text not null references public.reports (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  note text
);

create table if not exists public.notifications (
  id text primary key,
  recipient_id text not null,
  kind text not null,
  text text not null,
  project_id text,
  posting_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (read_at) where read_at is null;

-- Counters for rate limits. Keys hold hashes or ids, never emails or IP addresses.
create table if not exists public.rate_events (
  id bigserial primary key,
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_key_idx on public.rate_events (key, at desc);

-- Lock everything down. The website never reads these tables; only the api function
-- (connected as the database owner) does. RLS on with no policies, plus no grants.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'postings', 'engagements', 'invites', 'invite_tokens', 'reviews', 'restrictions',
                           'blocks', 'reports', 'report_events', 'notifications', 'rate_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke usage, select on all sequences in schema public from anon, authenticated;

-- The first version's shared invite codes (public.invites) were published in the README. The
-- engine no longer reads that table, so those codes stop working without changing any rows.

-- ---------------------------------------------------------------------------------------------
-- Operator tools. Run these from the Supabase SQL editor (as the database owner). The admin
-- schema is not exposed through the public API, and ordinary roles can't execute anything in it.
-- ---------------------------------------------------------------------------------------------
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- Issue a one-time invite. Returns the code once; only a hash of 'PB' plus its 20 characters is stored.
--   select admin.issue_invite('friend@example.org', 14, 'From Greta');
create or replace function admin.issue_invite(p_email text default null, p_days integer default 14, p_note text default null)
returns text language plpgsql as $$
declare
  raw text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
begin
  if p_days < 1 or p_days > 90 then raise exception 'p_days must be between 1 and 90'; end if;
  insert into public.invite_tokens (token_hash, hint, email, note, expires_at)
  values (encode(sha256(convert_to('PB' || raw, 'UTF8')), 'hex'), right(raw, 4), nullif(lower(trim(p_email)), ''), p_note, now() + make_interval(days => p_days));
  return 'PB-' || substr(raw, 1, 5) || '-' || substr(raw, 6, 5) || '-' || substr(raw, 11, 5) || '-' || substr(raw, 16, 5);
end $$;

create or replace function admin.revoke_invite(p_hint text)
returns integer language sql as $$
  with r as (update public.invite_tokens set revoked_at = now()
             where hint = upper(p_hint) and redeemed_at is null and revoked_at is null returning 1)
  select count(*)::int from r;
$$;

create or replace view admin.invites as
  select id, hint, email, note, created_at, expires_at, redeemed_at, redeemed_by, revoked_at,
    case when revoked_at is not null then 'revoked' when redeemed_at is not null then 'redeemed'
         when expires_at <= now() then 'expired' else 'active' end as state
  from public.invite_tokens order by created_at desc;

-- Record a review decision. p_method is shown to users, so say exactly what was checked.
--   select admin.set_review('<profile id>', 'organization', 'reviewed', 'Checked IRS exempt-org record and spoke with the executive director', 'Jake');
create or replace function admin.set_review(p_profile_id text, p_kind text, p_status text, p_method text, p_reviewer text, p_note text default null)
returns void language sql as $$
  insert into public.reviews (profile_id, kind, status, method, reviewer, note) values (p_profile_id, p_kind, p_status, p_method, p_reviewer, p_note);
$$;

create or replace view admin.people as
  select p.id, p.data->>'kind' as kind, p.data->>'name' as name, u.email, p.created_at,
    (select r.status from public.reviews r where r.profile_id = p.id and r.kind = case when p.data->>'kind' = 'nonprofit' then 'organization' else 'identity' end order by r.decided_at desc limit 1) as review_status,
    exists (select 1 from public.restrictions x where x.profile_id = p.id and x.lifted_at is null) as restricted
  from public.profiles p left join auth.users u on u.id = p.user_id
  where coalesce((p.data->>'deleted')::boolean, false) = false
    and p.id not in ('sally', 'marcus', 'priya', 'northside', 'riverside', 'eastside');

create or replace view admin.open_reports as
  select r.*, (select data->>'name' from public.profiles where id = r.reporter_id) as reporter_name,
    (select data->>'name' from public.profiles where id = r.target_id) as target_name
  from public.reports r where r.status in ('open', 'in_review') order by r.created_at;

create or replace function admin.assign_report(p_report_id text, p_operator text)
returns void language sql as $$
  update public.reports set status = 'in_review', assigned_to = p_operator where id = p_report_id;
  insert into public.report_events (report_id, actor, action) values (p_report_id, p_operator, 'assigned');
$$;

create or replace function admin.resolve_report(p_report_id text, p_status text, p_decision text, p_operator text)
returns void language plpgsql as $$
begin
  if p_status not in ('resolved', 'dismissed') then raise exception 'p_status must be resolved or dismissed'; end if;
  update public.reports set status = p_status, decision = p_decision, decided_at = now() where id = p_report_id;
  insert into public.report_events (report_id, actor, action, note) values (p_report_id, p_operator, p_status, p_decision);
end $$;

create or replace function admin.restrict(p_profile_id text, p_reason text, p_operator text)
returns void language sql as $$
  insert into public.restrictions (profile_id, reason, created_by) values (p_profile_id, p_reason, p_operator)
  on conflict (profile_id) do update set reason = excluded.reason, created_by = excluded.created_by, created_at = now(), lifted_at = null;
$$;
create or replace function admin.lift_restriction(p_profile_id text)
returns void language sql as $$ update public.restrictions set lifted_at = now() where profile_id = p_profile_id; $$;

-- Projects that may need a nudge: pending near the deadline, or active with no activity for 14 days.
create or replace view admin.stalled_projects as
  select e.id, e.status, e.data->'project'->'agreement'->>'title' as title,
    e.data->'project'->>'pendingUntil' as pending_until,
    (select max((m->>'createdAt')::timestamptz) from jsonb_array_elements(coalesce(e.data->'project'->'messages', '[]'::jsonb)) m) as last_message
  from public.engagements e
  where e.status in ('pending', 'active', 'completion_pending')
    and e.volunteer_id not in ('sally', 'marcus', 'priya', 'northside', 'riverside', 'eastside');

revoke all on all functions in schema admin from public, anon, authenticated;
revoke all on all tables in schema admin from public, anon, authenticated;
