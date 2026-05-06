'use strict';

module.exports = {
  defaultIntentPlan: [
    'drive_primary_conversion',   // Hero with quote form
    'establish_trust',            // License, rating, years in business
    'highlight_services',         // HVAC services grid
    'show_social_proof',          // Customer reviews
    'show_local_proof',           // Service area, local presence
    'capture_lead'                // Final quote CTA
  ],
  weaknessOverrides: {
    no_reviews: ['drive_primary_conversion', 'establish_trust', 'highlight_services', 'show_local_proof', 'capture_lead'],
    no_service_area: ['drive_primary_conversion', 'establish_trust', 'highlight_services', 'show_social_proof', 'capture_lead']
  }
};
