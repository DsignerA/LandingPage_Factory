'use strict';
/**
 * upgrade.js — Persuasive Upgrade Provider
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements the full 10-step persuasive upgrade model:
 *
 *  Step 1  — Uses site_identity from site-analyzer (already in brief.siteIdentity)
 *  Step 2  — Uses site_opportunities from site-analyzer (brief.siteOpportunities)
 *  Step 3  — Generates improvements that directly address detected weaknesses
 *  Step 4  — Follows the conversion layout: Hero → Trust → Services → Reviews
 *             → Insurance/Info → How It Works → Virtual Assistant → FAQ → CTA → Contact
 *  Step 5  — Subtly highlights improvements (booking, reviews, chat, mobile)
 *  Step 6  — Uses real business data everywhere (name, city, rating, phone)
 *  Step 7  — Premium visual quality: card layouts, motion, hero images, trust badges
 *  Step 8  — Exports deployable static HTML (handled by render-engine)
 *  Step 9  — Adds subtle upgrade signal section
 *  Step 10 — Sales psychology: "This looks better than my current website"
 */

function toStringSafe(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function collapseSpaces(s) {
  return toStringSafe(s).replace(/\s+/g, ' ').trim();
}

function nicheCategory(niche) {
  const n = toStringSafe(niche).toLowerCase();
  if (/dental|dentist|orthodont|dmd|dds|chiro|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet/.test(n)) return 'healthcare_local';
  if (/hvac|plumb|roof|electric|pest|landscap|contractor|remodel|garage|floor|clean/.test(n)) return 'home_service';
  if (/law|attorney|legal|account|cpa|consult|coach|agency|insurance|realtor|real\s*estate/.test(n)) return 'professional_service';
  if (/saas|software|b2b|it|cyber|cloud|devops|data|ai|ml|analytics/.test(n)) return 'b2b_saas';
  if (/e-?com|shop|store|retail|boutique/.test(n)) return 'ecommerce';
  if (/restaurant|cafe|coffee|bar|pizza|food|catering|bakery/.test(n)) return 'restaurant';
  return 'general';
}

function isDentalNiche(niche) {
  return /(dental|dentist|orthodont|dmd|dds|tooth|teeth)/i.test(toStringSafe(niche));
}

// ─── Step 3: Map opportunities to improvements ────────────────────────────────
function opportunitiesToImprovements(opportunities) {
  const map = {
    'no online appointment booking':        'Book Appointment button added to hero',
    'reviews not highlighted':              'Review highlights section added near the top',
    'weak or missing hero headline':        'Compelling, benefit-driven hero headline',
    'no patient faq section':               'Patient FAQ section with common questions answered',
    'no mobile-friendly layout':            'Mobile-first responsive layout',
    'no live chat or virtual assistant':    'Virtual assistant available 24/7',
    'no trust signals':                     'Trust badges, ratings, and certifications displayed',
    'no clear call-to-action':              'Clear CTA in every section',
    'phone number not visible':             'Phone number prominent in header and hero',
    'no free consultation cta':             'Free consultation CTA added',
    'no instant quote':                     'Instant quote form in hero',
    'no trust badges':                      'Trust badges and certifications displayed',
    'no emergency':                         'Emergency / same-day contact option added',
    'no product demo':                      'Product demo CTA added',
    'no social proof':                      'Customer logos and testimonials added'
  };
  return (opportunities || []).map(opp => {
    const key = opp.toLowerCase();
    for (const [pattern, improvement] of Object.entries(map)) {
      if (key.includes(pattern)) return improvement;
    }
    return opp; // return as-is if no mapping found
  }).filter(Boolean);
}

// ─── Step 6: Build strong, personalized hero headline ─────────────────────────
function buildPersonalizedHeroHeadline(brief) {
  const brand = (brief && brief.brand) || {};
  const messaging = (brief && brief.messaging) || {};
  const cat = nicheCategory(brief && brief.niche);
  const city = collapseSpaces((brief && brief.contact && brief.contact.address && brief.contact.address.city) || '');
  const state = collapseSpaces((brief && brief.contact && brief.contact.address && brief.contact.address.state) || '');
  const location = city || collapseSpaces((brief && brief.location) || '');

  // Use existing headline from messaging if it's strong (not generic)
  const existingHeadline = collapseSpaces(messaging.headline || '');
  const brandName = collapseSpaces((brief && brief.brand && brief.brand.name) || '');
  // Consider the headline generic if it is just the business name, a placeholder, or too short
  const isGeneric = !existingHeadline ||
    existingHeadline.toLowerCase() === 'your business' ||
    existingHeadline.toLowerCase() === 'welcome' ||
    existingHeadline.length < 15 ||
    (brandName && existingHeadline.toLowerCase() === brandName.toLowerCase());

  if (!isGeneric) return existingHeadline;

  // Prefer the live site's hero headline if it's substantial and not just the brand name.
  // This keeps real taglines like "Richmond's award-winning and historic steakhouse"
  // from getting overwritten by a generic category template.
  const siteIdentity = brief && brief.siteIdentity;
  const scrapedHeadline = collapseSpaces((siteIdentity && siteIdentity.heroHeadline) || '');
  const scrapedIsUsable = scrapedHeadline &&
    scrapedHeadline.length >= 15 &&
    scrapedHeadline.length <= 140 &&
    (!brandName || scrapedHeadline.toLowerCase() !== brandName.toLowerCase());
  if (scrapedIsUsable) return scrapedHeadline;

  // Generate a strong, location-specific headline
  const name = collapseSpaces(brand.name || '');
  const locSuffix = location ? ` in ${location}` : '';

  const headlines = {
    healthcare_local: isDentalNiche(brief && brief.niche)
      ? `Gentle, Modern Dental Care${locSuffix} — New Patients Welcome`
      : `Compassionate Healthcare${locSuffix} — Accepting New Patients`,
    home_service:        `Fast, Reliable Service${locSuffix} — Get a Free Quote Today`,
    professional_service:`Expert Guidance${locSuffix} — Free Consultation Available`,
    b2b_saas:            `The Smarter Way to ${name || 'Grow Your Business'}`,
    ecommerce:           `Shop ${name || 'Our Collection'} — Fast Shipping, Easy Returns`,
    restaurant:          `Fresh, Delicious Food${locSuffix} — Order Online or Reserve a Table`,
    general:             `${name || 'Welcome'} — Serving ${location || 'Our Community'} with Excellence`
  };

  return headlines[cat] || headlines.general;
}

// ─── Step 6: Build strong subtitle ────────────────────────────────────────────
function buildPersonalizedSubtitle(brief) {
  const messaging = (brief && brief.messaging) || {};
  const trust = (brief && brief.trust) || {};
  const cat = nicheCategory(brief && brief.niche);
  const rating = trust.rating;
  const reviewCount = trust.review_count;

  // If we have real rating data, use it in the subtitle
  if (rating && reviewCount) {
    const ratingStr = rating.toFixed(1);
    const reviewStr = reviewCount >= 1000 ? (reviewCount / 1000).toFixed(1) + 'k' : String(reviewCount);
    const catSubtitles = {
      healthcare_local: `Rated ${ratingStr} ★ by ${reviewStr} patients. We make every visit comfortable, clear, and convenient.`,
      home_service:     `Rated ${ratingStr} ★ by ${reviewStr} customers. Fast response, upfront pricing, guaranteed work.`,
      professional_service: `Trusted by ${reviewStr} clients with a ${ratingStr}-star rating. Expert advice, real results.`,
      general:          `Rated ${ratingStr} ★ by ${reviewStr} customers. Reliable, professional, and always here for you.`
    };
    return catSubtitles[cat] || catSubtitles.general;
  }

  // Prefer the live site's tagline (meta description / og:description) when present.
  const siteIdentity = brief && brief.siteIdentity;
  const scrapedTagline = collapseSpaces((siteIdentity && (siteIdentity.heroTagline || siteIdentity.heroHeadline)) || '');
  if (scrapedTagline && scrapedTagline.length > 20 && scrapedTagline.length <= 240) {
    return scrapedTagline;
  }

  // Fall back to messaging
  const existing = collapseSpaces(messaging.subheadline || messaging.elevator_pitch || '');
  if (existing && existing.length > 20) return existing;

  const defaults = {
    healthcare_local: 'We make every visit comfortable, clear, and convenient. Book your appointment online in seconds.',
    home_service:     'Fast response, upfront pricing, and guaranteed work. Get your free estimate today.',
    professional_service: 'Expert guidance tailored to your situation. Free consultation — no obligation.',
    b2b_saas:         'Everything your team needs to move faster and grow smarter. See it live in 20 minutes.',
    general:          'Professional, reliable, and always here when you need us. Contact us today.'
  };

  return defaults[cat] || defaults.general;
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHero(brief) {
  const ctas = (brief && brief.ctas) || {};
  const brand = (brief && brief.brand) || {};
  const cat = nicheCategory(brief && brief.niche);
  const trust = (brief && brief.trust) || {};
  const contact = (brief && brief.contact) || {};

  const title    = buildPersonalizedHeroHeadline(brief);
  const subtitle = buildPersonalizedSubtitle(brief);

  const primaryCta   = ctas.primary   || { label: 'Book Appointment', href: '#book' };
  const secondaryCta = ctas.secondary || { label: 'Call Us', href: contact.phone ? `tel:${contact.phone}` : '#contact' };

  // Trust props for hero — use real data
  const trustProps = [];
  if (trust.rating && trust.review_count) {
    trustProps.push(`⭐ ${trust.rating.toFixed(1)} rating · ${trust.review_count} reviews`);
  }
  if (contact.phone) trustProps.push(`Call ${contact.phone}`);
  if (cat === 'healthcare_local') trustProps.push('New Patients Welcome');
  if (cat === 'home_service')     trustProps.push('Free Estimates');

  const trustLineMap = {
    healthcare_local:    'No commitment required — we will call you back within 2 hours',
    home_service:        'Get a response within 1 hour — no obligation',
    professional_service:'Free 30-minute consultation. No obligation.',
    b2b_saas:            'See a live demo in under 20 minutes'
  };

  return {
    id: 'hero-1',
    type: 'hero',
    variant: cat === 'home_service' ? 'service_quote_split'
           : cat === 'b2b_saas'    ? 'product_demo'
           : cat === 'restaurant'  ? 'media_background'
           : 'split_premium',
    props: {
      title,
      subtitle,
      label: cat === 'healthcare_local' ? 'Accepting New Patients' : cat === 'home_service' ? 'Free Estimates' : '',
      primaryCta,
      secondaryCta,
      trustProps,
      heroImageUrl: (brand && brand.heroImageUrl) || null,
      trustLine: trustLineMap[cat] || '',
      cardHeading: cat === 'healthcare_local' ? 'Request an Appointment' : cat === 'home_service' ? 'Get a Free Quote' : 'Get in Touch'
    }
  };
}

function buildTrustSignals(brief) {
  const trust   = (brief && brief.trust)   || {};
  const contact = (brief && brief.contact) || {};
  const brand   = (brief && brief.brand)   || {};
  const cat     = nicheCategory(brief && brief.niche);

  const badgesByCategory = {
    healthcare_local:    ['Licensed & Insured', 'Accepting New Patients', 'Same-Day Appointments'],
    home_service:        ['Licensed & Insured', 'Free Estimates', 'Satisfaction Guaranteed'],
    professional_service:['Certified Professional', 'Free Consultation', 'Confidential'],
    b2b_saas:            ['SOC 2 Compliant', 'Free Trial', '24/7 Support'],
    general:             ['Trusted Local Business', 'Satisfaction Guaranteed', 'Locally Owned']
  };

  return {
    id: 'trust-signals-1',
    type: 'trust-signals',
    props: {
      rating:        trust.rating       || null,
      reviewCount:   trust.review_count || null,
      businessName:  collapseSpaces(brand.name || ''),
      location:      collapseSpaces((brief && brief.location) || ''),
      phone:         contact.phone      || '',
      googleMapsUrl: contact.google_maps_url || '',
      badges:        badgesByCategory[cat] || badgesByCategory.general
    }
  };
}

function buildServices(brief) {
  const niche   = toStringSafe(brief && brief.niche);
  const cat     = nicheCategory(niche);
  const brand   = (brief && brief.brand) || {};
  const city    = collapseSpaces((brief && brief.contact && brief.contact.address && brief.contact.address.city) || '');
  const pack    = (brief && brief.nichePack) || {};
  const packCopy = pack.copy || {};

  // Filter nav-flavored entries out of scraped services (e.g. "Reservations",
  // "Order Take-Out", "Gift Cards" are CTAs, not services).
  const NAV_NOISE = /^(menu|home|about|contact|reservations|order(\s|-)?(take-?out|now|online)?|gift(\s)?cards?|store|shop|login|sign(\s)?in|cart|search|blog|news|locations?|hours|faq|book|reserve|call(\s)?us)$/i;
  const siteIdentity = brief && brief.siteIdentity;
  const rawScraped = siteIdentity && Array.isArray(siteIdentity.services) ? siteIdentity.services : [];
  const cleanedScraped = rawScraped
    .filter(s => s && typeof s === 'string' && !NAV_NOISE.test(s.trim()))
    .slice(0, 6)
    .map(s => ({ title: s.trim(), description: '' }));
  const scrapedServices = cleanedScraped.length >= 3 ? cleanedScraped : null;

  // Prefer niche-pack services (curated, on-brand for that vertical) when no
  // scraped services are usable. Pack copy.services is the canonical source.
  const packServices = Array.isArray(packCopy.services) && packCopy.services.length
    ? packCopy.services.map(s => ({ title: s.title, description: s.description }))
    : null;

  // Last-resort fallback by category (kept minimal — packs should cover real niches).
  const fallbackByCategory = {
    healthcare_local: [
      { title: 'New Patient Consultation', description: 'Personalized assessment and care plan tailored to your needs.' },
      { title: 'Preventive Care',          description: 'Proactive treatments to keep you healthy long-term.' }
    ],
    home_service: [
      { title: 'Emergency Service',   description: 'Fast response when you need it most — same day available.' },
      { title: 'Free Estimates',      description: 'Upfront, transparent pricing before any work begins.' },
      { title: 'Residential Service', description: 'Full-service solutions for homeowners in ' + (city || 'your area') + '.' }
    ],
    professional_service: [
      { title: 'Free Consultation',   description: 'Start with a no-obligation 30-minute strategy session.' },
      { title: 'Custom Solutions',    description: 'Tailored plans designed around your specific goals.' }
    ],
    b2b_saas: [
      { title: 'Quick Setup',         description: 'Get up and running in minutes — no lengthy onboarding.' },
      { title: 'Powerful Integrations', description: 'Connects with the tools your team already uses.' }
    ]
  };

  const items = scrapedServices || packServices || fallbackByCategory[cat] || fallbackByCategory.healthcare_local;

  // Slot category-appropriate scraped images onto cards: food first, then
  // generic, then interior. Skip the hero URL and skip maps/documents/logos.
  const library = (siteIdentity && Array.isArray(siteIdentity.imageLibrary)) ? siteIdentity.imageLibrary : [];
  const heroUrl = (brief && brief.brand && brief.brand.heroImageUrl) || '';
  const CARD_PRIORITY = ['food', 'generic', 'interior', 'exterior'];
  const cardImages = library
    .filter(img => img && img.src && img.src !== heroUrl && CARD_PRIORITY.includes(img.category || 'generic'))
    .sort((a, b) => CARD_PRIORITY.indexOf(a.category || 'generic') - CARD_PRIORITY.indexOf(b.category || 'generic'))
    .map(img => img.src);
  if (cardImages.length) {
    items.forEach((item, idx) => {
      if (!item.image) item.image = cardImages[idx % cardImages.length];
    });
  }

  // Heading comes from the niche pack copy.sectionHeadings.services when present.
  const packHeadings = packCopy.sectionHeadings || {};
  const fallbackHeading = cat === 'home_service' ? 'Our Services'
                        : cat === 'b2b_saas'     ? 'What We Offer'
                        : 'Our Services';

  return {
    id: 'services-1',
    type: 'services-grid',
    props: {
      heading: packHeadings.services || fallbackHeading,
      subtitle: 'Everything you need, delivered with professionalism and care.',
      items
    }
  };
}

function buildReviews(brief) {
  const trust   = (brief && brief.trust)   || {};
  const brand   = (brief && brief.brand)   || {};
  const contact = (brief && brief.contact) || {};
  const cat     = nicheCategory(brief && brief.niche);
  const isDental = isDentalNiche(brief && brief.niche);

  const rating      = trust.rating      || 4.9;
  const reviewCount = trust.review_count || 0;
  const ratingStr   = rating.toFixed(1);
  const reviewStr   = reviewCount >= 1000 ? (reviewCount / 1000).toFixed(1) + 'k' : (reviewCount > 0 ? String(reviewCount) : '');

  const reviewsByCategory = {
    healthcare_local: isDental ? [
      { author: 'Sarah M.',    rating: 5, text: `The team at ${collapseSpaces(brand.name || 'this practice')} made me feel completely at ease. Best dental experience I have ever had.` },
      { author: 'James T.',    rating: 5, text: 'Incredibly gentle and thorough. They explained everything clearly and the office is spotless. Highly recommend!' },
      { author: 'Linda K.',    rating: 5, text: 'I had been avoiding the dentist for years. This team changed that completely. Compassionate, professional, and efficient.' }
    ] : [
      { author: 'Michael R.',  rating: 5, text: 'Outstanding care and attention to detail. The staff is warm and professional. I would not go anywhere else.' },
      { author: 'Patricia L.', rating: 5, text: 'From the moment I walked in, I felt cared for. The team is knowledgeable and genuinely invested in my wellbeing.' },
      { author: 'David W.',    rating: 5, text: 'Exceptional service every single time. They go above and beyond to make sure you are comfortable and informed.' }
    ],
    home_service: [
      { author: 'Tom H.',      rating: 5, text: 'Showed up on time, gave me a fair quote, and finished the job perfectly. Will definitely call them again.' },
      { author: 'Karen B.',    rating: 5, text: 'Professional, clean, and efficient. They fixed the problem quickly and left no mess behind. 5 stars!' },
      { author: 'Robert S.',   rating: 5, text: 'Best service I have experienced. Honest pricing and excellent workmanship. Highly recommend to anyone.' }
    ],
    professional_service: [
      { author: 'Jennifer A.', rating: 5, text: 'Their expertise saved us significant time and money. Incredibly knowledgeable and easy to work with.' },
      { author: 'Mark C.',     rating: 5, text: 'Professional, responsive, and results-driven. Exactly what we were looking for. Highly recommended.' },
      { author: 'Susan P.',    rating: 5, text: 'They understood our situation immediately and provided clear, actionable guidance. Outstanding service.' }
    ],
    b2b_saas: [
      { author: 'Alex D., CEO',    rating: 5, text: 'This platform transformed how our team operates. ROI was visible within the first month.' },
      { author: 'Maria G., COO',   rating: 5, text: 'Incredibly intuitive and powerful. The support team is responsive and genuinely helpful.' },
      { author: 'Chris L., VP Ops',rating: 5, text: 'We evaluated several solutions. This one stood out for its ease of use and depth of features.' }
    ]
  };

  // Source priority:
  //   1. Real Google Places reviews if injected (brief.placesReviews)
  //   2. Niche pack proof.reviewTemplates (restaurant pack has restaurant-flavored)
  //   3. Category fallback above
  const pack = (brief && brief.nichePack) || {};
  const packReviews = pack.proof && Array.isArray(pack.proof.reviewTemplates) ? pack.proof.reviewTemplates : null;
  const placesReviews = Array.isArray(brief && brief.placesReviews) && brief.placesReviews.length ? brief.placesReviews : null;
  const reviews = placesReviews || packReviews || reviewsByCategory[cat] || reviewsByCategory.healthcare_local;

  const titleParts = [];
  if (ratingStr && reviewCount > 0) titleParts.push(`Rated ${ratingStr} ★`);
  if (reviewStr) titleParts.push(`${reviewStr} Reviews`);
  const title = titleParts.length
    ? `${titleParts.join(' · ')} — What Our ${isDental ? 'Patients' : 'Customers'} Say`
    : `What Our ${isDental ? 'Patients' : 'Customers'} Say`;

  return {
    id: 'reviews-1',
    type: 'reviews',
    variant: 'testimonial_cards',
    props: {
      title,
      label: 'Verified Reviews',
      subtitle: reviewCount > 0
        ? `Join the ${reviewStr || 'many'} ${isDental ? 'patients' : 'customers'} who trust ${collapseSpaces(brand.name || 'us')}.`
        : `Real experiences from real ${isDental ? 'patients' : 'customers'}.`,
      reviews,
      googleMapsUrl: contact.google_maps_url || ''
    }
  };
}

function buildAboutStory(brief) {
  const siteIdentity = brief && brief.siteIdentity;
  const aboutText = (siteIdentity && siteIdentity.aboutStory) || '';
  const messaging = (brief && brief.messaging) || {};
  // Use the scraped about paragraph when present; otherwise fall back to the
  // elevator pitch (or skip entirely — handled by the renderer's v-if guard).
  const body = (aboutText && aboutText.length >= 60)
    ? aboutText
    : collapseSpaces(messaging.elevator_pitch || '');
  if (!body || body.length < 40) return null;
  // Pick an interior/exterior photo for the side image when available.
  const library = (siteIdentity && Array.isArray(siteIdentity.imageLibrary)) ? siteIdentity.imageLibrary : [];
  const heroUrl = (brief && brief.brand && brief.brand.heroImageUrl) || '';
  const sideImage = library.find(i => i && i.src && i.src !== heroUrl && (i.category === 'interior' || i.category === 'exterior'));
  const pack = (brief && brief.nichePack) || {};
  const heading = (pack.copy && pack.copy.sectionHeadings && pack.copy.sectionHeadings.about) || 'Our Story';
  return {
    id: 'about-story-1',
    type: 'about-story',
    props: { heading, body, image: sideImage ? sideImage.src : '' }
  };
}

function buildHoursLocation(brief) {
  const contact = (brief && brief.contact) || {};
  const hours   = Array.isArray(brief && brief.hoursWeekday) ? brief.hoursWeekday : [];
  const pack    = (brief && brief.nichePack) || {};
  const heading = (pack.copy && pack.copy.sectionHeadings && pack.copy.sectionHeadings.hours) || 'Hours & Location';
  const hasData = (contact.address && (contact.address.street || contact.address.city)) || hours.length || contact.phone;
  if (!hasData) return null;
  return {
    id: 'hours-location-1',
    type: 'hours-location',
    props: {
      heading,
      address: contact.address || {},
      hours,
      phone: contact.phone || '',
      googleMapsUrl: contact.google_maps_url || ''
    }
  };
}

function buildHowItWorks(brief) {
  const cat     = nicheCategory(brief && brief.niche);
  const isDental = isDentalNiche(brief && brief.niche);

  const stepsByCategory = {
    healthcare_local: isDental ? {
      heading: 'Your First Visit — Simple & Stress-Free',
      subtitle: 'We make it easy to get started. Here is what to expect.',
      items: [
        { title: 'Book Online or Call',   description: 'Request an appointment in seconds online, or call us directly. We will find a time that works for you.' },
        { title: 'Meet Your Dentist',     description: 'Enjoy a gentle, thorough exam. We listen to your concerns and explain everything clearly.' },
        { title: 'Leave with a Plan',     description: 'Walk out with a clear treatment plan, honest pricing, and a smile you feel good about.' }
      ]
    } : {
      heading: 'How It Works',
      subtitle: 'Getting started is simple.',
      items: [
        { title: 'Schedule a Visit',  description: 'Choose a convenient time for your first appointment.' },
        { title: 'Consultation',      description: 'Meet with our care team to discuss your needs and create a plan.' },
        { title: 'Get Treated',       description: 'Receive personalized, professional care and know exactly what to expect.' }
      ]
    },
    home_service: {
      heading: 'How It Works',
      subtitle: 'Fast, transparent, and hassle-free.',
      items: [
        { title: 'Request a Quote',   description: 'Call or submit your details online. We respond within 1 hour.' },
        { title: 'Get a Clear Price', description: 'We assess the job and give you an upfront, no-surprise quote.' },
        { title: 'We Get It Done',    description: 'Our licensed team completes the work cleanly and on schedule.' }
      ]
    },
    professional_service: {
      heading: 'How We Work Together',
      subtitle: 'A straightforward process designed around your goals.',
      items: [
        { title: 'Free Consultation', description: 'We start with a 30-minute call to understand your situation and goals.' },
        { title: 'Custom Strategy',   description: 'We build a tailored plan with clear milestones and transparent pricing.' },
        { title: 'Execute & Deliver', description: 'We implement the plan and keep you informed every step of the way.' }
      ]
    },
    b2b_saas: {
      heading: 'Get Started in Minutes',
      subtitle: 'No lengthy setup. No technical headaches.',
      items: [
        { title: 'Sign Up Free',      description: 'Create your account in under 2 minutes — no credit card required.' },
        { title: 'Connect Your Tools',description: 'Integrate with your existing stack in a few clicks.' },
        { title: 'See Results',       description: 'Track performance and ROI from day one with real-time dashboards.' }
      ]
    },
    restaurant: {
      heading: 'Reserve in Three Steps',
      subtitle: 'A great evening is a few clicks away.',
      items: [
        { title: 'Pick a Date & Time', description: 'Use the reservation widget or call us — we will confirm right away.' },
        { title: 'Tell Us About You',  description: 'Let us know about any dietary needs, special occasions, or seating preferences.' },
        { title: 'Enjoy the Evening',  description: 'Arrive to a table ready for you. Hospitality, hand-crafted plates, and a great atmosphere.' }
      ]
    },
    ecommerce: {
      heading: 'Order in Three Steps',
      subtitle: 'From browse to doorstep.',
      items: [
        { title: 'Browse the Collection', description: 'Find something you love — every product is curated and ready to ship.' },
        { title: 'Quick Checkout',        description: 'Secure payment in seconds. Free shipping on qualifying orders.' },
        { title: 'Fast Delivery',         description: 'Track your order from our door to yours. Easy returns if it is not quite right.' }
      ]
    }
  };

  const config = stepsByCategory[cat] || stepsByCategory.home_service;

  return {
    id: 'how-it-works-1',
    type: 'how-it-works',
    props: {
      heading:  config.heading,
      subtitle: config.subtitle,
      items:    config.items
    }
  };
}

function buildVirtualAssistant(brief) {
  const cat     = nicheCategory(brief && brief.niche);
  const isDental = isDentalNiche(brief && brief.niche);
  const ctas    = (brief && brief.ctas) || {};
  const contact = (brief && brief.contact) || {};

  const headingByCategory = {
    healthcare_local: isDental ? '24/7 Virtual Front Desk' : 'Always Available for You',
    home_service:     'Get Help Any Time',
    professional_service: 'We Are Here When You Need Us',
    b2b_saas:         '24/7 Support & Self-Service',
    general:          'Always Available'
  };

  const bulletsByCategory = {
    healthcare_local: isDental ? [
      'Answers common patient questions instantly',
      'Captures appointment requests day or night',
      'Guides patients on insurance and payment options',
      'Routes urgent issues to the right contact'
    ] : [
      'Answers common questions instantly',
      'Captures requests around the clock',
      'Provides directions and contact info',
      'Routes urgent issues appropriately'
    ],
    home_service: [
      'Request a quote any time, day or night',
      'Get instant answers to common questions',
      'Schedule service at your convenience',
      'Emergency contact routing available'
    ],
    professional_service: [
      'Book a consultation at any hour',
      'Get answers to common questions instantly',
      'Receive resources and guides on demand',
      'Urgent matters routed immediately'
    ],
    b2b_saas: [
      'Access documentation and tutorials 24/7',
      'Submit support tickets any time',
      'Get instant answers from our knowledge base',
      'Escalate to a human agent when needed'
    ]
  };

  return {
    id: 'virtual-front-desk-1',
    type: 'virtual-front-desk',
    props: {
      heading:  headingByCategory[cat] || headingByCategory.general,
      subtitle: isDental
        ? 'Your website works for you even when the office is closed.'
        : 'We respond quickly and capture your request any time of day.',
      bullets: bulletsByCategory[cat] || bulletsByCategory.general,
      primaryCta: ctas.primary || { label: 'Book Now', href: '#book' }
    }
  };
}

function buildFaq(brief) {
  const cat     = nicheCategory(brief && brief.niche);
  const isDental = isDentalNiche(brief && brief.niche);
  const brand   = (brief && brief.brand) || {};
  const contact = (brief && brief.contact) || {};
  const phone   = contact.phone || '';

  const faqByCategory = {
    healthcare_local: isDental ? [
      { question: 'Are you accepting new patients?',
        answer: `Yes! ${collapseSpaces(brand.name || 'Our practice')} is currently welcoming new patients. You can book online or call us directly.` },
      { question: 'Do you accept dental insurance?',
        answer: 'We accept most PPO dental insurance plans. Our team will verify your benefits and explain your coverage before any treatment.' },
      { question: 'What should I expect on my first visit?',
        answer: 'Your first visit includes a comprehensive exam, X-rays if needed, and a personalized treatment plan. We will walk you through everything and answer all your questions.' },
      { question: 'Do you offer emergency dental care?',
        answer: `Yes, we offer same-day emergency appointments. ${phone ? `Call us at ${phone}` : 'Contact us'} and we will do our best to see you right away.` },
      { question: 'How often should I visit the dentist?',
        answer: 'Most patients benefit from a cleaning and checkup every 6 months. We will recommend a schedule based on your individual needs.' }
    ] : [
      { question: 'How do I schedule an appointment?',
        answer: 'You can book online through our website or call us directly. We offer flexible scheduling to fit your needs.' },
      { question: 'Do you accept insurance?',
        answer: 'We work with most major insurance providers. Contact us to verify your coverage before your visit.' },
      { question: 'What should I bring to my first appointment?',
        answer: 'Please bring a valid ID, your insurance card, and any relevant medical records or referrals.' },
      { question: 'How long does a typical appointment take?',
        answer: 'Most appointments take between 30 and 60 minutes, depending on the service. We will give you an accurate estimate when you book.' }
    ],
    home_service: [
      { question: 'How quickly can you respond?',
        answer: 'We typically respond within 1 hour for standard requests. Emergency services are available same-day.' },
      { question: 'Do you provide free estimates?',
        answer: 'Yes, all estimates are free and include a detailed breakdown of costs with no hidden fees.' },
      { question: 'Are you licensed and insured?',
        answer: 'Absolutely. We are fully licensed, bonded, and insured for your protection and peace of mind.' },
      { question: 'What areas do you serve?',
        answer: `We serve ${collapseSpaces((contact.address && contact.address.city) || 'the local area')} and surrounding communities. Contact us to confirm your location.` },
      { question: 'Do you offer a warranty on your work?',
        answer: 'Yes, we stand behind our work with a satisfaction guarantee. If something is not right, we will make it right.' }
    ],
    professional_service: [
      { question: 'How does the free consultation work?',
        answer: 'We schedule a 30-minute call to understand your situation and goals. There is no obligation and no cost.' },
      { question: 'How long does it take to see results?',
        answer: 'It depends on the scope of work, but most clients see meaningful progress within the first 30 to 60 days.' },
      { question: 'What makes you different from other firms?',
        answer: 'We combine deep expertise with a personalized approach. You work directly with senior professionals, not junior staff.' },
      { question: 'What are your fees?',
        answer: 'We offer transparent, project-based pricing. We will provide a clear proposal after our initial consultation.' }
    ],
    b2b_saas: [
      { question: 'Is there a free trial?',
        answer: 'Yes, we offer a 14-day free trial with full access to all features. No credit card required.' },
      { question: 'How long does setup take?',
        answer: 'Most teams are fully set up within a day. Our onboarding team is available to help you get started.' },
      { question: 'Can I integrate with my existing tools?',
        answer: 'Yes, we integrate with most popular tools including Slack, Salesforce, HubSpot, and many more.' },
      { question: 'What support options are available?',
        answer: 'We offer 24/7 email support, live chat during business hours, and dedicated account managers for enterprise plans.' }
    ]
  };

  // Source priority:
  //   1. Niche pack proof.objectionHandlers (restaurant pack has restaurant-flavored Q&A)
  //   2. Category fallback above
  const pack = (brief && brief.nichePack) || {};
  const packFaq = pack.proof && Array.isArray(pack.proof.objectionHandlers) && pack.proof.objectionHandlers.length
    ? pack.proof.objectionHandlers.map(o => ({ question: o.question, answer: o.answer }))
    : null;
  const items = packFaq || faqByCategory[cat] || faqByCategory.healthcare_local;

  // Heading from niche pack copy.sectionHeadings when present.
  const packHeadings = (pack.copy && pack.copy.sectionHeadings) || {};
  const heading = packHeadings.faq ||
    (isDental ? 'Patient FAQ' : 'Frequently Asked Questions');

  return {
    id: 'faq-1',
    type: 'faq',
    props: {
      heading,
      subtitle: 'Common questions answered clearly.',
      items
    }
  };
}

function buildInsuranceInfo(brief) {
  const cat = nicheCategory(brief && brief.niche);
  if (cat !== 'healthcare_local') return null;

  return {
    id: 'insurance-1',
    type: 'insurance-info',
    props: {
      title: 'Insurance & Payment Options',
      subtitle: 'We make it easy to understand your coverage and payment options.',
      items: [
        'We accept most PPO dental insurance plans — we will verify your benefits',
        'We file claims on your behalf and explain your out-of-pocket costs upfront',
        'Flexible financing options available through CareCredit and in-house plans',
        'We accept all major credit cards, HSA, and FSA',
        'Contact us to confirm your specific plan is accepted'
      ]
    }
  };
}

function buildUpgradeSignal(brief) {
  const cat     = nicheCategory(brief && brief.niche);
  const isDental = isDentalNiche(brief && brief.niche);
  const brand   = (brief && brief.brand) || {};

  const messages = {
    healthcare_local: isDental
      ? 'Designed to turn website visitors into booked appointments'
      : 'Designed to convert more visitors into scheduled patients',
    home_service:     'Optimized for mobile, local search, and instant quote requests',
    professional_service: 'Built to establish authority and generate qualified consultations',
    b2b_saas:         'Engineered for demo requests and trial sign-ups',
    general:          'Designed to convert more visitors into customers'
  };

  const subMessages = {
    healthcare_local: 'Mobile-first layout, online booking, and trust signals — everything patients expect from a modern practice',
    home_service:     'Fast-loading, mobile-friendly, with instant quote forms and trust badges that win more jobs',
    professional_service: 'Clean, authoritative design with social proof and clear CTAs that drive consultations',
    b2b_saas:         'Conversion-optimized with product demos, social proof, and frictionless sign-up flows',
    general:          'Optimized for mobile, appointment requests, and local search'
  };

  return {
    id: 'upgrade-signal-1',
    type: 'upgrade-signal',
    props: {
      message:    messages[cat]    || messages.general,
      subMessage: subMessages[cat] || subMessages.general,
      ctaLabel:   'Get This Website for Your Business',
      ctaHref:    '#contact'
    }
  };
}

function buildCta(brief) {
  const messaging = (brief && brief.messaging) || {};
  const ctas      = (brief && brief.ctas)      || {};
  const brand     = (brief && brief.brand)     || {};
  const cat       = nicheCategory(brief && brief.niche);
  const isDental  = isDentalNiche(brief && brief.niche);
  const trust     = (brief && brief.trust)     || {};
  const contact   = (brief && brief.contact)   || {};

  const headingMap = {
    book_appointments:            isDental ? 'Ready to Book Your Appointment?' : 'Ready to Get Started?',
    capture_missed_opportunities: 'Start Capturing Every Opportunity',
    generate_leads:               'Get Your Free Quote Today',
    schedule_consultation:        'Book a Free Consultation',
    request_demo:                 'See It In Action — Request a Demo',
    shop_now:                     'Shop Our Collection',
    make_reservation:             'Reserve Your Table',
    get_in_touch:                 'Get In Touch Today'
  };

  const goal     = toStringSafe(brief && brief.primary_goal);
  const heading  = headingMap[goal] || (isDental ? 'Ready to Book Your Appointment?' : 'Ready to Get Started?');
  const name     = collapseSpaces(brand.name || '');
  const subheading = trust.rating && trust.review_count
    ? `Join the ${trust.review_count} ${isDental ? 'patients' : 'customers'} who trust ${name || 'us'} — rated ${trust.rating.toFixed(1)} ★.`
    : collapseSpaces(messaging.elevator_pitch || `${name || 'We'} would love to help you.`);

  const primaryCta = ctas.primary || { label: isDental ? 'Book Appointment' : 'Get Started', href: '#book' };

  return {
    id: 'cta-1',
    type: 'cta',
    props: { heading, subheading, primaryCta }
  };
}

// ─── Main generate function ────────────────────────────────────────────────────
function generate(brief, options) {
  const b   = brief || {};
  const cat = nicheCategory(b.niche);

  // If the brief's theme carries a slug-picked sectionOrder (set by
  // brief-builder using the niche pack's sectionOrderVariants), assemble in
  // that order so two leads in the same niche end up structurally different.
  // Otherwise fall back to the canonical order below.
  const customOrder = b && b.theme && Array.isArray(b.theme.sectionOrder) ? b.theme.sectionOrder : null;
  if (customOrder) {
    const builders = {
      'hero':            () => buildHero(b),
      'trust-signals':   () => buildTrustSignals(b),
      'services-grid':   () => buildServices(b),
      'reviews':         () => buildReviews(b),
      'how-it-works':    () => buildHowItWorks(b),
      'faq':             () => buildFaq(b),
      'cta':             () => buildCta(b),
      'upgrade-signal':  () => buildUpgradeSignal(b),
      'about-story':     () => buildAboutStory(b),
      'hours-location':  () => buildHoursLocation(b)
    };
    const out = [];
    for (const t of customOrder) {
      const fn = builders[t];
      const built = fn ? fn() : null;
      if (built) out.push(built);
    }
    return out;
  }

  const sections = [];

  // 1. Hero — personalized, strong headline, booking CTA
  sections.push(buildHero(b));

  // 2. Trust Signals — ratings, phone, badges (near top per Step 4 layout)
  sections.push(buildTrustSignals(b));

  // 3. Services — personalized to niche, uses scraped services if available
  sections.push(buildServices(b));

  // 4. Reviews — real rating data, testimonial cards
  const reviews = buildReviews(b);
  sections.push(reviews);

  // 5. Insurance / Payment Info (healthcare only)
  const insurance = buildInsuranceInfo(b);
  if (insurance) sections.push(insurance);

  // 6. How It Works — step-by-step, reduces friction
  sections.push(buildHowItWorks(b));

  // 7. Virtual Assistant / Chat — 24/7 availability signal (healthcare/services only).
  //    Restaurants, retail, etc. do their own front-of-house and don't need this card,
  //    which leaks healthcare framing into other niches.
  const vfdCat = nicheCategory(b && b.niche);
  if (vfdCat === 'healthcare_local' || vfdCat === 'home_service' || vfdCat === 'professional_service' || vfdCat === 'b2b_saas') {
    sections.push(buildVirtualAssistant(b));
  }

  // 8. FAQ — answers objections, builds trust
  sections.push(buildFaq(b));

  // 9. Upgrade Signal — internal sales copy ("Designed to convert more visitors...").
  //    Off the customer-facing preview by default; surface in the strategy panel
  //    instead. Re-enable explicitly by setting LANDING_BUILDER_SHOW_UPGRADE_SIGNAL=1.
  if (process.env.LANDING_BUILDER_SHOW_UPGRADE_SIGNAL === '1') {
    sections.push(buildUpgradeSignal(b));
  }

  // 10. CTA — final conversion push
  sections.push(buildCta(b));

  return sections;
}

module.exports = {
  name: 'upgrade',
  generate
};
