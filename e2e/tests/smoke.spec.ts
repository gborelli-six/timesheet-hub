/**
 * Smoke E2E — E1 (build & boot)
 *
 * Verifica che lo stack sia avviato correttamente: backend /api/health 200 via
 * nginx proxy e frontend che serve index.html. NON testa il flusso auth
 * (richiede JWT reali, fuori scope E1 — completato in E3, ADR-003-B).
 */
import { test, expect } from "@playwright/test";

test("@smoke backend /api/health 200 via nginx proxy", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({ status: "ok" });
});

test("@smoke frontend serve index.html", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const contentType = response?.headers()["content-type"] ?? "";
  expect(contentType).toContain("text/html");
});
