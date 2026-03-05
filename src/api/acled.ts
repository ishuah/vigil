import type { FilterState, ACLEDEvent, OAuthTokens } from '../types';

// In dev, Vite proxies /oauth → https://acleddata.com/oauth
// and /acled-api → https://acleddata.com/api/acled/read
// In prod (GitHub Pages), set VITE_ACLED_PROXY_BASE to point to your CORS proxy.
const PROXY_BASE = import.meta.env.VITE_ACLED_PROXY_BASE ?? '';
const TOKEN_URL = `${PROXY_BASE}/oauth/token`;
const API_URL = `${PROXY_BASE}/acled-api/read`;

const STORAGE_KEY = 'vigil_oauth';

// ── Token persistence ───────────────────────────────────────────────────────

export function saveTokens(tokens: OAuthTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function loadTokens(): OAuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OAuthTokens;
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isTokenExpired(tokens: OAuthTokens): boolean {
  // Treat as expired 60s before actual expiry to avoid edge cases
  return Date.now() > tokens.expiresAt - 60_000;
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    username: email,
    password,
    grant_type: 'password',
    client_id: 'acled',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Auth failed (${res.status})`;
    try {
      const json = JSON.parse(text);
      msg = json.message ?? json.error_description ?? msg;
    } catch { /* use default */ }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error('No access token in response');

  const tokens: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000,
  };
  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(tokens: OAuthTokens): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    refresh_token: tokens.refreshToken,
    grant_type: 'refresh_token',
    client_id: 'acled',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);

  const data = await res.json();
  const refreshed: OAuthTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 86400) * 1000,
  };
  saveTokens(refreshed);
  return refreshed;
}

// Returns a valid access token, refreshing if needed
export async function getValidToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error('Not authenticated');
  if (isTokenExpired(tokens)) {
    tokens = await refreshAccessToken(tokens);
  }
  return tokens.accessToken;
}

// ── Type guard ──────────────────────────────────────────────────────────────

export function isACLEDEvent(obj: unknown): obj is ACLEDEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'event_id_cnty' in obj &&
    'actor1' in obj &&
    'actor2' in obj
  );
}

// ── API calls ────────────────────────────────────────────────────────────────

function buildParams(
  filter: FilterState,
  page: number,
): Record<string, string> {
  const params: Record<string, string> = {
    limit: '500',
    page: String(page),
  };

  if (filter.countries.length > 0) {
    params.country = filter.countries.join('|');
    params.country_where = 'OR';
  }

  if (filter.startDate && filter.endDate) {
    params.event_date = `${filter.startDate}|${filter.endDate}`;
    params.event_date_where = 'BETWEEN';
  }

  if (filter.eventTypes.length > 0) {
    params.event_type = filter.eventTypes.join('|');
    params.event_type_where = 'OR';
  }

  return params;
}

async function apiFetch(params: Record<string, string>): Promise<Response> {
  const token = await getValidToken();
  const url = new URL(API_URL, window.location.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await apiFetch({ limit: '1', page: '1' });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` };
    const data = await res.json();
    if (data.status === 200 || data.success === true || Array.isArray(data.data)) {
      return { ok: true, message: 'Connection successful' };
    }
    return { ok: false, message: data.error ?? data.message ?? 'Unexpected response' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}

export async function fetchEvents(
  filter: FilterState,
  onProgress: (loaded: number, total: number) => void,
): Promise<ACLEDEvent[]> {
  const page1Res = await apiFetch(buildParams(filter, 1));
  if (!page1Res.ok) throw new Error(`HTTP error ${page1Res.status}`);
  const page1Data = await page1Res.json();

  if (page1Data.status !== 200 && page1Data.success !== true && !Array.isArray(page1Data.data)) {
    throw new Error(page1Data.error ?? page1Data.message ?? 'API error — check your filters');
  }

  const total: number = page1Data.count ?? page1Data.data?.length ?? 0;
  const events: ACLEDEvent[] = Array.isArray(page1Data.data) ? [...page1Data.data] : [];
  onProgress(events.length, total);

  if (total <= 500) return events;

  const totalPages = Math.ceil(total / 500);
  for (let page = 2; page <= totalPages; page++) {
    const res = await apiFetch(buildParams(filter, page));
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data.data)) break;
    events.push(...data.data);
    onProgress(events.length, total);
    if (!data.hasmore) break;
  }

  return events;
}
