import { useMemo } from 'react';
import * as d3 from 'd3';
import type { Actor, ACLEDEvent } from '../types';
import {
  EVENT_TYPE_COLORS,
  INTER_COLORS,
  INTER_LABELS,
  groupByMonth,
} from '../utils/graphData';

interface Props {
  actor: Actor;
  allEvents: ACLEDEvent[];
  onClose: () => void;
  onShowMap: () => void;
}

function SparkLine({ events }: { events: ACLEDEvent[] }) {
  const data = groupByMonth(events);
  if (data.length < 2) return null;
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const W = 120;
  const H = 36;
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - (d.count / maxCount) * (H - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={W} height={H} className="mt-1">
      <polyline
        points={pts}
        fill="none"
        stroke="#60A5FA"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DonutChart({ events }: { events: ACLEDEvent[] }) {
  const slices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const t = e.event_type || 'Strategic developments';
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    const data = [...counts.entries()].map(([type, count]) => ({ type, count }));
    const pie = d3.pie<{ type: string; count: number }>().value((d) => d.count)(data);
    const arc = d3.arc<d3.PieArcDatum<{ type: string; count: number }>>()
      .innerRadius(22)
      .outerRadius(38);
    return pie.map((p) => ({
      path: arc(p) || '',
      color: EVENT_TYPE_COLORS[p.data.type] || '#6B7280',
      type: p.data.type,
      count: p.data.count,
    }));
  }, [events]);

  return (
    <svg width={80} height={80} viewBox="-40 -40 80 80">
      {slices.map((s, i) => (
        <path key={i} d={s.path} fill={s.color} stroke="#1f2937" strokeWidth={0.5} />
      ))}
    </svg>
  );
}

export default function ActorDetailPanel({
  actor,
  allEvents,
  onClose,
  onShowMap,
}: Props) {
  const actorEvents = useMemo(
    () =>
      allEvents.filter(
        (e) => e.actor1 === actor.name || e.actor2 === actor.name,
      ),
    [actor, allEvents],
  );

  const adversaries = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of actorEvents) {
      const other = e.actor1 === actor.name ? e.actor2 : e.actor1;
      if (other) map.set(other, (map.get(other) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [actor, actorEvents]);

  const recentEvents = useMemo(
    () =>
      [...actorEvents]
        .sort((a, b) => b.event_date.localeCompare(a.event_date))
        .slice(0, 5),
    [actorEvents],
  );

  const color = INTER_COLORS[actor.interCode] || '#6B7280';
  const label = INTER_LABELS[actor.interCode] || 'Unknown';

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of actorEvents) {
      const t = e.event_type || 'Strategic developments';
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [actorEvents]);

  return (
    <div className="w-80 flex-shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-700 flex items-start justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: color + '30', color }}
            >
              {label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white break-words leading-tight">
            {actor.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Event count + sparkline */}
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-0.5">Total events</div>
          <div className="text-2xl font-bold text-white">
            {actor.eventCount.toLocaleString()}
          </div>
          <SparkLine events={actorEvents} />
        </div>

        {/* Donut chart + type breakdown */}
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Event types</div>
          <div className="flex items-center gap-4">
            <DonutChart events={actorEvents} />
            <div className="space-y-1 min-w-0">
              {typeCounts.map(([type, count]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: EVENT_TYPE_COLORS[type] || '#6B7280',
                    }}
                  />
                  <span className="text-gray-300 truncate">{type}</span>
                  <span className="text-gray-500 ml-auto flex-shrink-0">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top adversaries */}
        {adversaries.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Top adversaries</div>
            <div className="space-y-1.5">
              {adversaries.map(({ name, count }) => (
                <div key={name} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-300 truncate">{name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0 bg-gray-700 rounded px-1.5 py-0.5">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent events */}
        <div className="px-4 py-3 border-b border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Recent events</div>
          <div className="space-y-2">
            {recentEvents.map((e) => (
              <div
                key={e.event_id_cnty}
                className="bg-gray-700/50 rounded-lg px-2.5 py-2"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-400">{e.event_date}</span>
                  {Number(e.fatalities) > 0 && (
                    <span className="text-xs text-red-400">
                      {e.fatalities} ☠
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-200 font-medium">{e.event_type}</div>
                <div className="text-xs text-gray-400 truncate">
                  {[e.admin1, e.country].filter(Boolean).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Show on map */}
        <div className="px-4 py-3">
          <button
            onClick={onShowMap}
            className="w-full text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg px-3 py-2 transition-colors text-center"
          >
            🗺 Show on map
          </button>
        </div>
      </div>
    </div>
  );
}
