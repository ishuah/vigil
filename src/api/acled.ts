import type { Credentials, FilterState, ACLEDEvent } from '../types';

const BASE_URL = 'https://api.acleddata.com/acled/read';

export function buildUrl(params: Record<string, string>): string {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export function isACLEDEvent(obj: unknown): obj is ACLEDEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'event_id_cnty' in obj &&
    'actor1' in obj &&
    'actor2' in obj
  );
}

export async function testConnection(
  creds: Credentials,
): Promise<{ ok: boolean; message: string }> {
  try {
    const url = buildUrl({
      key: creds.apiKey,
      email: creds.email,
      limit: '1',
      page: '1',
    });
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    if (data.status === 200 || data.success === true) {
      return { ok: true, message: 'Connection successful' };
    }
    return {
      ok: false,
      message: data.error || data.message || 'Authentication failed',
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Network error',
    };
  }
}

export async function fetchEvents(
  creds: Credentials,
  filter: FilterState,
  onProgress: (loaded: number, total: number) => void,
): Promise<ACLEDEvent[]> {
  const baseParams: Record<string, string> = {
    key: creds.apiKey,
    email: creds.email,
    limit: '500',
  };

  if (filter.countries.length > 0) {
    baseParams.country = filter.countries.join('|');
    baseParams.country_where = 'OR';
  }

  if (filter.startDate && filter.endDate) {
    baseParams.event_date = `${filter.startDate}|${filter.endDate}`;
    baseParams.event_date_where = 'BETWEEN';
  }

  if (filter.eventTypes.length > 0) {
    baseParams.event_type = filter.eventTypes.join('|');
    baseParams.event_type_where = 'OR';
  }

  // Fetch page 1
  const page1Url = buildUrl({ ...baseParams, page: '1' });
  const page1Res = await fetch(page1Url);
  if (!page1Res.ok) throw new Error(`HTTP error ${page1Res.status}`);
  const page1Data = await page1Res.json();

  if (page1Data.status !== 200 && page1Data.success !== true) {
    throw new Error(
      page1Data.error || page1Data.message || 'API error — check your filters',
    );
  }

  const total: number = page1Data.count ?? page1Data.data?.length ?? 0;
  const events: ACLEDEvent[] = Array.isArray(page1Data.data)
    ? [...page1Data.data]
    : [];
  onProgress(events.length, total);

  if (total <= 500) return events;

  const totalPages = Math.ceil(total / 500);
  for (let page = 2; page <= totalPages; page++) {
    const url = buildUrl({ ...baseParams, page: String(page) });
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data.data)) break;
    events.push(...data.data);
    onProgress(events.length, total);
    if (!data.hasmore) break;
  }

  return events;
}
