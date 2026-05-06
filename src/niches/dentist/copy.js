'use strict';

// Dentist niche pack — copy.js
// Messaging conventions, headline patterns, and CTA language for dental practices.

module.exports = {
  headlinePatterns: [
    // Lead with the answers to patients’ biggest questions: insurance accepted, speed, and convenience.
    'Most PPO Plans Accepted. New Patients Seen in {city} This Week.',
    'Gentle Dental Care in {city} — Same-Week Appointments Available.',
    'Accepting New Patients in {city}. Evening & Saturday Hours.',
    '{city} Families Trust Us for Comfortable, Affordable Dental Care.'
  ],

  subheadlinePatterns: [
    'Comprehensive dental care for your whole family — from cleanings to cosmetic dentistry.',
    'We make dental visits comfortable, affordable, and easy to schedule.',
    'Same-week appointments available. Most insurance accepted.'
  ],

  ctaLabels: {
    primary: 'Request Your Appointment',
    secondary: 'See Our Services',
    booking: 'Book Online',
    call: 'Call Now',
    emergency: 'Emergency? Call Now'
  },

  sectionHeadings: {
    services: 'Our Dental Services',
    reviews: 'What Our Patients Say',
    insurance: 'Insurance & Payment',
    faq: 'Common Questions',
    about: 'About Our Practice',
    process: 'Your First Visit'
  },

  valueProps: [
    { title: 'Same-Week Appointments', description: 'New patients welcome — we work around your schedule.' },
    { title: 'Most Insurance Accepted', description: 'We verify your benefits before your visit so there are no surprises.' },
    { title: 'Gentle, Modern Care', description: 'Advanced techniques that minimize discomfort and maximize results.' },
    { title: 'Family-Friendly', description: 'A welcoming environment for patients of all ages.' }
  ],

  services: [
    { title: 'Cleanings & Checkups', description: 'Preventive care to keep your smile healthy year-round.', icon: '🦷' },
    { title: 'Fillings & Restorations', description: 'Treat cavities with tooth-colored, natural-looking restorations.', icon: '✨' },
    { title: 'Crowns & Bridges', description: 'Durable solutions to restore damaged or missing teeth.', icon: '👑' },
    { title: 'Teeth Whitening', description: 'Professional whitening for a noticeably brighter smile.', icon: '⭐' },
    { title: 'Dental Implants', description: 'Permanent, natural-feeling replacements for missing teeth.', icon: '🔬' },
    { title: 'Orthodontics', description: 'Straighten your smile with modern, comfortable options.', icon: '😁' }
  ],

  projectedImpact: [
    { metric: '+28%', label: 'Appointment requests from new patients', basis: 'Booking CTA in hero reduces friction' },
    { metric: '+35%', label: 'Mobile conversion rate', basis: 'Click-to-call and mobile-optimized layout' },
    { metric: '-40%', label: 'Front desk insurance questions', basis: 'Insurance info surfaced prominently' },
    { metric: '+22%', label: 'After-hours patient capture', basis: 'Chat and form available 24/7' }
  ]
};
