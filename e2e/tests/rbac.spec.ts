/**
 * RBAC E2E — STORY-015
 *
 * Scenario 1: endpoint protetto senza token → 401 (verificato con page.request).
 * Scenario 2: ruolo employee tenta endpoint hr-only → 403.
 *             Richiede E2E_TEST_MODE=true (POST /api/_test/session funzionale).
 */
import { test, expect } from "@playwright/test";

test("@rbac GET /api/users/me senza token → 401", async ({ request }) => {
  const r = await request.get("/api/users/me");
  expect(r.status()).toBe(401);
});

test("@rbac employee tenta endpoint hr-only → 403", async ({ request }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true",
  );

  const sessionR = await request.post("/api/_test/session", {
    data: { email: "employee@sixfeetup.it", role: "employee" },
  });
  expect(sessionR.status()).toBe(200);
  const { token } = await sessionR.json();

  const hrR = await request.get("/api/users/hr-only", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(hrR.status()).toBe(403);
});
