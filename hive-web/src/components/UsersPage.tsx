/**
 * MH-012: User management page (admin only).
 *
 * Lists all users, allows creating new users, updating roles/status,
 * and deleting users (with last-admin protection).
 */

import { useCallback, useEffect, useState } from "react";
import { authHeader } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: number;
  username: string;
  role: "admin" | "user";
  active: boolean;
  created_at: string;
}

interface ListUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.message ?? `HTTP ${res.status}` };
    }
    if (res.status === 204) return { ok: true, data: undefined as T };
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface UsersState {
  loading: boolean;
  error: string | null;
  users: AdminUser[];
  total: number;
  page: number;
  /** Increment to trigger a re-fetch without changing page. */
  fetchId: number;
}

export function UsersPage() {
  const [usersState, setUsersState] = useState<UsersState>({
    loading: true,
    error: null,
    users: [],
    total: 0,
    page: 1,
    fetchId: 0,
  });

  const PAGE_SIZE = 50;
  const { loading, error, users, total, page, fetchId } = usersState;

  // Fetch users whenever page or fetchId changes.
  // No synchronous setState in the effect body — initial state already has loading: true.
  useEffect(() => {
    let cancelled = false;
    apiFetch<ListUsersResponse>(
      `/api/admin/users?page=${page}&page_size=${PAGE_SIZE}`
    ).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setUsersState((s) => ({ ...s, loading: false, error: result.error }));
        return;
      }
      setUsersState((s) => ({
        ...s,
        loading: false,
        error: null,
        users: result.data.users,
        total: result.data.total,
        page: result.data.page,
      }));
    });
    return () => {
      cancelled = true;
    };
    // fetchId is intentionally included: incrementing it re-runs this effect
    // without changing page, used after create/delete.
  }, [page, fetchId]);

  const triggerRefresh = useCallback(
    () => setUsersState((s) => ({ ...s, loading: true, error: null, fetchId: s.fetchId + 1 })),
    []
  );

  const setPage = useCallback(
    (p: number) => setUsersState((s) => ({ ...s, loading: true, error: null, page: p })),
    []
  );

  // Create user form state
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleToggleActive = useCallback(async (user: AdminUser) => {
    const result = await apiFetch<AdminUser>(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !user.active }),
    });
    if (!result.ok) {
      setUsersState((s) => ({ ...s, error: result.error }));
      return;
    }
    setUsersState((s) => ({
      ...s,
      users: s.users.map((u) => (u.id === user.id ? result.data : u)),
    }));
  }, []);

  const handleRoleChange = useCallback(
    async (user: AdminUser, role: "admin" | "user") => {
      const result = await apiFetch<AdminUser>(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      if (!result.ok) {
        setUsersState((s) => ({ ...s, error: result.error }));
        return;
      }
      setUsersState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === user.id ? result.data : u)),
      }));
    },
    []
  );

  const handleDelete = useCallback(
    async (user: AdminUser) => {
      const confirmed = window.confirm(
        `Permanently delete user "${user.username}"?\nThis cannot be undone.`
      );
      if (!confirmed) return;
      const result = await apiFetch<undefined>(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (!result.ok) {
        setUsersState((s) => ({ ...s, error: result.error }));
        return;
      }
      setUsersState((s) => ({
        ...s,
        users: s.users.filter((u) => u.id !== user.id),
        total: s.total - 1,
      }));
    },
    []
  );

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUsername.trim() || !newPassword.trim()) {
        setCreateError("Username and password are required.");
        return;
      }
      setCreating(true);
      setCreateError(null);
      const result = await apiFetch<{ id: number; username: string; role: string }>(
        "/api/admin/users",
        {
          method: "POST",
          body: JSON.stringify({
            username: newUsername.trim(),
            password: newPassword,
            role: newRole,
          }),
        }
      );
      setCreating(false);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      setShowCreate(false);
      triggerRefresh();
    },
    [newUsername, newPassword, newRole, triggerRefresh]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div
      className="p-6 max-w-4xl mx-auto"
      data-testid="users-page"
      role="main"
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-100">User Management</h1>
        <button
          onClick={() => setShowCreate((s) => !s)}
          data-testid="create-user-button"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
        >
          {showCreate ? "Cancel" : "Add User"}
        </button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 bg-gray-800 rounded border border-gray-700"
          data-testid="create-user-form"
        >
          <h2 className="text-sm font-semibold text-gray-300 mb-3">New User</h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              data-testid="new-username-input"
              className="flex-1 min-w-36 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoComplete="off"
            />
            <input
              type="password"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              data-testid="new-password-input"
              className="flex-1 min-w-36 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoComplete="new-password"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "user")}
              data-testid="new-role-select"
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
          {createError && (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {createError}
            </p>
          )}
        </form>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="text-sm text-gray-400" role="status">
          Loading users…
        </div>
      ) : (
        <>
          <table
            className="w-full text-sm"
            aria-label="User list"
            data-testid="users-table"
          >
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700">
                <th className="pb-2 pr-4">Username</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Created</th>
                <th className="pb-2" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  data-testid={`user-row-${user.id}`}
                  className="border-b border-gray-800"
                >
                  <td className="py-2 pr-4 font-mono text-gray-200">
                    {user.username}
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(
                          user,
                          e.target.value as "admin" | "user"
                        )
                      }
                      aria-label={`Role for ${user.username}`}
                      className="px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => handleToggleActive(user)}
                      aria-label={
                        user.active
                          ? `Deactivate ${user.username}`
                          : `Activate ${user.username}`
                      }
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        user.active
                          ? "bg-green-900/60 text-green-400 hover:bg-green-900"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      {user.active ? "active" : "disabled"}
                    </button>
                  </td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">
                    {user.created_at.slice(0, 10)}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(user)}
                      aria-label={`Delete ${user.username}`}
                      className="px-2 py-0.5 rounded text-xs text-red-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              <span>
                Page {page} of {totalPages} ({total} users)
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
