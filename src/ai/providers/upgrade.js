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
  const isDental = isDentalNiche(niche);
  const cat     = nicheCategory(niche);
  const brand   = (brief && brief.brand) || {};
  const city    = collapseSpaces((brief && brief.contact && brief.contact.address && brief.contact.address.city) || '');

  // Use scraped services from site_identity if available
  const siteIdentity = brief && brief.siteIdentity;
  const scrapedServices = siteIdentity && Array.isArray(siteIdentity.services) && siteIdentity.services.length > 2
    ? siteIdentity.services.slice(0, 6).map(s => ({ title: s, description: '' }))
    : null;

  const servicesByCategory = {
    healthcare_local: isDental ? [
      { title: 'Cleanings & Checkups',    description: 'Preventive care to keep your smile healthy and catch issues early.' },
      { title: 'Fillings & Restorations', description: 'Treat cavities and protect damaged teeth with natural-looking materials.' },
      { title: 'Crowns & Bridges',        description: 'Durable solutions to restore function and appearance.' },
      { title: 'Teeth Whitening',         description: 'Professional whitening for a noticeably brighter smile.' },
      { title: 'Dental Implants',         description: 'Permanent, natural-looking replacement for missing teeth.' },
      { title: 'Orthodontics',            description: 'Straighten teeth comfortably with modern options.' }
    ] : [
      { title: 'New Patient Consultation', description: 'Personalized assessment and care plan tailored to your needs.' },
      { title: 'Preventive Care',          description: 'Proactive treatments to keep you healthy long-term.' },
      { title: 'Specialized Treatments',   description: 'Expert care for complex conditions and ongoing management.' }
    ],
    home_service: [
      { title: 'Emergency Service',   description: 'Fast response when you need it most — same day available.' },
      { title: 'Free Estimates',      description: 'Upfront, transparent pricing before any work begins.' },
      { title: 'Preventive Maintenance', description: 'Regular service to prevent costly problems down the road.' },
      { title: 'Residential Service', description: 'Full-service solutions for homeowners in ' + (city || 'your area') + '.' },
      { title: 'Commercial Service',  description: 'Reliable, scalable solutions for businesses of all sizes.' },
      { title: 'Warranty & Guarantee', description: '100% satisfaction guaranteed on all work performed.' }
    ],
    professional_service: [
      { title: 'Free Consultation',   description: 'Start with a no-obligation 30-minute strategy session.' },
      { title: 'Custom Solutions',    description: 'Tailored plans designed around your specific goals.' },
      { title: 'Ongoing Support',     description: 'Dedicated support to ensure lasting, measurable results.' }
    ],
    b2b_saas: [
      { title: 'Quick Setup',         description: 'Get up and running in minutes — no lengthy onboarding.' },
      { title: 'Powerful Integrations', description: 'Connects with the tools your team already uses.' },
      { title: 'Analytics & Reporting', description: 'Real-time insights to track performance and ROI.' },
      { title: 'Enterprise Security',   description: 'Bank-grade security and compliance built in.' }
    ]
  };

  const items = scrapedServices || servicesByCategory[cat] || servicesByCategory.healthcare_local;

  return {
    id: 'services-1',
    type: 'services-grid',
    props: {
      heading: isDental ? `Dental Services at ${collapseSpaces(brand.name || 'Our Practice')}`
             : cat === 'home_service' ? 'Our Services'
             : cat === 'b2b_saas'    ? 'What We Offer'
             : 'Our Services',
      subtitle: isDental
        ? 'Comprehensive care for the whole family — from routine cleanings to advanced restorations.'
        : 'Everything you need, delivered with professionalism and care.',
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

  const reviews = reviewsByCategory[cat] || reviewsByCategory.healthcare_local;

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

  const items = faqByCategory[cat] || faqByCategory.healthcare_local;

  return {
    id: 'faq-1',
    type: 'faq',
    props: {
      heading:  isDental ? 'Patient FAQ' : 'Frequently Asked Questions',
      subtitle: isDental
        ? 'Everything you need to know before your visit.'
        : 'Common questions answered clearly.',
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
    shop_now:                     'Start Shopping',
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

  // 7. Virtual Assistant / Chat — 24/7 availability signal
  sections.push(buildVirtualAssistant(b));

  // 8. FAQ — answers objections, builds trust
  sections.push(buildFaq(b));

  // 9. Upgrade Signal — subtle hint at the value of this improved site
  sections.push(buildUpgradeSignal(b));

  // 10. CTA — final conversion push
  sections.push(buildCta(b));

  return sections;
}

module.exports = {
  name: 'upgrade',
  generate
};
