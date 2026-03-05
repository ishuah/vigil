import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { ACLEDEvent } from '../types';

interface Props {
  events: ACLEDEvent[];
  title: string;
  onClose: () => void;
}

type WorldTopoJSON = {
  type: string;
  objects: {
    countries: object;
    land: object;
    [key: string]: object;
  };
  arcs: number[][][];
  transform?: object;
};

type GeoFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoFeature[];
};

type GeoFeature = {
  type: 'Feature';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry: any;
  properties: Record<string, unknown>;
};

export default function MiniMap({ events, title, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!svgRef.current) return;

    const W = 560;
    const H = 300;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const projection = d3
      .geoNaturalEarth1()
      .scale(90)
      .translate([W / 2, H / 2]);

    const path = d3.geoPath().projection(projection);

    const g = svg.append('g');

    // Load world topojson from CDN
    d3
      .json<WorldTopoJSON>(
        'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
      )
      .then((world) => {
        if (!world) return;

        // Inline topojson conversion (avoids topojson-client dependency)
        const topoFeatures = topoToGeoJSON(world);

        // Draw land
        g.append('g')
          .selectAll('path')
          .data(topoFeatures.features)
          .join('path')
          .attr('d', path as unknown as string)
          .attr('fill', '#374151')
          .attr('stroke', '#1f2937')
          .attr('stroke-width', 0.4);

        // Globe outline
        g.append('path')
          .datum({ type: 'Sphere' } as d3.GeoPermissibleObjects)
          .attr('d', path)
          .attr('fill', 'none')
          .attr('stroke', '#4B5563')
          .attr('stroke-width', 0.6);

        drawDots();
      })
      .catch(() => {
        setLoadError('Could not load world map (check network)');
        drawDots();
      });

    function drawDots() {
      const validEvents = events.filter(
        (e) => e.latitude && e.longitude && !isNaN(Number(e.latitude)),
      );

      const maxFatalities = Math.max(
        1,
        ...validEvents.map((e) => Number(e.fatalities) || 0),
      );

      const rScale = d3
        .scaleSqrt()
        .domain([0, maxFatalities])
        .range([2, 10]);

      g.append('g')
        .selectAll('circle')
        .data(validEvents)
        .join('circle')
        .attr('cx', (d) => {
          const p = projection([Number(d.longitude), Number(d.latitude)]);
          return p ? p[0] : -999;
        })
        .attr('cy', (d) => {
          const p = projection([Number(d.longitude), Number(d.latitude)]);
          return p ? p[1] : -999;
        })
        .attr('r', (d) => rScale(Number(d.fatalities) || 0))
        .attr('fill', '#EF4444')
        .attr('fill-opacity', 0.5)
        .attr('stroke', '#FCA5A5')
        .attr('stroke-width', 0.4);
    }
  }, [events]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden w-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {events.length} events · dots sized by fatalities
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        {loadError && (
          <div className="px-4 py-2 text-xs text-yellow-400 bg-yellow-900/20 border-b border-yellow-900/30">
            ⚠ {loadError}
          </div>
        )}

        <svg
          ref={svgRef}
          width={560}
          height={300}
          className="bg-gray-900 block"
        />
      </div>
    </div>
  );
}

/**
 * Minimal inline topojson→geojson converter (handles polygons only)
 * Avoids the topojson-client npm dependency.
 */
function topoToGeoJSON(topology: WorldTopoJSON): GeoFeatureCollection {
  try {
    // Use topojson-client-style conversion
    const obj = topology.objects.countries as {
      type: string;
      geometries: Array<{
        type: string;
        id?: string | number;
        arcs: number[][][] | number[][];
      }>;
    };

    const features: GeoFeature[] = obj.geometries.map((geom) => {
      const coords = decodeArcs(
        topology,
        geom.type,
        geom.arcs as number[][][],
      );
      return {
        type: 'Feature' as const,
        geometry: { type: geom.type, coordinates: coords },
        properties: {},
      };
    });
    return { type: 'FeatureCollection', features };
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

function decodeArcs(
  topology: WorldTopoJSON,
  type: string,
  arcs: number[][][] | number[][] | number[],
): number[][][] | number[][][][] {
  const transform = (topology as { transform?: { scale: [number, number]; translate: [number, number] } }).transform;
  const scale = transform?.scale ?? [1, 1];
  const translate = transform?.translate ?? [0, 0];

  function decodeArc(arcIdx: number): number[][] {
    const isNegated = arcIdx < 0;
    const idx = isNegated ? ~arcIdx : arcIdx;
    const rawArc = topology.arcs[idx];
    let x = 0;
    let y = 0;
    const pts: number[][] = rawArc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
    return isNegated ? pts.reverse() : pts;
  }

  function decodeRing(ring: number[]): number[][] {
    return ring.flatMap((idx) => decodeArc(idx));
  }

  if (type === 'Polygon') {
    return (arcs as number[][]).map(decodeRing);
  } else if (type === 'MultiPolygon') {
    return (arcs as number[][][]).map((poly) => poly.map(decodeRing));
  }
  return [];
}
