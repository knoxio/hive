/**
 * User preferences page (MH-028).
 *
 * Accessible at /settings/preferences (requires auth).
 * Provides controls for:
 *  - UI theme (System / Light / Dark) — applied immediately via data-theme attribute
 *  - UI density (Comfortable / Compact)
 *  - Notification toggles (@mentions, DMs, all-room)
 *  - Reset to defaults button
 *
 * Preferences are persisted server-side via PATCH /api/users/me/preferences
 * and applied on load from GET /api/users/me/preferences.
 */

import { type ChangeEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiError';
import { authHeader } from '../lib/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Types — must mirror the backend Preferences struct
// ---------------------------------------------------------------------------

type Theme = 'system' | 'light' | 'dark';
type Density = 'comfortable' | 'compact';

interface UiPrefs {
  theme: Theme;
  density: Density;
}

interface NotificationPrefs {
  mentions: boolean;
  dms: boolean;
  rooms: boolean;
}

interface Preferences {
  ui: UiPrefs;
  notifications: NotificationPrefs;
}

// ---------------------------------------------------------------------------
// Default preferences (mirrors backend defaults)
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: Preferences = {
  ui: { theme: 'system', density: 'comfortable' },
  notifications: { mentions: true, dms: true, rooms: false },
};

// ---------------------------------------------------------------------------
// Theme application
// ---------------------------------------------------------------------------

/**
 * Apply `theme` to `<html data-theme="...">` and respect `prefers-color-scheme`
 * when theme is "system".
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  // Load preferences on mount.
  useEffect(() => {
    let cancelled = false;

    apiFetch<Preferences>(`${API_BASE}/api/users/me/preferences`, {
      headers: authHeader(),
    })
      .then((data) => {
        if (!cancelled) {
          setPrefs(data);
          applyTheme(data.ui.theme);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Fall back to defaults — preferences are not critical.
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Persist a partial update and merge into local state. */
  async function save(patch: Partial<{ ui: Partial<UiPrefs>; notifications: Partial<NotificationPrefs> }>) {
    setSaving(true);
    setError(null);

    try {
      const updated = await apiFetch<Preferences>(
        `${API_BASE}/api/users/me/preferences`,
        {
          method: 'PATCH',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      );
      setPrefs(updated);
      applyTheme(updated.ui.theme);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2000);
    } catch {
      setError('Failed to save preferences — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleThemeChange(e: ChangeEvent<HTMLSelectElement>) {
    const theme = e.target.value as Theme;
    // Optimistically apply theme immediately.
    applyTheme(theme);
    setPrefs((p) => ({ ...p, ui: { ...p.ui, theme } }));
    void save({ ui: { theme } });
  }

  function handleDensityChange(e: ChangeEvent<HTMLSelectElement>) {
    const density = e.target.value as Density;
    setPrefs((p) => ({ ...p, ui: { ...p.ui, density } }));
    void save({ ui: { density } });
  }

  function handleNotifToggle(key: keyof NotificationPrefs) {
    const newValue = !prefs.notifications[key];
    setPrefs((p) => ({
      ...p,
      notifications: { ...p.notifications, [key]: newValue },
    }));
    void save({ notifications: { [key]: newValue } });
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Preferences>(
        `${API_BASE}/api/users/me/preferences`,
        {
          method: 'PATCH',
          headers: { ...authHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify(DEFAULT_PREFERENCES),
        },
      );
      setPrefs(updated);
      applyTheme(updated.ui.theme);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2000);
    } catch {
      setError('Failed to reset preferences — please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-gray-900 flex items-center justify-center"
        data-testid="preferences-loading"
      >
        <div className="animate-pulse text-gray-400 text-sm">Loading preferences…</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-900 text-gray-100 flex flex-col"
      data-testid="preferences-page"
    >
      {/* Navigation bar */}
      <nav className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        <Link
          to="/"
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          data-testid="preferences-back-link"
          aria-label="Back to home"
        >
          ← Hive
        </Link>
        <span className="text-gray-600 text-sm">/</span>
        <span className="text-sm font-medium text-gray-200">Preferences</span>

        {/* Saved confirmation */}
        {savedBanner && (
          <span
            className="ml-auto text-green-400 text-xs"
            role="status"
            data-testid="preferences-saved-banner"
          >
            Saved
          </span>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center pt-10 px-4">
        <div className="w-full max-w-lg space-y-8">
          {error && (
            <div
              role="alert"
              data-testid="preferences-error"
              className="rounded-md bg-red-900 border border-red-700 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          {/* UI section */}
          <section aria-labelledby="ui-heading">
            <h2
              id="ui-heading"
              className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3"
            >
              Display
            </h2>
            <div className="bg-gray-800 rounded-lg divide-y divide-gray-700">
              {/* Theme */}
              <div className="px-4 py-3 flex items-center justify-between">
                <label htmlFor="theme-select" className="text-sm text-gray-200">
                  Theme
                </label>
                <select
                  id="theme-select"
                  value={prefs.ui.theme}
                  onChange={handleThemeChange}
                  disabled={saving}
                  data-testid="preferences-theme-select"
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              {/* Density */}
              <div className="px-4 py-3 flex items-center justify-between">
                <label htmlFor="density-select" className="text-sm text-gray-200">
                  Density
                </label>
                <select
                  id="density-select"
                  value={prefs.ui.density}
                  onChange={handleDensityChange}
                  disabled={saving}
                  data-testid="preferences-density-select"
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>
          </section>

          {/* Notifications section */}
          <section aria-labelledby="notif-heading">
            <h2
              id="notif-heading"
              className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3"
            >
              Notifications
            </h2>
            <div className="bg-gray-800 rounded-lg divide-y divide-gray-700">
              <NotifToggle
                label="@mention notifications"
                description="Notify when someone @mentions you"
                checked={prefs.notifications.mentions}
                onToggle={() => handleNotifToggle('mentions')}
                disabled={saving}
                testId="preferences-notif-mentions"
              />
              <NotifToggle
                label="Direct message notifications"
                description="Notify for new direct messages"
                checked={prefs.notifications.dms}
                onToggle={() => handleNotifToggle('dms')}
                disabled={saving}
                testId="preferences-notif-dms"
              />
              <NotifToggle
                label="All-room notifications"
                description="Notify for every message in all rooms"
                checked={prefs.notifications.rooms}
                onToggle={() => handleNotifToggle('rooms')}
                disabled={saving}
                testId="preferences-notif-rooms"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Browser notifications require permission when first enabled.
            </p>
          </section>

          {/* Reset button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              data-testid="preferences-reset-btn"
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotifToggle — reusable toggle row
// ---------------------------------------------------------------------------

interface NotifToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  testId: string;
}

function NotifToggle({ label, description, checked, onToggle, disabled, testId }: NotifToggleProps) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        data-testid={testId}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
        aria-label={label}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
