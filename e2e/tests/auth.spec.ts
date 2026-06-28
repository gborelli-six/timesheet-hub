/**
 * Auth E2E — STORY-020, Scenario #1 (P0).
 *
 * Per ciascun ruolo: loginAs → naviga a "/" → verifica assenza redirect a "/login".
 * Richiede E2E_TEST_MODE=true.
 */
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";
import { Role } from "@support/types";

const ROLES: Role[] = ["employee", "hr", "admin"];
const test = mergeTests(base, authFixtures);

for (const role of ROLES) {
  test(`@auth ${role} autenticato → GET / non redirecta a /login`, async ({
    loginAs,
    page,
  }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs(role);

    // page usa lo stesso context — il cookie session è già presente
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    expect(page.url()).not.toContain("/login");
  });
}
