/**
 * Auth setup — STORY-020.
 *
 * Autentica tutti e 3 i ruoli via POST /api/_test/session e salva
 * storageState per-ruolo in e2e/.auth/{role}.json.
 *
 * Viene eseguito come dipendenza dal progetto "chromium" in playwright.config.ts.
 * Saltato silenziosamente se E2E_TEST_MODE !== "true".
 */
import { mergeTests } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";
import { Role } from "@support/types";

const ROLES: Role[] = ["employee", "hr", "admin"];
const test = mergeTests(base, authFixtures);

test("setup auth storageState per-ruolo", async ({ loginAs }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true — saltato in ambienti senza flag"
  );

  for (const role of ROLES) {
    await loginAs(role);
  }
});
