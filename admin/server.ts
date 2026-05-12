// WaveX OS Meta Mission Control — Fastify server.
// Reads from the wavex_os.* schema in Supabase using the service-role key,
// gates access via Supabase JWT with an `admin` claim, and renders a single
// server-side HTML page.

import { createHmac, timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { createClient } from '@supabase/supabase-js';
import {
  renderDashboard,
  renderError,
  type DashboardData,
  type InjectionQueueItem,
  type OptimizerRun,
  type Subscription,
} from './views/dashboard.html.js';

// ---- env loading -----------------------------------------------------------

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const SUPABASE_URL = reqEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = reqEnv('SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_JWT_SECRET = reqEnv('SUPABASE_JWT_SECRET');
const ADMIN_USER_EMAILS = new Set(
  (process.env.ADMIN_USER_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const LOG_LEVEL = (process.env.LOG_LEVEL ?? 'info') as 'trace' | 'debug' | 'info' | 'warn' | 'error';

if (ADMIN_USER_EMAILS.size === 0) {
  console.warn('[admin] ADMIN_USER_EMAILS is empty — no user will be admitted.');
}

// ---- Supabase client (server-side only) ------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'wavex_os' },
});

// ---- JWT verification ------------------------------------------------------
// Supabase issues HS256 JWTs signed with the project's JWT secret. We verify
// signature + expiry + admin claim ourselves so we don't need an extra runtime.

type AdminClaims = {
  sub: string;
  email?: string;
  exp?: number;
  app_metadata?: { admin?: boolean };
  user_metadata?: Record<string, unknown>;
};

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function verifyAdminJwt(token: string): AdminClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  const expected = createHmac('sha256', SUPABASE_JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const provided = b64urlDecode(sigB64);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  let claims: AdminClaims;
  try {
    claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as AdminClaims;
  } catch {
    return null;
  }

  if (claims.exp && Date.now() / 1000 > claims.exp) return null;
  if (!claims.email) return null;
  if (!claims.app_metadata?.admin) return null;
  if (!ADMIN_USER_EMAILS.has(claims.email.toLowerCase())) return null;

  return claims;
}

function extractToken(authorization: string | undefined, cookieToken: string | undefined): string | null {
  if (authorization && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }
  if (cookieToken && cookieToken.length > 0) return cookieToken;
  return null;
}

// Minimal cookie parser — avoids a plugin dependency.
function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

// ---- data loaders ----------------------------------------------------------

async function loadDashboardData(viewerEmail: string): Promise<DashboardData> {
  const [subsRes, runsRes, queueRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id,user_id,tier,status,current_period_end,days_until_renewal,last_fleet_digest_received')
      .eq('status', 'active')
      .order('current_period_end', { ascending: true })
      .limit(100),
    supabase
      .from('optimizer_runs')
      .select('id,subscription_id,kind,model,cost_cents,status,ran_at')
      .order('ran_at', { ascending: false })
      .limit(50),
    supabase
      .from('injection_queue')
      .select('id,subscription_id,kind,expires_at,created_at')
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const errors = [subsRes.error, runsRes.error, queueRes.error].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(`Supabase read failed: ${errors.map((e) => e!.message).join('; ')}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    viewerEmail,
    subscriptions: (subsRes.data ?? []) as Subscription[],
    optimizerRuns: (runsRes.data ?? []) as OptimizerRun[],
    injectionQueue: (queueRes.data ?? []) as InjectionQueueItem[],
  };
}

// ---- Fastify wiring --------------------------------------------------------

const app = Fastify({ logger: { level: LOG_LEVEL } });

app.get('/healthz', async () => ({ ok: true }));

app.get('/admin', async (req, reply) => {
  const token = extractToken(
    req.headers.authorization as string | undefined,
    parseCookie(req.headers.cookie as string | undefined, 'sb-access-token'),
  );
  if (!token) {
    reply.code(401).type('text/html');
    return renderError(
      401,
      'Unauthorized',
      'Missing Supabase JWT. Send as Authorization: Bearer <token> or sb-access-token cookie.',
    );
  }

  const claims = verifyAdminJwt(token);
  if (!claims) {
    reply.code(403).type('text/html');
    return renderError(
      403,
      'Forbidden',
      'Token failed verification or does not carry the admin claim for an allowlisted email.',
    );
  }

  try {
    const data = await loadDashboardData(claims.email!);
    reply.type('text/html');
    return renderDashboard(data);
  } catch (err) {
    req.log.error({ err }, 'failed to load dashboard data');
    reply.code(500).type('text/html');
    return renderError(500, 'Internal Server Error', 'Failed to read from Supabase. Check server logs.');
  }
});

app.get('/', async (_req, reply) => reply.redirect('/admin'));

// ---- bootstrap -------------------------------------------------------------

async function main() {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`admin dashboard listening on http://${HOST}:${PORT}/admin`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[admin] fatal startup error:', err);
  process.exit(1);
});
