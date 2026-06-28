/**
 * RBAC E2E — STORY-015 (aggiornato STORY-020)
 *
 * Scenario 1: endpoint protetto senza token → 401 (verificato con request API).
 * Scenario 2: ruolo employee tenta endpoint hr-only → 403.
 *             Usa cookie session via loginAs (non più Authorization: Bearer).
 *             Richiede E2E_TEST_MODE=true.
 */
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

test("@rbac GET /api/users/me senza token → 401", async ({ request }) => {
  const r = await request.get("/api/users/me");
  expect(r.status()).toBe(401);
});

test("@rbac employee tenta endpoint hr-only → 403", async ({ loginAs, context }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true",
  );

  await loginAs("employee");

  // Usa context.request — ha il cookie session impostato da loginAs
  const hrR = await context.request.get("/api/users/hr-only");
  expect(hrR.status()).toBe(403);
});
