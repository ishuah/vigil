import type { ACLEDEvent, Actor, GraphEdge, GraphData } from '../types';

export const EVENT_TYPES = [
  'Battles',
  'Explosions/Remote violence',
  'Violence against civilians',
  'Protests',
  'Riots',
  'Strategic developments',
] as const;

export const EVENT_TYPE_COLORS: Record<string, string> = {
  Battles: '#EF4444',
  'Explosions/Remote violence': '#F97316',
  'Violence against civilians': '#991B1B',
  Protests: '#EAB308',
  Riots: '#EAB308',
  'Strategic developments': '#6B7280',
};

export const INTER_COLORS: Record<number, string> = {
  1: '#3B82F6',  // State Forces - Blue
  2: '#EF4444',  // Rebel Groups - Red
  3: '#F97316',  // Political Militias - Orange
  4: '#A855F7',  // Identity Militias - Purple
  5: '#EAB308',  // Rioters - Yellow
  6: '#22C55E',  // Protesters - Green
  7: '#6B7280',  // Civilians - Gray
  8: '#14B8A6',  // External/Other Forces - Teal
};

export const INTER_LABELS: Record<number, string> = {
  1: 'State Forces',
  2: 'Rebel Group',
  3: 'Political Militia',
  4: 'Identity Militia',
  5: 'Rioters',
  6: 'Protesters',
  7: 'Civilians',
  8: 'External Forces',
};

export function buildGraphData(
  events: ACLEDEvent[],
  minInteractions: number,
  maxActors: number,
): GraphData {
  const actorMap = new Map<string, Actor>();

  const getOrCreate = (name: string, inter: number): Actor => {
    const key = name || 'Unknown';
    if (!actorMap.has(key)) {
      actorMap.set(key, {
        id: key,
        name: key,
        interCode: Math.max(1, Math.min(8, inter || 7)),
        eventCount: 0,
        events: [],
      });
    }
    return actorMap.get(key)!;
  };

  const edgeMap = new Map<
    string,
    { events: ACLEDEvent[]; a1: string; a2: string }
  >();

  for (const event of events) {
    const a1 = event.actor1?.trim();
    const a2 = event.actor2?.trim();
    if (!a1) continue;

    const inter1 =
      typeof event.inter1 === 'number'
        ? event.inter1
        : parseInt(String(event.inter1)) || 7;
    const inter2 =
      typeof event.inter2 === 'number'
        ? event.inter2
        : parseInt(String(event.inter2)) || 7;

    const actor1 = getOrCreate(a1, inter1);
    actor1.eventCount++;
    actor1.events.push(event);

    if (a2) {
      const actor2 = getOrCreate(a2, inter2);
      actor2.eventCount++;
      actor2.events.push(event);

      const [ka, kb] = a1 < a2 ? [a1, a2] : [a2, a1];
      const key = `${ka}|||${kb}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { events: [], a1: ka, a2: kb });
      }
      edgeMap.get(key)!.events.push(event);
    }
  }

  // Top N actors by event count
  const sortedActors = [...actorMap.values()]
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, maxActors);

  const actorSet = new Set(sortedActors.map((a) => a.id));

  const edges: GraphEdge[] = [];
  for (const [, { events: evs, a1, a2 }] of edgeMap) {
    if (evs.length < minInteractions) continue;
    if (!actorSet.has(a1) || !actorSet.has(a2)) continue;

    const typeCounts = new Map<string, number>();
    for (const e of evs) {
      const t = e.event_type || 'Strategic developments';
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    }
    const dominantEventType =
      [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'Strategic developments';

    edges.push({
      source: a1,
      target: a2,
      events: evs,
      weight: evs.length,
      dominantEventType,
    });
  }

  return { actors: sortedActors, edges };
}

export function groupByMonth(events: ACLEDEvent[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const m = e.event_date?.slice(0, 7) || 'unknown';
    map.set(m, (map.get(m) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, count]) => ({ month, count }));
}
