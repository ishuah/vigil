import { useState, useCallback } from 'react';
import type { ACLEDEvent } from '../types';
import { parseACLEDCSV } from '../api/csv';

async function loadSampleData(): Promise<ACLEDEvent[]> {
  const base = import.meta.env.BASE_URL ?? '/';
  const res = await fetch(`${base}sample-data.csv`);
  if (!res.ok) throw new Error('Could not load sample data');
  const text = await res.text();
  return parseACLEDCSV(text);
}

interface Props {
  onUpload: (events: ACLEDEvent[]) => void;
}

export default function UploadPage({ onUpload }: Props) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>('idle');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleLoadSample = useCallback(async () => {
    setStatus('parsing');
    setError('');
    try {
      const events = await loadSampleData();
      onUpload(events);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed to load sample data');
    }
  }, [onUpload]);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setStatus('error');
        setError('Please upload a .csv file exported from ACLED.');
        return;
      }
      setStatus('parsing');
      setError('');
      try {
        const text = await file.text();
        const events = parseACLEDCSV(text);
        onUpload(events);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Failed to parse CSV');
      }
    },
    [onUpload],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            <span className="text-blue-400">Vigil</span>
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Armed conflict actor network visualization
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Load ACLED data</h2>
          <p className="text-gray-400 text-sm mb-6">
            Export a CSV from{' '}
            <a
              href="https://acleddata.com/data-export-tool/"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              ACLED Explorer
            </a>{' '}
            and upload it here. Your data never leaves your browser.
          </p>

          {/* Drop zone */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-400 bg-blue-900/20'
                : 'border-gray-600 hover:border-gray-500 bg-gray-700/30 hover:bg-gray-700/50'
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {status === 'parsing' ? (
              <div className="text-center">
                <div className="text-2xl mb-2 animate-spin">⟳</div>
                <p className="text-gray-400 text-sm">Parsing CSV…</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl mb-3 text-gray-500">↑</div>
                <p className="text-white text-sm font-medium">
                  Drop CSV here or click to browse
                </p>
                <p className="text-gray-500 text-xs mt-1">ACLED data export (.csv)</p>
              </div>
            )}
          </label>

          {error && (
            <div className="mt-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
              ✗ {error}
            </div>
          )}
        </div>

        {/* Sample data */}
        <div className="mt-4 bg-gray-800/50 rounded-xl border border-blue-900/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-300">Try with sample data</h3>
              <p className="text-xs text-gray-500 mt-1">
                1,200 events · East Africa + Sudan + DRC · 2023–2024
              </p>
            </div>
            <button
              onClick={handleLoadSample}
              disabled={status === 'parsing'}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors"
            >
              Load sample →
            </button>
          </div>
        </div>

        {/* How to export instructions */}
        <div className="mt-6 bg-gray-800/50 rounded-xl border border-gray-700/50 p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">How to export from ACLED</h3>
          <ol className="space-y-2 text-xs text-gray-400">
            <li className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">1.</span>
              Go to{' '}
              <a
                href="https://acleddata.com/data-export-tool/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                acleddata.com/data-export-tool
              </a>{' '}
              and log in.
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">2.</span>
              Set your filters (country, date range, event types).
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">3.</span>
              Click <strong className="text-gray-300">Export</strong> → <strong className="text-gray-300">CSV</strong>.
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400 font-medium shrink-0">4.</span>
              Upload the downloaded file above.
            </li>
          </ol>
        </div>

        <div className="mt-4 text-center text-gray-600 text-xs">
          Open source · Client-side only · Data from{' '}
          <a href="https://acleddata.com" target="_blank" rel="noreferrer" className="hover:text-gray-500">
            ACLED
          </a>
        </div>
      </div>
    </div>
  );
}
