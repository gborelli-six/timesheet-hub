/**
 * Shell E2E — STORY-029.
 *
 * Verifica che la shell si comporti correttamente per i ruoli previsti
 * e che il flusso login/logout funzioni end-to-end.
 *
 * Scenario 1: utente non autenticato → redirect a /login (no E2E_TEST_MODE richiesto)
 * Scenario 2: employee → shell visibile, voce Admin assente
 * Scenario 3: admin → voce Admin visibile nel SideNav
 * Scenario 4: logout da employee → redirect a /login
 */
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

test(
  "@shell utente non autenticato → redirect a /login con pulsante Google",
  async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("login-google-button")).toBeVisible();
  }
);

test(
  "@shell employee autenticato → shell visibile, voce Admin assente",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/");

    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByTestId("user-email")).toBeVisible();
    await expect(page.getByTestId("nav-import")).toBeVisible();
    await expect(page.getByTestId("nav-log")).toBeVisible();
    await expect(page.getByTestId("nav-profilo")).toBeVisible();
    // nav-admin è condizionalmente renderizzato: non deve essere nel DOM
    await expect(page.getByTestId("nav-admin")).not.toBeAttached();
  }
);

test(
  "@shell admin autenticato → voce Admin visibile nel SideNav",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("admin");
    await page.goto("/");

    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByTestId("nav-admin")).toBeVisible();
  }
);

test(
  "@shell logout da employee → redirect a /login",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/");
    await expect(page.getByTestId("app-shell")).toBeVisible();

    await page.getByTestId("btn-logout").click();
    await expect(page).toHaveURL(/\/login/);
  }
);
