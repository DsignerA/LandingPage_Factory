'use strict';

// Restaurant niche pack — intents.js
// Conversion funnel for restaurants: appetite → trust → menu → proof → reservation.

module.exports = {
  defaultIntentPlan: [
    'drive_primary_conversion',   // Hero: hunger appeal + reserve/order CTAs
    'establish_trust',            // Rating, years open, awards
    'highlight_services',         // Menu highlights / signature dishes
    'show_social_proof',          // Diner reviews
    'show_local_proof',           // Neighborhood / community ties
    'capture_lead'                // Reservation form / order CTA
  ],

  weaknessOverrides: {
    no_online_reservation: ['drive_primary_conversion', 'establish_trust', 'highlight_services', 'show_social_proof', 'capture_lead'],
    no_menu:               ['drive_primary_conversion', 'highlight_services', 'establish_trust', 'show_social_proof', 'capture_lead'],
    no_reviews:            ['drive_primary_conversion', 'highlight_services', 'establish_trust', 'show_local_proof', 'capture_lead']
  }
};
