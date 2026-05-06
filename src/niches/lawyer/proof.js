'use strict';

module.exports = {
  trustBadges: [
    { icon: '⚖️', label: 'State Bar Member' },
    { icon: '🏆', label: 'Top Rated Attorney' },
    { icon: '📋', label: 'Free Consultation' },
    { icon: '🔒', label: 'Confidential' }
  ],
  reviewTemplates: [
    { author: 'Rachel B.', rating: 5, text: 'Exceptional legal guidance. They kept me informed every step of the way and achieved a great outcome.' },
    { author: 'Tom H.', rating: 5, text: 'Professional, responsive, and genuinely invested in my case. I felt supported throughout the entire process.' },
    { author: 'Priya S.', rating: 5, text: 'They explained everything clearly and fought hard for my rights. I cannot recommend them highly enough.' },
    { author: 'James W.', rating: 5, text: 'The free consultation was incredibly helpful. They were honest about my options and delivered results.' }
  ],
  localProofPatterns: [
    'Serving clients throughout {state}',
    '{city}-based firm with statewide reach',
    'Trusted by {review_count}+ clients in {city}'
  ],
  objectionHandlers: [
    { question: 'How much does a consultation cost?', answer: 'Your initial consultation is completely free and confidential.' },
    { question: 'How long will my case take?', answer: 'Every case is different. We will give you an honest timeline assessment during your consultation.' },
    { question: 'What are your fees?', answer: 'We offer contingency fee arrangements for many case types — you pay nothing unless we win.' }
  ],
  projectedImpact: [
    { metric: '+40%', label: 'Consultation requests', basis: 'Free consultation CTA reduces barrier to contact' },
    { metric: '+30%', label: 'Client trust before first call', basis: 'Authority signals and case results build credibility' },
    { metric: '+25%', label: 'Qualified lead quality', basis: 'Practice area clarity filters for right-fit clients' },
    { metric: '-35%', label: 'Objection-driven drop-offs', basis: 'FAQ and process section addresses common hesitations' }
  ]
};
