'use strict';

module.exports = {
  headlinePatterns: [
    // Emphasize response time and transparent pricing in the headline.
    'Fast, Reliable HVAC Service. No Surprise Pricing in {city}.',
    'Get Your {city} HVAC Fixed Today — Transparent, Upfront Quotes.',
    'Licensed & Insured HVAC Experts in {city} — Same-Day Response.',
    '{city}’s Heating & Cooling Pros — 24/7 Service Without Hidden Fees.'
  ],
  subheadlinePatterns: [
    'Heating, cooling, and air quality solutions — fast response, upfront pricing.',
    'Licensed, insured, and ready to help. Get a free estimate today.',
    'Same-day service available. No hidden fees.'
  ],
  ctaLabels: {
    primary: 'Get a Free Quote',
    secondary: 'See Our Services',
    call: 'Call for Same-Day Service',
    emergency: 'Emergency? Call Now'
  },
  sectionHeadings: {
    services: 'Our HVAC Services',
    reviews: 'What Our Customers Say',
    serviceArea: 'Service Area',
    about: 'About Our Company',
    process: 'How It Works'
  },
  valueProps: [
    { title: 'Same-Day Service', description: 'We respond fast — most repairs completed the same day you call.', icon: '⚡' },
    { title: 'Upfront Pricing', description: 'No hidden fees. You know the cost before we start any work.', icon: '💰' },
    { title: 'Licensed & Insured', description: 'Fully certified professionals you can trust in your home.', icon: '🛡️' },
    { title: 'Local & Family-Owned', description: 'We live and work in {city} — your neighbors, not a call center.', icon: '🏠' }
  ],
  services: [
    { title: 'AC Repair', description: 'Fast diagnosis and repair for all makes and models.', icon: '❄️' },
    { title: 'Heating Repair', description: 'Keep your home warm — furnace and heat pump repair.', icon: '🔥' },
    { title: 'System Installation', description: 'New system installation with manufacturer warranty.', icon: '🔧' },
    { title: 'Preventive Maintenance', description: 'Annual tune-ups to extend system life and efficiency.', icon: '✅' },
    { title: 'Air Quality', description: 'Filtration, purification, and humidity control solutions.', icon: '💨' },
    { title: 'Emergency Service', description: '24/7 emergency response for heating and cooling failures.', icon: '🚨' }
  ]
};
