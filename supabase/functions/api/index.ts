// probono API, deployed as one Supabase Edge Function named "api".
// Routes (all under /functions/v1/api):
//   GET  /config           public: skills, causes, demo accounts
//   GET  /state?postingId  signed in: the current screen's data
//   POST /actions          signed in: every change goes through the engine
//   POST /demo/sign-in     demo mode: one-tap entry as a demo account
//   POST /demo/reset       demo mode, demo accounts only: restore the demo data
import postgres from 'npm:postgres@3.4.4';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { CAUSES, SKILLS, type ActionInput, type AppConfig } from '../_shared/types.ts';
import { AppError, runEngine } from './engine.ts';
import { DEMO_ACCOUNTS, ensureSeeded, isDemoMode, resetDemo } from './seed.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3, idle_timeout: 20 });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

let seeded: Promise<void> | null = null;
const seedOnce = () => (seeded ??= ensureSeeded(sql, admin).catch((e) => { seeded = null; throw e; }));

async function userIdFrom(req: Request): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError('Please sign in.', 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new AppError('Please sign in again.', 401);
  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api/, '') || '/';
  try {
    await seedOnce();

    if (req.method === 'GET' && route === '/config') {
      const config: AppConfig = {
        skills: SKILLS, causes: CAUSES, demoMode: isDemoMode(),
        demoAccounts: isDemoMode() ? DEMO_ACCOUNTS.map(({ id, name, kind }) => ({ id, name, kind })) : [],
      };
      return json(config);
    }

    if (req.method === 'POST' && route === '/demo/sign-in') {
      if (!isDemoMode()) throw new AppError('Demo mode is off.', 404);
      const { accountId } = await req.json().catch(() => ({}));
      const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
      if (!account) throw new AppError('Unknown demo account.');
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: account.email });
      if (error) throw error;
      return json({ tokenHash: data.properties.hashed_token });
    }

    const userId = await userIdFrom(req);

    if (req.method === 'POST' && route === '/demo/reset') {
      if (!isDemoMode()) throw new AppError('Demo mode is off.', 404);
      const [row] = await sql<{ id: string }[]>`select id from profiles where user_id = ${userId}`;
      if (!row || !DEMO_ACCOUNTS.some((a) => a.id === row.id)) throw new AppError('Only demo accounts can reset the demo.', 403);
      await resetDemo(sql, admin);
      return json({ ok: true, message: 'Demo data has been reset.' });
    }

    if (req.method === 'GET' && route === '/state') {
      const postingId = url.searchParams.get('postingId') ?? undefined;
      return json(await sql.begin((tx) => runEngine(tx, userId, undefined, postingId)));
    }

    if (req.method === 'POST' && route === '/actions') {
      const body = (await req.json().catch(() => null)) as ActionInput | null;
      if (!body || typeof body.action !== 'string') throw new AppError('Please check the form values.');
      return json(await sql.begin((tx) => runEngine(tx, userId, body)));
    }

    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    if (e instanceof AppError) {
      // Validation problems come back as a normal result so the app can show a friendly message.
      if (e.status === 400 && route === '/actions') return json({ ok: false, message: e.message });
      return json({ error: e.message }, e.status);
    }
    console.error('probono request failed', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
