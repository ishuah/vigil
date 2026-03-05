import { useState, useEffect } from 'react';
import type { Credentials } from '../types';
import { testConnection } from '../api/acled';

interface Props {
  onConnect: (creds: Credentials) => void;
}

export default function ConnectPage({ onConnect }: Props) {
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('vigil_credentials');
    if (saved) {
      try {
        const creds: Credentials = JSON.parse(saved);
        setEmail(creds.email);
        setApiKey(creds.apiKey);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleTest = async () => {
    if (!email || !apiKey) {
      setStatus('error');
      setMessage('Both email and API key are required.');
      return;
    }
    setStatus('testing');
    setMessage('');
    const result = await testConnection({ email, apiKey });
    if (result.ok) {
      setStatus('ok');
      setMessage(result.message);
      localStorage.setItem('vigil_credentials', JSON.stringify({ email, apiKey }));
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  };

  const handleProceed = () => {
    onConnect({ email, apiKey });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            <span className="text-blue-400">Vigil</span>
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Armed conflict actor network visualization
          </p>
        </div>

        {/* Card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Connect to ACLED</h2>
          <p className="text-gray-400 text-sm mb-6">
            Enter your ACLED credentials. Get a free API key at{' '}
            <span className="text-blue-400">acleddata.com</span>.
            Credentials are stored locally and never sent to any server except ACLED.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your ACLED API key"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Status message */}
            {message && (
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  status === 'ok'
                    ? 'bg-green-900/50 border border-green-700 text-green-300'
                    : 'bg-red-900/50 border border-red-700 text-red-300'
                }`}
              >
                {status === 'ok' ? '✓ ' : '✗ '}
                {message}
              </div>
            )}

            <button
              onClick={handleTest}
              disabled={status === 'testing'}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {status === 'testing' ? 'Testing connection…' : 'Test Connection'}
            </button>

            {status === 'ok' && (
              <button
                onClick={handleProceed}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Proceed to Filter →
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 text-center text-gray-600 text-xs">
          Open source · Client-side only · Data from ACLED
        </div>
      </div>
    </div>
  );
}
