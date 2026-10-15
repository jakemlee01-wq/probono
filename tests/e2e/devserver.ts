// Local stand-in for the deployed "api" function, for browser tests only. Uses the real engine
// against the local test database (tests/db/run.sh creates it). Tokens look like "x.<user-id>.y".
// Run: PGHOST=/tmp PGPORT=54329 deno run -A --config tests/deno.json tests/e2e/devserver.ts
import postgres from 'npm:postgres@3.4.4';
import { AppError, inviteStatus, runEngine } from '../../supabase/functions/api/engine.ts';
import { INVITE_MESSAGES } from '../../supabase/functions/_shared/core.ts';

const env = (k: string, d: string) => Deno.env.get(k) ?? d;
const sql = postgres({ host: env('PGHOST', 'localhost'), port: Number(env('PGPORT', '5432')), user: env('PGUSER', 'postgres'), database: 'probono_test', prepare: false, onnotice: () => {} });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
Deno.serve({ port: 8787 }, async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api/, '');
  if (url.pathname.startsWith('/__admin/sql')) { // test setup hook
    const q = await req.text();
    return json(await sql.unsafe(q));
  }
  const id = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').split('.')[1] ?? '';
  try {
    if (route === '/config') return json({ supportUrl: null, policiesPublished: false });
    if (route === '/invites/check') {
      const { code } = await req.json();
      const { outcome, row } = await inviteStatus(sql, code);
      return json({ status: outcome, message: outcome === 'ok' ? '' : INVITE_MESSAGES[outcome], forEmail: !!row?.email });
    }
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Please sign in.' }, 401);
    await sql`insert into auth.users (id, email) values (${id}, ${id + '@example.org'}) on conflict do nothing`;
    const user = { id, email: id + '@example.org' };
    const prefix = `http://localhost:8787/storage/v1/object/public/photos/${id}/`;
    if (route === '/state') return json((await sql.begin((tx) => runEngine(tx, user, prefix, undefined, url.searchParams.get('postingId') ?? undefined))).result);
    if (route === '/actions') { const body = await req.json(); return json((await sql.begin((tx) => runEngine(tx, user, prefix, body))).result); }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    if (e instanceof AppError) return e.status === 400 ? json({ ok: false, message: e.message, field: e.field }) : json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on our side. Nothing was saved. Please try again.' }, 500);
  }
});
