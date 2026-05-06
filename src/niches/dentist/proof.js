'use strict';

// Dentist niche pack — proof.js
// Trust signals, review templates, and local proof patterns for dental practices.

module.exports = {
  trustBadges: [
    { icon: '⭐', label: '4.9 Rating' },
    { icon: '🦷', label: 'ADA Member' },
    { icon: '🏥', label: 'Accepting New Patients' },
    { icon: '🛡️', label: 'Most Insurance Accepted' }
  ],

  reviewTemplates: [
    { author: 'Alicia M.', rating: 5, text: 'The friendliest dental office I have ever been to. Painless cleaning and they explained everything clearly.' },
    { author: 'Jordan P.', rating: 5, text: 'They fit me in the same day when I chipped a tooth. Excellent care and very reasonable pricing.' },
    { author: 'Sam K.', rating: 5, text: 'Finally a dentist that accepts my insurance and doesn\'t make me wait weeks for an appointment.' },
    { author: 'Maria L.', rating: 5, text: 'My kids actually look forward to going to the dentist now. The staff is incredibly patient and kind.' }
  ],

  insuranceSignals: [
    'Delta Dental PPO',
    'Cigna',
    'Aetna',
    'MetLife',
    'United Concordia',
    'Most PPO Plans'
  ],

  localProofPatterns: [
    'Serving {city} families since {year}',
    'Trusted by patients across {neighborhood}',
    '{review_count}+ happy patients in {city}'
  ],

  objectionHandlers: [
    { question: 'Do you accept my insurance?', answer: 'We accept most PPO plans and will verify your benefits before your visit.' },
    { question: 'How quickly can I get an appointment?', answer: 'We offer same-week appointments for new patients and same-day for dental emergencies.' },
    { question: 'Are your prices transparent?', answer: 'Yes — we provide clear treatment estimates before any procedure begins.' }
  ]
};
