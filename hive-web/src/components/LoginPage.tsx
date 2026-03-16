import { useState } from 'react';

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [serverUrl, setServerUrl] = useState(
    localStorage.getItem('hive-server-url') || 'http://localhost:3000'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${serverUrl}/api/health`);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const data = await resp.json();
      if (data.status === 'ok' || data.status === 'degraded') {
        localStorage.setItem('hive-server-url', serverUrl);
        onLogin();
      } else {
        setError('Server is not ready');
      }
    } catch (e) {
      setError(`Cannot connect to ${serverUrl}: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Hive</h1>
        <p className="text-gray-400 mb-6">Agent Orchestration Platform</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://localhost:3000"
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-md px-3 py-2 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={onLogin}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-md transition-colors"
          >
            Continue as Guest
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          OAuth login coming soon
        </p>
      </div>
    </div>
  );
}
