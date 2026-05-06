'use strict';
/**
 * test-upgrade.js — Multi-niche test for the upgrade provider
 * Tests the full pipeline across dental, HVAC, and legal niches.
 */
const path = require('path');
const { normalizeLead } = require('../../core/lead-normalizer');
const buildSiteBrief = require('../data/site-brief-builder');
const { generate: generatePageSchema } = require('../ai/ai-page-generator');
const { render } = require('../engine/render-engine');
const { storePreview } = require('../preview/preview-storage');
const { analyzeSite } = require('../data/site-analyzer');

const TEST_LEADS = [
  {
    business_name: 'Little Oaks Smile Center',
    niche: 'dentist',
    city: 'Houston',
    state: 'Texas',
    website_url: 'riveroakssmilecenter.com',
    offer_angle: 'after_hours_patient_capture',
    google_rating: 4.9,
    review_count: 312,
    phone: '(713) 555-0192',
    notes: 'Weaknesses: No online booking, no insurance info, no mobile site'
  },
  {
    business_name: 'Frosty Air Heating & Cooling',
    niche: 'hvac',
    city: 'Austin',
    state: 'Texas',
    website_url: 'frostyairhvac.com',
    offer_angle: 'generate_leads',
    google_rating: 4.7,
    review_count: 89,
    phone: '(512) 555-0847',
    notes: 'Weaknesses: No instant quote, no trust badges, no emergency CTA'
  },
  {
    business_name: 'Rivera & Associates Law',
    niche: 'attorney',
    city: 'Miami',
    state: 'Florida',
    website_url: 'riveralaw.com',
    offer_angle: 'schedule_consultation',
    google_rating: 4.8,
    review_count: 47,
    phone: '(305) 555-0234',
    notes: 'Weaknesses: No free consultation CTA, no practice area cards, no social proof'
  }
];

async function runTest(rawLead) {
  const lead = normalizeLead(rawLead, {});
  console.log(`\n[test] Processing: ${rawLead.business_name} (${rawLead.niche})`);

  let siteAnalysis = null;
  try {
    siteAnalysis = await analyzeSite(lead, { timeout: 10000 });
    if (siteAnalysis) {
      console.log(`[analyze] opportunities:`, siteAnalysis.site_opportunities.slice(0, 3));
    }
  } catch (e) {
    console.warn(`[analyze] skipped: ${e && e.message}`);
  }

  const briefOptions = siteAnalysis ? {
    siteIdentity:      siteAnalysis.site_identity,
    siteOpportunities: siteAnalysis.site_opportunities
  } : {};
  const brief = buildSiteBrief(lead, briefOptions);
  const schema = generatePageSchema(brief, { provider: 'upgrade' });
  const html = render(schema, { assetPrefix: './' });

  const saveDir = path.resolve(process.cwd(), 'previews');
  const stored = await storePreview({
    lead_id: lead.lead_id,
    slug: brief.slug,
    html,
    business_name: brief.brand && brief.brand.name,
    location: brief.location,
    created_at: lead.created_at,
    generator: 'upgrade',
    schema_version: 'schema-1'
  }, { saveDir, copyAssets: true });

  // Verify all 10 sections
  const sectionTypes = schema.map(s => s.type);
  const required = ['hero', 'trust-signals', 'services-grid', 'reviews', 'how-it-works', 'virtual-front-desk', 'faq', 'upgrade-signal', 'cta'];
  const missing = required.filter(t => !sectionTypes.includes(t));

  console.log(`[ok] Sections: ${sectionTypes.join(', ')}`);
  if (missing.length) {
    console.warn(`[warn] Missing sections: ${missing.join(', ')}`);
  } else {
    console.log(`[ok] All required sections present`);
  }

  const heroSection = schema.find(s => s.type === 'hero');
  console.log(`[ok] Hero: "${heroSection && heroSection.props && heroSection.props.title}"`);
  console.log(`[ok] File: ${stored.filePath}`);

  return stored;
}

async function main() {
  console.log('=== Upgrade Provider Multi-Niche Test ===\n');
  for (const lead of TEST_LEADS) {
    try {
      await runTest(lead);
    } catch (err) {
      console.error(`[error] ${lead.business_name}: ${err && err.message}`);
    }
  }
  console.log('\n=== All tests complete ===');
}

main().catch(err => {
  console.error('Test failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
