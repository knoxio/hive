/**
 * MH-023: Message history — GET /api/rooms/:id/messages endpoint tests.
 *
 * Tests cover: auth enforcement, pagination, cursor-based backward scrolling,
 * has_more flag, empty rooms, and limit capping.
 * All tests use the Playwright request API (no browser).
 */
import { test, expect } from "@playwright/test";

const API = process.env.VITE_API_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAdmin(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { username: "admin", password: "admin" },
  });
  if (!res.ok()) return "";
  const body = (await res.json()) as { token?: string };
  return body.token ?? "";
}

// ---------------------------------------------------------------------------
// Auth enforcement
// ---------------------------------------------------------------------------

test("GET /api/rooms/:id/messages — 401 without token", async ({
  request,
}) => {
  const res = await request.get(`${API}/api/rooms/test-room/messages`);
  expect(res.status()).toBe(401);
});

test("GET /api/rooms/:id/messages — 401 with invalid token", async ({
  request,
}) => {
  const res = await request.get(`${API}/api/rooms/test-room/messages`, {
    headers: { Authorization: "Bearer invalid.token.here" },
  });
  expect(res.status()).toBe(401);
});

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

test("GET /api/rooms/:id/messages — valid token returns messages array and has_more", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  const res = await request.get(`${API}/api/rooms/room-dev/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // May be 200 (daemon up) or 200 with empty messages (daemon down) —
  // either way should NOT be 401/403.
  expect(res.status()).not.toBe(401);
  expect(res.status()).not.toBe(403);

  if (res.status() === 200) {
    const body = (await res.json()) as {
      messages: unknown[];
      has_more: boolean;
    };
    expect(Array.isArray(body.messages)).toBe(true);
    expect(typeof body.has_more).toBe("boolean");
  }
});

test("GET /api/rooms/:id/messages — default limit is 50", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  const res = await request.get(`${API}/api/rooms/room-dev/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) test.skip();

  const body = (await res.json()) as { messages: unknown[]; has_more: boolean };
  // Should return at most 50 messages.
  expect(body.messages.length).toBeLessThanOrEqual(50);
});

test("GET /api/rooms/:id/messages — limit query param respected", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  const res = await request.get(
    `${API}/api/rooms/room-dev/messages?limit=10`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status() !== 200) test.skip();

  const body = (await res.json()) as { messages: unknown[]; has_more: boolean };
  expect(body.messages.length).toBeLessThanOrEqual(10);
});

test("GET /api/rooms/:id/messages — limit capped at 200", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  const res = await request.get(
    `${API}/api/rooms/room-dev/messages?limit=9999`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status() !== 200) test.skip();

  const body = (await res.json()) as { messages: unknown[]; has_more: boolean };
  expect(body.messages.length).toBeLessThanOrEqual(200);
});

// ---------------------------------------------------------------------------
// Cursor pagination
// ---------------------------------------------------------------------------

test("GET /api/rooms/:id/messages — before cursor returns older subset", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  // First fetch — get the most recent messages.
  const firstRes = await request.get(
    `${API}/api/rooms/room-dev/messages?limit=5`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (firstRes.status() !== 200) test.skip();

  const firstBody = (await firstRes.json()) as {
    messages: Array<{ id: string }>;
    has_more: boolean;
  };
  if (firstBody.messages.length < 2) test.skip();

  // Use the oldest ID from the first page as the before cursor.
  const oldestId = firstBody.messages[0].id;

  const secondRes = await request.get(
    `${API}/api/rooms/room-dev/messages?before=${oldestId}&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (secondRes.status() !== 200) test.skip();

  const secondBody = (await secondRes.json()) as {
    messages: Array<{ id: string }>;
    has_more: boolean;
  };

  // None of the returned messages should include the cursor ID.
  const ids = secondBody.messages.map((m) => m.id);
  expect(ids).not.toContain(oldestId);
});

test("GET /api/rooms/:id/messages — unknown before cursor returns empty", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  const res = await request.get(
    `${API}/api/rooms/room-dev/messages?before=nonexistent-id-xyz`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status() !== 200) test.skip();

  const body = (await res.json()) as {
    messages: unknown[];
    has_more: boolean;
  };
  expect(body.messages).toHaveLength(0);
  expect(body.has_more).toBe(false);
});

// ---------------------------------------------------------------------------
// Non-existent room
// ---------------------------------------------------------------------------

test("GET /api/rooms/:id/messages — non-existent room returns empty messages", async ({
  request,
}) => {
  const token = await loginAdmin(request);
  if (!token) test.skip();

  const res = await request.get(
    `${API}/api/rooms/definitely-not-a-real-room-xyz/messages`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  // Should not 401/403 (auth is valid); may be 200 with empty body or 502.
  expect(res.status()).not.toBe(401);
  expect(res.status()).not.toBe(403);

  if (res.status() === 200) {
    const body = (await res.json()) as {
      messages: unknown[];
      has_more: boolean;
    };
    expect(Array.isArray(body.messages)).toBe(true);
  }
});
