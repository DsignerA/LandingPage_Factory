'use strict';

// Dentist niche pack — variants.js
// Maps intents to the best presentational variants for dental practices.

module.exports = {
  intentVariantMap: {
    drive_primary_conversion: 'split_booking_hero',
    establish_trust:          'rating_trust_strip',
    highlight_services:       'service_grid_cards',
    show_social_proof:        'testimonial_cards',
    reduce_objections:        'insurance_faq_panel',
    capture_lead:             'appointment_form_cta',
    show_local_proof:         'location_proof_strip',
    explain_process:          'numbered_steps',
    reinforce_authority:      'credentials_strip',
    secondary_cta_close:      'sticky_cta_bar'
  },

  sceneMap: {
    hero_scene: {
      surface: 'brand-soft',
      density: 'airy',
      intents: ['drive_primary_conversion', 'establish_trust']
    },
    proof_scene: {
      surface: 'warm-light',
      density: 'balanced',
      intents: ['show_social_proof', 'show_local_proof']
    },
    services_scene: {
      surface: 'paper',
      density: 'balanced',
      intents: ['highlight_services']
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
