'use strict';

module.exports = {
  defaultIntentPlan: [
    'drive_primary_conversion',
    'reinforce_authority',
    'highlight_services',
    'show_social_proof',
    'explain_process',
    'reduce_objections',
    'capture_lead'
  ],
  weaknessOverrides: {
    no_results: ['drive_primary_conversion', 'highlight_services', 'establish_trust', 'reduce_objections', 'capture_lead']
  }
};
