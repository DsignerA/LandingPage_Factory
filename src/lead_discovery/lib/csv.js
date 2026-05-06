'use strict';
/**
 * csv.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Minimal CSV writer for the lead discovery layer.
 * No external dependencies — uses only Node.js built-ins.
 *
 * Handles:
 *   - Proper RFC 4180 quoting (quotes any field containing comma, quote, or newline)
 *   - Embedded double-quote escaping ("" inside quoted fields)
 *   - Deterministic column order via explicit headers array
 *   - Graceful handling of undefined/null values (written as empty string)
 */

const fs   = require('fs');
const path = require('path');

/**
 * escapeField(value) — RFC 4180 CSV field escaping.
 */
function escapeField(value) {
  const str = value == null ? '' : String(value);
  // Quote if the field contains a comma, double-quote, newline, or carriage return
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * rowToCSV(row, headers) — converts a plain object to a CSV line.
 * Only the columns in `headers` are written, in order.
 */
function rowToCSV(row, headers) {
  return headers.map(h => escapeField(row[h])).join(',');
}

/**
 * writeCsv(filePath, rows, headers)
 * Writes an array of plain objects to a CSV file.
 *
 * @param {string}   filePath - Absolute or relative path to the output file
 * @param {object[]} rows     - Array of plain objects
 * @param {string[]} headers  - Column names in desired output order
 */
function writeCsv(filePath, rows, headers) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lines = [
    headers.join(','),
    ...rows.map(row => rowToCSV(row, headers)),
  ];
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

module.exports = { writeCsv, escapeField, rowToCSV };
