'use strict';

// Preview events logger (append-only JSONL)
// - File path: src/storage/preview-events.jsonl
// - One event JSON object per line
// - Creates parent directory/file if missing
// - Minimal, production-minded, Node fs/path only

const fs = require('fs/promises');
const path = require('path');

const EVENTS_DIR = path.resolve(__dirname, '..', 'storage');
const EVENTS_PATH = path.join(EVENTS_DIR, 'preview-events.jsonl');

function toStringSafe(v) { return v == null ? '' : String(v); }
function collapseSpaces(s) { return toStringSafe(s).replace(/\s+/g, ' ').trim(); }

function isoNow() {
  try { return new Date().toISOString(); } catch { return null; }
}

async function ensureFile() {
  await fs.mkdir(EVENTS_DIR, { recursive: true });
  try {
    await fs.access(EVENTS_PATH);
  } catch {
    await fs.writeFile(EVENTS_PATH, '', 'utf8');
  }
}

function sanitizeEvent(input) {
  const ev = Object(input || {});
  const event = collapseSpaces(ev.event);
  const slug = collapseSpaces(ev.slug);
  const lead_id = collapseSpaces(ev.lead_id);
  const timestamp = collapseSpaces(ev.timestamp) || isoNow();
  const ip = collapseSpaces(ev.ip);
  const user_agent = collapseSpaces(ev.user_agent);
  const referrer = collapseSpaces(ev.referrer);

  const out = { event, slug, lead_id, timestamp };
  if (ip) out.ip = ip;
  if (user_agent) out.user_agent = user_agent;
  if (referrer) out.referrer = referrer;
  return out;
}

function validateEvent(e) {
  if (!e || typeof e !== 'object') return false;
  if (!e.event || typeof e.event !== 'string') return false;
  if (!e.slug && !e.lead_id) return false; // require at least one identifier
  if (!e.timestamp || typeof e.timestamp !== 'string') return false;
  return true;
}

async function logEvent(eventRecord) {
  const rec = sanitizeEvent(eventRecord);
  if (!validateEvent(rec)) {
    // Fail soft: do not throw, but return false so callers can decide
    return false;
  }
  await ensureFile();
  const line = JSON.stringify(rec) + '\n';
  await fs.appendFile(EVENTS_PATH, line, 'utf8');
  return true;
}

module.exports = { logEvent };
