/**
 * MH-012: User management (admin only)
 *
 * Tests the full admin user-management API:
 *   GET    /api/admin/users         — list with pagination
 *   POST   /api/admin/users         — create user
 *   PATCH  /api/admin/users/:id     — update role / active status
 *   DELETE /api/admin/users/:id     — delete user
 *
 * Requires the server running with:
 *   HIVE_JWT_SECRET=<>=32-byte secret>
 *   HIVE_ADMIN_USER=admin
 *   HIVE_ADMIN_PASSWORD=test-password
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.HIVE_API_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.HIVE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.HIVE_ADMIN_PASSWORD || 'test-password';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type APIRequest = Parameters<typeof test>[1] extends { request: infer R } ? R : never;

async function loginAs(request: APIRequest, username: string, password: string): Promise<string> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { username, password },
  });
  expect(res.status()).toBe(200);
  const { token } = await res.json();
  return token as string;
}

async function loginAsAdmin(request: APIRequest): Promise<string> {
  return loginAs(request, ADMIN_USER, ADMIN_PASSWORD);
}

/** Create a user via the admin API and return its id. Cleans up after the test. */
async function createTestUser(
  request: APIRequest,
  token: string,
  username: string,
  role: 'user' | 'admin' = 'user',
): Promise<number> {
  const res = await request.post(`${API_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { username, password: 'TestPass1!', role },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.id as number;
}

async function deleteUser(request: APIRequest, token: string, userId: number): Promise<void> {
  await request.delete(`${API_URL}/api/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Unique suffix to avoid collisions across parallel runs.
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// AC-1: GET /api/admin/users — list users
// ---------------------------------------------------------------------------

test.describe('MH-012: GET /api/admin/users — list users', () => {
  test('returns 200 with users array and pagination metadata', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.get(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.page).toBe('number');
    expect(typeof body.page_size).toBe('number');
    // Each user has the expected shape.
    for (const u of body.users) {
      expect(typeof u.id).toBe('number');
      expect(typeof u.username).toBe('string');
      expect(['admin', 'user']).toContain(u.role);
      expect(typeof u.active).toBe('boolean');
      expect(typeof u.created_at).toBe('string');
    }
  });

  test('requires authentication', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/admin/users`);
    expect(res.status()).toBe(401);
  });

  test('non-admin token returns 403', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `plain-${uid()}`;
    const userId = await createTestUser(request, adminToken, username, 'user');
    try {
      const plainToken = await loginAs(request, username, 'TestPass1!');
      const res = await request.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${plainToken}` },
      });
      expect(res.status()).toBe(403);
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });

  test('page_size capped at 200', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.get(`${API_URL}/api/admin/users?page_size=9999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.page_size).toBeLessThanOrEqual(200);
  });

  test('page parameter is respected', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.get(`${API_URL}/api/admin/users?page=1&page_size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.users.length).toBeLessThanOrEqual(1);
    expect(body.page).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC-2: POST /api/admin/users — create user
// ---------------------------------------------------------------------------

test.describe('MH-012: POST /api/admin/users — create user', () => {
  test('creates a new user and returns 201 with id/username/role', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const username = `new-${uid()}`;
    let userId = -1;
    try {
      const res = await request.post(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { username, password: 'TestPass1!', role: 'user' },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(typeof body.id).toBe('number');
      expect(body.username).toBe(username);
      expect(body.role).toBe('user');
      userId = body.id;
    } finally {
      if (userId !== -1) await deleteUser(request, token, userId);
    }
  });

  test('created user can log in with the supplied password', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `login-${uid()}`;
    const userId = await createTestUser(request, adminToken, username);
    try {
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { username, password: 'TestPass1!' },
      });
      expect(loginRes.status()).toBe(200);
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });

  test('duplicate username returns 409', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const username = `dup-${uid()}`;
    const userId = await createTestUser(request, token, username);
    try {
      const res = await request.post(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { username, password: 'other', role: 'user' },
      });
      expect(res.status()).toBe(409);
    } finally {
      await deleteUser(request, token, userId);
    }
  });

  test('missing username returns 400', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { password: 'TestPass1!', role: 'user' },
    });
    expect(res.status()).toBe(400);
  });

  test('missing password returns 400', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { username: `nopw-${uid()}`, role: 'user' },
    });
    expect(res.status()).toBe(400);
  });

  test('invalid role returns 400', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.post(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { username: `badrole-${uid()}`, password: 'TestPass1!', role: 'superuser' },
    });
    expect(res.status()).toBe(400);
  });

  test('requires admin role', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `plain2-${uid()}`;
    const userId = await createTestUser(request, adminToken, username);
    try {
      const plainToken = await loginAs(request, username, 'TestPass1!');
      const res = await request.post(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${plainToken}` },
        data: { username: `shouldfail-${uid()}`, password: 'x', role: 'user' },
      });
      expect(res.status()).toBe(403);
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-3: PATCH /api/admin/users/:id — update role / active
// ---------------------------------------------------------------------------

test.describe('MH-012: PATCH /api/admin/users/:id — update user', () => {
  test('promotes user to admin', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `promote-${uid()}`;
    const userId = await createTestUser(request, adminToken, username, 'user');
    try {
      const res = await request.patch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { role: 'admin' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.role).toBe('admin');
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });

  test('deactivates a user — login returns 403', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `deactivate-${uid()}`;
    const userId = await createTestUser(request, adminToken, username, 'user');
    try {
      const patchRes = await request.patch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { active: false },
      });
      expect(patchRes.status()).toBe(200);
      const body = await patchRes.json();
      expect(body.active).toBe(false);

      // Deactivated user should not be able to log in.
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { username, password: 'TestPass1!' },
      });
      expect(loginRes.status()).toBe(403);
    } finally {
      // Re-activate before deletion (deletion may also be blocked on inactive users in future).
      await request.patch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { active: true },
      });
      await deleteUser(request, adminToken, userId);
    }
  });

  test('re-activating a user restores login', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `reactivate-${uid()}`;
    const userId = await createTestUser(request, adminToken, username, 'user');
    try {
      // Deactivate.
      await request.patch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { active: false },
      });
      // Re-activate.
      await request.patch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { active: true },
      });
      // Should log in successfully.
      const loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { username, password: 'TestPass1!' },
      });
      expect(loginRes.status()).toBe(200);
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });

  test('last-admin guard: cannot demote the only admin', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    // Find the admin user ID.
    const listRes = await request.get(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { users } = await listRes.json();
    const adminUsers: Array<{ id: number; username: string; role: string }> = users.filter(
      (u: { role: string }) => u.role === 'admin',
    );
    // Skip if there are multiple admins — guard only fires on the last one.
    if (adminUsers.length !== 1) return;
    const adminId = adminUsers[0].id;

    const res = await request.patch(`${API_URL}/api/admin/users/${adminId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { role: 'user' },
    });
    expect(res.status()).toBe(409);
  });

  test('patching non-existent user returns 404', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.patch(`${API_URL}/api/admin/users/999999`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { role: 'user' },
    });
    expect(res.status()).toBe(404);
  });

  test('requires admin role', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `patch-plain-${uid()}`;
    const userId = await createTestUser(request, adminToken, username);
    try {
      const plainToken = await loginAs(request, username, 'TestPass1!');
      const res = await request.patch(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${plainToken}` },
        data: { role: 'admin' },
      });
      expect(res.status()).toBe(403);
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-4: DELETE /api/admin/users/:id — delete user
// ---------------------------------------------------------------------------

test.describe('MH-012: DELETE /api/admin/users/:id — delete user', () => {
  test('deletes an existing user and returns 204', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const username = `del-${uid()}`;
    const userId = await createTestUser(request, token, username);
    const res = await request.delete(`${API_URL}/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);
  });

  test('deleted user cannot log in', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `del-login-${uid()}`;
    const userId = await createTestUser(request, adminToken, username);
    await deleteUser(request, adminToken, userId);

    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { username, password: 'TestPass1!' },
    });
    expect(loginRes.status()).toBe(401);
  });

  test('deleting non-existent user returns 404', async ({ request }) => {
    const token = await loginAsAdmin(request);
    const res = await request.delete(`${API_URL}/api/admin/users/999999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  test('last-admin guard: cannot delete the only admin', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const listRes = await request.get(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { users } = await listRes.json();
    const adminUsers: Array<{ id: number; role: string }> = users.filter(
      (u: { role: string }) => u.role === 'admin',
    );
    if (adminUsers.length !== 1) return;
    const adminId = adminUsers[0].id;

    const res = await request.delete(`${API_URL}/api/admin/users/${adminId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(409);
  });

  test('cannot delete your own account', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    // Find the admin's own user id.
    const listRes = await request.get(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { users } = await listRes.json();
    const self: { id: number; username: string } | undefined = users.find(
      (u: { username: string }) => u.username === ADMIN_USER,
    );
    if (!self) return; // Can't proceed without knowing self id.

    const res = await request.delete(`${API_URL}/api/admin/users/${self.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(409);
  });

  test('requires admin role', async ({ request }) => {
    const adminToken = await loginAsAdmin(request);
    const username = `del-plain-${uid()}`;
    const userId = await createTestUser(request, adminToken, username);
    try {
      const plainToken = await loginAs(request, username, 'TestPass1!');
      const res = await request.delete(`${API_URL}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${plainToken}` },
      });
      expect(res.status()).toBe(403);
    } finally {
      await deleteUser(request, adminToken, userId);
    }
  });
});
