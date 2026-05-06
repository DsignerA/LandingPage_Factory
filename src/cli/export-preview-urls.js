#!/usr/bin/env node
'use strict';

// Export preview URLs to CSV for outreach
// - Reads all records from src/preview/preview-index.js
// - Writes CSV to src/storage/preview-urls.csv with columns:
//   lead_id, business_name, location, slug, url, created_at
// - Minimal, deterministic, production-minded (atomic write via temp file)
// - Plain Node fs/path only

const fs = require('fs/promises');
const path = require('path');
const { getAll } = require('../preview/preview-index');

const STORAGE_DIR = path.resolve(__dirname, '..', 'storage');
const CSV_PATH = path.join(STORAGE_DIR, 'preview-urls.csv');

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exportPreviewUrls(options = {}) {
  await ensureDir(STORAGE_DIR);

  const records = await getAll();
  const header = ['lead_id', 'business_name', 'location', 'slug', 'url', 'created_at'];

  const lines = [header.join(',')];
  for (const r of records) {
    const row = [
      r.lead_id || '',
      r.business_name || '',
      r.location || '',
      r.slug || '',
      r.url || '',
      r.created_at || ''
    ].map(csvEscape).join(',');
    lines.push(row);
  }

  const tmpPath = CSV_PATH + '.tmp';
  await fs.writeFile(tmpPath, lines.join('\n') + '\n', 'utf8');
  await fs.rename(tmpPath, CSV_PATH);

  return { filepath: CSV_PATH, count: records.length };
}

module.exports = exportPreviewUrls;

if (require.main === module) {
  exportPreviewUrls()
    .then(({ filepath, count }) => {
      console.log(`Exported ${count} preview URL(s) to: ${filepath}`);
    })
    .catch(err => {
      console.error('Failed to export preview URLs:', err && err.stack ? err.stack : err);
      process.exitCode = 1;
    });
}
