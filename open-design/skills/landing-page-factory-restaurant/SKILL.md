---
name: landing-page-factory-restaurant
description: |
  Landing page factory specialized for restaurants, cafés, bars, pizzerias,
  steakhouses, and bakeries. Inherits the generic landing-page-factory
  contract and layers restaurant-specific structure and copy guidance.
triggers:
  - "restaurant landing page"
  - "cafe landing page"
  - "steakhouse landing page"
  - "pizzeria landing page"
od:
  mode: prototype
  category: web-artifacts
---

# landing-page-factory-restaurant

Follow the **landing-page-factory** base contract (one `<artifact>` block,
Tailwind CDN, real scraped photo URLs, real brand colors and fonts). Below is
the restaurant-specific layer on top.

## Primary goal

Default conversion is **reservation**. The dominant CTA throughout the page
must read "Reserve a Table" (or the brief's exact `ctaLabels.primary`).
Secondary is **online ordering** ("Order Take-Out"). Phone CTA is tertiary
("Call to Reserve").

## Section order (override the generic only when stronger for this brand)

1. **Sticky nav** — logo left, links (Menu / Reservations / Order / About /
   Private Events / Contact), reserve button right.
2. **Hero** — full-bleed dish or interior photo, dark overlay (rgba(0,0,0,0.45))
   for legibility. Scraped tagline as H1 in serif. Subhead = scraped about
   story's first sentence. Two CTAs: "Reserve a Table" + "Order Take-Out".
3. **Award strip** — if the brief mentions awards, Diners Choice, OpenTable
   Top, James Beard, etc., row of badges. Otherwise: rating + review count.
4. **Menu highlights** — 3–6 cards using scraped food photos with category
   labels (Starters / Entrées / After Dinner / Wine List / etc.) Each card
   has a "View Menu" link.
5. **Our story** — when the brief has `aboutStory` ≥ 100 chars: split
   layout with interior photo + paragraph. Pair with a "Since YYYY" badge
   if a founding year is in the story.
6. **Reviews** — verbatim from `placesReviews` when present (attribute each).
   Otherwise from `nichePack.proof.reviewTemplates`.
7. **Reservation widget area** — when widgets.opentable is true in the
   scraped data, surface a `<a target="_blank">` button labelled "Reserve
   on OpenTable" in addition to the in-page CTA. (Don't embed the actual
   iframe — that needs API credentials.) Otherwise just the in-page CTA.
8. **Hours & location** — real address, real hours when present, phone,
   "Get Directions" link to Google Maps.
9. **Private events / catering** — only when the niche pack signals it
   (`navItems` includes "Private Events"). One row, dark background, photo
   + 2-sentence pitch + "Inquire" link.
10. **FAQ accordion** — from `nichePack.proof.objectionHandlers` (use
    `<details>` / `<summary>`).
11. **Final CTA band** — dark, full-width, repeated reservation CTA.
12. **Footer** — name, address, phone, social, copyright.

## Restaurant-specific style notes

- Use **serif typography for headings** unless the design system explicitly
  prescribes sans (e.g. `linear-app`, `mono`, `sleek`). Restaurants read
  warmer in serif.
- **Vertical rhythm:** large breathing room between sections (`py-20`/`py-24`).
  Cramped restaurant pages feel like fast food.
- **Photo treatment:** food photos should be uncropped above the fold (let
  the dish be the subject); below-the-fold cards can use `aspect-ratio: 4/3`
  with `object-cover`.
- **Color emphasis:** primary brand color reserved for CTAs and badges only;
  body copy stays neutral text-color on light or text-inverse on dark. Don't
  flood the page with brand color — let the food photography carry warmth.
- **No emoji** in copy. Restaurants don't need them and they cheapen the page.

## What restaurants must NEVER include on this preview

- Cookie banners
- Newsletter popups
- Music autoplay
- Carousel sliders (they kill perceived performance)
- Stock photos of generic food when the brief has real photos available
