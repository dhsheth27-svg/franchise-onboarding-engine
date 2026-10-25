// Excel in / out. Reads the judges' workbook as-is (title line, header row, grey example row),
// and builds the blank template, the sample workbook and the export.

import * as XLSX from 'xlsx';
import { EXISTING_STORES_DEFAULT } from './config';
import type { RawApplication, RawStore, RawTerritory } from './engine/types';

export interface ParsedWorkbook {
  applications: RawApplication[];
  territories: RawTerritory[];
  existingStores: RawStore[] | undefined;
  notes: string[];
}

export class WorkbookError extends Error {
  constructor(
    message: string,
    public details: string[] = [],
  ) {
    super(message);
  }
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

type ColumnSpec<K extends string> = { key: K; label: string; match: (h: string) => boolean; required: boolean };

const APP_COLUMNS: ColumnSpec<keyof RawApplication & string>[] = [
  { key: 'applicationId', label: 'Application ID', match: (h) => h === 'applicationid' || h === 'appid', required: true },
  { key: 'applicantName', label: 'Applicant name', match: (h) => h === 'applicantname' || h === 'name', required: true },
  { key: 'city', label: 'City', match: (h) => h === 'city', required: true },
  { key: 'state', label: 'State', match: (h) => h === 'state', required: false },
  { key: 'pin', label: 'Pin code', match: (h) => h.startsWith('pincode') || h === 'pin', required: true },
  { key: 'investment', label: 'Investment capacity (₹ lakh)', match: (h) => h.startsWith('investment'), required: true },
  { key: 'experience', label: 'Retail experience (years)', match: (h) => h.includes('experience'), required: true },
  { key: 'business', label: 'Current / past business', match: (h) => h.includes('business'), required: false },
  { key: 'spaceAvailable', label: 'Space available', match: (h) => h === 'spaceavailable', required: true },
  { key: 'spaceSize', label: 'Space size (sq ft)', match: (h) => h.startsWith('spacesize'), required: false },
  { key: 'floor', label: 'Floor', match: (h) => h === 'floor', required: false },
  { key: 'targetLaunch', label: 'Target launch (months)', match: (h) => h.startsWith('targetlaunch'), required: false },
  { key: 'language', label: 'Preferred language', match: (h) => h.includes('language'), required: false },
  { key: 'notes', label: 'Notes from applicant', match: (h) => h.startsWith('notes'), required: false },
];

const TERR_COLUMNS: ColumnSpec<keyof RawTerritory & string>[] = [
  { key: 'territoryId', label: 'Territory ID', match: (h) => h === 'territoryid', required: true },
  { key: 'city', label: 'City', match: (h) => h === 'city', required: true },
  { key: 'state', label: 'State', match: (h) => h === 'state', required: false },
  { key: 'pins', label: 'Pin codes covered', match: (h) => h.startsWith('pincode'), required: true },
  { key: 'tier', label: 'City tier', match: (h) => h.includes('tier'), required: false },
  { key: 'openSlots', label: 'Open slots', match: (h) => h.includes('slot'), required: true },
  { key: 'priority', label: 'Priority', match: (h) => h === 'priority', required: false },
];

const STORE_COLUMNS: ColumnSpec<keyof RawStore & string>[] = [
  { key: 'storeId', label: 'Store ID', match: (h) => h === 'storeid', required: true },
  { key: 'city', label: 'City', match: (h) => h === 'city', required: false },
  { key: 'pin', label: 'Pin code', match: (h) => h.startsWith('pincode') || h === 'pin', required: true },
  { key: 'openedYear', label: 'Opened (year)', match: (h) => h.startsWith('opened'), required: false },
];

const APP_HEADERS = APP_COLUMNS.map((c) => c.label);
const TERR_HEADERS = TERR_COLUMNS.map((c) => c.label);
const STORE_HEADERS = STORE_COLUMNS.map((c) => c.label);

const EXAMPLE_APP = ['APP-001', 'Ravi Kumar', 'Mysuru', 'Karnataka', 570001, 25, 4, 'Runs a footwear store', 'Rented', 450, 'Ground', 3, 'Kannada', 'Wants to open before Diwali'];
const EXAMPLE_TERR = ['TER-01', 'Mysuru', 'Karnataka', '570001, 570002, 570008', 'Tier 2', 3, 'High'];

function findSheet(wb: XLSX.WorkBook, name: string, headerKey: string): XLSX.WorkSheet | null {
  const exact = wb.SheetNames.find((n) => n.trim().toLowerCase() === name.toLowerCase());
  if (exact) return wb.Sheets[exact];
  const loose = wb.SheetNames.find((n) => norm(n).includes(norm(name)));
  if (loose) return wb.Sheets[loose];
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: '' }).slice(0, 20);
    if (rows.some((r) => r.some((c) => norm(c) === headerKey))) return wb.Sheets[n];
  }
  return null;
}

function readTable<K extends string>(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  columns: ColumnSpec<K>[],
  headerKey: string,
  example: unknown[] | null,
  notes: string[],
): Record<K | 'rowNumber', unknown>[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true, blankrows: true });
  const headerIdx = rows.findIndex((r, i) => i < 30 && r.some((c) => norm(c) === headerKey));
  if (headerIdx < 0) throw new WorkbookError(`The "${sheetName}" sheet has no header row: could not find a "${columns[0].label}" column.`, [`Expected columns: ${columns.map((c) => c.label).join(', ')}`]);
  const header = rows[headerIdx].map(norm);
  const colIndex = new Map<K, number>();
  const missing: string[] = [];
  for (const c of columns) {
    const idx = header.findIndex((h) => h && c.match(h));
    if (idx >= 0) colIndex.set(c.key, idx);
    else if (c.required) missing.push(c.label);
  }
  if (missing.length) throw new WorkbookError(`The "${sheetName}" sheet is missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`, [`Columns found: ${rows[headerIdx].filter(Boolean).join(', ')}`]);

  const out: Record<K | 'rowNumber', unknown>[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => String(c ?? '').trim() === '')) continue;
    if (i === headerIdx + 1 && example && example.every((v, j) => norm(r[j]) === norm(v))) {
      notes.push(`${sheetName}: skipped the grey template example row (row ${i + 1}).`);
      continue;
    }
    const rec = { rowNumber: i + 1 } as Record<K | 'rowNumber', unknown>;
    for (const c of columns) rec[c.key] = colIndex.has(c.key) ? r[colIndex.get(c.key)!] : '';
    out.push(rec);
  }
  return out;
}

export function parseWorkbook(buf: ArrayBuffer | Buffer): ParsedWorkbook {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: buf instanceof ArrayBuffer ? 'array' : 'buffer' });
  } catch {
    throw new WorkbookError('This file could not be read as an Excel workbook. Please upload the .xlsx file in the case template format.');
  }
  const notes: string[] = [];
  const appSheet = findSheet(wb, 'Applications', 'applicationid');
  const terrSheet = findSheet(wb, 'Territories', 'territoryid');
  const missingSheets = [!appSheet && 'Applications', !terrSheet && 'Territories'].filter(Boolean) as string[];
  if (missingSheets.length)
    throw new WorkbookError(`The workbook is missing the ${missingSheets.join(' and ')} sheet${missingSheets.length > 1 ? 's' : ''}.`, [`Sheets found: ${wb.SheetNames.join(', ') || 'none'}`]);

  const applications = readTable(appSheet!, 'Applications', APP_COLUMNS, 'applicationid', EXAMPLE_APP, notes) as RawApplication[];
  const territories = readTable(terrSheet!, 'Territories', TERR_COLUMNS, 'territoryid', EXAMPLE_TERR, notes) as RawTerritory[];
  if (!applications.length) throw new WorkbookError('The Applications sheet has no applicant rows below the header.');
  if (!territories.length) throw new WorkbookError('The Territories sheet has no territory rows below the header.');

  let existingStores: RawStore[] | undefined;
  const storeSheet = findSheet(wb, 'Existing stores', 'storeid');
  if (storeSheet) {
    try {
      existingStores = readTable(storeSheet, 'Existing stores', STORE_COLUMNS, 'storeid', null, notes) as RawStore[];
    } catch {
      notes.push('Existing stores sheet could not be read; the fixed list from the case brief is used.');
    }
  } else notes.push('No Existing stores sheet found; the fixed list from the case brief is used.');
  return { applications, territories, existingStores, notes };
}

// ---------- Writing ----------

function sheetWithTitle(title: string, headers: string[], rows: unknown[][], widths?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([[title], headers, ...rows]);
  ws['!cols'] = (widths ?? headers.map((h) => Math.max(12, h.length + 2))).map((wch) => ({ wch }));
  return ws;
}

export function storesRows(): unknown[][] {
  return EXISTING_STORES_DEFAULT.map((s) => [s.storeId, s.city, Number(s.pin), s.openedYear]);
}

export function templateWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetWithTitle('Applications — one row per record. Row 3 is an example (grey); enter data from row 4.', APP_HEADERS, [EXAMPLE_APP]), 'Applications');
  XLSX.utils.book_append_sheet(wb, sheetWithTitle('Territories — one row per record. Row 3 is an example (grey); enter data from row 4.', TERR_HEADERS, [EXAMPLE_TERR]), 'Territories');
  XLSX.utils.book_append_sheet(wb, sheetWithTitle("FIXED - all the brand's stores open today. Do not edit.", STORE_HEADERS, storesRows()), 'Existing stores');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function workbookFromInput(applications: RawApplication[], territories: RawTerritory[]): Buffer {
  const wb = XLSX.utils.book_new();
  const appRows = applications.map((a) => APP_COLUMNS.map((c) => a[c.key] ?? ''));
  const terrRows = territories.map((t) => TERR_COLUMNS.map((c) => t[c.key] ?? ''));
  XLSX.utils.book_append_sheet(wb, sheetWithTitle('Applications — one row per record. Row 3 is an example (grey); enter data from row 4.', APP_HEADERS, [EXAMPLE_APP, ...appRows]), 'Applications');
  XLSX.utils.book_append_sheet(wb, sheetWithTitle('Territories — one row per record. Row 3 is an example (grey); enter data from row 4.', TERR_HEADERS, [EXAMPLE_TERR, ...terrRows]), 'Territories');
  XLSX.utils.book_append_sheet(wb, sheetWithTitle("FIXED - all the brand's stores open today. Do not edit.", STORE_HEADERS, storesRows()), 'Existing stores');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export { XLSX };
