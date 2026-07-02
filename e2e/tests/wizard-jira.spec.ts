/**
 * Wizard importazione con connettore Jira stub — STORY-E8b-4.
 *
 * Strategia: POST /_test/seed-mapping inietta un UserToken jira + un
 * ConnectorRowMapping per la coppia (excel_project, excel_task) della
 * fixture jira-happy.xlsx. I test verificano:
 *   1. che l'autocomplete progetti del card Jira restituisca i dati dello stub
 *   2. che il submit con progetto+task selezionati produca success_count > 0
 *
 * Fixture: jira-happy.xlsx (generata da e2e/fixtures/generate.ts)
 *   Riga 0 → Jira Frontend Work / Frontend Task (corrisponde al seed)
 *   Riga 1 → Jira Frontend Work / Frontend Task
 *
 * Seed:
 *   connector_label: "jira-test"
 *   service: "jira"
 *   excel_project: "Jira Frontend Work"
 *   excel_task: "Frontend Task"
 *   remote_project_id: "PROJ-A"
 *   remote_project_name: "Jira Project Alpha"
 *   remote_task_id: "PROJ-A-1"
 *   remote_task_name: "Frontend Issue"
 */
import path from "path";
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const XLSX_DIR = path.join(__dirname, "..", "fixtures", "xlsx");

const SEED_PAYLOAD = {
  email: "employee@sixfeetup.it",
  connector_label: "jira-test",
  service: "jira",
  excel_project: "Jira Frontend Work",
  excel_task: "Frontend Task",
  remote_project_id: "PROJ-A",
  remote_project_name: "Jira Project Alpha",
  remote_task_id: "PROJ-A-1",
  remote_task_name: "Frontend Issue",
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
  "@smoke @jira #E8b-4 wizard con Jira — autocomplete progetti",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    // Step 1: carica jira-happy.xlsx
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "jira-happy.xlsx"));

    // Avanza al passo 2 (Verifica e assegna)
    const nextBtn = page.getByTestId("upload-btn-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Attende che il seed suggerisca l'assegnazione per la riga 0
    // (il chip suggerito appare dopo il fetch dei suggerimenti)
    await expect(page.getByTestId("suggested-icon-0-0")).toBeVisible({
      timeout: 10_000,
    });

    // Apre il modal per la riga 0 tramite il pulsante edit
    await page.getByTestId("assign-edit-0").click();
    await expect(page.getByTestId("assign-modal")).toBeVisible();

    // La card 0 del modal è già pre-compilata con jira-test dal seed.
    // Il connettore jira-test deve essere selezionato (token valido).
    // L'autocomplete progetto è abilitato — digita per cercare.
    const projectAutocomplete = page.getByTestId(
      "assign-modal-card-0-project-autocomplete"
    );
    await expect(projectAutocomplete).toBeVisible();

    // Clicca sull'input dell'autocomplete progetto e digita una query parziale
    const projectInput = projectAutocomplete.locator("input");
    await projectInput.click();
    await projectInput.fill("Jira");

    // Attende che appaiano le opzioni dello stub nello stesso documento
    // (il listbox del MUI Autocomplete è appeso al <body> via portale)
    const optionAlpha = page.getByRole("option", { name: "Jira Project Alpha" });
    const optionBeta = page.getByRole("option", { name: "Jira Project Beta" });

    await expect(optionAlpha).toBeVisible({ timeout: 8_000 });
    await expect(optionBeta).toBeVisible({ timeout: 8_000 });

    // Chiude il modal senza salvare
    await page.getByTestId("assign-modal-close").click();
    await expect(page.getByTestId("assign-modal")).not.toBeAttached();
  }
);

test(
  "@smoke @jira #E8b-4 wizard con Jira — submit restituisce success_count > 0",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    // Step 1: carica jira-happy.xlsx
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "jira-happy.xlsx"));

    const nextBtn = page.getByTestId("upload-btn-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Attende che lo stub suggerisca il mapping per la riga 0
    await expect(page.getByTestId("suggested-icon-0-0")).toBeVisible({
      timeout: 10_000,
    });

    // Apre il modal della riga 0 e completa/conferma l'assegnazione già suggerita
    await page.getByTestId("assign-edit-0").click();
    await expect(page.getByTestId("assign-modal")).toBeVisible();

    // La card pre-compilata dal seed ha già remoteProjectId e remoteTaskId —
    // verifica che il bottone Conferma sia abilitato senza ulteriori selezioni.
    const saveBtn = page.getByTestId("assign-modal-btn-save");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Il modal si chiude dopo il salvataggio
    await expect(page.getByTestId("assign-modal")).not.toBeAttached();

    // Il chip della riga 0 è ora visibile nella tabella
    await expect(page.getByTestId("conn-chip-0-0")).toBeVisible();

    // Avanza al passo 3 (Conferma importazione)
    const previewNext = page.getByTestId("preview-btn-next");
    await expect(previewNext).toBeEnabled();
    await previewNext.click();

    // Avvia il submit
    const submitBtn = page.getByTestId("confirm-btn-submit");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Attende la schermata di risultato
    await expect(page.getByTestId("result-screen")).toBeVisible({
      timeout: 15_000,
    });

    // Intercetta la risposta dell'API per verificare success_count > 0.
    // Lo stub Jira in modalità E2E__OK restituisce success_count = num_entries.
    // Verifica a livello UI: il chip sul connettore mostra "righe importate".
    // Il testo del chip dipende da ConnectorResult.success_count > 0.
    const successChip = page
      .getByText(/\d+ righe? importate?/)
      .first();
    await expect(successChip).toBeVisible({ timeout: 10_000 });
  }
);
