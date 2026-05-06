'use strict';

module.exports = {
  headlinePatterns: [
    // Lead with case specificity and remove risk: free consultation, pay nothing unless we win.
    '{practice_area} Attorney in {city} — Free Consultation & No Upfront Fees.',
    'Need a {practice_area} Lawyer in {city}? Pay Nothing Unless We Win.',
    '{city}’s Trusted {practice_area} Advocates — Free Case Evaluation.',
    'Injured or Facing Legal Trouble? Get a Risk‑Free Consultation in {city}.'
  ],
  subheadlinePatterns: [
    'Free consultation. No fees unless we win. Serving {city} and surrounding areas.',
    'Experienced, compassionate legal representation for {city} residents.',
    'We handle the legal complexity so you can focus on moving forward.'
  ],
  ctaLabels: {
    primary: 'Schedule a Free Consultation',
    secondary: 'View Our Practice Areas',
    call: 'Call for Immediate Help',
    emergency: 'Need Help Now? Call Us'
  },
  sectionHeadings: {
    services: 'Practice Areas',
    reviews: 'Client Testimonials',
    process: 'How We Work',
    results: 'Case Results',
    about: 'About Our Firm',
    faq: 'Frequently Asked Questions'
  },
  valueProps: [
    { title: 'Free Initial Consultation', description: 'Discuss your case with no obligation and no upfront cost.', icon: '📋' },
    { title: 'No Win, No Fee', description: 'Contingency arrangements available for qualifying cases.', icon: '🏆' },
    { title: 'Experienced Advocates', description: 'Decades of combined experience in {state} courts.', icon: '⚖️' },
    { title: 'Personal Attention', description: 'Your case is handled by a senior attorney, not passed to junior staff.', icon: '🤝' }
  ],
  services: [
    { title: 'Personal Injury', description: 'Accidents, slip and fall, and negligence claims.', icon: '⚖️' },
    { title: 'Family Law', description: 'Divorce, custody, and family legal matters.', icon: '👨‍👩‍👧' },
    { title: 'Criminal Defense', description: 'Protecting your rights at every stage of the process.', icon: '🛡️' },
    { title: 'Estate Planning', description: 'Wills, trusts, and probate guidance.', icon: '📜' },
    { title: 'Business Law', description: 'Contracts, disputes, and business formation.', icon: '💼' },
    { title: 'Real Estate', description: 'Transactions, disputes, and property law.', icon: '🏠' }
  ]
};
