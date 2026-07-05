/**
 * Filtri Step 2 "Verifica ed Assegna" E2E — epica E9c (STORY-E9c-6).
 *
 * Copre gli scenari principali dei filtri per data/progetto/task nella tabella
 * dello Step 2 del wizard di importazione (icone imbuto, Opzione C):
 *   1. filtro singolo per progetto
 *   2. filtri combinati (progetto + task, AND)
 *   3. reset filtri
 *   4. assegnazione con filtro attivo (indice originale preservato)
 *   5. precompila righe simili con filtro attivo (righe nascoste comunque precompilate)
 *
 * Fixture: filters.xlsx (generata da e2e/fixtures/generate.ts)
 *   8 righe · progetti Alpha/Beta/Gamma · task Dev/Review/QA · date 06-01/02/03.
 *
 * Il seed-mapping inietta SOLO il connettore odoo-filters-test con una coppia
 * progetto/task NON presente nella fixture: nessun suggerimento da storico, tutte
 * le righe partono vuote.
 */
import path from "path";
import { mergeTests, expect } from "@playwright/test";
import { test as base, type Page } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const XLSX_DIR = path.join(__dirname, "..", "fixtures", "xlsx");

const SEED_PAYLOAD = {
  email: "employee@sixfeetup.it",
  connector_label: "odoo-filters-test",
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

  const seedRes = await request.post("/api/_test/seed-mapping", { data: SEED_PAYLOAD });
  expect(seedRes.ok()).toBeTruthy();
});

/** Carica filters.xlsx e avanza allo Step 2. */
async function gotoStep2(page: Page): Promise<void> {
  await page.goto("/import");
  await page.getByTestId("file-upload-input").setInputFiles(path.join(XLSX_DIR, "filters.xlsx"));
  const nextBtn = page.getByTestId("upload-btn-next");
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();
  // Prima riga visibile → Step 2 renderizzato.
  await expect(page.getByTestId("assign-trigger-0")).toBeVisible();
}

/** Seleziona un valore (per testo) in un imbuto colonna e chiude il popover. */
async function selectFilterValue(page: Page, filterTestId: string, value: string): Promise<void> {
  await page.getByTestId(filterTestId).click();
  const menu = page.getByTestId(`${filterTestId}-menu`);
  await expect(menu).toBeVisible();
  await menu.getByText(value, { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
}

/**
 * Seleziona l'opzione all'indice indicato (per posizione) in un imbuto colonna.
 * Utile per le date, il cui testo dipende dal locale del browser: le opzioni sono
 * ordinate cronologicamente, quindi index 0 = data più antica.
 */
async function selectFilterOptionByIndex(
  page: Page,
  filterTestId: string,
  index: number,
): Promise<void> {
  await page.getByTestId(filterTestId).click();
  const menu = page.getByTestId(`${filterTestId}-menu`);
  await expect(menu).toBeVisible();
  // Le opzioni sono ListItemButton (role="button"); l'ordine riflette distinctDates.
  await menu.getByRole("button").nth(index).click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
}

/** Assegna il connettore stub odoo alla riga indicata tramite l'AssignModal. */
async function assignRow(page: Page, rowIndex: number): Promise<void> {
  await page.getByTestId(`assign-trigger-${rowIndex}`).click();
  await expect(page.getByTestId("assign-modal")).toBeVisible();

  await page.getByTestId("assign-modal-btn-add").click();
  await expect(page.getByTestId("assign-modal-card-0")).toBeVisible();

  const projectInput = page.getByTestId("assign-modal-card-0-project-autocomplete").locator("input");
  await projectInput.click();
  await projectInput.fill("Alpha");
  const projectOption = page.getByRole("option", { name: "Progetto Alpha" });
  await expect(projectOption).toBeVisible({ timeout: 8_000 });
  await projectOption.click();

  const taskInput = page.getByTestId("assign-modal-card-0-task-autocomplete").locator("input");
  await taskInput.click();
  const taskOption = page.getByRole("option", { name: "Task Frontend" });
  await expect(taskOption).toBeVisible({ timeout: 8_000 });
  await taskOption.click();

  const saveBtn = page.getByTestId("assign-modal-btn-save");
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();
  await expect(page.getByTestId("assign-modal")).not.toBeAttached();
}

test("@smoke #E9c-6 filtro singolo per progetto mostra solo le righe del progetto", async ({
  loginAs,
  page,
}) => {
  test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");
  await loginAs("employee");
  await gotoStep2(page);

  await selectFilterValue(page, "column-filter-project", "Alpha");

  // Alpha → righe 0,1,2 visibili; 3..7 nascoste.
  await expect(page.getByTestId("assign-trigger-0")).toBeVisible();
  await expect(page.getByTestId("assign-trigger-1")).toBeVisible();
  await expect(page.getByTestId("assign-trigger-2")).toBeVisible();
  await expect(page.getByTestId("assign-trigger-3")).not.toBeAttached();
  await expect(page.getByTestId("assign-trigger-5")).not.toBeAttached();

  await expect(page.getByTestId("filter-count")).toHaveText("Mostrate 3 di 8 righe");
});

test("#E9c-6 filtri combinati progetto + task (AND)", async ({ loginAs, page }) => {
  test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");
  await loginAs("employee");
  await gotoStep2(page);

  await selectFilterValue(page, "column-filter-project", "Alpha");
  await selectFilterValue(page, "column-filter-task", "Dev");

  // Alpha ∧ Dev → righe 0 e 2.
  await expect(page.getByTestId("assign-trigger-0")).toBeVisible();
  await expect(page.getByTestId("assign-trigger-2")).toBeVisible();
  await expect(page.getByTestId("assign-trigger-1")).not.toBeAttached();
  await expect(page.getByTestId("filter-count")).toHaveText("Mostrate 2 di 8 righe");
});

test("#E9c-6 reset filtri ripristina tutte le righe", async ({ loginAs, page }) => {
  test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");
  await loginAs("employee");
  await gotoStep2(page);

  await selectFilterValue(page, "column-filter-project", "Gamma");
  await expect(page.getByTestId("filter-count")).toHaveText("Mostrate 2 di 8 righe");

  await page.getByTestId("filter-reset").click();

  await expect(page.getByTestId("filter-count")).not.toBeAttached();
  await expect(page.getByTestId("assign-trigger-0")).toBeVisible();
  await expect(page.getByTestId("assign-trigger-7")).toBeVisible();
});

test("@smoke #E9c-6 assegnazione con filtro attivo preserva l'indice originale", async ({
  loginAs,
  page,
}) => {
  test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");
  await loginAs("employee");
  await gotoStep2(page);

  // Filtra per Beta (righe 3,4,5) e assegna la prima riga visibile (indice 3).
  await selectFilterValue(page, "column-filter-project", "Beta");
  await assignRow(page, 3);
  await expect(page.getByTestId("conn-chip-3-0")).toBeVisible();

  // Rimuovi il filtro: l'assegnazione è sulla riga corretta (indice 3), non sulla 0.
  await page.getByTestId("filter-reset").click();
  await expect(page.getByTestId("conn-chip-3-0")).toBeVisible();
  await expect(page.getByTestId("conn-chip-0-0")).not.toBeAttached();

  // Badge globale "righe pronte" aggiornato a 1/8.
  await expect(page.getByText("1/8 righe pronte")).toBeVisible();
});

test("#E9c-6 precompila righe simili con filtro attivo precompila anche righe nascoste", async ({
  loginAs,
  page,
}) => {
  test.skip(process.env.E2E_TEST_MODE !== "true", "Richiede E2E_TEST_MODE=true");
  await loginAs("employee");
  await gotoStep2(page);

  // Filtra per la data più antica (2026-06-01) → visibili righe 0 e 1. La riga 2
  // (Alpha/Dev, stessa chiave della 0) è nascosta.
  await selectFilterOptionByIndex(page, "column-filter-date", 0);
  await expect(page.getByTestId("filter-count")).toHaveText("Mostrate 2 di 8 righe");

  // Assegna la riga 0 (Alpha/Dev).
  await assignRow(page, 0);
  await expect(page.getByTestId("conn-chip-0-0")).toBeVisible();

  // Precompila: la riga 2 (nascosta, stessa chiave) viene precompilata.
  const fillBtn = page.getByTestId("preview-btn-fill-similar");
  await expect(fillBtn).toBeEnabled();
  await fillBtn.click();

  // Rimuovi il filtro: la riga 2 precompilata è visibile con chip suggerito.
  await page.getByTestId("filter-reset").click();
  await expect(page.getByTestId("conn-chip-2-0")).toBeVisible();
  await expect(page.getByTestId("suggested-icon-2-0")).toBeVisible();
});
