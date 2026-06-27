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
