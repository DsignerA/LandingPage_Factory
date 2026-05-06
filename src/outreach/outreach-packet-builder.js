'use strict';

/**
 * outreach-packet-builder.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Assembles the final outreach payload for a single lead.
 * Suitable for: cold email, cold calling notes, VA outreach, CRM import,
 * personalized video workflows.
 *
 * Consumes outputs from:
 *   - core/lead-normalizer.js         (normalizedLead)
 *   - src/audit/site-auditor.js       (auditResult)
 *   - src/audit/weakness-scoring.js   (scoringResult)
 *   - src/preview/strategy-summary.js (strategySummary)
 *   - src/preview/preview-storage.js  (previewMeta)
 *   - src/preview/screenshot-service.js (screenshotResult)
 */

const path = require('path');

// ── Validation schema ────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['lead_id', 'business_name'];

function validatePacket(packet) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (!packet[field]) errors.push(`Missing required field: ${field}`);
  }
  return errors;
}

// ── Cold email subject line generator ────────────────────────────────────────

function generateEmailSubject(businessName, topIssue, niche) {
  const n = String(niche || '').toLowerCase();
  // Use the full business name (up to 4 words) for a more personal subject line
  const nameParts = String(businessName || 'your practice').split(' ');
  const name = nameParts.slice(0, 4).join(' ');

  if (topIssue && /booking|appointment|cta/i.test(topIssue)) {
    return `${name} — quick idea to get more appointment requests from your website`;
  }
  if (topIssue && /after.hours|missed/i.test(topIssue)) {
    return `${name} — are you losing patients after hours?`;
  }
  if (topIssue && /mobile|sticky/i.test(topIssue)) {
    return `${name} — most of your visitors are on mobile (here's what we noticed)`;
  }
  if (topIssue && /review|trust/i.test(topIssue)) {
    return `${name} — we built a quick preview of what your site could look like`;
  }
  if (/dental|dentist/i.test(n)) {
    return `${name} — we built a free preview of your dental website`;
  }
  if (/hvac|plumb|roof/i.test(n)) {
    return `${name} — a quick look at what your website could be doing better`;
  }
  if (/law|attorney/i.test(n)) {
    return `${name} — we noticed a few things on your website worth discussing`;
  }
  return `${name} — we built a free preview of what your website could look like`;
}

// ── Cold email opener generator ──────────────────────────────────────────────

function generateEmailOpener(businessName, city, topIssue, niche) {
  const name = String(businessName || 'your practice');
  const loc  = city ? ` in ${city}` : '';

  if (topIssue && /booking|appointment|cta/i.test(topIssue)) {
    return `Hi, I was looking at ${name}'s website${loc} and noticed there's no clear booking button above the fold. We built a quick preview showing what it could look like with a proper appointment flow — no commitment, just a look.`;
  }
  if (topIssue && /after.hours|missed/i.test(topIssue)) {
    return `Hi, I was looking at ${name}'s website${loc} and noticed there's no way for patients to leave a message or book after hours. We put together a quick preview showing how you could capture those leads automatically.`;
  }
  if (topIssue && /mobile|sticky/i.test(topIssue)) {
    return `Hi, I checked out ${name}'s website${loc} on mobile and noticed the call button isn't visible while scrolling. We built a quick preview showing how a persistent mobile CTA could improve your booking rate.`;
  }
  return `Hi, I was looking at ${name}'s website${loc} and put together a quick preview showing a few improvements that could help you get more patients from your site.`;
}

// ── Relative path helper ─────────────────────────────────────────────────────

function toRelativePath(absPath, baseDir) {
  if (!absPath) return null;
  try {
    return path.relative(baseDir || process.cwd(), absPath);
  } catch (e) {
    return absPath;
  }
}

// ── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildOutreachPacket(options)
 *
 * @param {object} options
 * @param {object}  options.normalizedLead     - From lead-normalizer.js
 * @param {object}  options.auditResult        - From site-auditor.js
 * @param {object}  options.scoringResult      - From weakness-scoring.js
 * @param {object}  options.strategySummary    - From strategy-summary.js
 * @param {object}  [options.previewMeta]      - From preview-storage.js { previewPath, previewUrl, slug }
 * @param {object}  [options.screenshotResult] - From screenshot-service.js
 * @param {string}  [options.baseDir]          - Base directory for relative paths
 * @returns {{ packet: OutreachPacket, validationErrors: string[] }}
 */
function buildOutreachPacket(options = {}) {
  const {
    normalizedLead,
    auditResult,
    scoringResult,
    strategySummary,
    previewMeta    = {},
    screenshotResult = {},
    baseDir,
  } = options;

  const lead    = Object(normalizedLead || {});
  const audit   = Object(auditResult || {});
  const scoring = Object(scoringResult || {});
  const summary = Object(strategySummary || {});

  // ── Resolve identifiers ──────────────────────────────────────────────────
  const leadId       = lead.lead_id || lead.slug || previewMeta.slug || 'unknown';
  const businessName = lead.business_name || 'Unknown Business';
  const niche        = lead.niche || 'general';
  // normalizeLead outputs a combined `location` field ("Houston, TX"), not separate city/state
  const locationParts = (lead.location || '').split(',').map(s => s.trim());
  const city         = lead.city || locationParts[0] || '';
  const state        = lead.state || locationParts[1] || '';
  const phone        = lead.phone || '';
  const websiteUrl   = audit.website_url || lead.website_url || '';

  // ── Resolve preview URL ──────────────────────────────────────────────────
  const previewUrl = previewMeta.previewUrl || previewMeta.url || null;
  const previewPath = previewMeta.previewPath || previewMeta.path || null;

  // ── Resolve screenshots ──────────────────────────────────────────────────
  const currentSiteScreenshot = screenshotResult.currentSiteScreenshot
    ? toRelativePath(screenshotResult.currentSiteScreenshot, baseDir)
    : null;
  const generatedPreviewScreenshot = screenshotResult.generatedPreviewScreenshot
    ? toRelativePath(screenshotResult.generatedPreviewScreenshot, baseDir)
    : null;

  // ── Top issues ───────────────────────────────────────────────────────────
  const topIssues = (scoring.top_issues || summary.top_issues || []).slice(0, 5);
  const topIssue  = topIssues[0] || null;

  // ── Strategy summary ─────────────────────────────────────────────────────
  const strategyBullets = (summary.summary_bullets || []).slice(0, 5);
  const projectedImpact = (summary.projected_impact || []).slice(0, 4);
  const offerAngles     = (summary.offer_angles || []).slice(0, 3);

  // ── Outreach copy ────────────────────────────────────────────────────────
  const emailSubject = generateEmailSubject(businessName, topIssue, niche);
  const emailOpener  = generateEmailOpener(businessName, city, topIssue, niche);

  // ── Audit observations summary ───────────────────────────────────────────
  const obs = audit.observations || {};
  const auditSummary = {
    site_score:       scoring.site_score || 0,
    weakness_count:   scoring.weakness_count || 0,
    has_booking:      !!obs.hasBookingFlow,
    has_phone:        !!obs.hasPhoneNumber,
    has_reviews:      !!obs.hasVisibleReviews,
    has_chat:         !!obs.hasChatWidget,
    has_insurance:    !!obs.hasInsuranceInfo,
    has_mobile_cta:   !!obs.hasStickyMobileCTA,
    has_after_hours:  !!obs.hasAfterHoursCapture,
    fetch_status:     audit.fetch_status || 'unknown',
  };

  // ── Assemble packet ──────────────────────────────────────────────────────
  const packet = {
    // Identity
    lead_id:        leadId,
    business_name:  businessName,
    niche,
    city,
    state,
    phone,
    website_url:    websiteUrl,
    generated_at:   new Date().toISOString(),

    // Preview
    preview_url:    previewUrl,
    preview_path:   previewPath ? toRelativePath(previewPath, baseDir) : null,

    // Screenshots
    current_site_screenshot:    currentSiteScreenshot,
    generated_preview_screenshot: generatedPreviewScreenshot,

    // Intelligence
    audit_summary:  auditSummary,
    top_issues:     topIssues,

    // Strategy
    strategy_summary:  strategyBullets,
    projected_impact:  projectedImpact,
    offer_angles:      offerAngles,

    // Outreach copy
    outreach: {
      email_subject: emailSubject,
      email_opener:  emailOpener,
      call_notes:    topIssues.slice(0, 3).map(issue => `• ${issue}`).join('\n'),
    },

    // CRM-ready flat fields
    crm: {
      lead_id:        leadId,
      business_name:  businessName,
      niche,
      city,
      state,
      phone,
      website_url:    websiteUrl,
      preview_url:    previewUrl,
      site_score:     auditSummary.site_score,
      weakness_count: auditSummary.weakness_count,
      top_issue_1:    topIssues[0] || '',
      top_issue_2:    topIssues[1] || '',
      top_issue_3:    topIssues[2] || '',
      offer_angle_1:  offerAngles[0] || '',
      offer_angle_2:  offerAngles[1] || '',
      email_subject:  emailSubject,
      current_screenshot: currentSiteScreenshot || '',
      preview_screenshot: generatedPreviewScreenshot || '',
    },
  };

  const validationErrors = validatePacket(packet);

  return { packet, validationErrors };
}

/**
 * packetsToCSV(packets)
 * Converts an array of outreach packets to a CSV string using the crm flat fields.
 */
function packetsToCSV(packets) {
  if (!packets || packets.length === 0) return '';

  const headers = Object.keys(packets[0].crm);
  const rows = packets.map(p => {
    return headers.map(h => {
      const val = String(p.crm[h] || '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * packetsToJSONL(packets)
 * Converts an array of outreach packets to JSONL format (one JSON object per line).
 */
function packetsToJSONL(packets) {
  return (packets || []).map(p => JSON.stringify(p)).join('\n');
}

module.exports = { buildOutreachPacket, packetsToCSV, packetsToJSONL };
