#!/usr/bin/env node
'use strict';

// vision-qa.js
// Sends (lead screenshot, our preview screenshot) to Claude vision and asks
// it to score the preview against the lead's site for brand fidelity,
// modernity, and conversion strength. Writes the result next to the preview
// as {slug}.qa.json and prints a summary.
//
// Usage:
//   node scripts/vision-qa.js <slug>
//
// Requires ANTHROPIC_API_KEY. Skips gracefully without one.
// Expects screenshots at:
//   previews/{slug}.assets/lead-site.png        (captured by generate-preview)
//   screenshots/ours-latest.png OR a fresh shot of previews/{slug}.html
//
// Output: previews/{slug}.qa.json

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');

const VISION_MODEL = process.env.LANDING_BUILDER_LLM_MODEL || 'claude-sonnet-4-6';

function htmlBaseFor(slug) { return path.resolve('previews', `${slug}.html`); }
function leadShotFor(slug) { return path.resolve('previews', `${slug}.assets`, 'lead-site.png'); }

async function ensureOurShot(slug) {
  const ourPath = path.resolve('screenshots', `ours-${slug}.png`);
  await fs.mkdir(path.dirname(ourPath), { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const url = 'file://' + htmlBaseFor(slug);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await page.waitForLoadState('networkidle', { timeout: 6000 }); } catch (e) {}
    await page.waitForTimeout(1200);
    await page.screenshot({ path: ourPath, fullPage: true });
  } finally {
    await browser.close();
  }
  return ourPath;
}

async function callVision(leadPng, ourPng, apiKey) {
  const [leadB, ourB] = await Promise.all([fs.readFile(leadPng), fs.readFile(ourPng)]);
  const body = {
    model: VISION_MODEL,
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text:
          'Two screenshots of restaurant landing pages.\n' +
          '1. LEAD: the business\'s current website.\n' +
          '2. OURS: the modernized version we generated.\n\n' +
          'Score OURS (1-10 each) on: brandFidelity (uses the same colors/logo/imagery/tone), modernity (cleaner, better hierarchy, mobile-friendly look), conversionStrength (clear primary CTA, trust signals, easy reservation/order path).\n' +
          'Also list: kept (what we preserved well from the lead), missed (what brand DNA we dropped), suggest (the single highest-impact improvement).\n\n' +
          'Return ONLY valid JSON with this shape:\n' +
          '{ "scores": { "brandFidelity": N, "modernity": N, "conversionStrength": N }, "kept": [..], "missed": [..], "suggest": "..." }'
        },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: leadB.toString('base64') } },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: ourB.toString('base64')  } }
      ]
    }]
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in vision response');
  return JSON.parse(m[0]);
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/vision-qa.js <slug>');
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[vision-qa] skipped — ANTHROPIC_API_KEY not set');
    process.exit(0);
  }
  const leadPng = leadShotFor(slug);
  if (!fsSync.existsSync(leadPng)) {
    console.error('[vision-qa] no lead screenshot at', leadPng, '— run `npm run preview` first');
    process.exit(1);
  }
  const ourPng = await ensureOurShot(slug);
  console.log('[vision-qa] sending to', VISION_MODEL, '...');
  const qa = await callVision(leadPng, ourPng, apiKey);
  const outPath = path.resolve('previews', `${slug}.qa.json`);
  await fs.writeFile(outPath, JSON.stringify(qa, null, 2));
  console.log('[vision-qa] result →', outPath);
  console.log(JSON.stringify(qa.scores, null, 2));
  if (qa.suggest) console.log('Top suggestion:', qa.suggest);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[vision-qa] failed:', err && err.message);
    process.exitCode = 1;
  });
}
