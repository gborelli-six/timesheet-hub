/**
 * Genera le fixture Excel con marcatori E2E__ (ADR-003-D).
 * Invocato da global-setup.ts — nessun file binario committato nel repo.
 *
 * Marcatori ADR-003-D:
 *   E2E__OK       → progetto con importazione attesa al 100%
 *   E2E__FAIL     → task con una riga rifiutata dal backend esterno
 *   E2E__EXPIRED  → utente con token scaduto (401 dallo stub adapter)
 *   E2E__DOWN     → progetto verso backend non raggiungibile (503)
 *
 * Fixture prodotte (in fixtures/xlsx/):
 *   happy.xlsx    — tutto ok (E2E__OK)
 *   partial.xlsx  — successo parziale (task E2E__FAIL)
 *   expired.xlsx  — token scaduto (utente E2E__EXPIRED, E3+)
 *   down.xlsx     — backend down (E2E__DOWN)
 *   wrong.xlsx    — formato non conforme (no header standard)
 */
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const XLSX_DIR = path.join(__dirname, "xlsx");

interface TimesheetRow {
  date: string;
  project: string;
  task: string;
  hours: number;
  notes?: string;
}

export async function generateE2EFixtures(): Promise<void> {
  if (!fs.existsSync(XLSX_DIR)) {
    fs.mkdirSync(XLSX_DIR, { recursive: true });
  }

  await writeFixture("happy.xlsx", [
    { date: "2026-01-15", project: "E2E__OK", task: "development", hours: 8 },
    { date: "2026-01-16", project: "E2E__OK", task: "review", hours: 4 },
    { date: "2026-01-17", project: "E2E__OK", task: "testing", hours: 2 },
  ]);

  await writeFixture("partial.xlsx", [
    { date: "2026-01-15", project: "E2E__OK", task: "development", hours: 8 },
    { date: "2026-01-16", project: "E2E__OK", task: "E2E__FAIL", hours: 4, notes: "riga rifiutata" },
  ]);

  await writeFixture("expired.xlsx", [
    { date: "2026-01-15", project: "E2E__OK", task: "development", hours: 8, notes: "utente E2E__EXPIRED" },
  ]);

  await writeFixture("down.xlsx", [
    { date: "2026-01-15", project: "E2E__DOWN", task: "development", hours: 8 },
  ]);

  await writeWrongFormatFixture("wrong.xlsx");

  // E6-5: fixture per i test di parsing lato client
  await writeWrongColumnFixture("wrong-format.xlsx");
  await writeAnomalieFixture("anomalie.xlsx");

  // E8a-6: fixture per il test dei suggerimenti da storico
  await writeFixture("suggestions.xlsx", [
    { date: "2026-03-01", project: "Alpha Project", task: "Development", hours: 8, notes: "" },
    { date: "2026-03-02", project: "Beta Project", task: "Review", hours: 4, notes: "" },
  ]);

  // E8b: fixture per il test del wizard con connettore Jira stub
  // excel_project/excel_task devono corrispondere al seed-mapping iniettato dal beforeEach
  await writeFixture("jira-happy.xlsx", [
    { date: "2026-04-01", project: "Jira Frontend Work", task: "Frontend Task", hours: 8, notes: "" },
    { date: "2026-04-02", project: "Jira Frontend Work", task: "Frontend Task", hours: 4, notes: "" },
  ]);

  console.log("[fixtures/generate] Fixture Excel generate in", XLSX_DIR);
}

async function writeFixture(filename: string, rows: TimesheetRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Timesheet");

  // Header standard Timesheet Hub (template atteso dall'import wizard)
  ws.addRow(["Data", "Progetto", "Task", "Ore", "Note"]);

  for (const row of rows) {
    ws.addRow([row.date, row.project, row.task, row.hours, row.notes ?? ""]);
  }

  await wb.xlsx.writeFile(path.join(XLSX_DIR, filename));
}

async function writeWrongFormatFixture(filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  // Header non conforme — colonne diverse dall'atteso
  ws.addRow(["Giorno", "Attività", "Durata"]);
  ws.addRow(["lunedì", "sviluppo", "8h"]);
  await wb.xlsx.writeFile(path.join(XLSX_DIR, filename));
}

// E6-5: header completamente diverso (assenti Progetto e Ore) → MISSING_PERIOD
async function writeWrongColumnFixture(filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow(["Cognome", "Nome", "Anno"]);
  ws.addRow(["Rossi", "Mario", "2026"]);
  ws.addRow(["Bianchi", "Anna", "2026"]);
  await wb.xlsx.writeFile(path.join(XLSX_DIR, filename));
}

// E6-5: header standard con 3 righe: 1 valida, 1 senza Progetto e Ore, 1 senza Task
async function writeAnomalieFixture(filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Timesheet");
  ws.addRow(["Data", "Progetto", "Task", "Ore", "Note"]);
  ws.addRow(["2026-01-15", "E2E__OK", "dev", 8, ""]);   // valida
  ws.addRow(["2026-01-16", "", "review", "", ""]);       // MISSING_PROJECT + MISSING_HOURS
  ws.addRow(["2026-01-17", "E2E__OK", "", 4, ""]);       // MISSING_TASK
  await wb.xlsx.writeFile(path.join(XLSX_DIR, filename));
}
