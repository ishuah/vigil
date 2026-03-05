import { useState, useEffect } from 'react';
import { login, loadTokens, isTokenExpired, testConnection } from '../api/acled';
import type { OAuthTokens } from '../types';

interface Props {
  onConnect: () => void;
}

function tokenExpiryLabel(tokens: OAuthTokens): string {
  const ms = tokens.expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
}

export default function ConnectPage({ onConnect }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'logging-in' | 'verifying' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [savedTokens, setSavedTokens] = useState<OAuthTokens | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (tokens) setSavedTokens(tokens);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setStatus('error');
      setMessage('Email and password are required.');
      return;
    }
    setStatus('logging-in');
    setMessage('');
    try {
      await login(email, password);
      setStatus('verifying');
      setMessage('');
      const result = await testConnection();
      if (result.ok) {
        setStatus('ok');
        setMessage('Authenticated successfully.');
        setSavedTokens(loadTokens());
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const handleUseSaved = async () => {
    setStatus('verifying');
    setMessage('');
    const result = await testConnection();
    if (result.ok) {
      onConnect();
    } else {
      setStatus('error');
      setMessage('Saved session expired. Please log in again.');
      setSavedTokens(null);
    }
  };

  const handleProceed = () => onConnect();

  const isLoading = status === 'logging-in' || status === 'verifying';

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

        {/* Saved session banner */}
        {savedTokens && !isTokenExpired(savedTokens) && status === 'idle' && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-xl mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">Session active</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {tokenExpiryLabel(savedTokens)}
                </p>
              </div>
              <button
                onClick={handleUseSaved}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg px-4 py-1.5 text-sm transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Login card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">
            {savedTokens && !isTokenExpired(savedTokens) ? 'Log in again' : 'Log in to ACLED'}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Uses your{' '}
            <a
              href="https://acleddata.com/register"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              myACLED
            </a>{' '}
            credentials. Token stored locally — never sent to any third party.
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
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="you@example.com"
                disabled={isLoading}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Your myACLED password"
                disabled={isLoading}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50"
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
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {status === 'logging-in'
                ? 'Authenticating…'
                : status === 'verifying'
                ? 'Verifying connection…'
                : 'Log in'}
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

        <div className="mt-6 text-center text-gray-600 text-xs">
          Open source · Client-side only · Data from{' '}
          <a
            href="https://acleddata.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-gray-500"
          >
            ACLED
          </a>
        </div>
      </div>
    </div>
  );
}
