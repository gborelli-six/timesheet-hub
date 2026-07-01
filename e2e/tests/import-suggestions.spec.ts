/**
 * Import Suggestions E2E — STORY-E8a-6.
 *
 * Scenario: la seconda importazione suggerisce le associazioni dallo storico.
 *
 * Strategia: POST /_test/seed-mapping inietta un mapping preesistente nel DB
 * senza eseguire una prima importazione via UI. Il test verifica che l'apertura
 * dello step 2 del wizard mostri chip "Suggerito", alert pre-compilato e banner
 * nel modal. La rimozione di un connettore nel modal fa sparire il badge.
 *
 * Fixture: suggestions.xlsx (generata da e2e/fixtures/generate.ts)
 *   Riga 0 → Alpha Project / Development (corrisponde al mapping iniettato)
 *   Riga 1 → Beta Project / Review (nessun mapping → nessun suggerimento)
 */
import path from "path";
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const XLSX_DIR = path.join(__dirname, "..", "fixtures", "xlsx");

const SEED_PAYLOAD = {
  email: "employee@sixfeetup.it",
  connector_label: "odoo-test",
  service: "odoo",
  excel_project: "Alpha Project",
  excel_task: "Development",
  remote_project_id: "1",
  remote_project_name: "Progetto Alpha",
  remote_task_id: "101",
  remote_task_name: "Task Frontend",
};

test.beforeEach(async ({ request }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true"
  );

  const resetRes = await request.post("/api/_test/reset");
  expect(resetRes.ok()).toBeTruthy();

  const seedRes = await request.post("/api/_test/seed-mapping", {
    data: SEED_PAYLOAD,
  });
  expect(seedRes.ok()).toBeTruthy();
});

test(
  "@smoke #E8a-6 seconda importazione mostra chip Suggerito e banner nel modal",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    // Step 1: carica suggestions.xlsx
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "suggestions.xlsx"));

    // Procede a Step 2
    const nextBtn = page.getByTestId("upload-btn-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Attende che i suggerimenti siano caricati per la riga 0
    await expect(page.getByTestId("suggested-icon-0-0")).toBeVisible({ timeout: 10_000 });

    // Alert "Assegnazioni pre-compilate" visibile
    await expect(page.getByTestId("preview-suggestions-alert")).toBeVisible();

    // Chip suggerito per la riga 0 visibile in PreviewTable
    await expect(page.getByTestId("conn-chip-0-0")).toBeVisible();

    // Riga 1 non ha chip suggerito (nessun mapping per Beta Project / Review)
    await expect(page.getByTestId("conn-chip-1-0")).not.toBeAttached();

    // Apre il modal per la riga 0 via pulsante edit
    await page.getByTestId("assign-edit-0").click();
    await expect(page.getByTestId("assign-modal")).toBeVisible();

    // Banner suggerimento visibile nel modal
    await expect(page.getByTestId("assign-modal-suggest-note")).toBeVisible();

    // Chip "Suggerito" sulla card 0 del modal
    await expect(page.getByTestId("assign-modal-card-0-chip-suggested")).toBeVisible();

    // Rimozione del connettore → il chip Suggerito scompare
    await page.getByTestId("assign-modal-card-0-remove").click();
    await expect(page.getByTestId("assign-modal-card-0-chip-suggested")).not.toBeAttached();

    // Il banner suggest-note scompare una volta rimosso l'unico suggerimento
    await expect(page.getByTestId("assign-modal-suggest-note")).not.toBeAttached();
  }
);
