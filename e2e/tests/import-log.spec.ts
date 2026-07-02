/**
 * Import Log E2E — STORY-E9a-7.
 *
 * Scenario #13 (@smoke): un'importazione con una riga E2E__FAIL genera un log
 *   immediatamente consultabile via bottone "Log dettagliato" e via /log;
 *   il dettaglio mostra il messaggio d'errore della riga fallita.
 *
 * Scenario #15: con storageState Employee, la lista dei log mostra solo i
 *   propri log; un log seedato per hr@sixfeetup.it non compare.
 *
 * Strategia:
 *   #13 — esegue il wizard completo con partial.xlsx (E2E__FAIL su riga 1);
 *          verifica result-screen → click "Log dettagliato" → /log/{id} con row-error;
 *          poi verifica che /log mostri la riga nella lista.
 *   #15 — POST /_test/seed-import-log per hr; login employee; /log vuota.
 *
 * Fixture: partial.xlsx (generata da e2e/fixtures/generate.ts)
 *   Riga 0 → E2E__OK / development / 8h  (successo)
 *   Riga 1 → E2E__OK / E2E__FAIL / 4h    (fallita — riga rifiutata dal backend)
 */
import path from "path";
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const XLSX_DIR = path.join(__dirname, "..", "fixtures", "xlsx");

// Seed per entrambe le righe di partial.xlsx tramite connector odoo-test.
// seed-mapping crea anche il UserToken se assente.
const SEED_ROW_0 = {
  email: "employee@sixfeetup.it",
  connector_label: "odoo-test",
  service: "odoo",
  excel_project: "E2E__OK",
  excel_task: "development",
  remote_project_id: "1",
  remote_project_name: "E2E Project",
  remote_task_id: "101",
  remote_task_name: "E2E Dev Task",
};

const SEED_ROW_1 = {
  ...SEED_ROW_0,
  excel_task: "E2E__FAIL",
  remote_task_id: "102",
  remote_task_name: "E2E Fail Task",
};

test.beforeEach(async ({ request }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true"
  );

  const resetRes = await request.post("/api/_test/reset");
  expect(resetRes.ok()).toBeTruthy();

  const seed0 = await request.post("/api/_test/seed-mapping", { data: SEED_ROW_0 });
  expect(seed0.ok()).toBeTruthy();

  const seed1 = await request.post("/api/_test/seed-mapping", { data: SEED_ROW_1 });
  expect(seed1.ok()).toBeTruthy();
});

test(
  "@smoke #E9a-7 import parziale genera log consultabile via bottone e via /log",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    // Step 1: carica partial.xlsx
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "partial.xlsx"));

    const nextBtn = page.getByTestId("upload-btn-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Attende che il seed suggerisca l'assegnazione per entrambe le righe
    await expect(page.getByTestId("suggested-icon-0-0")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("suggested-icon-1-0")).toBeVisible({ timeout: 10_000 });

    // Avanza al passo 3 (Conferma importazione)
    const previewNext = page.getByTestId("preview-btn-next");
    await expect(previewNext).toBeEnabled();
    await previewNext.click();

    // Avvia il submit
    const submitBtn = page.getByTestId("confirm-btn-submit");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Attende la schermata di risultato
    await expect(page.getByTestId("result-screen")).toBeVisible({ timeout: 15_000 });

    // --- verifica via bottone "Log dettagliato" ---
    await page.getByTestId("result-go-to-log").click();

    // La pagina di dettaglio è raggiungibile e mostra un import_id valido in URL
    await expect(page).toHaveURL(/\/log\/[0-9a-f-]+$/, { timeout: 10_000 });
    await expect(page.getByTestId("detail-container")).toBeVisible();

    // Il messaggio d'errore della riga fallita è visibile
    await expect(page.getByTestId("row-error").first()).toBeVisible();

    // --- verifica via /log ---
    await page.goto("/log");
    await expect(page.getByTestId("log-table")).toBeVisible({ timeout: 10_000 });

    // Almeno una riga visibile (l'import appena eseguito)
    await expect(page.getByTestId("log-row").first()).toBeVisible();
  }
);

test(
  "#E9a-7 employee vede solo i propri log: log seedato per hr non compare",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    // Seed un import log per hr (utente diverso dall'employee)
    const seedRes = await request.post("/api/_test/seed-import-log", {
      data: { email: "hr@sixfeetup.it" },
    });
    expect(seedRes.ok()).toBeTruthy();

    // Login come employee e naviga alla lista log
    await loginAs("employee");
    await page.goto("/log");

    // Dopo il reset in beforeEach, employee non ha log propri → lista vuota
    await expect(page.getByTestId("log-empty")).toBeVisible({ timeout: 10_000 });

    // Nessuna riga della tabella visibile (il log di hr è invisibile)
    await expect(page.getByTestId("log-row")).not.toBeAttached();
  }
);
