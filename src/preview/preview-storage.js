'use strict';

// Preview storage module (local filesystem)
// - Writes HTML previews to disk
// - Upserts a record into the local preview index
// - Returns preview metadata: { lead_id, slug, path, url, created_at }
//
// Minimal, deterministic, production-minded
// Uses only Node fs/path and the local preview-index

const path = require('path');
const fs = require('fs/promises');
const index = require('./preview-index');

function toStringSafe(v) { return v == null ? '' : String(v); }

function safeSlug(s) {
  const core = toStringSafe(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return core || 'preview';
}

function isoNow() {
  try { return new Date().toISOString(); } catch { return null; }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function storePreview(payload, options = {}) {
  const lead_id = toStringSafe(payload.lead_id || '');
  const slug = safeSlug(payload.slug || lead_id);
  const html = toStringSafe(payload.html || '');

  // Default storage under src/storage/previews to align with hosting and index
  const outDir = options.outDir || path.resolve(__dirname, '..', 'storage', 'previews');
  await ensureDir(outDir);

  const filePath = path.join(outDir, `${slug}.html`);
  await fs.writeFile(filePath, html, 'utf8');

  // If requested, copy required JS/CSS assets into the preview directory
  const copyAssets = options.copyAssets || false;
  if (copyAssets) {
    // Determine project root (landing_builder). __dirname is src/preview
    const projectRoot = path.resolve(__dirname, '..', '..');
    // Source directories to copy. Note: copy the top-level components directory,
    // and the src components, ui, and styles directories.
    const sources = [
      { src: path.join(projectRoot, 'components'), dest: path.join(outDir, 'components') },
      { src: path.join(projectRoot, 'src', 'components'), dest: path.join(outDir, 'src', 'components') },
      { src: path.join(projectRoot, 'src', 'ui'), dest: path.join(outDir, 'src', 'ui') },
      { src: path.join(projectRoot, 'src', 'styles'), dest: path.join(outDir, 'src', 'styles') }
    ];

    // Helper to recursively copy directories/files
    async function copyRecursive(src, dest) {
      try {
        const stats = await fs.stat(src);
        if (stats.isDirectory()) {
          await fs.mkdir(dest, { recursive: true });
          const entries = await fs.readdir(src);
          for (const entry of entries) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
          }
        } else if (stats.isFile()) {
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(src, dest);
        }
      } catch (e) {
        // Ignore missing sources to avoid breaking preview
      }
    }

    for (const { src, dest } of sources) {
      await copyRecursive(src, dest);
    }
  }

  const created_at = toStringSafe(payload.created_at) || isoNow();
  const url = `file://${filePath}`;

  // Upsert index record
  await index.upsert({
    lead_id,
    slug,
    file_path: filePath,
    url,
    business_name: toStringSafe(payload.business_name || ''),
    location: toStringSafe(payload.location || ''),
    created_at,
    generator: toStringSafe(payload.generator || 'noop'),
    schema_version: toStringSafe(payload.schema_version || 'schema-1')
  });

  return { lead_id, slug, path: filePath, url, created_at };
}

module.exports = { storePreview };
