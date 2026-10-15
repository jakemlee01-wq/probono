// probono API, deployed as one Supabase Edge Function named "api".
// Routes (all under /functions/v1/api):
//   GET  /config           public: support and policy status
//   POST /invites/check    public, rate limited: is this invite code usable? (does not use it up)
//   GET  /state?postingId  signed in: the current screen's data
//   POST /actions          signed in: every change goes through the engine
//   POST /account/delete   signed in within the last 10 minutes: delete my account
//
// The demo never calls this API. It runs the same engine in the visitor's browser.
import postgres from 'npm:postgres@3.4.4';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import type { ActionInput, AppConfig } from '../_shared/types.ts';
import { INVITE_MESSAGES } from '../_shared/core.ts';
import { RATE } from '../_shared/rules.ts';
import { addEvent, AppError, deleteAccount, inviteStatus, nonprofitSignupsOpen, recentEvents, runEngine, sha256hex, type User } from './engine.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3, idle_timeout: 20 });
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function tokenFrom(req: Request) {
  return (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
}
async function userFrom(req: Request): Promise<User & { issuedAt: number }> {
  const token = tokenFrom(req);
  if (!token) throw new AppError('Please sign in.', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new AppError('Please sign in again.', 401);
  let issuedAt = 0;
  try { issuedAt = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).iat * 1000; } catch { /* stays 0 */ }
  return { id: data.user.id, email: data.user.email ?? '', issuedAt };
}
const photoPrefix = (userId: string) => `${SUPABASE_URL}/storage/v1/object/public/photos/${userId}/`;

async function readJson<T>(req: Request): Promise<T | null> {
  const size = Number(req.headers.get('content-length') ?? 0);
  if (size > 200_000) throw new AppError('That request is too large.', 413);
  return (await req.json().catch(() => null)) as T | null;
}

async function removePhotos(userId: string, urls: string[]) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/photos/`;
  const paths = urls.filter((u) => u.startsWith(prefix + userId + '/')).map((u) => u.slice(prefix.length));
  if (paths.length) await admin.storage.from('photos').remove(paths).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api/, '') || '/';
  let userForInvite: User | null = null;
  try {
    if (req.method === 'GET' && route === '/config') {
      const config: AppConfig = {
        supportUrl: Deno.env.get('SUPPORT_URL') || null,
        policiesPublished: (Deno.env.get('POLICIES_PUBLISHED') ?? '') === 'yes',
        nonprofitSignupsOpen: nonprofitSignupsOpen(),
      };
      return json(config);
    }

    if (req.method === 'POST' && route === '/invites/check') {
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
      const key = `invite_check:${(await sha256hex(ip)).slice(0, 32)}`;
      if ((await recentEvents(sql, key, 3600_000)) >= RATE.inviteChecksPerHour) return json({ status: 'too_many', message: INVITE_MESSAGES.too_many });
      await addEvent(sql, key);
      const body = await readJson<{ code?: string }>(req);
      const { outcome, row } = await inviteStatus(sql, body?.code ?? '');
      return json({ status: outcome, message: outcome === 'ok' ? '' : INVITE_MESSAGES[outcome], forEmail: !!row?.email && outcome === 'ok' });
    }

    const user = await userFrom(req);

    if (req.method === 'GET' && route === '/state') {
      const postingId = url.searchParams.get('postingId') ?? undefined;
      const { result } = await sql.begin((tx) => runEngine(tx, user, photoPrefix(user.id), undefined, postingId));
      return json(result);
    }

    if (req.method === 'POST' && route === '/actions') {
      const body = await readJson<ActionInput>(req);
      if (!body || typeof body.action !== 'string') throw new AppError('Please check the form values.');
      if (body.action === 'onboard') userForInvite = user;
      const { result, removedPhotos } = await sql.begin((tx) => runEngine(tx, user, photoPrefix(user.id), body));
      if (removedPhotos.length) await removePhotos(user.id, removedPhotos);
      return json(result);
    }

    if (req.method === 'POST' && route === '/account/delete') {
      if (Date.now() - user.issuedAt > 10 * 60_000) throw new AppError('Please enter your password again to confirm.', 403);
      await sql.begin((tx) => deleteAccount(tx, user.id));
      const { data: files } = await admin.storage.from('photos').list(user.id, { limit: 1000 });
      if (files?.length) {
        const { error } = await admin.storage.from('photos').remove(files.map((f) => `${user.id}/${f.name}`));
        if (error) throw new AppError("Your profile is removed, but we couldn't delete your photos yet. Please try again.", 500);
      }
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw new AppError("Your profile is removed, but we couldn't finish deleting your sign-in. Please try again.", 500);
      return json({ ok: true, message: 'Your account is deleted.' });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof AppError) {
      // A failed invite attempt is recorded outside the rolled-back transaction, for rate limiting.
      if (userForInvite && e.field === 'inviteCode') await addEvent(sql, `invite_fail:${userForInvite.id}`).catch(() => {});
      // Validation problems come back as a normal result so the app can show them next to the field.
      if (e.status === 400 && route === '/actions') return json({ ok: false, message: e.message, field: e.field });
      return json({ error: e.message }, e.status);
    }
    // Log the error type only: never request bodies, chat text, or emails.
    console.error('probono request failed', e instanceof Error ? e.name + ': ' + e.message.slice(0, 200) : 'unknown');
    return json({ error: 'Something went wrong on our side. Nothing was saved. Please try again.' }, 500);
  }
});
