/**
 * "Precompila righe simili" E2E — enhancement E8a.
 *
 * Scenario: alla prima importazione (o per progetti/attività nuovi non ancora
 * nello storico) l'utente assegna manualmente una riga e propaga l'assegnazione
 * alle altre righe vuote con la stessa coppia (progetto, task) tramite il
 * pulsante "Precompila righe simili" nello Step 2.
 *
 * Strategia: POST /_test/seed-mapping inietta SOLO il connettore odoo-fill-test (il
 * mapping seminato usa una coppia progetto/task NON presente nella fixture, così
 * nessun suggerimento da storico compare e tutte le righe partono vuote). La
 * riga 0 viene assegnata a mano via modal (autocomplete stub), poi il pulsante
 * propaga i connettori alla riga 1 (stessa chiave) ma NON alla riga 2 (diversa).
 *
 * Fixture: fill-similar.xlsx (generata da e2e/fixtures/generate.ts)
 *   Riga 0 → Fill Alpha / Shared Task  (assegnata manualmente)
 *   Riga 1 → Fill Alpha / Shared Task  (deve essere precompilata dalla 0)
 *   Riga 2 → Fill Beta / Other Task    (chiave diversa → NON toccata)
 */
import path from "path";
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const XLSX_DIR = path.join(__dirname, "..", "fixtures", "xlsx");

// Mapping seminato deliberatamente NON corrispondente alla fixture: serve solo a
// creare il connettore odoo-fill-test, senza innescare suggerimenti da storico.
const SEED_PAYLOAD = {
  email: "employee@sixfeetup.it",
  connector_label: "odoo-fill-test",
  service: "odoo",
  excel_project: "History Only Project",
  excel_task: "History Only Task",
  remote_project_id: "1",
  remote_project_name: "Progetto Alpha",
  remote_task_id: "101",
  remote_task_name: "Task Frontend",
};

test.beforeEach(async ({ request }) => {
  test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");

  const resetRes = await request.post("/api/_test/reset");
  expect(resetRes.ok()).toBeTruthy();

  const seedRes = await request.post("/api/_test/seed-mapping", {
    data: SEED_PAYLOAD,
  });
  expect(seedRes.ok()).toBeTruthy();
});

test(
  "@smoke #E8a-fill-similar precompila righe simili dalle righe già assegnate in pagina",
  async ({ loginAs, page }) => {
    test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");

    await loginAs("employee");
    await page.goto("/import");

    // Step 1: carica fill-similar.xlsx
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "fill-similar.xlsx"));

    const nextBtn = page.getByTestId("upload-btn-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Nessun suggerimento da storico: tutte le righe partono vuote e il pulsante
    // è disabilitato (nessuna riga assegnata da cui dedurre).
    const fillBtn = page.getByTestId("preview-btn-fill-similar");
    await expect(fillBtn).toBeDisabled();
    await expect(page.getByTestId("preview-fill-similar-hint")).toContainText(
      "Assegna almeno una riga",
    );
    await expect(page.getByTestId("conn-chip-0-0")).not.toBeAttached();

    // Assegna manualmente la riga 0 tramite il modal.
    await page.getByTestId("assign-trigger-0").click();
    await expect(page.getByTestId("assign-modal")).toBeVisible();

    // Aggiunge una card connettore (odoo-fill-test viene auto-selezionato: è l'unico).
    await page.getByTestId("assign-modal-btn-add").click();
    await expect(page.getByTestId("assign-modal-card-0")).toBeVisible();

    // Progetto remoto: cerca e seleziona "Progetto Alpha" dallo stub.
    const projectInput = page
      .getByTestId("assign-modal-card-0-project-autocomplete")
      .locator("input");
    await projectInput.click();
    await projectInput.fill("Alpha");
    const projectOption = page.getByRole("option", { name: "Progetto Alpha" });
    await expect(projectOption).toBeVisible({ timeout: 8_000 });
    await projectOption.click();

    // Task remoto: seleziona "Task Frontend".
    const taskInput = page
      .getByTestId("assign-modal-card-0-task-autocomplete")
      .locator("input");
    await taskInput.click();
    const taskOption = page.getByRole("option", { name: "Task Frontend" });
    await expect(taskOption).toBeVisible({ timeout: 8_000 });
    await taskOption.click();

    // Conferma: il modal si chiude e il chip compare sulla riga 0.
    const saveBtn = page.getByTestId("assign-modal-btn-save");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(page.getByTestId("assign-modal")).not.toBeAttached();
    await expect(page.getByTestId("conn-chip-0-0")).toBeVisible();

    // Ora il pulsante è abilitato: la riga 1 (stessa chiave) è precompilabile.
    await expect(fillBtn).toBeEnabled();
    await expect(page.getByTestId("preview-fill-similar-hint")).toContainText(
      "possono essere precompilate",
    );

    // Precompila.
    await fillBtn.click();

    // Riga 1 precompilata con chip suggerito.
    await expect(page.getByTestId("conn-chip-1-0")).toBeVisible();
    await expect(page.getByTestId("suggested-icon-1-0")).toBeVisible();

    // Riga 2 (chiave diversa) resta vuota.
    await expect(page.getByTestId("conn-chip-2-0")).not.toBeAttached();

    // Esaurite le righe simili, il pulsante torna disabilitato.
    await expect(fillBtn).toBeDisabled();
  },
);
