// services/csvExport.js
// Minimal, dependency-free CSV encoder for report exports. Given column
// definitions and row objects, builds a CSV string and hands it to
// services/fileExport.js for download — keeps the app fully offline with
// no library dependency, matching services/pdfGenerator.js's approach.

import { downloadBlob } from './fileExport.js';

/**
 * @param {{ key: string, label: string }[]} columns
 * @param {Record<string, any>[]} rows
 */
export function buildCsv(columns, rows) {
  const headerLine = columns.map((column) => escapeCsvValue(column.label)).join(',');
  const dataLines = rows.map((row) => columns.map((column) => escapeCsvValue(row[column.key])).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function downloadCsv(filename, columns, rows) {
  const csvContent = buildCsv(columns, rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

function escapeCsvValue(value) {
  const stringValue = value === undefined || value === null ? '' : String(value);
  const sanitized = neutralizeFormulaPrefix(stringValue);
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Mitigates "CSV injection": a cell value starting with =, +, -, or @ is
 * interpreted as a formula by Excel/Google Sheets when the exported file
 * is opened (e.g. a client name or payment reference of
 * `=cmd|'/c calc'!A1`). User-entered fields (client name, payment
 * reference, program name, etc.) flow through this export unmodified, so
 * a leading apostrophe is added to force spreadsheet apps to treat the
 * cell as plain text instead of a formula — it doesn't change what a
 * human reading the CSV as text sees.
 */
function neutralizeFormulaPrefix(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
