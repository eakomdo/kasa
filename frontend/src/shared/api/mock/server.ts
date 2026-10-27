/**
 * Mock REST server. Routes are declared per resource in ./handlers and
 * matched by method + path pattern (e.g. "/units/:unitId/vocabulary/").
 * Handlers enforce the same auth and permission rules the real API will.
 */
import { env } from '@/shared/config/env';
import { getDb, saveDb } from './db';
import { HttpError, type Ctx } from './http';
import { routes } from './handlers';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
  signal?: AbortSignal;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(a[i]!);
    else if (seg !== a[i]) return null;
  }
  return params;
}

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

export async function handleMockRequest(req: MockRequest): Promise<MockResponse> {
  if (!env.isTest) await delay(env.mockLatencyMs * (0.6 + Math.random() * 0.8), req.signal);

  const db = getDb();
  const userId = req.token ? db.sessions[req.token] : undefined;
  const user = userId ? (db.users.find((u) => u.id === userId) ?? null) : null;

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const params = match(r.pattern, req.path);
    if (!params) continue;

    const ctx: Ctx = {
      db,
      now: new Date(),
      params,
      query: req.query,
      body: (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>,
      user,
      token: req.token,
      requireUser(opts) {
        if (!user) throw new HttpError(401, 'Please log in to continue.');
        if (!opts?.allowSuspended && user.status === 'suspended' && req.method !== 'GET')
          throw new HttpError(
            403,
            'Your account is paused by a moderator, so you can’t make changes right now.',
          );
        return user;
      },
      requireRole(...roles) {
        const u = ctx.requireUser();
        if (!roles.includes(u.role)) throw new HttpError(403, 'You don’t have permission to do that.');
        return u;
      },
    };

    try {
      const body = await r.handler(ctx);
      if (user) user.lastActiveAt = ctx.now.toISOString();
      saveDb();
      return { status: 200, body };
    } catch (err) {
      if (err instanceof HttpError) return { status: err.status, body: err.body };
      console.error('[mock] handler crashed', req.method, req.path, err);
      return { status: 500, body: { detail: 'Mock server error.' } };
    }
  }
  return { status: 404, body: { detail: `No mock route for ${req.method} ${req.path}` } };
}
