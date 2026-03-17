/**
 * First-run setup wizard (MH-004).
 *
 * Three-step flow:
 *  1. Daemon URL — test connection, then save
 *  2. Admin user — create the first local admin account
 *  3. Complete  — finalise setup and redirect to /login
 *
 * All five setup endpoints are public (no JWT required).
 */

import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldError } from './FieldError';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 'daemon' | 'admin' | 'complete';

// ---------------------------------------------------------------------------
// Top-level wizard
// ---------------------------------------------------------------------------

/**
 * Full-screen setup wizard accessible at /setup.
 * Hides itself once setup_complete=true (redirects to /login).
 */
export function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('daemon');
  const [daemonUrl, setDaemonUrl] = useState('');

  return (
    <div
      className="min-h-screen bg-gray-900 flex items-center justify-center px-4"
      data-testid="setup-wizard"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white mb-1">Hive Setup</h1>
        <p className="text-gray-400 text-sm mb-6">
          Complete this one-time configuration to get started.
        </p>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step content */}
        <div className="mt-6">
          {step === 'daemon' && (
            <DaemonStep
              daemonUrl={daemonUrl}
              onDaemonUrlChange={setDaemonUrl}
              onNext={() => setStep('admin')}
            />
          )}
          {step === 'admin' && (
            <AdminStep onNext={() => setStep('complete')} />
          )}
          {step === 'complete' && (
            <CompleteStep onDone={() => navigate('/login', { replace: true })} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS: { id: Step; label: string }[] = [
  { id: 'daemon', label: 'Daemon' },
  { id: 'admin', label: 'Admin' },
  { id: 'complete', label: 'Complete' },
];

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2" aria-label="Setup progress" role="list">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-2" role="listitem">
            {i > 0 && <div className="flex-1 h-px bg-gray-600 w-6" />}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                  done
                    ? 'bg-green-600 text-white'
                    : active
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-400'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={`text-xs mt-1 ${active ? 'text-white' : 'text-gray-500'}`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Daemon URL
// ---------------------------------------------------------------------------

interface DaemonStepProps {
  daemonUrl: string;
  onDaemonUrlChange: (url: string) => void;
  onNext: () => void;
}

function DaemonStep({ daemonUrl, onDaemonUrlChange, onNext }: DaemonStepProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleTest = async () => {
    setTestStatus('testing');
    setTestError(null);

    try {
      const res = await fetch(`${API_BASE}/api/setup/verify-daemon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: daemonUrl }),
      });
      const data = (await res.json()) as { reachable: boolean; error?: string };
      if (data.reachable) {
        setTestStatus('ok');
      } else {
        setTestStatus('fail');
        setTestError(data.error ?? 'Daemon unreachable');
      }
    } catch {
      setTestStatus('fail');
      setTestError('Could not reach the server — check your connection.');
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`${API_BASE}/api/setup/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daemon_url: daemonUrl }),
      });

      if (res.ok) {
        onNext();
        return;
      }

      const data = (await res.json()) as { message?: string };
      setSaveError(data.message ?? 'Failed to save daemon URL.');
    } catch {
      setSaveError('Could not reach the server — check your connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4" data-testid="setup-step-daemon">
      <div>
        <label
          htmlFor="daemon-url"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Daemon URL
        </label>
        <input
          id="daemon-url"
          type="url"
          autoFocus
          required
          value={daemonUrl}
          onChange={(e) => {
            onDaemonUrlChange(e.target.value);
            setTestStatus('idle');
          }}
          placeholder="ws://room-daemon:4200"
          data-testid="setup-daemon-url"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          WebSocket URL of the room daemon (ws:// or wss://).
        </p>
      </div>

      {/* Test result */}
      {testStatus === 'ok' && (
        <div
          role="status"
          data-testid="setup-daemon-test-ok"
          className="rounded-md bg-green-900 border border-green-700 px-3 py-2 text-sm text-green-200"
        >
          Daemon is reachable.
        </div>
      )}
      {testStatus === 'fail' && (
        <div
          role="alert"
          data-testid="setup-daemon-test-fail"
          className="rounded-md bg-red-900 border border-red-700 px-3 py-2 text-sm text-red-200"
        >
          {testError}
        </div>
      )}

      <FieldError message={saveError} />

      <div className="flex gap-3">
        <button
          type="button"
          disabled={!daemonUrl || testStatus === 'testing'}
          onClick={handleTest}
          data-testid="setup-daemon-test-btn"
          className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
        >
          {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="submit"
          disabled={!daemonUrl || saving}
          data-testid="setup-daemon-save-btn"
          className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
        >
          {saving ? 'Saving…' : 'Save & continue'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Create admin user
// ---------------------------------------------------------------------------

interface AdminStepProps {
  onNext: () => void;
}

function AdminStep({ onNext }: AdminStepProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/setup/create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        onNext();
        return;
      }

      const data = (await res.json()) as { message?: string };
      setError(data.message ?? 'Failed to create admin user.');
    } catch {
      setError('Could not reach the server — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" data-testid="setup-step-admin">
      <div>
        <label
          htmlFor="admin-username"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Admin username
        </label>
        <input
          id="admin-username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
          data-testid="setup-admin-username"
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="admin-password"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="admin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            data-testid="setup-admin-password"
            className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            data-testid="setup-toggle-password"
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-200 focus:outline-none"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Minimum 8 characters.</p>
      </div>

      <FieldError message={error} />

      <button
        type="submit"
        disabled={!username || password.length < 8 || loading}
        data-testid="setup-admin-submit"
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        {loading ? 'Creating…' : 'Create admin & continue'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Complete
// ---------------------------------------------------------------------------

interface CompleteStepProps {
  onDone: () => void;
}

function CompleteStep({ onDone }: CompleteStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/setup/complete`, {
        method: 'POST',
      });

      if (res.ok) {
        onDone();
        return;
      }

      const data = (await res.json()) as { message?: string };
      setError(data.message ?? 'Failed to complete setup.');
    } catch {
      setError('Could not reach the server — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="setup-step-complete">
      <div className="rounded-md bg-gray-700 px-4 py-3 text-sm text-gray-200 space-y-1">
        <p className="font-medium text-white">Setup summary</p>
        <p>✓ Daemon URL configured</p>
        <p>✓ Admin user created</p>
      </div>

      <p className="text-sm text-gray-400">
        Click below to finalise setup. You will be redirected to the login page.
      </p>

      <FieldError message={error} />

      <button
        type="button"
        disabled={loading}
        onClick={handleComplete}
        data-testid="setup-complete-btn"
        className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        {loading ? 'Finishing…' : 'Finish setup'}
      </button>
    </div>
  );
}
