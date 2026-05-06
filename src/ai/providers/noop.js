'use strict';

// Noop provider — deterministic, niche-aware, goal-aware schema generator.
//
// This is the default (no-LLM) provider. It maps a site brief to a
// renderer-compatible page schema. The output is fully driven by:
//   - brief.niche  (category classification)
//   - brief.primary_goal  (structural decisions: form, CTA style, sections)
//   - brief.messaging  (all visible copy — sanitized presentation fields only)
//   - brief.theme  (palette, heroStyle, tone — passed through to schema)
//
// Strategy / presentation boundary:
// - Internal fields (offer_angle, notes.weaknesses, notes.opportunities) are
//   used ONLY for structural decisions (e.g., which sections to include).
// - They are NEVER surfaced verbatim in any section props.
// - All visible copy comes from brief.messaging.* (sanitized by site-brief-builder).
//
// Provider interface:
//   { name: string, generate(brief, options?): Array<section> }
//
// Section schema:
//   [{ id: string, type: string, props: object }, ...]

function toStringSafe(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function collapseSpaces(s) {
  return toStringSafe(s).replace(/\s+/g, ' ').trim();
}

// ─── Niche classification (mirrors site-brief-builder) ────────────────────────
function nicheCategory(niche) {
  const n = toStringSafe(niche).toLowerCase();
  if (/dental|dentist|orthodont|dmd|dds/.test(n)) return 'healthcare_local';
  if (/chiro|clinic|medical|medspa|spa|therapy|therapist|veterinary|vet/.test(n)) return 'healthcare_local';
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

// ─── Section builders ─────────────────────────────────────────────────────────

function buildHero(brief) {
  const messaging = (brief && brief.messaging) || {};
  const ctas = (brief && brief.ctas) || {};
  const brand = (brief && brief.brand) || {};

  const title = collapseSpaces(messaging.headline) || collapseSpaces(brand.name) || 'Your Business';
  const subtitle = collapseSpaces(messaging.subheadline) || collapseSpaces(messaging.elevator_pitch) || '';
  const primaryCta = ctas.primary || { label: 'Get Started', href: '#cta' };
  const secondaryCta = ctas.secondary || null;

  // Determine the trust line based on niche category. These lines are specific to the
  // visitor's mental model and reduce perceived friction. Fallback to an empty
  // string so that the hero component uses its default.
  const cat = nicheCategory(brief && brief.niche);
  const trustLineMap = {
    healthcare_local:    "We'll call you back within 2 business hours",
    home_service:        'Get a response within 1 hour — no obligation',
    professional_service:'Free 30-minute consultation. No obligation.',
    b2b_saas:            'See a live demo in under 20 minutes'
  };
  const trustLine = trustLineMap[cat] || '';

  return {
    id: 'hero-1',
    type: 'hero',
    props: {
      title,
      subtitle,
      primaryCta,
      secondaryCta: secondaryCta || { label: 'Learn More', href: '#features' },
      logos: [],
      heroImageUrl: (brief && brief.brand && brief.brand.heroImageUrl) || null,
      trustLine
    }
  };
}

function buildMissingOpportunities(brief) {
  // Use brief.opportunities (already sanitized by site-brief-builder)
  const fromBrief = Array.isArray(brief && brief.opportunities) ? brief.opportunities : [];
  const items = fromBrief
    .slice(0, 3)
    .map(s => collapseSpaces(s))
    .filter(Boolean);

  if (!items.length) return null;

  return {
    id: 'missing-1',
    type: 'missing-opportunities',
    props: {
      title: 'Your current site is missing:',
      items
    }
  };
}

// ── Healthcare (dental + general healthcare) ──────────────────────────────────
function buildHealthcareServices(brief) {
  const niche = toStringSafe(brief && brief.niche);
  const isDental = isDentalNiche(niche);

  const heading = isDental ? 'Our Dental Services' : 'Our Services';
  const items = isDental
    ? [
        { title: 'Cleanings & Checkups', description: 'Preventive care to keep your smile healthy.' },
        { title: 'Fillings & Restorations', description: 'Treat cavities and protect damaged teeth.' },
        { title: 'Crowns & Bridges', description: 'Durable solutions to restore function and appearance.' },
        { title: 'Teeth Whitening', description: 'Professional whitening for a brighter smile.' },
        { title: 'Dental Implants', description: 'Permanent replacement for missing teeth.' },
        { title: 'Orthodontics', description: 'Straighten teeth with modern, comfortable options.' }
      ]
    : [
        { title: 'Consultations', description: 'Personalized assessments and care plans.' },
        { title: 'Treatments', description: 'Comprehensive care tailored to your needs.' },
        { title: 'Follow-up Care', description: 'Ongoing support for lasting results.' }
      ];

  return { id: 'services-1', type: 'services-grid', props: { heading, items } };
}

function buildVirtualFrontDesk(brief) {
  const ctas = (brief && brief.ctas) || {};
  const niche = toStringSafe(brief && brief.niche);
  const isDental = isDentalNiche(niche);

  const heading = isDental ? '24/7 Virtual Front Desk' : 'Always Available';
  const subheading = isDental
    ? 'Never miss another opportunity — your website helps patients even after hours.'
    : 'We respond quickly and capture your request any time of day.';
  const bullets = isDental
    ? [
        'Answers common patient questions instantly',
        'Captures appointment requests day or night',
        'Routes urgent issues to the right contact'
      ]
    : [
        'Answers common questions instantly',
        'Captures requests around the clock',
        'Quick follow-up guaranteed'
      ];

  return {
    id: 'vfd-1',
    type: 'virtual-front-desk',
    props: {
      heading,
      subheading,
      bullets,
      primaryCta: ctas.primary || { label: 'Get Started', href: '#cta' }
    }
  };
}

function buildChatDemo(brief) {
  const niche = toStringSafe(brief && brief.niche);
  const isDental = isDentalNiche(niche);

  const heading = isDental ? 'Try Our Patient Chat' : 'See It In Action';
  const messages = isDental
    ? [
        { role: 'patient', text: 'Hi, do you accept Delta Dental PPO?' },
        { role: 'assistant', text: 'Yes, we accept most PPO plans. Would you like to request an appointment?' },
        { role: 'patient', text: 'Great! Do you have evening slots?' },
        { role: 'assistant', text: 'We have availability next Tuesday at 6pm. I can take your details to request that time.' }
      ]
    : [
        { role: 'visitor', text: 'Hi, what are your hours?' },
        { role: 'assistant', text: 'We are available Monday–Friday 8am–6pm, and Saturdays 9am–2pm.' },
        { role: 'visitor', text: 'Can I get a quote?' },
        { role: 'assistant', text: 'Absolutely! I can take your details and we will follow up with a free estimate.' }
      ];

  return { id: 'chat-1', type: 'chat-demo', props: { heading, messages } };
}

function buildReviews(brief) {
  const cat = nicheCategory(brief && brief.niche);
  const headingMap = {
    healthcare_local:    'What Patients Say',
    home_service:        'What Our Customers Say',
    professional_service:'What Our Clients Say',
    b2b_saas:            'What Our Users Say',
    ecommerce:           'Customer Reviews',
    restaurant:          'What Guests Are Saying',
    general:             'What People Are Saying'
  };
  const heading = headingMap[cat] || 'What People Are Saying';

  const reviewsByCategory = {
    healthcare_local: [
      { author: 'Alicia M.', rating: 5, text: 'Friendly staff and a painless experience. Highly recommend!' },
      { author: 'Jordan P.', rating: 5, text: 'They fit me in quickly when I needed help. Great care.' },
      { author: 'Sam K.', rating: 5, text: 'Clear pricing and they answered all my questions.' }
    ],
    home_service: [
      { author: 'Chris T.', rating: 5, text: 'Fast response and fair pricing. Will definitely call again.' },
      { author: 'Maria L.', rating: 5, text: 'Professional, on time, and cleaned up after themselves.' },
      { author: 'Derek W.', rating: 5, text: 'Solved the problem quickly and explained everything clearly.' }
    ],
    professional_service: [
      { author: 'Rachel B.', rating: 5, text: 'Expert guidance and clear communication throughout.' },
      { author: 'Tom H.', rating: 5, text: 'They delivered exactly what was promised, on time.' },
      { author: 'Priya S.', rating: 5, text: 'Highly professional and genuinely invested in our success.' }
    ],
    b2b_saas: [
      { author: 'Alex R.', rating: 5, text: 'Onboarding was seamless and the ROI was clear within weeks.' },
      { author: 'Jamie L.', rating: 5, text: 'Best-in-class support and a product that actually delivers.' },
      { author: 'Morgan C.', rating: 5, text: 'Saved us hours every week. Highly recommend to any team.' }
    ],
    general: [
      { author: 'Pat A.', rating: 5, text: 'Great service and easy to work with.' },
      { author: 'Lee B.', rating: 5, text: 'Exactly what we needed. Would recommend.' },
      { author: 'Quinn D.', rating: 5, text: 'Professional, responsive, and delivered results.' }
    ]
  };

  const items = reviewsByCategory[cat] || reviewsByCategory.general;
  // Pass along the Google Maps URL for micro CTA in the reviews section, if available
  const contact = (brief && brief.contact) || {};
  const googleUrl = contact.google_maps_url || contact.google_maps_url || '';
  return { id: 'reviews-1', type: 'reviews', props: { heading, items, google_maps_url: googleUrl } };
}

function buildInsuranceInfo(brief) {
  // Only include for healthcare niches where insurance info is relevant
  const cat = nicheCategory(brief && brief.niche);
  if (cat !== 'healthcare_local') return null;

  const niche = toStringSafe(brief && brief.niche);
  const isDental = isDentalNiche(niche);
  const heading = isDental ? 'Insurance & FAQ' : 'Coverage & FAQ';
  const bullets = isDental
    ? [
        'We accept most PPO plans and help verify benefits',
        'Payment options available for out-of-pocket costs',
        'Answers to common patient questions, 24/7'
      ]
    : [
        'We work with most major insurance providers',
        'Flexible payment options available',
        'Quick answers to common coverage questions'
      ];

  return { id: 'insurance-1', type: 'insurance-info', props: { heading, bullets } };
}

// ─── Process / How-it-works section ─────────────────────────────────────────
/**
 * Build a generic 'How it works' / 'Your first visit' section. The heading
 * and step descriptions adapt to the niche category. Dental and general
 * healthcare leads get a 'Your First Visit' title and dental-specific steps,
 * while other categories fall back to a generic three-step process. This
 * section reduces "what happens next" anxiety and sets clear expectations.
 *
 * @param {object} brief
 * @returns {{ id: string, type: string, props: object }}
 */
function buildHowItWorks(brief) {
  const cat = nicheCategory(brief && brief.niche);
  const niche = toStringSafe(brief && brief.niche);
  const isDental = isDentalNiche(niche);

  let heading;
  let items;

  if (cat === 'healthcare_local') {
    // Healthcare and dental: reassure patients with a "first visit" flow
    heading = isDental ? 'Your First Visit' : 'How It Works';
    if (isDental) {
      items = [
        { title: 'Schedule Your Appointment', description: 'Call us or request a time online — we work around your schedule.' },
        { title: 'Meet the Dentist', description: 'Enjoy a gentle exam, discuss your concerns and goals, and get personalized recommendations.' },
        { title: 'Follow‑Up Care', description: 'Receive a clear treatment plan and continued support to maintain your healthy smile.' }
      ];
    } else {
      items = [
        { title: 'Schedule a Visit', description: 'Choose a convenient time for your first appointment.' },
        { title: 'Consultation', description: 'Meet with our care team to discuss your needs and create a plan.' },
        { title: 'Get Treated', description: 'Receive personalized, professional care and know exactly what to expect.' }
      ];
    }
  } else {
    // Default three-step process for other niches
    heading = 'How It Works';
    items = [
      { title: 'Contact Us', description: 'Reach out to discuss your needs — we’ll ask a few questions to understand your goals.' },
      { title: 'Get a Plan', description: 'We craft a customized plan and walk you through the details with transparent pricing.' },
      { title: 'Take Action', description: 'We execute and support you along the way to ensure a successful outcome.' }
    ];
  }

  return {
    id: 'how-it-works-1',
    type: 'how-it-works',
    props: { heading, items }
  };
}

// ── Home service sections ─────────────────────────────────────────────────────
function buildHomeServiceFeatures(brief) {
  const messaging = (brief && brief.messaging) || {};
  const features = (brief && brief.features) || [];
  const heading = 'Why Choose Us';
  const subheading = collapseSpaces(messaging.subheadline) || 'Reliable, professional service you can count on.';

  const items = features.length
    ? features.slice(0, 3).map(f => ({
        title: collapseSpaces(f.title) || 'Service',
        description: collapseSpaces(f.description) || ''
      }))
    : [
        { title: 'Fast Response', description: 'We show up quickly and get the job done right.' },
        { title: 'Upfront Pricing', description: 'No hidden fees — you know the cost before we start.' },
        { title: 'Licensed & Insured', description: 'Fully certified professionals you can trust.' }
      ];

  return { id: 'features-1', type: 'features', props: { heading, subheading, items } };
}

// ── B2B SaaS sections ─────────────────────────────────────────────────────────
function buildSaasFeatures(brief) {
  const messaging = (brief && brief.messaging) || {};
  const features = (brief && brief.features) || [];
  const heading = collapseSpaces(messaging.subheadline) || 'Built for teams that move fast';
  const subheading = 'Everything you need to get started and scale.';

  const items = features.length
    ? features.slice(0, 3).map(f => ({
        title: collapseSpaces(f.title) || 'Feature',
        description: collapseSpaces(f.description) || ''
      }))
    : [
        { title: 'Deploy in Minutes', description: 'Get up and running without a lengthy setup process.' },
        { title: 'Proven ROI', description: 'Customers see measurable results within the first month.' },
        { title: 'Secure & Scalable', description: 'Enterprise-grade security that grows with your team.' }
      ];

  return { id: 'features-1', type: 'features', props: { heading, subheading, items } };
}

// ── Professional service sections ─────────────────────────────────────────────
function buildProfessionalFeatures(brief) {
  const messaging = (brief && brief.messaging) || {};
  const features = (brief && brief.features) || [];
  const heading = 'How We Help';
  const subheading = collapseSpaces(messaging.subheadline) || 'Expert guidance tailored to your situation.';

  const items = features.length
    ? features.slice(0, 3).map(f => ({
        title: collapseSpaces(f.title) || 'Service',
        description: collapseSpaces(f.description) || ''
      }))
    : [
        { title: 'Expert Guidance', description: 'Deep expertise applied directly to your needs.' },
        { title: 'Tailored Solutions', description: 'No cookie-cutter approaches — every plan is custom.' },
        { title: 'Measurable Results', description: 'Clear milestones and outcomes you can track.' }
      ];

  return { id: 'features-1', type: 'features', props: { heading, subheading, items } };
}

// ── CTA section ───────────────────────────────────────────────────────────────
function buildCta(brief) {
  const messaging = (brief && brief.messaging) || {};
  const ctas = (brief && brief.ctas) || {};
  const brand = (brief && brief.brand) || {};
  const goal = toStringSafe(brief && brief.primary_goal);

  const headingMap = {
    book_appointments:           'Ready to Book Your Appointment?',
    capture_missed_opportunities:'Start Capturing Every Opportunity',
    generate_leads:              'Get Your Free Quote Today',
    schedule_consultation:       'Book a Free Consultation',
    request_demo:                'See It In Action',
    shop_now:                    'Start Shopping',
    get_in_touch:                'Get In Touch'
  };
  const heading = headingMap[goal] || 'Ready to Get Started?';
  const subheading = collapseSpaces(messaging.elevator_pitch) || `${collapseSpaces(brand.name) || 'We'} would love to help you.`;
  const primaryCta = ctas.primary || { label: 'Get Started', href: '#cta' };

  return { id: 'cta-1', type: 'cta', props: { heading, subheading, primaryCta } };
}

// ─── Section builder dispatch ─────────────────────────────────────────────────
const SECTION_BUILDERS = {
  'hero':                  buildHero,
  'missing-opportunities': buildMissingOpportunities,
  'services-grid':         buildHealthcareServices,
  'virtual-front-desk':    buildVirtualFrontDesk,
  'chat-demo':             buildChatDemo,
  'reviews':               buildReviews,
  'insurance-info':        buildInsuranceInfo,
  'features':              (b, cat) => {
    if (cat === 'home_service') return buildHomeServiceFeatures(b);
    if (cat === 'b2b_saas') return buildSaasFeatures(b);
    if (cat === 'professional_service') return buildProfessionalFeatures(b);
    return buildHomeServiceFeatures(b);
  },
  // New builder for how-it-works / process section. This helps visitors understand
  // the next steps and reduces anxiety about what happens after they convert.
  'how-it-works':         buildHowItWorks,
  'cta': buildCta
};

// ─── Main generate function ───────────────────────────────────────────────────
function generate(brief, options) {
  const b = brief || {};
  const cat = nicheCategory(b.niche);
  const goal = toStringSafe(b.primary_goal);

  // If page-composer provided a section plan, use it to drive section order + variants
  const sectionPlan = options && Array.isArray(options.sectionPlan) ? options.sectionPlan : null;

  if (sectionPlan && sectionPlan.length) {
    const sections = [];
    for (const planEntry of sectionPlan) {
      const type = toStringSafe(planEntry.type);
      const variant = toStringSafe(planEntry.variant) || 'default';
      const id = toStringSafe(planEntry.id) || type + '-1';
      const builder = SECTION_BUILDERS[type];
      if (!builder) continue;
      const section = builder(b, cat);
      if (!section) continue;
      // Apply variant and id from plan
      section.id = id;
      section.variant = variant;
      sections.push(section);
    }
    return sections;
  }

  // Default ordering (no plan provided)
  const sections = [];

  // 1. Hero (always first)
  const hero = buildHero(b);
  // Apply niche-appropriate hero variant
  hero.variant = cat === 'home_service' ? 'service_quote_split'
    : cat === 'b2b_saas' ? (goal === 'request_demo' ? 'product_demo' : 'centered_product')
    : cat === 'restaurant' ? 'media_background'
    : 'split_premium';
  sections.push(hero);

  // 2. Missing opportunities — removed from public-facing pages (use opportunities internally only)
  // const missing = buildMissingOpportunities(b);
  // if (missing) sections.push(missing);

  // 3. Category-specific body sections
  switch (cat) {
    case 'healthcare_local': {
      // Reordered persuasion flow for healthcare/dental sites:
      //  - Services grid immediately after hero
      //  - How it works / first visit section
      //  - Reviews (testimonial cards)
      //  - Insurance & FAQ (dental only)
      sections.push(buildHealthcareServices(b));
      sections.push(buildHowItWorks(b));
      const reviews = buildReviews(b);
      reviews.variant = 'testimonial_cards';
      sections.push(reviews);
      const insurance = buildInsuranceInfo(b);
      if (insurance) sections.push(insurance);
      break;
    }
    case 'home_service': {
      const features = buildHomeServiceFeatures(b);
      features.variant = 'icon_features';
      sections.push(features);
      sections.push(buildReviews(b));
      break;
    }
    case 'b2b_saas': {
      const features = buildSaasFeatures(b);
      features.variant = 'grid_cards';
      sections.push(features);
      const reviews = buildReviews(b);
      reviews.variant = 'testimonial_cards';
      sections.push(reviews);
      break;
    }
    case 'professional_service': {
      const features = buildProfessionalFeatures(b);
      features.variant = 'list_features';
      sections.push(features);
      sections.push(buildReviews(b));
      break;
    }
    default: {
      // General / ecommerce / restaurant: basic features + reviews
      const featureItems = (b.features || []).slice(0, 3);
      if (featureItems.length) {
        sections.push({
          id: 'features-1',
          type: 'features',
          variant: 'grid_cards',
          props: {
            heading: 'What We Offer',
            items: featureItems.map(f => ({
              title: collapseSpaces(f.title) || 'Feature',
              description: collapseSpaces(f.description) || ''
            }))
          }
        });
      }
      sections.push(buildReviews(b));
      break;
    }
  }

  // 4. CTA (always last)
  sections.push(buildCta(b));

  return sections;
}

module.exports = {
  name: 'noop',
  generate
};
