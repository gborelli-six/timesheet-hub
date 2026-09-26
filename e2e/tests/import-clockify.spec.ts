/**
 * Import da sorgente Clockify E2E — E13.
 *
 * Scenario: lo Step 0 del wizard aggiunge la scelta della sorgente. Oltre
 * all'upload Excel, l'utente può scaricare le voci da un connettore la cui
 * spec di servizio è dichiarata sorgente (oggi solo Clockify): sceglie un
 * periodo, il backend scarica le voci dallo StubSource e da lì il wizard
 * prosegue identico (preview, assegnazione multi-connettore, submit).
 *
 * Regola di prodotto verificata anche qui: lo Step 0 compare SOLO se
 * l'utente ha almeno un connettore-sorgente. Senza sorgenti il wizard parte
 * direttamente dall'upload Excel (StepBar a 3 step, come prima di E13) —
 * per questo gli scenari esistenti (excel-upload, wizard-jira,
 * import-suggestions, import-log), che seminano solo connettori
 * jira/odoo (destinazioni), continuano a valere senza modifiche.
 *
 * Dati dello StubSource (backend/app/sources/stub.py, marker E2E__OK):
 *   2026-06-01 · Progetto Alpha · Task Frontend · 7.5h
 *   2026-06-02 · Progetto Alpha · Task Backend  · 4.0h
 *   2026-06-03 · Progetto Beta  · Task Design   · 2.25h
 * Gli stessi progetti/task sono serviti dallo StubAdapter (destinazione), così
 * una riga scaricata si assegna a un connettore di destinazione stub senza
 * dati intermedi (Progetto Alpha id=1 / Task Frontend id=101 su odoo-test).
 */
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const SOURCE_LABEL = "clockify-test";
const DEST_LABEL = "odoo-test";

const SEED_SOURCE_OK = {
  email: "employee@sixfeetup.it",
  connector_label: SOURCE_LABEL,
  service: "clockify",
  account_identifier: "E2E__OK",
};

const SEED_DEST_OK = {
  email: "employee@sixfeetup.it",
  connector_label: DEST_LABEL,
  service: "odoo",
  account_identifier: "E2E__OK",
};

// Riga identificata dal testid, per leggere il contenuto della sua <tr> senza
// affidarsi a classi CSS: assign-trigger-{i} è presente su ogni riga scaricata
// finché non le viene assegnato un connettore.
function previewRow(page: import("@playwright/test").Page, index: number) {
  return page.getByTestId(`assign-trigger-${index}`).locator("xpath=ancestor::tr");
}

test.beforeEach(async ({ request }) => {
  test.skip(
    process.env.E2E_TEST_MODE !== "true",
    "Richiede E2E_TEST_MODE=true"
  );

  const resetRes = await request.post("/api/_test/reset");
  expect(resetRes.ok()).toBeTruthy();
});

test(
  "@smoke #E13 percorso completo: scarica da Clockify, assegna e importa",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedSource = await request.post("/api/_test/seed-connector", {
      data: SEED_SOURCE_OK,
    });
    expect(seedSource.ok()).toBeTruthy();
    const seedDest = await request.post("/api/_test/seed-connector", {
      data: SEED_DEST_OK,
    });
    expect(seedDest.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/import");

    // Step 0: la card Excel e quella del connettore-sorgente sono entrambe
    // presenti perché l'utente ha almeno un connettore sorgente.
    await expect(page.getByTestId("source-option-excel")).toBeVisible();
    const clockifyOption = page.getByTestId(`source-option-${SOURCE_LABEL}`);
    await expect(clockifyOption).toBeVisible();
    await clockifyOption.click();

    // Step "Periodo": imposta un periodo che copra tutte e 3 le righe fisse.
    await page.getByTestId("source-fetch-start").fill("2026-06-01");
    await page.getByTestId("source-fetch-end").fill("2026-06-30");
    await page.getByTestId("source-fetch-submit").click();

    const result = page.getByTestId("source-fetch-result");
    await expect(result).toBeVisible({ timeout: 10_000 });
    await expect(result).toContainText("3");

    const nextBtn = page.getByTestId("upload-btn-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Le 3 righe sono in preview, ciascuna ancora da assegnare (nessuno
    // storico di mapping per questo utente dopo il reset).
    await expect(page.getByTestId("assign-trigger-0")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("assign-trigger-1")).toBeVisible();
    await expect(page.getByTestId("assign-trigger-2")).toBeVisible();
    await expect(page.getByTestId("assign-trigger-3")).not.toBeAttached();

    // Contenuto atteso per ciascuna riga: data, progetto, task, ore.
    await expect(previewRow(page, 0)).toContainText("Progetto Alpha");
    await expect(previewRow(page, 0)).toContainText("Task Frontend");
    await expect(previewRow(page, 0)).toContainText("7.5");

    await expect(previewRow(page, 1)).toContainText("Progetto Alpha");
    await expect(previewRow(page, 1)).toContainText("Task Backend");
    await expect(previewRow(page, 1)).toContainText("4");

    await expect(previewRow(page, 2)).toContainText("Progetto Beta");
    await expect(previewRow(page, 2)).toContainText("Task Design");
    await expect(previewRow(page, 2)).toContainText("2.25");

    // Assegna la riga 0 al connettore di destinazione odoo-test.
    await page.getByTestId("assign-trigger-0").click();
    await expect(page.getByTestId("assign-modal")).toBeVisible();
    await page.getByTestId("assign-modal-btn-add").click();

    // "Aggiungi connettore" seleziona di default il primo connettore libero,
    // che può essere clockify-test (la sorgente stessa, che compare anche fra
    // le opzioni ma non ha un adapter di scrittura): seleziona esplicitamente
    // il connettore di destinazione odoo-test.
    await page.getByTestId("assign-modal-card-0-connector-odoo-test").click();

    const projectInput = page
      .getByTestId("assign-modal-card-0-project-autocomplete")
      .locator("input");
    await projectInput.click();
    await projectInput.fill("Alpha");
    const projectOption = page.getByRole("option", { name: "Progetto Alpha" });
    await expect(projectOption).toBeVisible({ timeout: 8_000 });
    await projectOption.click();

    const taskInput = page
      .getByTestId("assign-modal-card-0-task-autocomplete")
      .locator("input");
    await taskInput.click();
    await taskInput.fill("Frontend");
    const taskOption = page.getByRole("option", { name: "Task Frontend" });
    await expect(taskOption).toBeVisible({ timeout: 8_000 });
    await taskOption.click();

    const saveBtn = page.getByTestId("assign-modal-btn-save");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(page.getByTestId("assign-modal")).not.toBeAttached();
    await expect(page.getByTestId("conn-chip-0-0")).toBeVisible();

    // Avanza a Conferma e invia.
    const previewNext = page.getByTestId("preview-btn-next");
    await expect(previewNext).toBeEnabled();
    await previewNext.click();

    const submitBtn = page.getByTestId("confirm-btn-submit");
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    await expect(page.getByTestId("result-screen")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\d+ righe? importate?/).first()).toBeVisible({
      timeout: 10_000,
    });
  }
);

test(
  "#E13 il periodo selezionato filtra davvero le voci scaricate",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedSource = await request.post("/api/_test/seed-connector", {
      data: SEED_SOURCE_OK,
    });
    expect(seedSource.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/import");

    await page.getByTestId(`source-option-${SOURCE_LABEL}`).click();

    // Periodo ristretto a un solo giorno → solo la riga del 2026-06-02.
    await page.getByTestId("source-fetch-start").fill("2026-06-02");
    await page.getByTestId("source-fetch-end").fill("2026-06-02");
    await page.getByTestId("source-fetch-submit").click();

    const result = page.getByTestId("source-fetch-result");
    await expect(result).toBeVisible({ timeout: 10_000 });
    await expect(result).toContainText("1");

    await page.getByTestId("upload-btn-next").click();

    await expect(page.getByTestId("assign-trigger-0")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("assign-trigger-1")).not.toBeAttached();

    await expect(previewRow(page, 0)).toContainText("Progetto Alpha");
    await expect(previewRow(page, 0)).toContainText("Task Backend");
    await expect(previewRow(page, 0)).toContainText("4");
  }
);

test(
  "#E13 E2E__DOWN — backend non raggiungibile, con possibilità di riprovare",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedRes = await request.post("/api/_test/seed-connector", {
      data: { ...SEED_SOURCE_OK, account_identifier: "E2E__DOWN" },
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/import");

    await page.getByTestId(`source-option-${SOURCE_LABEL}`).click();
    await page.getByTestId("source-fetch-start").fill("2026-06-01");
    await page.getByTestId("source-fetch-end").fill("2026-06-03");
    await page.getByTestId("source-fetch-submit").click();

    const error = page.getByTestId("source-fetch-error");
    await expect(error).toBeVisible({ timeout: 10_000 });

    const retryBtn = page.getByTestId("source-fetch-retry");
    await expect(retryBtn).toBeVisible();
    // Non c'è alcun link di reautenticazione per un errore di raggiungibilità.
    await expect(page.getByTestId("source-fetch-reauth-link")).not.toBeAttached();

    // Il retry ripete la stessa chiamata: lo stub è ancora E2E__DOWN,
    // l'errore resta visibile senza che l'app vada in crash.
    await retryBtn.click();
    await expect(error).toBeVisible({ timeout: 10_000 });
  }
);

test(
  "#E13 E2E__EXPIRED — credenziali da aggiornare, con rimando al profilo",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    const seedRes = await request.post("/api/_test/seed-connector", {
      data: { ...SEED_SOURCE_OK, account_identifier: "E2E__EXPIRED" },
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/import");

    await page.getByTestId(`source-option-${SOURCE_LABEL}`).click();
    await page.getByTestId("source-fetch-start").fill("2026-06-01");
    await page.getByTestId("source-fetch-end").fill("2026-06-03");
    await page.getByTestId("source-fetch-submit").click();

    const error = page.getByTestId("source-fetch-error");
    await expect(error).toBeVisible({ timeout: 10_000 });

    const reauthLink = page.getByTestId("source-fetch-reauth-link");
    await expect(reauthLink).toBeVisible();
    await expect(reauthLink).toHaveAttribute("href", "/profile");
    // Un errore di credenziali non offre il retry immediato: va prima
    // aggiornato il token.
    await expect(page.getByTestId("source-fetch-retry")).not.toBeAttached();
  }
);

test(
  "#E13 senza connettori-sorgente lo Step 0 è assente: si parte dall'upload Excel",
  async ({ loginAs, page, request }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    // Solo un connettore di destinazione: nessuna sorgente disponibile.
    const seedRes = await request.post("/api/_test/seed-connector", {
      data: SEED_DEST_OK,
    });
    expect(seedRes.ok()).toBeTruthy();

    await loginAs("employee");
    await page.goto("/import");

    // Il wizard parte direttamente dallo step di upload, come prima di E13.
    await expect(page.getByTestId("file-upload-dropzone")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("source-option-excel")).not.toBeAttached();
    await expect(
      page.getByTestId(`source-option-${SOURCE_LABEL}`)
    ).not.toBeAttached();

    // Nessuno step "Indietro" verso una sorgente inesistente.
    await expect(page.getByTestId("input-btn-back")).not.toBeAttached();
  }
);
