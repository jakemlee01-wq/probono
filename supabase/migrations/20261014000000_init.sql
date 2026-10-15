-- probono schema. The website never talks to these tables directly: row level security is on
-- with no policies, so only the "api" Edge Function (which connects as the database owner) can.

create table if not exists public.profiles (
  id text primary key,
  user_id uuid unique references auth.users (id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.postings (
  id text primary key,
  org_id text not null references public.profiles (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.engagements (
  id text primary key,
  posting_id text not null references public.postings (id) on delete cascade,
  volunteer_id text not null references public.profiles (id) on delete cascade,
  status text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (posting_id, volunteer_id)
);

create table if not exists public.invites (
  code text primary key,
  remaining integer not null default 0
);

create index if not exists engagements_volunteer_idx on public.engagements (volunteer_id);
create index if not exists engagements_status_idx on public.engagements (status);
create index if not exists postings_org_idx on public.postings (org_id);

alter table public.profiles enable row level security;
alter table public.postings enable row level security;
alter table public.engagements enable row level security;
alter table public.invites enable row level security;

-- Profile photos: public to read, and each signed-in user can only upload into their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos: upload to own folder" on storage.objects;
create policy "photos: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos: delete own" on storage.objects;
create policy "photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
