#!/usr/bin/env node
'use strict';

/**
 * build-packet.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Bundle a generated preview into a sales packet ready to email or share.
 *
 * Usage:
 *   node src/cli/build-packet.js <slug>          # build packet for a slug
 *   node src/cli/build-packet.js --all           # build packets for every preview
 *
 * Output: previews/{slug}.packet.zip containing:
 *   - index.html              the agent-generated landing page
 *   - assets/                 localized scraped images
 *   - design.md               the picked design system + niche pack metadata
 *   - lead-site.png           the screenshot of the lead's current site
 *   - ours.png                the screenshot of our generated preview
 *   - SUMMARY.pdf             one-page sales summary (when Playwright available)
 *   - README.txt              what's in the packet, how to view it
 */

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PREVIEWS_DIR = path.resolve(process.cwd(), 'previews');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJsonIfExists(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; }
}

async function listSlugs() {
  const entries = await fs.readdir(PREVIEWS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.html') && !e.name.includes('.variants.') && !e.name.includes('-v'))
    .map(e => e.name.replace(/\.html$/, ''));
}

/**
 * Render a one-page summary PDF with the lead-vs-ours screenshots side by
 * side, key facts pulled from the debug artifact + design.md, and a list of
 * the improvements we made. Falls back to skipping the PDF if Playwright
 * isn't installed or rendering fails.
 */
async function renderSummaryPdf({ slug, packetDir, brief, debug }) {
  const ourPng  = path.join(packetDir, 'ours.png');
  const leadPng = path.join(packetDir, 'lead-site.png');
  const hasOur  = await exists(ourPng);
  const hasLead = await exists(leadPng);
  const summaryHtml = buildSummaryHtml({ slug, brief, debug, hasOur, hasLead });
  const summaryPath = path.join(packetDir, '_summary-source.html');
  await fs.writeFile(summaryPath, summaryHtml, 'utf8');

  const pdfPath = path.join(packetDir, 'SUMMARY.pdf');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('file://' + summaryPath, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await page.pdf({ path: pdfPath, format: 'Letter', printBackground: true, margin: { top: '0.6in', bottom: '0.6in', left: '0.6in', right: '0.6in' } });
    return pdfPath;
  } catch (err) {
    console.warn('[packet] PDF render failed (non-fatal):', err.message);
    return null;
  } finally {
    if (browser) try { await browser.close(); } catch {}
    try { await fs.unlink(summaryPath); } catch {}
  }
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function buildSummaryHtml({ slug, brief, debug, hasOur, hasLead }) {
  const brand    = (brief && brief.brand)   || {};
  const contact  = (brief && brief.contact) || {};
  const trust    = (brief && brief.trust)   || {};
  const niche    = (brief && brief.niche)   || '';
  const location = (brief && brief.location) || '';
  const ds       = (brief && brief.designSystem) || {};
  const improvements = deriveImprovements(brief, debug);

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font: 11pt/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; padding: 0; }
.hdr { border-bottom: 2px solid #0f172a; padding-bottom: 0.5rem; margin-bottom: 1.25rem; }
.hdr h1 { font-size: 1.625rem; font-weight: 800; letter-spacing: -0.01em; }
.hdr .sub { color: #64748b; font-size: 0.9rem; margin-top: 0.15rem; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1.25rem 0; }
.shot { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
.shot .label { background: #f1f5f9; color: #475569; font-size: 0.7rem; font-weight: 600; padding: 0.35rem 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; }
.shot img { display: block; width: 100%; height: auto; max-height: 360px; object-fit: cover; object-position: top; }
.facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem 1.5rem; margin: 1rem 0 1.5rem; }
.fact { border-left: 3px solid #f59e0b; padding-left: 0.65rem; }
.fact dt { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
.fact dd { font-size: 0.95rem; font-weight: 500; }
h2 { font-size: 1rem; font-weight: 700; margin: 1rem 0 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid #e2e8f0; }
ul.improvements { list-style: none; padding: 0; }
ul.improvements li { padding: 0.35rem 0 0.35rem 1.25rem; position: relative; font-size: 0.92rem; }
ul.improvements li::before { content: "✓"; position: absolute; left: 0; color: #16a34a; font-weight: 800; }
.footer { margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; font-size: 0.7rem; color: #94a3b8; }
</style></head><body>
<div class="hdr">
  <h1>${esc(brand.name || slug)}</h1>
  <div class="sub">${esc([niche, location].filter(Boolean).join(' · '))}</div>
</div>

<div class="row">
  ${hasLead ? `<div class="shot"><div class="label">Their current site</div><img src="lead-site.png" /></div>` : '<div></div>'}
  ${hasOur ? `<div class="shot"><div class="label">Our redesigned page</div><img src="ours.png" /></div>` : '<div></div>'}
</div>

<dl class="facts">
  ${contact.phone ? `<div class="fact"><dt>Phone</dt><dd>${esc(contact.phone)}</dd></div>` : ''}
  ${contact.address && (contact.address.street || contact.address.city) ? `<div class="fact"><dt>Address</dt><dd>${esc([contact.address.street, contact.address.city, contact.address.state].filter(Boolean).join(', '))}</dd></div>` : ''}
  ${trust.rating ? `<div class="fact"><dt>Rating</dt><dd>${esc(trust.rating)}★ · ${esc(trust.review_count || 0)} reviews</dd></div>` : ''}
  ${ds.name ? `<div class="fact"><dt>Visual System</dt><dd>${esc(ds.title || ds.name)}</dd></div>` : ''}
</dl>

<h2>What we improved</h2>
<ul class="improvements">
  ${improvements.map(i => `<li>${esc(i)}</li>`).join('\n  ')}
</ul>

<div class="footer">slug: ${esc(slug)} · generated by landing-page-factory · ${new Date().toISOString().slice(0, 10)}</div>
</body></html>`;
}

/**
 * Derive a list of "what we improved" bullets from the scraped weakness
 * signals + niche pack. These mirror what the audit found wrong with the
 * lead's site and what our preview addresses.
 */
function deriveImprovements(brief, debug) {
  const out = [];
  const ops = (brief && brief.siteOpportunities) || (brief && brief.notes && brief.notes.opportunities) || [];
  const heroImg = brief && brief.brand && brief.brand.heroImageUrl;
  const ds = brief && brief.designSystem;
  const trust = brief && brief.trust;
  const contact = brief && brief.contact;
  const story = brief && brief.siteIdentity && brief.siteIdentity.aboutStory;

  if (ops && ops.length) {
    for (const op of ops.slice(0, 6)) out.push(op);
  }
  if (heroImg) out.push('Real brand hero photo surfaced above the fold');
  if (ds && ds.title) out.push(`Aesthetic aligned to a curated "${ds.title}" design system`);
  if (trust && trust.rating && trust.review_count) out.push(`Real ${trust.rating}★ rating + ${trust.review_count}-review badge front and center`);
  if (contact && contact.phone) out.push('Phone moved into the persistent nav bar');
  if (story) out.push('Brand story extracted from the live site and placed in a dedicated "Our Story" section');
  if (!out.length) out.push('Modernized layout, brand-true palette, and clear primary conversion path');
  return out;
}

async function buildPacket(slug) {
  const previewHtml = path.join(PREVIEWS_DIR, `${slug}.html`);
  const designMd    = path.join(PREVIEWS_DIR, `${slug}.design.md`);
  const assetsDir   = path.join(PREVIEWS_DIR, `${slug}.assets`);

  if (!fsSync.existsSync(previewHtml)) {
    throw new Error(`preview not found: ${previewHtml}`);
  }

  // Load brief debug for facts on the summary page
  const debug = await readJsonIfExists(path.resolve('src/storage/debug', `lead_${slug.split('-').pop()}.json`));
  const brief = debug && debug.brief ? debug.brief : null;

  // Stage everything into a temp dir then zip it
  const packetDir = path.join(PREVIEWS_DIR, `${slug}.packet`);
  await fs.rm(packetDir, { recursive: true, force: true });
  await fs.mkdir(packetDir, { recursive: true });

  await fs.copyFile(previewHtml, path.join(packetDir, 'index.html'));
  if (fsSync.existsSync(designMd)) await fs.copyFile(designMd, path.join(packetDir, 'design.md'));
  if (fsSync.existsSync(assetsDir)) {
    await fs.cp(assetsDir, path.join(packetDir, 'assets'), { recursive: true });
    // Promote the lead-site screenshot to top-level for easy preview
    const leadSrc = path.join(assetsDir, 'lead-site.png');
    if (fsSync.existsSync(leadSrc)) await fs.copyFile(leadSrc, path.join(packetDir, 'lead-site.png'));
  }
  // Capture our preview screenshot (if not already there)
  const ourPng = path.join(packetDir, 'ours.png');
  try {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto('file://' + path.join(packetDir, 'index.html'), { waitUntil: 'domcontentloaded' });
    try { await p.waitForLoadState('networkidle', { timeout: 6000 }); } catch {}
    await p.waitForTimeout(800);
    await p.screenshot({ path: ourPng, fullPage: true });
    await browser.close();
  } catch (err) {
    console.warn('[packet] screenshot failed (non-fatal):', err.message);
  }

  // Render summary PDF
  await renderSummaryPdf({ slug, packetDir, brief, debug });

  // README
  const readme = [
    `Sales packet for ${(brief && brief.brand && brief.brand.name) || slug}`,
    '',
    'Files in this packet:',
    '- index.html         Open in any browser to view the redesigned landing page',
    '- assets/            Images and supporting files referenced by index.html',
    '- ours.png           Full-page screenshot of the redesigned page',
    '- lead-site.png      Full-page screenshot of the client\'s current site',
    '- SUMMARY.pdf        One-page side-by-side summary (open this first)',
    '- design.md          Design-system notes for the redesigned page',
    '',
    `Generated: ${new Date().toISOString()}`,
    'Source pipeline: landing-page-factory'
  ].join('\n');
  await fs.writeFile(path.join(packetDir, 'README.txt'), readme, 'utf8');

  // Zip the packet
  const zipPath = path.join(PREVIEWS_DIR, `${slug}.packet.zip`);
  await fs.rm(zipPath, { force: true });
  await new Promise((resolve, reject) => {
    const child = spawn('zip', ['-rq', zipPath, path.basename(packetDir)], { cwd: PREVIEWS_DIR });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`zip exited ${code}`)));
    child.on('error', reject);
  });

  // Keep the staging dir around so packet.html can be opened directly too,
  // but compress the zip and report.
  const { size } = await fs.stat(zipPath);
  return { zipPath, packetDir, size };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node src/cli/build-packet.js <slug> | --all');
    process.exit(1);
  }
  const targets = arg === '--all' ? await listSlugs() : [arg];
  for (const slug of targets) {
    try {
      const { zipPath, size } = await buildPacket(slug);
      console.log(`[packet] ${slug} → ${path.relative(process.cwd(), zipPath)} (${(size / 1024).toFixed(0)}kb)`);
    } catch (err) {
      console.error(`[packet] ${slug} failed:`, err.message);
    }
  }
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { buildPacket, listSlugs };
