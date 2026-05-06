'use strict';

module.exports = {
  trustBadges: [
    { icon: '⭐', label: '4.8 Rating' },
    { icon: '🔧', label: 'Licensed & Insured' },
    { icon: '⚡', label: 'Same-Day Service' },
    { icon: '📍', label: 'Local & Family-Owned' }
  ],
  reviewTemplates: [
    { author: 'Chris T.', rating: 5, text: 'Fast response and fair pricing. My AC was fixed the same day I called. Will definitely use them again.' },
    { author: 'Maria L.', rating: 5, text: 'Professional crew, showed up on time, and cleaned up after themselves. Highly recommend.' },
    { author: 'Derek W.', rating: 5, text: 'Diagnosed the problem quickly and gave me an upfront price before starting any work. No surprises.' },
    { author: 'Sandra B.', rating: 5, text: 'Best HVAC company in the area. They installed a new system and the house has never been more comfortable.' }
  ],
  localProofPatterns: [
    'Serving {city} and surrounding areas',
    'Licensed contractor in {state}',
    '{review_count}+ satisfied customers in {city}'
  ],
  objectionHandlers: [
    { question: 'How fast can you respond?', answer: 'We offer same-day and next-day service for most repairs in the {city} area.' },
    { question: 'Do you provide free estimates?', answer: 'Yes — we provide free, no-obligation estimates for all installations and major repairs.' },
    { question: 'Are you licensed and insured?', answer: 'Fully licensed, bonded, and insured in {state}. License number available on request.' }
  ],
  projectedImpact: [
    { metric: '+32%', label: 'Quote requests from website', basis: 'Quote form in hero reduces friction' },
    { metric: '+45%', label: 'Mobile call conversions', basis: 'Click-to-call prominently placed' },
    { metric: '+25%', label: 'Service area visibility', basis: 'Local proof and city mentions improve local SEO' },
    { metric: '-30%', label: 'Missed after-hours leads', basis: 'Contact form captures requests 24/7' }
  ]
};
