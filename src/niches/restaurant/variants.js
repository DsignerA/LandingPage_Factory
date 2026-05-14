'use strict';

// Restaurant niche pack — variants.js
// Maps intents to presentational variants tuned for restaurants.

module.exports = {
  intentVariantMap: {
    drive_primary_conversion: 'media_background_hero',
    establish_trust:          'rating_trust_strip',
    highlight_services:       'menu_highlight_cards',
    show_social_proof:        'testimonial_cards',
    show_local_proof:         'location_proof_strip',
    reduce_objections:        'faq_accordion',
    capture_lead:             'reservation_form_cta',
    explain_process:          'numbered_steps',
    reinforce_authority:      'awards_strip',
    secondary_cta_close:      'sticky_cta_bar'
  },

  sceneMap: {
    hero_scene: {
      surface: 'image-overlay',
      density: 'airy',
      intents: ['drive_primary_conversion', 'establish_trust']
    },
    menu_scene: {
      surface: 'paper',
      density: 'balanced',
      intents: ['highlight_services']
    },
    proof_scene: {
      surface: 'warm-light',
      density: 'balanced',
      intents: ['show_social_proof', 'show_local_proof']
    },
    objection_scene: {
      surface: 'subtle-gradient',
      density: 'balanced',
      intents: ['reduce_objections']
    },
    conversion_scene: {
      surface: 'brand-strong',
      density: 'dense',
      intents: ['capture_lead', 'secondary_cta_close']
    }
  }
};
