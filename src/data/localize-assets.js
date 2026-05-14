'use strict';

/**
 * localize-assets.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Downloads scraped image URLs to a local assets folder and rewrites references
 * to relative paths. Protects previews from breaking when the source site
 * changes its CDN, adds hotlink protection, or removes the image entirely.
 *
 * Usage:
 *   const { localizeImagesInHtml } = require('./src/data/localize-assets');
 *   const { html: rewritten, downloaded } = await localizeImagesInHtml(html, outDir, urls);
 *
 * Returns the rewritten HTML and a count of successfully downloaded files.
 * Failures are non-fatal — the original URL stays in the HTML if we can't
 * fetch a local copy.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
}

function extensionFor(url, contentType) {
  // Trust path extension first; fall back to content-type.
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase().replace('.', '');
    if (/^(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(ext)) return ext;
  } catch (e) {}
  if (contentType) {
    const m = /image\/(jpeg|png|webp|gif|avif|svg\+xml)/i.exec(contentType);
    if (m) return m[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  }
  return 'jpg';
}

async function downloadOne(url, outDir) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return null; // skip tiny/blank
    const ext = extensionFor(url, res.headers.get('content-type'));
    const name = `${hashUrl(url)}.${ext}`;
    const filePath = path.join(outDir, name);
    await fsp.writeFile(filePath, buf);
    return name;
  } catch (e) {
    return null;
  }
}

/**
 * Download all unique image URLs referenced in `urls`, then return a Map of
 * original→local-relative-path for HTML rewriting.
 */
async function downloadImages(urls, outDir) {
  await fsp.mkdir(outDir, { recursive: true });
  const unique = Array.from(new Set(urls.filter(u => u && /^https?:\/\//.test(u))));
  const mapping = new Map();
  // Limit concurrency: small fan-out so we don't hammer the source.
  const CONC = 4;
  let idx = 0;
  async function worker() {
    while (idx < unique.length) {
      const u = unique[idx++];
      const name = await downloadOne(u, outDir);
      if (name) mapping.set(u, name);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  return mapping;
}

/**
 * Rewrite the HTML to use local paths for any URL we successfully downloaded.
 * The rewritten paths are relative to `previews/`, e.g. './{slug}.assets/abc123.jpg'.
 */
function rewriteHtmlUrls(html, mapping, assetsDirName) {
  let out = html;
  for (const [orig, local] of mapping.entries()) {
    // Escape the URL for use in a regex.
    const esc = orig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc, 'g');
    out = out.replace(re, `./${assetsDirName}/${local}`);
  }
  return out;
}

/**
 * High-level helper used by generate-preview.js.
 * @param {string} html
 * @param {string} previewDir - absolute path to the previews/ root
 * @param {string} slug
 * @param {string[]} extraUrls - additional URLs to localize (hero, card images, logo).
 */
async function localizeImagesInHtml(html, previewDir, slug, extraUrls = []) {
  const assetsDirName = `${slug}.assets`;
  const assetsDir = path.join(previewDir, assetsDirName);

  // Pull every absolute image URL out of the HTML, plus the explicitly-passed
  // hero/card/logo URLs that may live in JSON props.
  const urlRegex = /https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|gif|avif|svg)(?:\?[^\s"'<>)]*)?/gi;
  const fromHtml = html.match(urlRegex) || [];
  const all = [...fromHtml, ...extraUrls];

  // Skip Unsplash placeholder URLs — those are stock fallbacks, not client assets,
  // and live behind a stable CDN we can trust.
  const filtered = all.filter(u => !/images\.unsplash\.com/.test(u));

  const mapping = await downloadImages(filtered, assetsDir);
  const rewritten = rewriteHtmlUrls(html, mapping, assetsDirName);
  return { html: rewritten, downloaded: mapping.size, mapping };
}

module.exports = { localizeImagesInHtml, downloadImages };
