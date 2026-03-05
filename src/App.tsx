import { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
import type { FilterState, ACLEDEvent, Actor } from './types';
import UploadPage from './components/UploadPage';
import FilterPage from './components/FilterPage';
import ActorGraph from './components/ActorGraph';
import ActorDetailPanel from './components/ActorDetailPanel';
import MiniMap from './components/MiniMap';

type Step = 'upload' | 'filter' | 'graph';

const DEFAULT_FILTER: FilterState = {
  countries: [],
  startDate: '',
  endDate: '',
  eventTypes: [],
  minInteractions: 2,
  maxActors: 100,
};

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [allEvents, setAllEvents] = useState<ACLEDEvent[]>([]);
  const [events, setEvents] = useState<ACLEDEvent[]>([]);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const handleUpload = useCallback((uploaded: ACLEDEvent[]) => {
    setAllEvents(uploaded);
    setStep('filter');
  }, []);

  const handleLoad = useCallback((loadedEvents: ACLEDEvent[], loadedFilter: FilterState) => {
    setEvents(loadedEvents);
    setFilter(loadedFilter);
    setSelectedActor(null);
    setStep('graph');
  }, []);

  const handleBackToFilter = useCallback(() => {
    setStep('filter');
    setSelectedActor(null);
  }, []);

  const handleExportPNG = useCallback(async () => {
    const el = graphContainerRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#111827',
        useCORS: true,
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `vigil-graph-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Export failed', e);
    }
  }, []);

  const miniMapEvents = selectedActor
    ? events.filter((e) => e.actor1 === selectedActor.name || e.actor2 === selectedActor.name)
    : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {step === 'upload' && <UploadPage onUpload={handleUpload} />}

      {step === 'filter' && (
        <FilterPage
          allEvents={allEvents}
          onLoad={handleLoad}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'graph' && (
        <div className="flex flex-col h-screen">
          {/* Top bar */}
          <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-bold">
                <span className="text-blue-400">Vigil</span>
              </h1>
              <span className="text-gray-600 text-sm">·</span>
              <span className="text-gray-400 text-sm">
                {events.length.toLocaleString()} events
                {filter.countries.length > 0 && filter.countries.length <= 3
                  ? ` · ${filter.countries.join(', ')}`
                  : filter.countries.length > 3
                  ? ` · ${filter.countries.length} countries`
                  : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBackToFilter}
                className="text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 transition-colors"
              >
                ← Refilter
              </button>
              <button
                onClick={() => setStep('upload')}
                className="text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-1.5 transition-colors"
              >
                ↑ New file
              </button>
              <button
                onClick={handleExportPNG}
                className="text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-1.5 transition-colors"
              >
                ↓ Export PNG
              </button>
            </div>
          </div>

          {/* Main area */}
          <div className="flex flex-1 overflow-hidden">
            <div ref={graphContainerRef} className="flex-1 relative overflow-hidden">
              <ActorGraph
                events={events}
                filter={filter}
                onSelectActor={setSelectedActor}
                selectedActor={selectedActor}
              />
            </div>

            {selectedActor && (
              <ActorDetailPanel
                actor={selectedActor}
                allEvents={events}
                onClose={() => setSelectedActor(null)}
                onShowMap={() => setShowMiniMap(true)}
              />
            )}
          </div>
        </div>
      )}

      {showMiniMap && selectedActor && (
        <MiniMap
          events={miniMapEvents}
          title={selectedActor.name}
          onClose={() => setShowMiniMap(false)}
        />
      )}
    </div>
  );
}
