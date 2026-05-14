---
name: landing-page-factory-dentist
description: |
  Landing page factory specialized for dental practices, orthodontists, and
  general healthcare-local providers. Inherits the generic landing-page-factory
  contract and layers patient-conversion-specific structure.
triggers:
  - "dentist landing page"
  - "dental practice landing page"
  - "orthodontist landing page"
  - "healthcare landing page"
od:
  mode: prototype
  category: web-artifacts
---

# landing-page-factory-dentist

Follow the **landing-page-factory** base contract. Layer on the dentist-
specific structure below.

## Primary goal

**Book an appointment.** Dominant CTA is "Request Your Appointment" (or
brief's exact `ctaLabels.primary`). Secondary CTA is **call the office**
("Call Now" + phone). Tertiary is "Ask a Question" (form).

## Trust is the conversion lever

Dental visits are anxiety-laden purchases. Front-load reassurance:

- Insurance accepted (most PPOs, file claims for the patient)
- Same-week / same-day availability
- New patient welcomed
- Years in practice / certifications

## Section order

1. **Sticky nav** — logo, links (Services / About / Reviews / Insurance /
   Contact), prominent "Book Appointment" button.
2. **Hero** — split layout: warm photo of practice or smiling patient on
   one side; H1 + subhead + 2 CTAs ("Book Appointment" + "Call") on the
   other. Trust pills below the CTAs: "Accepting New Patients",
   "Most Insurance Accepted", "Same-Week Visits".
3. **Trust strip** — real rating + review count + ADA badge + insurance
   logos (if mentioned in the brief).
4. **Services grid** — 4–6 cards: Cleanings & Checkups / Fillings /
   Crowns & Bridges / Whitening / Implants / Orthodontics. Real photos
   when available; otherwise icon-only cards. Each card includes a short
   benefit sentence (not a procedure description).
5. **Insurance & payment** — dedicated band: list accepted plans;
   "We file your claims" reassurance; CareCredit / in-house financing.
6. **What to expect on your first visit** — 3 numbered steps in plain
   language. Removes fear.
7. **Reviews** — verbatim from `placesReviews`, attributed. Patient names
   first-name + last-initial only.
8. **Hours & location** — emphasize "convenient hours" if evenings or
   Saturdays are in the scraped hours. Map link.
9. **FAQ** — insurance questions, emergency care, first-visit logistics,
   payment plans.
10. **Final CTA band** — light-color, calm. "Ready for a healthier smile?
    Book your appointment in seconds." + form or click-to-call.
11. **Footer** — name, address, phone, hours, license/credentials.

## Style notes

- **Calm palette:** healthcare niches read better with cool, restrained
  color. Don't overuse the brand primary — reserve for CTAs.
- **Sans-serif headings** unless the design system says otherwise — serif
  reads "old-fashioned office" for medical contexts.
- **Generous whitespace.** Cramped dental sites trigger anxiety.
- **Avoid pure white teeth close-ups in hero** — go for practice exterior,
  reception, or a real-feel patient interaction shot. Hero photos of teeth
  are off-putting.

## What must NEVER appear

- Stock smiling-patient photos when the brief has real practice photos
- Before/after dental images without disclaimer ("individual results vary")
- Pricing claims ("$99 cleaning") unless explicitly in the scraped data
- Insurance logos for plans not in the scraped accepted list
- Animations on the hero (medical pages must feel stable)
