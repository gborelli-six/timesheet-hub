/**
 * Global setup Playwright — ADR-003-B/C.
 *
 * Eseguito una volta prima di tutti i test:
 *  1. Crea e2e/.auth/ con file storageState vuoti per-ruolo (stub E1).
 *     In E3 questi file saranno sovrascritti dal loginAs reale.
 *  2. Genera le fixture Excel con marcatori E2E__ (ADR-003-D).
 */
import { FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";
import { generateE2EFixtures } from "./fixtures/generate";

const AUTH_DIR = path.join(__dirname, ".auth");
const ROLES = ["employee", "hr", "admin"] as const;

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // 1. Crea .auth/ e storageState vuoti per-ruolo
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  for (const role of ROLES) {
    const stateFile = path.join(AUTH_DIR, `${role}.json`);
    if (!fs.existsSync(stateFile)) {
      // storageState vuoto: nessun cookie, nessun token.
      // I test smoke non lo usano; i test funzionali (E3+) lo sovrascriveranno
      // tramite la fixture loginAs dopo che POST /_test/session è operativo.
      fs.writeFileSync(
        stateFile,
        JSON.stringify({ cookies: [], origins: [] }, null, 2)
      );
    }
  }

  // 2. Genera fixture Excel (no binari nel repo, generate a runtime)
  await generateE2EFixtures();

  console.log("[global-setup] Completato: .auth/ predisposta, fixture Excel generate.");
}
