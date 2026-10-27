/**
 * The one HTTP entry point. Features never call fetch directly: they call
 * `api.get/post/patch` with a Zod schema, which gives typed, validated data.
 *
 * With VITE_USE_MOCKS=true requests are answered in-process by
 * ./mock/server (lazy-loaded, so it costs nothing when mocks are off).
 */
import type { z } from 'zod';
import { env } from '@/shared/config/env';
import { reportError } from '@/shared/lib/monitoring';

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  get isOffline() {
    return this.status === 0;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions<T> {
  schema: z.ZodType<T>;
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

/* The session store registers these at startup; avoids an import cycle. */
let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};
export function configureAuth(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export const OFFLINE_MESSAGE = "You're offline. Check your data or Wi-Fi and try again.";

function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Turns a DRF-style error body ({detail} or {field: [msg]}) into an ApiError. */
function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.detail === 'string') return new ApiError(status, obj.detail);
    const fieldErrors: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      const msg = Array.isArray(v) ? v[0] : v;
      if (typeof msg === 'string') fieldErrors[k] = msg;
    }
    const first = Object.values(fieldErrors)[0];
    if (first) return new ApiError(status, first, fieldErrors);
  }
  return new ApiError(
    status,
    status >= 500 ? 'Kasa is having trouble right now. Try again shortly.' : 'Something went wrong.',
  );
}

async function send(
  method: Method,
  path: string,
  body: unknown,
  query: Query | undefined,
  signal?: AbortSignal,
) {
  const token = getToken();
  if (env.useMocks) {
    const { handleMockRequest } = await import('./mock/server');
    return handleMockRequest({
      method,
      path,
      query: new URLSearchParams(buildQuery(query)),
      body,
      token,
      signal,
    });
  }
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}${buildQuery(query)}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  const data: unknown = res.status === 204 ? { ok: true } : await res.json().catch(() => null);
  return { status: res.status, body: data };
}

async function request<T>(method: Method, path: string, opts: RequestOptions<T>): Promise<T> {
  const { status, body } = await send(method, path, opts.body, opts.query, opts.signal);
  if (status === 401) {
    onUnauthorized();
    throw toApiError(401, body ?? { detail: 'Please log in again.' });
  }
  if (status < 200 || status >= 300) throw toApiError(status, body);

  const parsed = opts.schema.safeParse(body);
  if (!parsed.success) {
    reportError(new Error(`API contract violation: ${method} ${path}`), { issues: parsed.error.issues });
    throw new ApiError(status, 'Kasa received data it did not expect. Please update the app.');
  }
  return parsed.data;
}

export const api = {
  get: <T>(path: string, opts: Omit<RequestOptions<T>, 'body'>) => request('GET', path, opts),
  post: <T>(path: string, opts: RequestOptions<T>) => request('POST', path, opts),
  patch: <T>(path: string, opts: RequestOptions<T>) => request('PATCH', path, opts),
  put: <T>(path: string, opts: RequestOptions<T>) => request('PUT', path, opts),
  delete: <T>(path: string, opts: Omit<RequestOptions<T>, 'body'>) => request('DELETE', path, opts),
};

/** URL for pronunciation audio. Native recordings win; otherwise Khaya TTS via our API. */
export function audioUrlFor(
  item: { audioUrl: string | null; translation: string },
  khayaTtsCode: string,
  voice: string,
) {
  if (item.audioUrl) return item.audioUrl;
  const q = new URLSearchParams({ text: item.translation, lang: khayaTtsCode, speaker: voice });
  return `${env.apiBaseUrl}/tts/?${q.toString()}`;
}
