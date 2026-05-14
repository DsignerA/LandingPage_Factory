'use strict';

// Restaurant niche pack — proof.js
// Trust signals, diner reviews, and local proof for restaurants.

module.exports = {
  trustBadges: [
    { icon: '⭐', label: '4.7 Average Rating' },
    { icon: '🏆', label: 'Award-Winning' },
    { icon: '🍽️', label: 'Chef-Driven Menu' },
    { icon: '📍', label: 'Neighborhood Favorite' }
  ],

  reviewTemplates: [
    { author: 'Jamie R.', rating: 5, text: 'The steak was perfectly cooked and the service was incredible. We will be back.' },
    { author: 'Priya S.', rating: 5, text: 'Hands down the best dinner we have had in months. Beautiful room, attentive staff, and the menu is fantastic.' },
    { author: 'Marcus T.', rating: 5, text: 'A real find. Reservation was easy, the food was elevated, and the wine list is excellent.' },
    { author: 'Helena W.', rating: 5, text: 'We celebrated our anniversary here and they made the whole evening feel special. Highly recommend.' }
  ],

  awards: [
    'Featured in local food press',
    'Repeat diners choice award',
    'Award-winning wine program'
  ],

  localProofPatterns: [
    'A {city} dining staple for years',
    'Serving {neighborhood} since {year}',
    '{review_count}+ five-star reviews from {city} diners'
  ],

  objectionHandlers: [
    { question: 'How far in advance should I reserve?', answer: 'We recommend booking 3–7 days ahead for weekends. Weeknights are usually available same-day.' },
    { question: 'Do you offer take-out or delivery?',    answer: 'Yes — order online for pickup, or check our delivery partners on the menu page.' },
    { question: 'Can you host private events?',          answer: 'Absolutely. We host rehearsals, birthdays, and small corporate dinners. Get in touch for availability.' },
    { question: 'Do you accommodate dietary restrictions?', answer: 'Our kitchen handles most allergies and dietary needs — just let us know when you book.' }
  ]
};
