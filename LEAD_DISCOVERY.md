# Google Places Lead Discovery (v3 High-Intent Prospecting)

The `landing-builder-factory` now includes a **v3 High-Intent Prospecting** lead discovery layer. This pipeline discovers dental practices via Google Places, detects if they are running Google Ads, audits their website quality, and scores them to find the highest-value outreach targets.

## 1. Setup

You need a Google Maps Platform API key with the **Places API** enabled.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Places API**
3. Generate an API key
4. Add it to your `.env` file:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

*Note: The v3 pipeline also uses Playwright for Google Ads detection. Run `npx playwright install chromium` if you haven't already.*

## 2. Running Discovery

Use the `discover:dentists:v3` npm script to run the full enriched discovery pipeline.

### Basic Example

```bash
GOOGLE_MAPS_API_KEY=YOUR_KEY npm run discover:dentists:v3 -- \
  --query "dentist in Lynchburg, VA" \
  --out-all ./data/lynchburg_all.csv \
  --out-priority ./data/lynchburg_priority.csv \
  --out-ads-weak ./data/lynchburg_ads_weak.csv \
  --out-no-website ./data/lynchburg_no_website.csv
```

### Advanced Example (with filters and fast mode)

```bash
npm run discover:dentists:v3 -- \
  --query "cosmetic dentist in Austin, TX" \
  --limit 100 \
  --min-reviews 20 \
  --ad-query-mode expanded \
  --out-all ./data/austin_all.csv
```
*(If the optional output paths are omitted, the script auto-derives them based on `--out-all`.)*

### CLI Arguments

| Argument | Description | Default |
|---|---|---|
| `--query` | Text search query (e.g. "dentist in Lynchburg, VA") | **Required** |
| `--out-all` | Path to save the full list of discovered leads | **Required** |
| `--out-priority` | Path to save the filtered priority leads | **Required** |
| `--out-ads-weak` | Path to save ads+weak-site leads | Auto-derived |
| `--out-no-website` | Path to save no-website leads | Auto-derived |
| `--limit` | Maximum number of leads to fetch | `60` |
| `--detect-ads` | Run Google Ads detection (`true`/`false`) | `true` |
| `--audit-sites` | Run website quality audit (`true`/`false`) | `true` |
| `--ad-query-mode` | Ads query mode (`basic` or `expanded`) | `basic` |

## 3. Feeding Leads into the Campaign

The v3 discovery script outputs CSV files that are **exactly matched** to the `run-campaign.js` input schema.

### The Two Strongest Lead Types

**1. Google Ads Detected + Weak Website (`ads_weak` CSV)**
These dentists are actively paying Google for traffic, but sending that traffic to a website that lacks clear CTAs, booking widgets, or modern layouts. This is your highest-value segment for conversion-focused upgrades.

```bash
npm run campaign -- ./data/lynchburg_ads_weak.csv --out-dir ./campaign-output-lynchburg-ads --verbose
```

**2. No Website (`no_website` CSV)**
These dentists have an established Google Business Profile (often with good reviews) but no website at all. This is the easiest cold outreach angle.

```bash
npm run campaign -- ./data/lynchburg_no_website.csv --out-dir ./campaign-output-lynchburg-no-site --verbose
```

## 4. How the Enrichment Works

### Google Ads Detection
The system launches a headless Chromium browser and searches Google for local-intent keywords (e.g., "dentist in Lynchburg, VA"). It inspects the top sponsored results, looking for domain matches or business name matches in the ad headlines. Detection is conservative—it only flags `google_ads_detected=yes` if clear evidence is found.

### Website Quality Audit
If a lead has a website, the system fetches the homepage HTML and runs deterministic heuristic checks (no AI required). It looks for:
- Appointment booking widgets or links
- Click-to-call phone numbers
- Contact forms
- Live chat
- SSL (HTTPS) and mobile viewport tags
- Clear primary CTAs

Based on these signals, it computes a `conversion_score` and classifies the site as `strong`, `average`, or `weak`.

### Paid-Traffic Mismatch Scoring
The scoring model heavily rewards leads with a mismatch between traffic intent and conversion readiness:
- **No website:** +15 points
- **Google Ads detected:** +12 points
- **Weak website quality:** +10 points
- **COMBO (Ads + Weak Site):** +10 bonus points
- **Missing appointment booking:** +6 points
- **High reviews (≥ 100):** +10 points

Leads scoring ≥ 18 points are placed in **Tier A** and exported to the priority CSV.
