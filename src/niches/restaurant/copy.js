'use strict';

// Restaurant niche pack — copy.js
// Headlines, CTAs, and menu-flavored value props.

module.exports = {
  headlinePatterns: [
    '{city}\'s Favorite Place to Dine — Reserve a Table Tonight.',
    'A {city} Classic. Hand-Crafted Plates and Hand-Picked Wines.',
    'Fresh, Seasonal, and Local — Now Taking Reservations in {city}.',
    'Tonight, Eat Where {city} Eats.'
  ],

  subheadlinePatterns: [
    'Hand-crafted seasonal menus, warm hospitality, and an unforgettable evening.',
    'Reserve a table or order take-out — fresh from our kitchen to yours.',
    'A neighborhood favorite serving classic plates with a modern twist.'
  ],

  ctaLabels: {
    primary: 'Reserve a Table',
    secondary: 'See the Menu',
    booking: 'Make a Reservation',
    order: 'Order Take-Out',
    call: 'Call to Reserve',
    privateEvents: 'Plan a Private Event'
  },

  sectionHeadings: {
    services: 'On the Menu',
    reviews: 'What Our Guests Say',
    hours: 'Hours & Location',
    privateEvents: 'Private Events',
    faq: 'Good to Know',
    about: 'Our Story'
  },

  valueProps: [
    { title: 'Reserve in Seconds',     description: 'Book your table online — no phone calls, no waiting.' },
    { title: 'Fresh, Seasonal Menus',  description: 'Chef-driven plates that change with what is best right now.' },
    { title: 'Take-Out & Delivery',    description: 'Bring the dining room to your table at home.' },
    { title: 'Private Dining',         description: 'Perfect for celebrations, rehearsals, and small parties.' }
  ],

  // Generic menu placeholders — real menus should come from site analysis.
  services: [
    { title: 'Signature Plates',  description: 'Chef-driven entrees built around what is fresh this week.', icon: '🍽️' },
    { title: 'Seasonal Specials', description: 'A rotating selection that follows the seasons.',           icon: '🌿' },
    { title: 'Wine & Cocktails',  description: 'A thoughtfully curated bar and wine list.',                 icon: '🍷' },
    { title: 'Desserts',          description: 'House-made sweets to finish the evening.',                  icon: '🍰' },
    { title: 'Take-Out',          description: 'Order online for pickup or delivery.',                      icon: '🥡' },
    { title: 'Private Events',    description: 'Rehearsals, birthdays, and intimate gatherings.',           icon: '🥂' }
  ],

  projectedImpact: [
    { metric: '+34%', label: 'Reservation completion rate',     basis: 'One-click reservation widget in hero' },
    { metric: '+27%', label: 'Online take-out orders',           basis: 'Prominent Order CTA + menu integration' },
    { metric: '+18%', label: 'First-time visitor conversions',   basis: 'Social proof and signature dish imagery above the fold' },
    { metric: '+22%', label: 'Private event inquiries',          basis: 'Dedicated private events section with form' }
  ]
};
