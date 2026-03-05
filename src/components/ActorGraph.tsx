import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { ACLEDEvent, Actor, FilterState } from '../types';
import worldData from '../data/world-110m.json';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import {
  buildGraphData,
  EVENT_TYPE_COLORS,
  INTER_COLORS,
  INTER_LABELS,
} from '../utils/graphData';

type SimActor = Actor &
  SimulationNodeDatum & {
    geoX?: number;
    geoY?: number;
  };

type SimEdge = SimulationLinkDatum<SimActor> & {
  events: ACLEDEvent[];
  weight: number;
  dominantEventType: string;
};

interface Props {
  events: ACLEDEvent[];
  filter: FilterState;
  onSelectActor: (actor: Actor | null) => void;
  selectedActor: Actor | null;
}

const NODE_RADIUS = (d: SimActor) => Math.max(5, Math.sqrt(d.eventCount) * 1.8);

// Compute mean lat/lon centroid for an actor from their events
function computeCentroid(actor: Actor): [number, number] | null {
  const coords: [number, number][] = actor.events
    .map((e) => [parseFloat(e.longitude), parseFloat(e.latitude)] as [number, number])
    .filter(([lng, lat]) => !isNaN(lng) && !isNaN(lat) && lat !== 0 && lng !== 0);
  if (coords.length === 0) return null;
  const lng = coords.reduce((s, [x]) => s + x, 0) / coords.length;
  const lat = coords.reduce((s, [, y]) => s + y, 0) / coords.length;
  return [lng, lat];
}

export default function ActorGraph({ events, filter, onSelectActor, selectedActor }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<SimActor, SimEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const showLabelsRef = useRef(true);

  const [showLabels, setShowLabels] = useState(true);
  const [paused, setPaused] = useState(false);
  const [geoMode, setGeoMode] = useState(true);

  const graphData = useMemo(
    () => buildGraphData(events, filter.minInteractions, filter.maxActors),
    [events, filter.minInteractions, filter.maxActors],
  );

  const toggleLabels = useCallback(() => {
    if (!svgRef.current) return;
    const v = !showLabelsRef.current;
    showLabelsRef.current = v;
    setShowLabels(v);
    d3.select(svgRef.current).select('.labels').attr('display', v ? null : 'none');
  }, []);

  const togglePause = useCallback(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    if (paused) { sim.alphaTarget(0.05).restart(); setPaused(false); }
    else { sim.stop(); setPaused(true); }
  }, [paused]);

  const zoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const zoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy, 0.7);
  }, []);

  const resetView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().call(zoomRef.current.transform, d3.zoomIdentity);
    const sim = simulationRef.current;
    if (sim) { sim.alpha(0.5).alphaTarget(0).restart(); setPaused(false); }
  }, []);

  // Main render effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const { actors, edges } = graphData;
    if (actors.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const simActors: SimActor[] = actors.map((a) => ({ ...a }));
    const simEdges: SimEdge[] = edges.map((e) => ({
      source: typeof e.source === 'string' ? e.source : (e.source as Actor).id,
      target: typeof e.target === 'string' ? e.target : (e.target as Actor).id,
      events: e.events,
      weight: e.weight,
      dominantEventType: e.dominantEventType,
    }));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 30])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    // Tooltip
    const tip = d3.select(container)
      .append('div')
      .attr('class', 'vigil-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(17,24,39,0.95)')
      .style('border', '1px solid #374151')
      .style('color', '#f9fafb')
      .style('padding', '8px 10px')
      .style('border-radius', '6px')
      .style('pointer-events', 'none')
      .style('font-size', '12px')
      .style('white-space', 'pre')
      .style('z-index', '100')
      .style('display', 'none')
      .style('max-width', '280px')
      .style('line-height', '1.6');

    // ── Graph builder ───────────────────────────────────────────────────────
    const buildGraph = (projection: d3.GeoProjection | null) => {
      // Assign geo positions if we have a projection
      if (projection) {
        for (const actor of simActors) {
          const centroid = computeCentroid(actor);
          if (centroid) {
            const projected = projection(centroid);
            if (projected) {
              actor.geoX = projected[0];
              actor.geoY = projected[1];
              actor.x = projected[0];
              actor.y = projected[1];
            }
          }
        }
      }

      // ── Edges ────────────────────────────────────────────────────────────
      const link = g.append('g').attr('class', 'links')
        .selectAll<SVGLineElement, SimEdge>('line')
        .data(simEdges).join('line')
        .attr('stroke', (d) => EVENT_TYPE_COLORS[d.dominantEventType] || '#6B7280')
        .attr('stroke-opacity', 0.5)
        .attr('stroke-width', (d) => Math.max(0.8, Math.sqrt(d.weight) * 0.7))
        .attr('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          const src = d.source as SimActor;
          const tgt = d.target as SimActor;
          const fat = d.events.reduce((s, e) => s + (Number(e.fatalities) || 0), 0);
          const dates = d.events.map((e) => e.event_date).sort();
          tip.style('display', 'block')
            .style('left', event.offsetX + 12 + 'px')
            .style('top', event.offsetY - 10 + 'px')
            .text(`${src.name}\n↔ ${tgt.name}\n${d.weight} events · ${fat} fatalities\n${dates[0]} → ${dates[dates.length - 1]}`);
        })
        .on('mouseout', () => tip.style('display', 'none'));

      // ── Nodes ────────────────────────────────────────────────────────────
      const node = g.append('g').attr('class', 'nodes')
        .selectAll<SVGCircleElement, SimActor>('circle')
        .data(simActors).join('circle')
        .attr('r', NODE_RADIUS)
        .attr('fill', (d) => INTER_COLORS[d.interCode] || '#6B7280')
        .attr('stroke', '#1f2937')
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          d3.select(event.currentTarget as SVGCircleElement)
            .attr('stroke', '#ffffff').attr('stroke-width', 2.5);
          tip.style('display', 'block')
            .style('left', event.offsetX + 12 + 'px')
            .style('top', event.offsetY - 10 + 'px')
            .text(`${d.name}\n${INTER_LABELS[d.interCode] || 'Unknown'}\n${d.eventCount} events`);
        })
        .on('mouseout', (event, d) => {
          d3.select(event.currentTarget as SVGCircleElement)
            .attr('stroke', selectedActor?.id === d.id ? '#60A5FA' : '#1f2937')
            .attr('stroke-width', selectedActor?.id === d.id ? 3 : 1.5);
          tip.style('display', 'none');
        })
        .on('click', (_event, d) => {
          onSelectActor(d);
          node.attr('stroke', (n) => n.id === d.id ? '#60A5FA' : '#1f2937')
            .attr('stroke-width', (n) => n.id === d.id ? 3 : 1.5);
        });

      // Drag
      node.call(
        d3.drag<SVGCircleElement, SimActor>()
          .on('start', (event, d) => {
            if (!event.active && simulationRef.current) {
              simulationRef.current.alphaTarget(0.3).restart();
              setPaused(false);
            }
            d.fx = d.x; d.fy = d.y;
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end', (event, d) => {
            if (!event.active && simulationRef.current)
              simulationRef.current.alphaTarget(0);
            d.fx = null; d.fy = null;
          }),
      );

      // Labels (top 10)
      const top10 = [...simActors].sort((a, b) => b.eventCount - a.eventCount).slice(0, 10);
      const allLabels = g.append('g').attr('class', 'labels')
        .attr('display', showLabelsRef.current ? null : 'none');
      allLabels.selectAll<SVGTextElement, SimActor>('text')
        .data(top10).join('text')
        .text((d) => d.name.length > 22 ? d.name.slice(0, 19) + '…' : d.name)
        .attr('font-size', 10)
        .attr('fill', '#e5e7eb')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .attr('dy', (d) => -(NODE_RADIUS(d) + 4));

      // ── Simulation ───────────────────────────────────────────────────────
      const linkForce = d3.forceLink<SimActor, SimEdge>(simEdges)
        .id((d) => d.id)
        .distance(projection ? 25 : 100)
        .strength(projection ? 0.15 : 0.5);

      const sim = projection
        ? d3.forceSimulation<SimActor, SimEdge>(simActors)
            .force('link', linkForce)
            .force('charge', d3.forceManyBody<SimActor>().strength(-10))
            .force('x', d3.forceX<SimActor>((d) => d.geoX ?? width / 2).strength(0.95))
            .force('y', d3.forceY<SimActor>((d) => d.geoY ?? height / 2).strength(0.95))
            .force('collide', d3.forceCollide<SimActor>((d) => NODE_RADIUS(d) + 4))
        : d3.forceSimulation<SimActor, SimEdge>(simActors)
            .force('link', linkForce)
            .force('charge', d3.forceManyBody<SimActor>().strength(-250))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide<SimActor>((d) => NODE_RADIUS(d) + 4));

      simulationRef.current = sim;

      sim.on('tick', () => {
        link
          .attr('x1', (d) => (d.source as SimActor).x ?? 0)
          .attr('y1', (d) => (d.source as SimActor).y ?? 0)
          .attr('x2', (d) => (d.target as SimActor).x ?? 0)
          .attr('y2', (d) => (d.target as SimActor).y ?? 0);
        node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
        allLabels.selectAll<SVGTextElement, SimActor>('text')
          .attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);
      });

      sim.on('end', () => setPaused(true));
    };

    // ── Render with or without geo base map ─────────────────────────────────
    if (geoMode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const world = worldData as any;
      const countries = topojson.feature(world, world.objects.countries) as unknown as GeoJSON.FeatureCollection;

      // Collect all valid event coordinates
      const allCoords: [number, number][] = events
        .map((e) => [parseFloat(e.longitude), parseFloat(e.latitude)] as [number, number])
        .filter(([lng, lat]) => !isNaN(lng) && !isNaN(lat) && lat !== 0 && lng !== 0);

      let projection: d3.GeoProjection;

      if (allCoords.length >= 2) {
        // Use MultiPoint — D3's fitExtent handles this correctly and reliably
        const multiPoint: GeoJSON.Feature<GeoJSON.MultiPoint> = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'MultiPoint', coordinates: allCoords },
        };
        projection = d3.geoMercator()
          .fitExtent([[60, 60], [width - 60, height - 60]], multiPoint);
      } else {
        projection = d3.geoMercator().scale(130).translate([width / 2, height / 2]);
      }

      const path = d3.geoPath().projection(projection);

      // Ocean background
      g.append('rect')
        .attr('width', width).attr('height', height)
        .attr('fill', '#0d1b2a');

      // Country fills
      g.append('g').attr('class', 'countries')
        .selectAll('path')
        .data(countries.features)
        .join('path')
        .attr('d', (f) => path(f) ?? '')
        .attr('fill', '#1a2d40')
        .attr('stroke', '#2d4a5e')
        .attr('stroke-width', 0.5);

      // ── City labels ────────────────────────────────────────────────────────
      // Collect unique locations from events, deduplicated by name
      const locationMap = new Map<string, { lng: number; lat: number; count: number }>();
      for (const e of events) {
        const name = e.location?.trim();
        const lng = parseFloat(e.longitude);
        const lat = parseFloat(e.latitude);
        if (!name || isNaN(lng) || isNaN(lat) || lat === 0) continue;
        const existing = locationMap.get(name);
        if (existing) {
          existing.count++;
        } else {
          locationMap.set(name, { lng, lat, count: 1 });
        }
      }

      // Show top 40 most-active locations
      const topLocations = [...locationMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 40);

      const cityLayer = g.append('g').attr('class', 'city-labels');

      topLocations.forEach(([name, { lng, lat }]) => {
        const projected = projection([lng, lat]);
        if (!projected) return;
        const [cx, cy] = projected;

        // Small dot
        cityLayer.append('circle')
          .attr('cx', cx).attr('cy', cy)
          .attr('r', 1.5)
          .attr('fill', '#4a6a7a')
          .attr('pointer-events', 'none');

        // Label
        cityLayer.append('text')
          .attr('x', cx).attr('y', cy - 4)
          .attr('font-size', 8)
          .attr('fill', '#5a8090')
          .attr('text-anchor', 'middle')
          .attr('pointer-events', 'none')
          .text(name);
      });

      buildGraph(projection);
    } else {
      buildGraph(null);
    }

    return () => {
      simulationRef.current?.stop();
      tip.remove();
    };
  }, [graphData, geoMode, onSelectActor, selectedActor]);

  // Sync selected actor highlight
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .select('.nodes')
      .selectAll<SVGCircleElement, SimActor>('circle')
      .attr('stroke', (d) => selectedActor?.id === d.id ? '#60A5FA' : '#1f2937')
      .attr('stroke-width', (d) => selectedActor?.id === d.id ? 3 : 1.5);
  }, [selectedActor]);

  const { actors, edges } = graphData;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden" style={{ background: geoMode ? '#0d1b2a' : '#111827' }}>
      <svg ref={svgRef} className="w-full h-full" />

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-gray-800/90 backdrop-blur border border-gray-700 rounded-xl p-3 space-y-2 shadow-xl">
        <div className="text-xs text-gray-400 font-medium mb-1 px-1">Controls</div>

        {/* View toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-600 text-xs">
          <button
            onClick={() => setGeoMode(true)}
            className={`flex-1 px-2 py-1.5 transition-colors ${geoMode ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            🗺 Map
          </button>
          <button
            onClick={() => setGeoMode(false)}
            className={`flex-1 px-2 py-1.5 transition-colors ${!geoMode ? 'bg-blue-700 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            🔗 Network
          </button>
        </div>

        <button onClick={zoomIn} className="w-full text-left text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition-colors">+ Zoom In</button>
        <button onClick={zoomOut} className="w-full text-left text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition-colors">− Zoom Out</button>
        <button onClick={resetView} className="w-full text-left text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200 transition-colors">↺ Reset</button>
        <button
          onClick={toggleLabels}
          className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${showLabels ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
        >
          ⊙ Labels
        </button>
        <button
          onClick={togglePause}
          className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${paused ? 'bg-yellow-700 hover:bg-yellow-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400">
        {actors.length} actors · {edges.length} edges
        {geoMode && <span className="ml-2 text-blue-400">· geo</span>}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-900/80 backdrop-blur border border-gray-700 rounded-lg px-3 py-2">
        <div className="text-xs text-gray-400 font-medium mb-1.5">Actor types</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {Object.entries(INTER_LABELS).map(([code, label]) => (
            <div key={code} className="flex items-center gap-1.5 text-xs text-gray-300">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: INTER_COLORS[Number(code)] }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
