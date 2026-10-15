-- Access checks run as the roles the public website would use. Every check must be refused.
\set ON_ERROR_STOP on
create or replace function pg_temp.expect(role_name text, sub text, stmt text, want text) returns void language plpgsql as $$
declare got text;
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claims', json_build_object('sub', sub)::text, true);
  begin
    execute stmt;
    get diagnostics got = row_count;
    got := 'rows:' || got;
  exception when insufficient_privilege then got := 'denied';
    when others then got := 'error:' || sqlstate;
  end;
  reset role;
  if got <> want and not (want = 'denied_or_empty' and got in ('denied', 'rows:0')) then
    raise exception 'FAIL [%] % -> % (wanted %)', role_name, stmt, got, want;
  end if;
  raise notice 'PASS [%] % -> %', role_name, left(stmt, 70), got;
end $$;

insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@example.org'), ('22222222-2222-2222-2222-222222222222', 'b@example.org');
insert into profiles (id, user_id, data) values ('pa', '11111111-1111-1111-1111-111111111111', '{"name":"A"}'), ('pb', '22222222-2222-2222-2222-222222222222', '{"name":"B"}');
insert into postings (id, org_id, data) values ('post-b', 'pb', '{}');
insert into engagements (id, posting_id, volunteer_id, status, data) values ('e1', 'post-b', 'pa', 'pending', '{"project":{"messages":[{"text":"secret"}]}}');
insert into reports (id, reporter_id, target_id, category) values ('r1', 'pa', 'pb', 'spam');
insert into invite_tokens (token_hash, hint, expires_at) values ('h', 'ABCD', now() + interval '1 day');

begin;
select pg_temp.expect(r, s, q, w) from (values
  ('anon', '', 'select * from profiles', 'denied'),
  ('anon', '', 'select * from engagements', 'denied'),
  ('anon', '', 'select * from invite_tokens', 'denied'),
  ('anon', '', 'select * from invites', 'denied'),
  ('anon', '', 'select * from reports', 'denied'),
  ('anon', '', 'select * from reviews', 'denied'),
  ('anon', '', 'insert into reviews (profile_id, kind, status, method, reviewer) values (''pa'',''identity'',''reviewed'',''x'',''x'')', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select * from profiles', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select * from engagements', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'update profiles set data = ''{}'' where id = ''pb''', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'update engagements set status = ''active''', 'denied'),
  ('authenticated', '22222222-2222-2222-2222-222222222222', 'select * from reports', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into reviews (profile_id, kind, status, method, reviewer) values (''pa'',''identity'',''reviewed'',''x'',''x'')', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into restrictions (profile_id, reason, created_by) values (''pb'',''x'',''x'')', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into invite_tokens (token_hash, hint, expires_at) values (''x'',''x'',now())', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select * from notifications', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select * from blocks', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select admin.issue_invite()', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select * from admin.invites', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'select admin.set_review(''pa'',''identity'',''reviewed'',''x'',''x'')', 'denied'),
  ('anon', '', 'select * from admin.open_reports', 'denied'),
  -- Storage: upload only into your own folder; nobody can list objects.
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into storage.objects (bucket_id, name) values (''photos'', ''11111111-1111-1111-1111-111111111111/a.jpg'')', 'rows:1'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into storage.objects (bucket_id, name) values (''photos'', ''22222222-2222-2222-2222-222222222222/a.jpg'')', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into storage.objects (bucket_id, name) values (''photos'', ''a.jpg'')', 'denied'),
  ('authenticated', '11111111-1111-1111-1111-111111111111', 'insert into storage.objects (bucket_id, name) values (''other'', ''11111111-1111-1111-1111-111111111111/a.jpg'')', 'denied'),
  ('anon', '', 'insert into storage.objects (bucket_id, name) values (''photos'', ''x/a.jpg'')', 'denied'),
  ('authenticated', '22222222-2222-2222-2222-222222222222', 'delete from storage.objects where name like ''1111%''', 'rows:0'),
  ('authenticated', '22222222-2222-2222-2222-222222222222', 'select * from storage.objects', 'rows:0')
) t(r, s, q, w);
commit;

-- The bucket enforces the 5 MB limit and image types on the server side.
select case when file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg','image/png','image/webp'] and public
  then 'PASS photos bucket: 5MB, jpeg/png/webp' else 'FAIL photos bucket settings' end from storage.buckets where id = 'photos';

-- Operator tools work for the owner, and invites are stored hashed.
do $$ declare code text; begin
  code := admin.issue_invite('Friend@Example.org ', 7, 'test');
  if code !~ '^PB-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$' then raise exception 'FAIL invite format %', code; end if;
  if exists (select 1 from invite_tokens where token_hash like '%' || replace(substr(code, 4), '-', '') || '%') then raise exception 'FAIL code stored in clear'; end if;
  if (select email from invite_tokens where note = 'test') <> 'friend@example.org' then raise exception 'FAIL email not normalized'; end if;
  raise notice 'PASS admin.issue_invite returns % (hash only stored)', left(code, 9) || '...';
  if admin.revoke_invite(right(replace(code, '-', ''), 4)) <> 1 then raise exception 'FAIL revoke'; end if;
  raise notice 'PASS admin.revoke_invite';
end $$;
delete from storage.objects; delete from reports; delete from engagements; delete from postings; delete from profiles; delete from invite_tokens; delete from auth.users;
