import { useState, useMemo } from 'react';
import type { FilterState, ACLEDEvent } from '../types';
import { EVENT_TYPES } from '../utils/graphData';

function getPresetDates(preset: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (preset === '30d') start.setDate(end.getDate() - 30);
  else if (preset === '90d') start.setDate(end.getDate() - 90);
  else if (preset === '1yr') start.setFullYear(end.getFullYear() - 1);
  else if (preset === '3yr') start.setFullYear(end.getFullYear() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

interface Props {
  allEvents: ACLEDEvent[];
  onLoad: (events: ACLEDEvent[], filter: FilterState) => void;
  onBack: () => void;
}

export default function FilterPage({ allEvents, onLoad, onBack }: Props) {
  // Derive available countries from the loaded data
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEvents) if (e.country) set.add(e.country);
    return Array.from(set).sort();
  }, [allEvents]);

  // Default date range = full span of the loaded dataset
  const datasetDates = useMemo(() => {
    const dates = allEvents.map((e) => e.event_date).filter(Boolean).sort();
    return dates.length > 0
      ? { start: dates[0], end: dates[dates.length - 1] }
      : getPresetDates('1yr');
  }, [allEvents]);

  const [countries, setCountries] = useState<string[]>([...availableCountries]);
  const [countrySearch, setCountrySearch] = useState('');
  const [startDate, setStartDate] = useState(() => datasetDates.start);
  const [endDate, setEndDate] = useState(() => datasetDates.end);
  const [eventTypes, setEventTypes] = useState<string[]>([...EVENT_TYPES]);
  const [minInteractions, setMinInteractions] = useState(2);
  const [maxActors, setMaxActors] = useState(100);
  const [error, setError] = useState('');

  const filteredCountries = useMemo(
    () => availableCountries.filter((c) => c.toLowerCase().includes(countrySearch.toLowerCase())),
    [availableCountries, countrySearch],
  );

  // Live preview count
  const previewCount = useMemo(() => {
    return allEvents.filter((e) => {
      if (countries.length > 0 && !countries.includes(e.country)) return false;
      if (startDate && e.event_date < startDate) return false;
      if (endDate && e.event_date > endDate) return false;
      if (eventTypes.length > 0 && !eventTypes.includes(e.event_type)) return false;
      return true;
    }).length;
  }, [allEvents, countries, startDate, endDate, eventTypes]);

  const toggleCountry = (c: string) =>
    setCountries((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const toggleEventType = (t: string) =>
    setEventTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const applyPreset = (preset: string) => {
    const { start, end } = getPresetDates(preset);
    setStartDate(start);
    setEndDate(end);
  };

  const handleApply = () => {
    if (countries.length === 0) {
      setError('Select at least one country.');
      return;
    }
    if (eventTypes.length === 0) {
      setError('Select at least one event type.');
      return;
    }
    setError('');

    const filtered = allEvents.filter((e) => {
      if (!countries.includes(e.country)) return false;
      if (startDate && e.event_date < startDate) return false;
      if (endDate && e.event_date > endDate) return false;
      if (!eventTypes.includes(e.event_type)) return false;
      return true;
    });

    if (filtered.length === 0) {
      setError('No events match your filters. Try widening the date range or event types.');
      return;
    }

    const filter: FilterState = { countries, startDate, endDate, eventTypes, minInteractions, maxActors };
    onLoad(filtered, filter);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center gap-4">
        <button onClick={onBack} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Upload new file
        </button>
        <h1 className="text-lg font-semibold">
          <span className="text-blue-400">Vigil</span>
          <span className="text-gray-500 mx-2">/</span>
          Filter
        </h1>
        <span className="ml-auto text-xs text-gray-500">
          {allEvents.length.toLocaleString()} events loaded
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Country selector */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="font-semibold text-white mb-3">
              Countries
              {countries.length > 0 && countries.length < availableCountries.length && (
                <span className="ml-2 text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                  {countries.length}/{availableCountries.length}
                </span>
              )}
            </h2>
            <input
              type="text"
              placeholder="Search…"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <div className="flex gap-2 mb-2">
              <button onClick={() => setCountries([...availableCountries])} className="text-xs text-blue-400 hover:text-blue-300">
                All
              </button>
              <span className="text-gray-600">·</span>
              <button onClick={() => setCountries([])} className="text-xs text-gray-400 hover:text-gray-300">
                Clear
              </button>
            </div>
            <div className="h-56 overflow-y-auto space-y-0.5">
              {filteredCountries.map((c) => (
                <label key={c} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={countries.includes(c)}
                    onChange={() => toggleCountry(c)}
                    className="accent-blue-500"
                  />
                  <span className={countries.includes(c) ? 'text-white' : 'text-gray-400'}>{c}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date + Event types */}
          <div className="space-y-5">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="font-semibold text-white mb-3">Date Range</h2>
              <div className="flex gap-2 mb-3">
                {(['30d', '90d', '1yr', '3yr'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded px-2 py-1 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="font-semibold text-white mb-3">Event Types</h2>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setEventTypes([...EVENT_TYPES])} className="text-xs text-blue-400 hover:text-blue-300">All</button>
                <span className="text-gray-600">·</span>
                <button onClick={() => setEventTypes([])} className="text-xs text-gray-400 hover:text-gray-300">None</button>
              </div>
              <div className="space-y-1.5">
                {EVENT_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={eventTypes.includes(t)}
                      onChange={() => toggleEventType(t)}
                      className="accent-blue-500"
                    />
                    <span className={eventTypes.includes(t) ? 'text-white' : 'text-gray-500'}>{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Sliders */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 md:col-span-2">
            <h2 className="font-semibold text-white mb-4">Graph Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Min interactions per pair: <span className="text-white font-medium">{minInteractions}</span>
                </label>
                <input
                  type="range" min={1} max={20} value={minInteractions}
                  onChange={(e) => setMinInteractions(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 (all)</span><span>20 (frequent only)</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Max actors: <span className="text-white font-medium">{maxActors}</span>
                </label>
                <input
                  type="range" min={10} max={200} step={10} value={maxActors}
                  onChange={(e) => setMaxActors(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10</span><span>200</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Apply button */}
        <div className="mt-6 space-y-3">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
              ✗ {error}
            </div>
          )}
          <button
            onClick={handleApply}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
          >
            Build Graph →
            {previewCount > 0 && (
              <span className="ml-2 text-blue-200 font-normal">
                ({previewCount.toLocaleString()} events)
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
