'use strict';

// src/engine/strategy-panel.js
// Strategy Explanation Panel — generates the "Why this page was built this way" HTML overlay.
//
// This panel is injected at the top of every preview page.
// It explains:
//   - The strategic intent plan (why each section was chosen)
//   - The design decisions (palette, hero variant, motion profile)
//   - Projected impact metrics (from niche pack proof data)
//   - The detected weaknesses/opportunities that drove the layout
//
// The panel is collapsible and only visible in preview mode (not production).

function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const INTENT_LABELS = {
  drive_primary_conversion: 'Primary Conversion',
  establish_trust:          'Trust Establishment',
  reinforce_authority:      'Authority Reinforcement',
  highlight_services:       'Service Showcase',
  show_social_proof:        'Social Proof',
  show_local_proof:         'Local Presence',
  reduce_objections:        'Objection Handling',
  capture_lead:             'Lead Capture',
  explain_process:          'Process Clarity',
  secondary_cta_close:      'Conversion Close'
};

const INTENT_RATIONALE = {
  drive_primary_conversion: 'Hero section placed first to capture intent immediately. Visitors who land here are already searching — the CTA must be visible before the fold.',
  establish_trust:          'Trust signals placed immediately after the hero. Visitors need social validation before they will take action.',
  reinforce_authority:      'Credentials and results shown early to establish authority and reduce skepticism for high-consideration decisions.',
  highlight_services:       'Services section surfaces what the business offers. Clarity here reduces bounce from visitors who are unsure if this business fits their need.',
  show_social_proof:        'Reviews and testimonials placed after services to validate the offering. Real words from real customers convert better than any marketing copy.',
  show_local_proof:         'Local signals (city, area, review count) reinforce that this is a real, nearby business — critical for local service searches.',
  reduce_objections:        'FAQ and insurance/pricing info placed before the final CTA to remove the last barriers to conversion.',
  capture_lead:             'Final conversion section with a clear form. Visitors who have scrolled this far are warm — a low-friction form captures them.',
  explain_process:          'A "How it works" section reduces anxiety about the process and sets expectations, especially for first-time buyers.',
  secondary_cta_close:      'Sticky bar or final CTA ensures conversion is always one tap away, regardless of scroll position.'
};

const VARIANT_LABELS = {
  split_booking_hero:        'Split layout with booking form',
  product_demo_hero:         'Product demo hero with video/screenshot',
  quote_form_hero:           'Quote form hero with inline lead capture',
  split_consultation_hero:   'Split layout with consultation form',
  lead_capture_hero:         'Lead capture hero with email/phone form',
  call_cta_hero:             'Click-to-call hero for phone-first conversion',
  split_premium:             'Premium split layout with image',
  centered_product:          'Centered hero with product screenshot',
  service_grid_cards:        'Grid of service cards',
  service_icon_grid:         'Icon-based service grid',
  practice_area_cards:       'Practice area cards with descriptions',
  review_cards:              'Review cards with star ratings',
  testimonial_cards:         'Testimonial cards with author attribution',
  insurance_faq_panel:       'Insurance info + FAQ accordion',
  faq_accordion:             'FAQ accordion',
  appointment_form_cta:      'Appointment request form CTA',
  quote_form_cta:            'Quote request form CTA',
  consultation_form_cta:     'Consultation request form CTA',
  contact_form_cta:          'Contact form CTA',
  numbered_steps:            'Numbered steps process section',
  rating_trust_strip:        'Rating + review count trust strip',
  trust_badge_strip:         'Trust badge strip',
  authority_badge_strip:     'Authority credentials badge strip',
  credentials_strip:         'Credentials and certifications strip',
  credentials_results_strip: 'Credentials + case results strip',
  location_proof_strip:      'Location and service area proof strip',
  service_area_map:          'Service area map/list',
  sticky_cta_bar:            'Sticky mobile CTA bar',
  call_cta_bar:              'Sticky click-to-call bar'
};

/**
 * Generate the strategy explanation panel HTML.
 * @param {object} options
 * @param {object} options.brief - The site brief
 * @param {string[]} options.intentPlan - The ordered intent plan
 * @param {Array<{intent: string, variant: string}>} options.intentVariantPlan - Intent+variant pairs
 * @param {object} options.design - The design profile
 * @param {object} options.nichePack - The resolved niche pack
 * @param {object} options.localProof - Local proof data
 * @returns {string} HTML string for the strategy panel
 */
function buildStrategyPanel({ brief, intentPlan, intentVariantPlan, design, nichePack, localProof }) {
  const b = brief || {};
  const brand = b.brand || {};
  const niche = String(b.niche || 'General Business');
  const goal = String(b.primary_goal || 'get_in_touch').replace(/_/g, ' ');
  const city = String(brand.city || '');
  const packConfig = (nichePack && nichePack.config) || {};
  const packProof = (nichePack && nichePack.proof) || {};
  const projectedImpact = Array.isArray(packProof.projectedImpact) ? packProof.projectedImpact : [];

  // Intent plan rows
  const intentRows = (intentVariantPlan || []).map((item, i) => {
    const label = INTENT_LABELS[item.intent] || item.intent;
    const variantLabel = VARIANT_LABELS[item.variant] || item.variant;
    const rationale = INTENT_RATIONALE[item.intent] || '';
    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:0.625rem 0.75rem;font-size:0.8125rem;color:#64748b;font-weight:600;white-space:nowrap">${i + 1}</td>
        <td style="padding:0.625rem 0.75rem;font-size:0.8125rem;font-weight:600;color:#1e293b">${htmlEscape(label)}</td>
        <td style="padding:0.625rem 0.75rem;font-size:0.8125rem;color:#475569">${htmlEscape(variantLabel)}</td>
        <td style="padding:0.625rem 0.75rem;font-size:0.8125rem;color:#64748b;max-width:320px">${htmlEscape(rationale)}</td>
      </tr>`;
  }).join('');

  // Projected impact cards
  const impactCards = projectedImpact.map(item => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.875rem 1rem;min-width:160px;flex:1">
      <div style="font-size:1.5rem;font-weight:800;color:#2563eb;font-family:system-ui">${htmlEscape(item.metric)}</div>
      <div style="font-size:0.8125rem;font-weight:600;color:#1e293b;margin-top:0.125rem">${htmlEscape(item.label)}</div>
      <div style="font-size:0.75rem;color:#64748b;margin-top:0.25rem">${htmlEscape(item.basis)}</div>
    </div>`).join('');

  // Design decisions
  const designDecisions = [
    { label: 'Palette', value: design && design.profile ? design.profile : (packConfig.palette || 'auto') },
    { label: 'Hero Variant', value: design && design.heroVariant ? design.heroVariant : (packConfig.heroVariant || 'split_premium') },
    { label: 'Motion Profile', value: design && design.motion && design.motion.enableScrollReveal ? 'scroll-reveal enabled' : 'static' },
    { label: 'Tone', value: packConfig.tone || 'professional' },
    { label: 'Conversion Mechanism', value: packConfig.conversionMechanism || 'form' }
  ].map(d => `
    <div style="display:flex;gap:0.5rem;align-items:baseline">
      <span style="font-size:0.75rem;font-weight:600;color:#64748b;min-width:140px;text-transform:uppercase;letter-spacing:0.04em">${htmlEscape(d.label)}</span>
      <span style="font-size:0.8125rem;color:#1e293b;font-weight:500">${htmlEscape(String(d.value))}</span>
    </div>`).join('');

  return `
<!-- Strategy Panel (preview mode only) -->
<div id="strategy-panel" style="font-family:system-ui,-apple-system,sans-serif;background:#ffffff;border-bottom:2px solid #2563eb;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="max-width:1200px;margin:0 auto;padding:0 1.5rem">

    <!-- Panel header (always visible) -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0.875rem 0;cursor:pointer" onclick="document.getElementById('strategy-panel-body').style.display=document.getElementById('strategy-panel-body').style.display==='none'?'block':'none'">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="background:#2563eb;color:#fff;font-size:0.6875rem;font-weight:700;padding:0.25rem 0.625rem;border-radius:9999px;letter-spacing:0.06em;text-transform:uppercase">Strategy Preview</div>
        <span style="font-size:0.9375rem;font-weight:600;color:#1e293b">${htmlEscape(brand.name || 'Preview')} — ${htmlEscape(niche)}${city ? ' · ' + htmlEscape(city) : ''}</span>
        <span style="font-size:0.8125rem;color:#64748b">Goal: <strong>${htmlEscape(goal)}</strong></span>
      </div>
      <button style="background:none;border:1px solid #e2e8f0;border-radius:0.375rem;padding:0.25rem 0.75rem;font-size:0.8125rem;color:#475569;cursor:pointer">Toggle Details ▾</button>
    </div>

    <!-- Panel body (collapsible) -->
    <div id="strategy-panel-body" style="display:none;padding-bottom:1.25rem">

      <!-- Intent plan table -->
      <div style="margin-bottom:1.25rem">
        <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.5rem">Conversion Funnel — Intent Plan</div>
        <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:0.5rem">
          <table style="width:100%;border-collapse:collapse;font-family:system-ui">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0">
                <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;font-weight:600;color:#64748b">#</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;font-weight:600;color:#64748b">Intent</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;font-weight:600;color:#64748b">Variant</th>
                <th style="padding:0.5rem 0.75rem;text-align:left;font-size:0.75rem;font-weight:600;color:#64748b">Rationale</th>
              </tr>
            </thead>
            <tbody>${intentRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Design decisions + projected impact (side by side) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">

        <!-- Design decisions -->
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.625rem">Design Decisions</div>
          <div style="border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.875rem 1rem;display:flex;flex-direction:column;gap:0.5rem">
            ${designDecisions}
          </div>
        </div>

        <!-- Projected impact -->
        <div>
          <div style="font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.625rem">Projected Impact</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.75rem">
            ${impactCards || '<div style="color:#94a3b8;font-size:0.875rem">No impact data available for this niche.</div>'}
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
<!-- /Strategy Panel -->
`;
}

module.exports = { buildStrategyPanel };
