/**
 * Building blocks for mock route handlers. Kept separate from server.ts so
 * handlers can import them without creating an import cycle.
 */
import type { Role } from '@/shared/api/schemas';
import type { Db, DbUser } from './db';

export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, detail: string | Record<string, string[]>) {
    super(typeof detail === 'string' ? detail : 'Validation error');
    this.status = status;
    this.body = typeof detail === 'string' ? { detail } : detail;
  }
}

export interface Ctx {
  db: Db;
  now: Date;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  user: DbUser | null;
  token: string | null;
  /** Throws 401 when signed out, 403 when suspended (for write actions). */
  requireUser(opts?: { allowSuspended?: boolean }): DbUser;
  requireRole(...roles: Role[]): DbUser;
}

export type Handler = (ctx: Ctx) => unknown;

export interface Route {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  pattern: string;
  handler: Handler;
}

export const route = (method: Route['method'], pattern: string, handler: Handler): Route => ({
  method,
  pattern,
  handler,
});

/* ---------- Small helpers shared by handlers ---------- */
export function str(
  body: Record<string, unknown>,
  key: string,
  opts: { min?: number; max?: number; label?: string } = {},
): string {
  const v = body[key];
  const s = typeof v === 'string' ? v.trim() : '';
  const label = opts.label ?? key;
  if (opts.min !== undefined && s.length < opts.min)
    throw new HttpError(400, {
      [key]: [
        opts.min <= 1 ? `Add ${label}.` : `${capitalise(label)} needs at least ${opts.min} characters.`,
      ],
    });
  if (opts.max !== undefined && s.length > opts.max)
    throw new HttpError(400, { [key]: [`${capitalise(label)} can be at most ${opts.max} characters.`] });
  return s;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function paginate<T>(items: T[], query: URLSearchParams, defaultSize = 20) {
  const page = Math.max(1, Number(query.get('page') ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.get('pageSize') ?? defaultSize)));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}
