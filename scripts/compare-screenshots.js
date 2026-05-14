#!/usr/bin/env node
'use strict';

// compare-screenshots.js
// Take side-by-side screenshots of our generated preview and the live lead site.
// Usage: node scripts/compare-screenshots.js <preview-url> <lead-url> [outDir]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs/promises');

async function shoot(browser, url, outPath, viewport) {
  const ctx = await browser.newContext({
    viewport,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}
    await page.waitForTimeout(1200);
    // Auto-scroll once so any IntersectionObserver-driven scroll-reveal triggers
    // before the full-page screenshot. Without this, sections below the fold
    // can capture with opacity:0.
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let y = 0;
        const step = 400;
        const interval = setInterval(() => {
          window.scrollBy(0, step);
          y += step;
          if (y >= document.body.scrollHeight) {
            clearInterval(interval);
            window.scrollTo(0, 0);
            setTimeout(resolve, 400);
          }
        }, 80);
      });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`[shot] ${url} -> ${outPath}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  const previewUrl = process.argv[2];
  const leadUrl    = process.argv[3];
  const outDir     = path.resolve(process.argv[4] || './screenshots');

  if (!previewUrl || !leadUrl) {
    console.error('Usage: node scripts/compare-screenshots.js <preview-url> <lead-url> [outDir]');
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ourPath  = path.join(outDir, `ours-${stamp}.png`);
  const leadPath = path.join(outDir, `lead-${stamp}.png`);
  const ourLatest  = path.join(outDir, 'ours-latest.png');
  const leadLatest = path.join(outDir, 'lead-latest.png');

  const browser = await chromium.launch({ headless: true });
  try {
    await shoot(browser, previewUrl, ourPath,  { width: 1440, height: 900 });
    await shoot(browser, leadUrl,    leadPath, { width: 1440, height: 900 });
  } finally {
    await browser.close();
  }

  await fs.copyFile(ourPath,  ourLatest);
  await fs.copyFile(leadPath, leadLatest);

  console.log('\nLatest:');
  console.log('  ours:', ourLatest);
  console.log('  lead:', leadLatest);
}

main().catch(err => {
  console.error('Failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
