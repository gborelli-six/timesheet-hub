/**
 * Excel Upload E2E — STORY-E6-5.
 *
 * Scenario #6: upload file con colonne non riconosciute → errore formato, nessuna navigazione a step 2
 * Scenario #7: upload file con anomalie → step 2 con badge warning e righe evidenziate
 * Scenario #8: back da step 2 → FileUpload in idle; re-upload happy.xlsx → 3 righe senza warning
 *
 * Fixture generate da e2e/fixtures/generate.ts:
 *   wrong-format.xlsx — header Cognome|Nome|Anno (nessuna colonna Ore → MISSING_PERIOD)
 *   anomalie.xlsx     — 3 righe: 1 valida, 2 con warning
 *   happy.xlsx        — 3 righe tutte valide (E2E__OK)
 */
import path from "path";
import { mergeTests, expect } from "@playwright/test";
import { test as base } from "@playwright/test";
import { authFixtures } from "@support/auth";

const test = mergeTests(base, authFixtures);

const XLSX_DIR = path.join(__dirname, "..", "fixtures", "xlsx");

test(
  "@excel #6 wrong-format.xlsx → errore formato, nessuna navigazione a step 2",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "wrong-format.xlsx"));

    const errorAlert = page.getByTestId("import-format-error");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("Formato non riconosciuto");

    // Nessun pulsante "Avanti" — siamo ancora a step 1
    await expect(page.getByTestId("preview-btn-next")).not.toBeAttached();
  }
);

test(
  "@excel #7 anomalie.xlsx → step 2 con 1 valida · 2 con warning",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "anomalie.xlsx"));
    // Dal wizard multi-step di E8a il passaggio alla preview richiede un click
    // esplicito: il parsing da solo non avanza più.
    await page.getByTestId("upload-btn-next").click();

    const alert = page.getByTestId("preview-warning-alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("1 riga valida");
    await expect(alert).toContainText("2 righe con warning");

    const warningRows = page.getByTestId("preview-row-warning");
    await expect(warningRows).toHaveCount(2);
  }
);

test(
  "@excel #8 back da step 2 → idle; re-upload happy.xlsx → 3 righe senza warning",
  async ({ loginAs, page }) => {
    test.skip(
      process.env.E2E_TEST_MODE !== "true",
      "Richiede E2E_TEST_MODE=true"
    );

    await loginAs("employee");
    await page.goto("/import");

    // Prima upload — va a step 2 (dopo il click esplicito su Avanti, E8a)
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "anomalie.xlsx"));
    await page.getByTestId("upload-btn-next").click();
    await expect(page.getByTestId("preview-btn-back")).toBeVisible();

    // Torna a step 1
    await page.getByTestId("preview-btn-back").click();

    // FileUpload è tornato in stato idle (dropzone visibile)
    await expect(page.getByTestId("file-upload-dropzone")).toBeVisible();

    // Seconda upload — happy.xlsx senza anomalie
    await page
      .getByTestId("file-upload-input")
      .setInputFiles(path.join(XLSX_DIR, "happy.xlsx"));
    await page.getByTestId("upload-btn-next").click();

    // Nessun alert warning e nessuna riga evidenziata
    await expect(page.getByTestId("preview-warning-alert")).not.toBeAttached();
    await expect(page.getByTestId("preview-row-warning")).toHaveCount(0);
  }
);
