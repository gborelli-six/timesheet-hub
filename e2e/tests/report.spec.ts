/**
 * Report ore E2E — STORY-E9d-5.
 *
 * Scenario A (@smoke): nav-report visibile per tutti i ruoli + empty state senza dati.
 * Scenario B: tabella pivot con dati seedati (2 progetti × 2 connettori, totale 20h).
 * Scenario C: drill-down per Giorno (popover chooser → L1 date → L2 task).
 * Scenario D: drill-down per Task + comprimi (popover → L1 task → collapse).
 * Scenario E: filtri periodo (preset mese corrente → empty) + connettore + reset.
 * Scenario F: isolamento utente — dati di hr non visibili a employee.
 *
 * Seed (POST /api/_test/seed-report-data):
 *   Alpha / Dev    / odoo-report / 2026-06-01 / 8h
 *   Alpha / Review / odoo-report / 2026-06-02 / 4h
 *   Beta  / Dev    / jira-report / 2026-06-01 / 6h
 *   Beta  / QA     / jira-report / 2026-06-03 / 2h
 *   Totale: 20.0h | Alpha=12h | Beta=8h
 *   Date tutte giugno 2026 → escluse dal preset "Mese corrente" (luglio 2026).
 */
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

test.beforeEach(async ({ request }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true"
  );

  const resetRes = await request.post("/api/_test/reset");
  expect(resetRes.ok()).toBeTruthy();
});

// ── Scenario A ─────────────────────────────────────────────────────────────
test(
  "@smoke #E9d-5 nav-report visibile per tutti i ruoli; empty state senza dati",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    // Employee
    await loginAs("employee");
    await page.goto("/report");
    await expect(page.getByTestId("nav-report")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("report-empty")).toBeVisible({ timeout: 10_000 });

    // HR
    await loginAs("hr");
    await page.goto("/report");
    await expect(page.getByTestId("nav-report")).toBeVisible({ timeout: 10_000 });

    // Admin
    await loginAs("admin");
    await page.goto("/report");
    await expect(page.getByTestId("nav-report")).toBeVisible({ timeout: 10_000 });
  }
);

// ── Scenario B ─────────────────────────────────────────────────────────────
test(
  "#E9d-5 tabella pivot con dati: report-table, 2 connettori, totale 20h",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedRes = await request.post("/api/_test/seed-report-data", {
      data: { email: "employee@sixfeetup.it" },
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/report");

    // Tabella visibile
    const table = page.getByTestId("report-table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // 2 righe progetto (Alpha + Beta)
    await expect(page.getByTestId("report-row")).toHaveCount(2);

    // Colonne connettore nell'intestazione
    const thead = table.locator("thead");
    await expect(thead).toContainText("odoo-report");
    await expect(thead).toContainText("jira-report");

    // Totale 20.0 nel footer
    const tfoot = table.locator("tfoot");
    await expect(tfoot).toContainText("20.0");
  }
);

// ── Scenario C ─────────────────────────────────────────────────────────────
test(
  "#E9d-5 drill-down Giorno: popover chooser → L1 date → L2 task",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedRes = await request.post("/api/_test/seed-report-data", {
      data: { email: "employee@sixfeetup.it" },
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/report");
    await expect(page.getByTestId("report-table")).toBeVisible({ timeout: 10_000 });

    // Click sul trigger della riga Alpha → popover visibile
    await page.getByTestId("proj-trigger-Alpha").click();
    await expect(page.locator(".dim-pop")).toBeVisible({ timeout: 5_000 });

    // Seleziona "Giorno" → sub-righe L1 con date
    await page.getByTestId("dim-opt-date").click();
    const l1Rows = page.getByTestId("report-l1-row");
    await expect(l1Rows.first()).toBeVisible({ timeout: 5_000 });

    // Alpha ha 2 date distinte (01/06 e 02/06) → almeno 1 riga L1
    const l1Count = await l1Rows.count();
    expect(l1Count).toBeGreaterThanOrEqual(1);

    // Click sulla prima riga L1 → righe L2 con task visibili
    await l1Rows.first().click();
    await expect(page.locator(".rpt-l2").first()).toBeVisible({ timeout: 5_000 });
  }
);

// ── Scenario D ─────────────────────────────────────────────────────────────
test(
  "#E9d-5 drill-down Task + comprimi: popover → L1 task → collapse",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedRes = await request.post("/api/_test/seed-report-data", {
      data: { email: "employee@sixfeetup.it" },
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/report");
    await expect(page.getByTestId("report-table")).toBeVisible({ timeout: 10_000 });

    // Apri popover Alpha → seleziona Task
    await page.getByTestId("proj-trigger-Alpha").click();
    await expect(page.locator(".dim-pop")).toBeVisible();
    await page.getByTestId("dim-opt-task").click();

    // L1 con task (Dev, Review)
    const l1Rows = page.getByTestId("report-l1-row");
    await expect(l1Rows.first()).toBeVisible({ timeout: 5_000 });
    const l1Count = await l1Rows.count();
    expect(l1Count).toBeGreaterThanOrEqual(2);

    // Riapri popover → comprimi
    await page.getByTestId("proj-trigger-Alpha").click();
    await expect(page.locator(".dim-pop")).toBeVisible();
    await page.getByTestId("dim-opt-collapse").click();

    // Alpha torna collassata — nessuna riga L1 visibile
    await expect(page.getByTestId("report-l1-row")).not.toBeVisible({ timeout: 5_000 });
  }
);

// ── Scenario E ─────────────────────────────────────────────────────────────
test(
  "#E9d-5 filtri: periodo mese corrente → empty; connettore → pill active; reset",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedRes = await request.post("/api/_test/seed-report-data", {
      data: { email: "employee@sixfeetup.it" },
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/report");
    await expect(page.getByTestId("report-table")).toBeVisible({ timeout: 10_000 });

    // Filtro periodo: mese corrente (luglio 2026) → dati di giugno esclusi → empty
    await page.getByTestId("period-thisMonth").click();
    await expect(page.getByTestId("report-empty")).toBeVisible({ timeout: 5_000 });

    // Reset → tabella torna visible
    await page.getByTestId("report-filters-reset").click();
    await expect(page.getByTestId("report-table")).toBeVisible({ timeout: 5_000 });

    // Filtro connettore: apri popover → seleziona prima opzione reale (nth 1, skip "Tutti")
    await page.getByTestId("filter-connector").click();
    await expect(page.getByTestId("filter-connector-pop")).toBeVisible();
    await page.locator('[data-testid="filter-connector-pop"] button').nth(1).click();

    // Pill connettore diventa .active
    await expect(page.getByTestId("filter-connector")).toHaveClass(/active/);

    // Reset rimuove active e ripristina tabella
    await page.getByTestId("report-filters-reset").click();
    await expect(page.getByTestId("filter-connector")).not.toHaveClass(/active/);
    await expect(page.getByTestId("report-table")).toBeVisible();
  }
);

// ── Scenario F ─────────────────────────────────────────────────────────────
test(
  "#E9d-5 isolamento utente: i dati di hr non compaiono per employee",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    // Seed dati per hr (utente diverso da employee)
    const seedRes = await request.post("/api/_test/seed-report-data", {
      data: { email: "hr@sixfeetup.it" },
    });
    expect(seedRes.ok()).toBeTruthy();

    // Employee non deve vedere i dati di hr
    await loginAs("employee");
    await page.goto("/report");
    await expect(page.getByTestId("report-empty")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("report-table")).not.toBeAttached();
  }
);
