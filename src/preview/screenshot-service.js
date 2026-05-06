'use strict';

/**
 * screenshot-service.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Captures screenshots of:
 *   1. The current/existing business website homepage
 *   2. The generated landing page preview
 *
 * Uses Playwright (Chromium headless). Gracefully handles timeouts and failures.
 * Does NOT crash the pipeline if a screenshot fails.
 *
 * Output directory structure:
 *   previews/screenshots/current/{slug}.png
 *   previews/screenshots/generated/{slug}.png
 */

const path = require('path');
const fs   = require('fs');

// ── Directory helpers ────────────────────────────────────────────────────────

const DEFAULT_SCREENSHOT_BASE = path.resolve(
  __dirname,
  '../../previews/screenshots'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Playwright launcher ──────────────────────────────────────────────────────

async function launchBrowser() {
  const { chromium } = require('playwright');
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

// ── Single screenshot capture ────────────────────────────────────────────────

/**
 * captureUrl(browser, url, outputPath, options?)
 * Navigates to a URL and saves a full-page screenshot.
 *
 * @param {Browser} browser     - Playwright browser instance
 * @param {string}  url         - URL to capture
 * @param {string}  outputPath  - Absolute path to save the PNG
 * @param {object}  [options]
 * @param {number}  [options.timeoutMs=15000]
 * @param {number}  [options.viewportWidth=1280]
 * @param {number}  [options.viewportHeight=800]
 * @param {boolean} [options.fullPage=true]
 * @returns {Promise<{success:boolean, path:string|null, error:string|null}>}
 */
async function captureUrl(browser, url, outputPath, options = {}) {
  const {
    timeoutMs     = 15000,
    viewportWidth = 1280,
    viewportHeight= 800,
    fullPage      = true,
  } = options;

  let context, page;
  try {
    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      userAgent: 'Mozilla/5.0 (compatible; LandingBuilderScreenshot/1.0)',
    });
    page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Wait briefly for any lazy-loaded content
    await page.waitForTimeout(1500);

    ensureDir(path.dirname(outputPath));
    await page.screenshot({ path: outputPath, fullPage });

    return { success: true, path: outputPath, error: null };
  } catch (err) {
    return { success: false, path: null, error: err.message || String(err) };
  } finally {
    if (page)    await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

// ── File URL helper ──────────────────────────────────────────────────────────

function filePathToUrl(filePath) {
  // Convert absolute path to file:// URL
  const abs = path.resolve(filePath);
  return 'file://' + abs;
}

// ── Main service ─────────────────────────────────────────────────────────────

/**
 * captureScreenshots(options)
 *
 * @param {object} options
 * @param {string}  options.slug              - Lead slug (used for filenames)
 * @param {string}  [options.currentSiteUrl]  - URL of the existing business website
 * @param {string}  [options.generatedPreviewPath] - Absolute path to the generated HTML preview
 * @param {string}  [options.generatedPreviewUrl]  - Public URL of the generated preview (alternative to path)
 * @param {string}  [options.screenshotBase]  - Base directory for screenshots
 * @param {object}  [options.captureOptions]  - Passed to captureUrl
 * @returns {Promise<ScreenshotResult>}
 */
async function captureScreenshots(options = {}) {
  const {
    slug,
    currentSiteUrl,
    generatedPreviewPath,
    generatedPreviewUrl,
    screenshotBase = DEFAULT_SCREENSHOT_BASE,
    captureOptions = {},
  } = options;

  if (!slug) {
    // Build a diagnostic message so callers can see exactly what was passed.
    const receivedKeys   = Object.keys(options);
    const receivedSlug   = options.slug;
    const receivedLeadId = options.lead_id || options.leadId || '(not provided)';
    const receivedPreview = options.generatedPreviewPath || options.generatedPreviewUrl || '(not provided)';
    throw new Error(
      'screenshot-service: slug is required but was ' +
      (receivedSlug === undefined ? 'undefined' : receivedSlug === null ? 'null' : `"${receivedSlug}"`) +
      '.\n' +
      `  received keys:    ${receivedKeys.join(', ') || '(none)'}\n` +
      `  lead_id:          ${receivedLeadId}\n` +
      `  preview:          ${receivedPreview}\n` +
      '  Fix: ensure the caller passes options.slug (a non-empty string derived from the lead).'
    );
  }

  const result = {
    slug,
    currentSiteScreenshot:   null,
    generatedPreviewScreenshot: null,
    errors: [],
  };

  let browser;
  try {
    browser = await launchBrowser();

    // ── 1. Current site screenshot ─────────────────────────────────────────
    if (currentSiteUrl) {
      const outPath = path.join(screenshotBase, 'current', `${slug}.png`);
      const r = await captureUrl(browser, currentSiteUrl, outPath, captureOptions);
      if (r.success) {
        result.currentSiteScreenshot = outPath;
      } else {
        result.errors.push({ type: 'current_site', url: currentSiteUrl, error: r.error });
      }
    }

    // ── 2. Generated preview screenshot ───────────────────────────────────
    const previewUrl = generatedPreviewUrl ||
      (generatedPreviewPath ? filePathToUrl(generatedPreviewPath) : null);

    if (previewUrl) {
      const outPath = path.join(screenshotBase, 'generated', `${slug}.png`);
      const r = await captureUrl(browser, previewUrl, outPath, captureOptions);
      if (r.success) {
        result.generatedPreviewScreenshot = outPath;
      } else {
        result.errors.push({ type: 'generated_preview', url: previewUrl, error: r.error });
      }
    }
  } catch (err) {
    result.errors.push({ type: 'browser_launch', error: err.message || String(err) });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return result;
}

/**
 * captureSingleUrl(url, outputPath, options?)
 * Convenience wrapper for capturing a single URL without managing a browser instance.
 */
async function captureSingleUrl(url, outputPath, options = {}) {
  let browser;
  try {
    browser = await launchBrowser();
    const result = await captureUrl(browser, url, outputPath, options);
    return result;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { captureScreenshots, captureSingleUrl, captureUrl, launchBrowser };
