import { useState, useMemo } from 'react';
import type { FilterState, ACLEDEvent } from '../types';
import { fetchEvents } from '../api/acled';
import { EVENT_TYPES } from '../utils/graphData';

const ALL_COUNTRIES = [
  // Africa
  'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde',
  'Cameroon','Central African Republic','Chad','Comoros','Côte d\'Ivoire',
  'Democratic Republic of Congo','Djibouti','Egypt','Equatorial Guinea',
  'Eritrea','Eswatini','Ethiopia','Gabon','Gambia','Ghana','Guinea',
  'Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar','Malawi',
  'Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger',
  'Nigeria','Republic of Congo','Rwanda','São Tomé and Príncipe','Senegal',
  'Seychelles','Sierra Leone','Somalia','South Africa','South Sudan','Sudan',
  'Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe',
  // Middle East
  'Bahrain','Iran','Iraq','Israel','Jordan','Kuwait','Lebanon','Oman',
  'Palestine','Qatar','Saudi Arabia','Syria','United Arab Emirates','Yemen',
  // Asia
  'Afghanistan','Bangladesh','Bhutan','Cambodia','China','India','Indonesia',
  'Japan','Kazakhstan','Kyrgyzstan','Laos','Malaysia','Maldives','Mongolia',
  'Myanmar','Nepal','North Korea','Pakistan','Papua New Guinea','Philippines',
  'South Korea','Sri Lanka','Taiwan','Tajikistan','Thailand','Timor-Leste',
  'Turkmenistan','Uzbekistan','Vietnam',
  // Europe
  'Armenia','Azerbaijan','Belarus','Bosnia-Herzegovina','Georgia','Kosovo',
  'Moldova','Russia','Serbia','Turkey','Ukraine',
  // Americas
  'Bolivia','Brazil','Canada','Colombia','Ecuador','El Salvador','Guatemala',
  'Haiti','Honduras','Jamaica','Mexico','Nicaragua','Peru',
  'Trinidad and Tobago','United States of America','Venezuela',
  // Pacific
  'Australia','Fiji','Papua New Guinea','Solomon Islands',
].sort();

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

  onLoad: (events: ACLEDEvent[], filter: FilterState) => void;
  onBack: () => void;
}

export default function FilterPage({ onLoad, onBack }: Props) {
  const [countries, setCountries] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [startDate, setStartDate] = useState(() => getPresetDates('1yr').start);
  const [endDate, setEndDate] = useState(() => getPresetDates('1yr').end);
  const [eventTypes, setEventTypes] = useState<string[]>([...EVENT_TYPES]);
  const [minInteractions, setMinInteractions] = useState(2);
  const [maxActors, setMaxActors] = useState(100);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState('');
  const [resultSummary, setResultSummary] = useState('');

  const filteredCountries = useMemo(
    () =>
      ALL_COUNTRIES.filter((c) =>
        c.toLowerCase().includes(countrySearch.toLowerCase()),
      ),
    [countrySearch],
  );

  const toggleCountry = (c: string) => {
    setCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  const toggleEventType = (t: string) => {
    setEventTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const applyPreset = (preset: string) => {
    const { start, end } = getPresetDates(preset);
    setStartDate(start);
    setEndDate(end);
  };

  const handleLoad = async () => {
    if (countries.length === 0) {
      setError('Please select at least one country.');
      return;
    }
    setError('');
    setLoading(true);
    setProgress({ loaded: 0, total: 0 });
    setResultSummary('');
    try {
      const filter: FilterState = {
        countries,
        startDate,
        endDate,
        eventTypes,
        minInteractions,
        maxActors,
      };
      const events = await fetchEvents(filter, (loaded, total) => {
        setProgress({ loaded, total });
      });
      const actorSet = new Set<string>();
      for (const e of events) {
        if (e.actor1) actorSet.add(e.actor1);
        if (e.actor2) actorSet.add(e.actor2);
      }
      setResultSummary(
        `Loaded ${events.length.toLocaleString()} events across ${actorSet.size.toLocaleString()} actors`,
      );
      onLoad(events, filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
      setLoading(false);
    }
  };

  const progressPct =
    progress.total > 0
      ? Math.round((progress.loaded / progress.total) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">
          <span className="text-blue-400">Vigil</span>
          <span className="text-gray-500 mx-2">/</span>
          Filter Data
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Country selector */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h2 className="font-semibold text-white mb-3">
              Countries
              {countries.length > 0 && (
                <span className="ml-2 text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                  {countries.length}
                </span>
              )}
            </h2>
            <input
              type="text"
              placeholder="Search countries…"
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setCountries([...ALL_COUNTRIES])}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Select all
              </button>
              <span className="text-gray-600">·</span>
              <button
                onClick={() => setCountries([])}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Clear
              </button>
            </div>
            <div className="h-56 overflow-y-auto space-y-0.5">
              {filteredCountries.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-700 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={countries.includes(c)}
                    onChange={() => toggleCountry(c)}
                    className="accent-blue-500"
                  />
                  <span className={countries.includes(c) ? 'text-white' : 'text-gray-300'}>
                    {c}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date range + Event types */}
          <div className="space-y-5">
            {/* Date range */}
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

            {/* Event types */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h2 className="font-semibold text-white mb-3">Event Types</h2>
              <div className="space-y-1.5">
                {EVENT_TYPES.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={eventTypes.includes(t)}
                      onChange={() => toggleEventType(t)}
                      className="accent-blue-500"
                    />
                    <span className={eventTypes.includes(t) ? 'text-white' : 'text-gray-500'}>
                      {t}
                    </span>
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
                  Min interactions per pair:{' '}
                  <span className="text-white font-medium">{minInteractions}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={minInteractions}
                  onChange={(e) => setMinInteractions(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 (all)</span>
                  <span>20 (high-freq only)</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Max actors:{' '}
                  <span className="text-white font-medium">{maxActors}</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={10}
                  value={maxActors}
                  onChange={(e) => setMaxActors(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>10</span>
                  <span>200</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Load button + progress */}
        <div className="mt-6 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
              ✗ {error}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Fetching events…</span>
                <span>
                  {progress.loaded.toLocaleString()} / {progress.total.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {resultSummary && !loading && (
            <div className="bg-green-900/50 border border-green-700 text-green-300 rounded-lg px-4 py-3 text-sm">
              ✓ {resultSummary}
            </div>
          )}

          <button
            onClick={handleLoad}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 text-sm transition-colors"
          >
            {loading ? 'Loading data…' : 'Load Data →'}
          </button>
        </div>
      </div>
    </div>
  );
}
