'use strict';
/**
 * screenshot-worker.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Stage worker for: capture_screenshots
 *
 * Reads:  storage/leads/{lead_id}.json
 *         storage/audits/{lead_id}.json
 *         storage/previews/{lead_id}.html
 * Writes: storage/screenshots/current/{slug}.png   (original site)
 *         storage/screenshots/generated/{slug}.png  (new preview)
 * Emits:  screenshots.completed → triggers build_outreach_packet
 *
 * Screenshot modes (based on tier):
 *   Tier A: comparison — full-page side-by-side comparison image
 *   Tier B: hero       — hero section only (viewport screenshot)
 *   Tier C: skipped
 *
 * Idempotent: re-running overwrites screenshot artifacts.
 *
 * ── Screenshot failure policy ─────────────────────────────────────────────────
 *
 *   current-site screenshot failure:
 *     WARN and continue. The current site may be down, slow, or geo-blocked.
 *     A missing current-site screenshot is not a blocker for outreach; the
 *     pipeline proceeds and the result is flagged with skipped_current=true.
 *
 *   generated preview screenshot failure:
 *     Mark result.generated_needs_review=true and include the error details.
 *     Do NOT silently treat this as a full success — the generated preview
 *     screenshot is a core deliverable used in the outreach packet comparison.
 *     The job still completes (does not throw) so the pipeline can continue,
 *     but downstream consumers should check generated_needs_review and either
 *     retry the capture or flag the lead for manual review before sending.
 *
 * ── Slug derivation ───────────────────────────────────────────────────────────
 *
 *   The canonical slug is read from the lead artifact (set by lead-normalizer).
 *   If missing (e.g. legacy data), a safe slug is derived inline:
 *     1. lead.slug
 *     2. lead.business_name  (slugified)
 *     3. lead.practice_name  (slugified)
 *     4. "lead_<lead_id>"    (fallback)
 *
 * ── Field name contract with screenshot-service ───────────────────────────────
 *
 *   captureScreenshots() expects:
 *     { slug, currentSiteUrl, generatedPreviewPath, screenshotBase, captureOptions }
 *
 *   captureScreenshots() returns:
 *     { slug, currentSiteScreenshot, generatedPreviewScreenshot, errors }
 */

const path = require('path');
const fs   = require('fs');
const { getStore } = require('../storage/artifact-store');

function getScreenshotService() {
  return require('../../preview/screenshot-service');
}

// ── Slug utilities ─────────────────────────────────────────────────────────────

/**
 * slugify(str) — converts a free-form string to a URL-safe slug.
 * Mirrors the logic in core/lead-normalizer.js (inline copy to avoid
 * a cross-package dependency from the factory layer).
 */
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '')           // trim leading/trailing hyphens
    .slice(0, 80);
}

/**
 * resolveSlug(lead) — returns a stable, non-empty slug for the lead.
 *
 * Priority:
 *   1. lead.slug          (set by lead-normalizer — preferred)
 *   2. lead.business_name (slugified)
 *   3. lead.practice_name (slugified)
 *   4. "lead_<lead_id>"   (guaranteed fallback)
 */
function resolveSlug(lead) {
  if (lead.slug && String(lead.slug).trim()) {
    return String(lead.slug).trim();
  }
  const fromBusiness = slugify(lead.business_name);
  if (fromBusiness) return fromBusiness;

  const fromPractice = slugify(lead.practice_name);
  if (fromPractice) return fromPractice;

  return `lead_${String(lead.lead_id || 'unknown').replace(/[^a-z0-9_\-]/gi, '_')}`;
}

// ── Worker handler ─────────────────────────────────────────────────────────────

/**
 * screenshotWorkerHandler(job)
 */
async function screenshotWorkerHandler(job) {
  const store   = getStore(job.payload.storage_dir);
  const leadId  = job.lead_id;
  const verbose = !!(job.payload.verbose || process.env.VERBOSE);

  // ── 1. Read artifacts ────────────────────────────────────────────────────────
  const [lead, auditArtifact] = await Promise.all([
    store.read('lead',  leadId),
    store.read('audit', leadId),
  ]);
  if (!lead) throw new Error(`Lead artifact not found: ${leadId}`);

  const tier         = (auditArtifact && auditArtifact.tier) || lead.tier || 'A';
  const tierConfig   = (auditArtifact && auditArtifact.tier_config) || {};
  const screenshotMode = tierConfig.screenshot_mode
    || (tier === 'A' ? 'comparison' : tier === 'B' ? 'hero' : null);

  if (!screenshotMode || tier === 'C') {
    return { lead_id: leadId, skipped: true, reason: 'tier_C_no_screenshots' };
  }

  // ── 2. Resolve slug ──────────────────────────────────────────────────────────
  //
  // captureScreenshots() REQUIRES a slug — it uses it for output filenames.
  // We derive one here so the worker never passes an empty/undefined slug.
  const slug = resolveSlug(lead);

  if (verbose) {
    console.log(`[screenshot-worker] lead_id=${leadId}  slug="${slug}"  tier=${tier}  mode=${screenshotMode}`);
  }

  // Warn if slug had to be derived (indicates missing normalizer output)
  if (!lead.slug) {
    console.warn(
      `[screenshot-worker] WARN: lead.slug missing for ${leadId} — derived slug="${slug}" ` +
      `from ${lead.business_name ? 'business_name' : lead.practice_name ? 'practice_name' : 'lead_id'}`
    );
  }

  // ── 3. Resolve preview path ──────────────────────────────────────────────────
  const previewPath = store.artifactPath('preview', leadId);
  if (!fs.existsSync(previewPath)) {
    throw new Error(`Preview artifact not found for screenshot: ${previewPath}`);
  }

  const websiteUrl = lead.website_url || lead.website || null;

  if (verbose) {
    console.log(`[screenshot-worker] preview_path=${previewPath}`);
    console.log(`[screenshot-worker] website_url=${websiteUrl || '(none)'}`);
  }

  // ── 4. Capture screenshots ───────────────────────────────────────────────────
  //
  // captureScreenshots() API (screenshot-service.js):
  //   Input:  { slug, currentSiteUrl, generatedPreviewPath, screenshotBase, captureOptions }
  //   Output: { slug, currentSiteScreenshot, generatedPreviewScreenshot, errors }
  //
  // NOTE: screenshotBase is intentionally left as the service default so that
  // screenshots land in the standard storage/screenshots/{current,generated}/ dirs.
  // The service builds the output filenames as `{screenshotBase}/{current|generated}/{slug}.png`.

  const { captureScreenshots } = getScreenshotService();

  const captureOptions = {
    viewportWidth:  screenshotMode === 'hero' ? 1440 : 1440,
    viewportHeight: screenshotMode === 'hero' ? 900  : 900,
    fullPage:       screenshotMode !== 'hero',
  };

  const serviceResult = await captureScreenshots({
    slug,
    currentSiteUrl:       websiteUrl,
    generatedPreviewPath: previewPath,   // service converts to file:// internally
    screenshotBase:       store.baseDir ? require('path').join(store.baseDir, 'screenshots') : undefined,
    captureOptions,
  });

  if (verbose) {
    console.log(`[screenshot-worker] service result:`, JSON.stringify({
      currentSiteScreenshot:      serviceResult.currentSiteScreenshot,
      generatedPreviewScreenshot: serviceResult.generatedPreviewScreenshot,
      errors:                     serviceResult.errors,
    }, null, 2));
  }

  // ── 5. Apply failure policy ──────────────────────────────────────────────────
  //
  // Map service result fields (camelCase) to worker result fields (snake_case).
  // Service returns: currentSiteScreenshot, generatedPreviewScreenshot, errors[]

  // Current-site failure: warn and continue — not a pipeline blocker.
  const currentFailed = !serviceResult.currentSiteScreenshot && websiteUrl;
  if (currentFailed) {
    const currentErr = (serviceResult.errors || []).find(e => e && e.type === 'current_site');
    console.warn(
      `[screenshot-worker] WARN: current-site screenshot failed for ${leadId} (slug="${slug}")` +
      (currentErr ? ` — ${currentErr.error}` : '') +
      ' (continuing)'
    );
  }

  // Generated preview failure: flag for retry / manual review — NOT silent success.
  const generatedFailed = !serviceResult.generatedPreviewScreenshot;
  let generatedNeedsReview = false;
  let generatedError = null;
  if (generatedFailed) {
    const genErr = (serviceResult.errors || []).find(e => e && e.type === 'generated_preview');
    generatedError = genErr ? genErr.error : 'unknown error';
    generatedNeedsReview = true;
    console.warn(
      `[screenshot-worker] WARN: generated preview screenshot failed for ${leadId} (slug="${slug}")` +
      ` — ${generatedError}` +
      ' (flagged for retry/manual review)'
    );
  }

  return {
    lead_id:                leadId,
    slug,
    screenshot_mode:        screenshotMode,
    current_path:           serviceResult.currentSiteScreenshot   || null,
    generated_path:         serviceResult.generatedPreviewScreenshot || null,
    skipped_current:        currentFailed || false,
    generated_needs_review: generatedNeedsReview,
    generated_error:        generatedError,
  };
}

module.exports = { screenshotWorkerHandler };
