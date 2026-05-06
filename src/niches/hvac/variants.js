'use strict';

module.exports = {
  intentVariantMap: {
    drive_primary_conversion: 'quote_form_hero',
    establish_trust:          'trust_badge_strip',
    highlight_services:       'service_icon_grid',
    show_social_proof:        'review_cards',
    show_local_proof:         'service_area_map',
    capture_lead:             'quote_form_cta',
    reduce_objections:        'faq_accordion',
    explain_process:          'numbered_steps',
    reinforce_authority:      'credentials_strip',
    secondary_cta_close:      'call_cta_bar'
  },
  sceneMap: {
    hero_scene: { surface: 'brand-soft', density: 'airy', intents: ['drive_primary_conversion', 'establish_trust'] },
    services_scene: { surface: 'paper', density: 'balanced', intents: ['highlight_services'] },
    proof_scene: { surface: 'warm-light', density: 'balanced', intents: ['show_social_proof', 'show_local_proof'] },
    conversion_scene: { surface: 'brand-strong', density: 'dense', intents: ['capture_lead'] }
  }
};
