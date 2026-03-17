/**
 * User profile page (MH-011).
 *
 * Displays the current user's identity (username, role, ID) fetched from
 * `GET /api/users/me`.  All fields are read-only in this version — profile
 * editing (display name, preferences) is tracked as a follow-up.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, type AppError } from '../lib/apiError';
import { authHeader } from '../lib/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface UserProfile {
  id: string;
  username: string;
  role: string;
}

/** Return the first two characters of a username as uppercase initials. */
function avatarInitials(username: string): string {
  const trimmed = username.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 2).toUpperCase() : '??';
}

/** Colour scheme for role badges. */
const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-700 text-purple-100',
  user: 'bg-gray-700 text-gray-300',
};

function roleBadgeClass(role: string): string {
  return ROLE_BADGE[role] ?? 'bg-gray-700 text-gray-300';
}

/** Full-page loading skeleton. */
function LoadingState() {
  return (
    <div
      className="min-h-screen bg-gray-900 flex items-center justify-center"
      data-testid="profile-loading"
    >
      <div className="animate-pulse text-gray-400 text-sm">Loading profile…</div>
    </div>
  );
}

/** Full-page error display. */
function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="min-h-screen bg-gray-900 flex items-center justify-center"
      data-testid="profile-error-state"
    >
      <div className="text-center space-y-4">
        <p className="text-red-400 text-sm" data-testid="profile-error">
          {message}
        </p>
        <Link
          to="/"
          className="text-blue-400 hover:text-blue-300 text-sm underline"
          data-testid="profile-error-back"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

/** Displays the authenticated user's identity. */
export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiFetch<UserProfile>(`${API_BASE}/api/users/me`, {
      headers: authHeader(),
    })
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const appError = err as AppError;
          setError(appError?.message ?? 'Could not load your profile.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState />;
  if (error || !profile) {
    return <ErrorState message={error ?? 'Could not load your profile.'} />;
  }

  const initials = avatarInitials(profile.username);

  return (
    <div
      className="min-h-screen bg-gray-900 text-gray-100 flex flex-col"
      data-testid="profile-page"
    >
      {/* Navigation bar */}
      <nav className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        <Link
          to="/"
          className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
          data-testid="profile-back-link"
          aria-label="Back to home"
        >
          ← Hive
        </Link>
        <span className="text-gray-600 text-sm">/</span>
        <span className="text-sm font-medium text-gray-200">Profile</span>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center pt-16 px-4">
        <div className="w-full max-w-md space-y-6">
          {/* Avatar and identity header */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold select-none"
              aria-label={`Avatar for ${profile.username}`}
              data-testid="profile-avatar"
            >
              {initials}
            </div>
            <div className="text-center">
              <h1
                className="text-xl font-semibold"
                data-testid="profile-username-heading"
              >
                {profile.username}
              </h1>
              <span
                className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-medium ${roleBadgeClass(profile.role)}`}
                data-testid="profile-role-badge"
              >
                {profile.role}
              </span>
            </div>
          </div>

          {/* Profile detail rows */}
          <div
            className="bg-gray-800 rounded-lg divide-y divide-gray-700"
            role="list"
            aria-label="Profile details"
          >
            <div className="px-4 py-3 flex justify-between items-center" role="listitem">
              <span className="text-sm text-gray-400">Username</span>
              <span
                className="text-sm font-medium"
                data-testid="profile-username-field"
              >
                {profile.username}
              </span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center" role="listitem">
              <span className="text-sm text-gray-400">Role</span>
              <span
                className="text-sm font-medium capitalize"
                data-testid="profile-role-field"
              >
                {profile.role}
              </span>
            </div>

            <div className="px-4 py-3 flex justify-between items-center" role="listitem">
              <span className="text-sm text-gray-400">User ID</span>
              <span
                className="text-sm text-gray-500 font-mono"
                data-testid="profile-id-field"
              >
                #{profile.id}
              </span>
            </div>
          </div>

          {/* Follow-up note */}
          <p className="text-xs text-gray-500 text-center">
            Profile editing (display name, avatar, preferences) is coming in a
            follow-up.
          </p>
        </div>
      </main>
    </div>
  );
}
