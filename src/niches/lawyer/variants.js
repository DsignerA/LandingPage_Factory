'use strict';

module.exports = {
  intentVariantMap: {
    drive_primary_conversion: 'split_consultation_hero',
    establish_trust:          'authority_badge_strip',
    reinforce_authority:      'credentials_results_strip',
    highlight_services:       'practice_area_cards',
    show_social_proof:        'testimonial_cards',
    explain_process:          'numbered_steps',
    reduce_objections:        'faq_accordion',
    capture_lead:             'consultation_form_cta',
    show_local_proof:         'location_proof_strip',
    secondary_cta_close:      'sticky_cta_bar'
  },
  sceneMap: {
    hero_scene: { surface: 'contrast-dark', density: 'airy', intents: ['drive_primary_conversion', 'reinforce_authority'] },
    services_scene: { surface: 'paper', density: 'balanced', intents: ['highlight_services'] },
    proof_scene: { surface: 'subtle-gradient', density: 'balanced', intents: ['show_social_proof', 'explain_process'] },
    objection_scene: { surface: 'warm-light', density: 'balanced', intents: ['reduce_objections'] },
    conversion_scene: { surface: 'brand-strong', density: 'dense', intents: ['capture_lead'] }
  }
};
