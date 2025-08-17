// =============================================
// File: src/lib/api.ts
// Aligns with .env.local → NEXT_PUBLIC_API_BASE=http://127.0.0.1:5050/api
// Adds robust returns, optional credentials, and safe token/header handling.
// =============================================

export type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string | number | boolean | null | undefined>;
  token?: string | null;          // override token per request
  signal?: AbortSignal;
  rawResponse?: boolean;          // if true, return Response
  withCredentials?: boolean;      // default false
};

export type ApiErrorShape = { error?: any; message?: string } & Record<string, any>;

const DEFAULT_API_ORIGIN =
  process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:5050';

const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  DEFAULT_API_ORIGIN
).replace(/\/+$/, '');

const API_BASE = `${API_ORIGIN}/api`;

function buildQuery(params?: ApiOptions['query']): string {
  if (!params) return '';
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('token') ||
      null
    );
  } catch {
    return null;
  }
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    query,
    token,
    signal,
    rawResponse = false,
    withCredentials = false,
  } = opts;

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${buildQuery(query)}`;

  // ----- Body & headers detection -----
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const isStringBody = typeof body === 'string';
  const hdrContentType = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
  const needsJsonHeader =
    !isForm &&
    (isStringBody || (body && typeof body === 'object')) &&
    !hdrContentType;

  const finalHeaders: Record<string, string> = {
    ...(needsJsonHeader ? { 'Content-Type': 'application/json' } : {}),
    Accept: 'application/json',
    ...headers,
  };

  // ----- Auth header -----
  const authToken = token ?? getStoredToken();
  if (authToken) finalHeaders['Authorization'] = `Bearer ${authToken}`;

  // ----- Fetch -----
  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: isForm
      ? body
      : isStringBody
      ? body // already string (often JSON.stringify(...))
      : body && typeof body === 'object'
      ? JSON.stringify(body)
      : body ?? undefined,
    signal,
    credentials: withCredentials ? 'include' : 'omit',
  });

  if (rawResponse) return (res as unknown) as T;

  // ----- Parse response -----
  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    try { data = await res.json(); } catch { data = {}; }
  } else {
    try { data = await res.text(); } catch { data = ''; }
    // Best-effort: if it looks like JSON, parse it
    if (typeof data === 'string' && /^\s*[\{\[]/.test(data)) {
      try { data = JSON.parse(data); } catch {}
    }
  }

  // ----- Error handling -----
  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data as ApiErrorShape).error) ||
      (data && typeof data === 'object' && (data as ApiErrorShape).message) ||
      res.statusText ||
      'Request failed';
    const err = new Error(message) as Error & { status?: number; body?: any };
    err.status = res.status;
    (err as any).body = data;

    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('API error', {
        url,
        status: res.status,
        statusText: res.statusText,
        data,
        method,
        body: isForm ? '[FormData]' : isStringBody ? body : (body && typeof body === 'object') ? '[JSON object]' : body,
      });
    }
    throw err;
  }

  return data as T;
}

// ----- Convenience helpers -----
export const get = <T = unknown>(path: string, query?: ApiOptions['query'], opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'GET', query });

export const post = <T = unknown>(path: string, body?: any, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'POST', body });

export const put = <T = unknown>(path: string, body?: any, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'PUT', body });

export const del = <T = unknown>(path: string, opts?: ApiOptions) =>
  api<T>(path, { ...opts, method: 'DELETE' });

// ----- Upload / Download helpers -----
export async function upload<T = unknown>(
  path: string,
  file: File | Blob,
  fieldName = 'file',
  extraFields?: Record<string, string | Blob>
): Promise<T> {
  const fd = new FormData();
  fd.append(fieldName, file);
  if (extraFields) for (const [k, v] of Object.entries(extraFields)) fd.append(k, v);
  return api<T>(path, { method: 'POST', body: fd });
}

export async function download(
  path: string,
  query?: ApiOptions['query'],
  opts?: ApiOptions
): Promise<Blob> {
  const res = await api<Response>(path, { ...opts, method: 'GET', query, rawResponse: true });
  const blob = await (res as unknown as Response).blob();
  return blob;
}

export async function downloadAndSave(
  path: string,
  filename: string,
  query?: ApiOptions['query'],
  opts?: ApiOptions
): Promise<void> {
  const blob = await download(path, query, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
