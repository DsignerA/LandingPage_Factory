'use strict';

// Dentist niche pack — intents.js
// Defines the default intent funnel for dental practices.
// Ordered as a conversion funnel: hook → proof → services → objection handling → capture.

module.exports = {
  defaultIntentPlan: [
    'drive_primary_conversion',   // Hero with booking form — immediate action
    'establish_trust',            // Rating strip, years in practice, certifications
    'highlight_services',         // Core dental services grid
    'show_social_proof',          // Patient reviews / testimonials
    'reduce_objections',          // Insurance, FAQ, payment options
    'capture_lead'                // Final appointment CTA / form
  ],

  // Intent plan variants based on detected weaknesses/opportunities
  weaknessOverrides: {
    no_booking: ['drive_primary_conversion', 'establish_trust', 'highlight_services', 'show_social_proof', 'capture_lead'],
    no_reviews: ['drive_primary_conversion', 'highlight_services', 'establish_trust', 'reduce_objections', 'capture_lead'],
    no_insurance_info: ['drive_primary_conversion', 'establish_trust', 'highlight_services', 'reduce_objections', 'capture_lead']
  }
};
