'use strict';

// Preview Index (JSON-based)
// - Maintains a local index at src/storage/preview-index.json
// - Minimal, deterministic behavior with safe defaults
// - Plain Node fs/path only (no external deps)
//
// Exports:
// - getAll()
// - getBySlug(slug)
// - getByLeadId(leadId)
// - upsert(record)
//
// Record shape (stored):
// {
//   lead_id: string,
//   slug: string,
//   file_path: string,
//   url: string,
//   business_name: string,
//   location: string,
//   created_at: string (ISO),
//   generator: string,
//   schema_version: string
// }
//
// Assumptions:
// - Node.js process has write permission to src/storage
// - Single-process writes. For multi-process coordination, add a file lock.

const fs = require('fs/promises');
const path = require('path');

const INDEX_DIR = path.resolve(__dirname, '..', 'storage');
const INDEX_PATH = path.join(INDEX_DIR, 'preview-index.json');

function toStringSafe(v) { return v == null ? '' : String(v); }

function collapseSpaces(s) { return toStringSafe(s).replace(/\s+/g, ' ').trim(); }

function safeSlug(s) {
  const core = toStringSafe(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return core || 'preview';
}

function isoNow() {
  try { return new Date().toISOString(); } catch { return null; }
}

async function ensureIndexFile() {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  try {
    await fs.access(INDEX_PATH);
  } catch {
    const initial = { version: 1, records: [] };
    await fs.writeFile(INDEX_PATH, JSON.stringify(initial, null, 2) + '\n', 'utf8');
  }
}

async function readIndex() {
  await ensureIndexFile();
  const raw = await fs.readFile(INDEX_PATH, 'utf8');
  try {
    const json = JSON.parse(raw || '{}');
    if (!json || typeof json !== 'object') return { version: 1, records: [] };
    const recs = Array.isArray(json.records) ? json.records : [];
    return { version: json.version || 1, records: recs };
  } catch {
    return { version: 1, records: [] };
  }
}

async function writeIndex(data) {
  const payload = { version: 1, records: Array.isArray(data.records) ? data.records : [] };
  const tmpPath = INDEX_PATH + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  await fs.rename(tmpPath, INDEX_PATH);
}

function sanitizeRecord(input) {
  const lead_id = collapseSpaces(input.lead_id);
  const slug = safeSlug(input.slug || input.Slug || lead_id);
  const file_path = path.normalize(toStringSafe(input.file_path || input.filepath || ''));
  const url = collapseSpaces(input.url);
  const business_name = collapseSpaces(input.business_name);
  const location = collapseSpaces(input.location);
  const generator = collapseSpaces(input.generator || 'noop');
  const schema_version = collapseSpaces(input.schema_version || 'schema-1');
  const created_at = collapseSpaces(input.created_at) || isoNow();

  return { lead_id, slug, file_path, url, business_name, location, created_at, generator, schema_version };
}

function sortRecords(recs) {
  return recs.slice().sort((a, b) => {
    const ta = Date.parse(a.created_at || '') || 0;
    const tb = Date.parse(b.created_at || '') || 0;
    return tb - ta; // newest first
  });
}

async function getAll() {
  const { records } = await readIndex();
  return sortRecords(records);
}

async function getBySlug(slug) {
  const s = safeSlug(slug);
  const { records } = await readIndex();
  return records.find(r => toStringSafe(r.slug) === s) || null;
}

async function getByLeadId(leadId) {
  const id = collapseSpaces(leadId);
  const { records } = await readIndex();
  return records.find(r => toStringSafe(r.lead_id) === id) || null;
}

async function upsert(record) {
  const next = sanitizeRecord(record || {});
  const idx = await readIndex();

  // Find existing by slug first, then by lead_id
  let foundIndex = idx.records.findIndex(r => toStringSafe(r.slug) === next.slug);
  if (foundIndex === -1 && next.lead_id) {
    foundIndex = idx.records.findIndex(r => toStringSafe(r.lead_id) === next.lead_id);
  }

  if (foundIndex >= 0) {
    const existing = idx.records[foundIndex] || {};
    // Preserve created_at if the incoming record didn't provide one
    const created_at = collapseSpaces(record.created_at) || existing.created_at || next.created_at;
    idx.records[foundIndex] = { ...existing, ...next, created_at };
  } else {
    idx.records.push(next);
  }

  // Deduplicate by slug (keep newest by created_at)
  const bySlug = new Map();
  for (const r of idx.records) {
    const k = toStringSafe(r.slug);
    if (!bySlug.has(k)) bySlug.set(k, r);
    else {
      const a = bySlug.get(k);
      const ta = Date.parse(a.created_at || '') || 0;
      const tb = Date.parse(r.created_at || '') || 0;
      if (tb > ta) bySlug.set(k, r);
    }
  }

  const finalRecords = sortRecords(Array.from(bySlug.values()));
  await writeIndex({ records: finalRecords });
  return finalRecords.find(r => r.slug === next.slug) || null;
}

module.exports = {
  getAll,
  getBySlug,
  getByLeadId,
  upsert
};
