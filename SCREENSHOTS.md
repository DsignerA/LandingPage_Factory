# Screenshot Providers

This project supports two screenshot providers, selected via the `SCREENSHOT_PROVIDER`
environment variable (default: `local`).

---

## Provider: `local` (default)

Uses **Playwright headless Chromium** running on the same machine as the Node.js process.

**Best for:**
- `file://` preview screenshots (generated HTML files on disk)
- Local development and CI environments
- Any situation where you control the machine and can install Playwright

**Setup:**
```bash
npm install          # installs playwright
npx playwright install chromium   # downloads the browser binary
```

**Usage:**
```bash
SCREENSHOT_PROVIDER=local node src/cli/run-campaign.js data/sample-leads.csv
# or simply omit SCREENSHOT_PROVIDER — "local" is the default
```

**Notes:**
- This is the **preferred provider for `file://` preview screenshots**.
- Playwright can navigate `file://` URLs directly because it runs on the same machine.
- No API token required.

---

## Provider: `browserless`

Uses the **[Browserless.io](https://browserless.io) remote headless-browser API** to
capture screenshots of publicly accessible URLs.

**Best for:**
- Capturing screenshots of live public websites (`http://` or `https://`)
- Production pipelines where you do not want to manage a local browser binary
- Scaling screenshot capture without local Chromium overhead

**Setup:**
```bash
# Add to your .env (copy from .env.example)
SCREENSHOT_PROVIDER=browserless
BROWSERLESS_TOKEN=your_token_here
BROWSERLESS_URL=https://chrome.browserless.io   # optional, this is the default
```

**Usage:**
```bash
SCREENSHOT_PROVIDER=browserless node src/cli/run-campaign.js data/sample-leads.csv
```

**Notes:**
- Browserless runs in a **remote sandbox** and has **no access to your local filesystem**.
- **Browserless cannot reliably capture non-self-contained `file://` previews.**
  The remote browser cannot read files from your disk. Attempting to do so will
  produce a blank or broken screenshot.
- If you need to screenshot a generated preview HTML file using Browserless, you must
  first **serve it over HTTP/HTTPS** (e.g. `npx serve ./previews`) and pass the
  resulting `http://localhost:PORT/...` URL instead.
- For generated preview screenshots during local development, use
  `SCREENSHOT_PROVIDER=local` instead.

---

## Choosing the Right Provider

| Scenario | Recommended provider |
|---|---|
| Screenshotting generated `file://` preview HTML | `local` |
| Screenshotting a live business website (`https://`) | `browserless` or `local` |
| CI/CD pipeline with no local browser | `browserless` (serve previews via HTTP first) |
| Local development / smoke tests | `local` |
| Production at scale | `browserless` |

---

## Failure Policy

### Current-site screenshot failure
A failure to capture the **existing business website** is treated as a **warning**.
The pipeline continues and the result is flagged with `skipped_current: true`.
This is expected when a site is down, slow, or geo-restricted.

### Generated preview screenshot failure
A failure to capture the **generated preview** is flagged with
`generated_needs_review: true` in the job result. This is **not** silently treated
as a success. Downstream consumers (e.g. the outreach packet builder) should check
this flag and either retry the screenshot or mark the lead for manual review before
sending the outreach.

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `SCREENSHOT_PROVIDER` | `local` | Active provider: `local` or `browserless` |
| `BROWSERLESS_TOKEN` | _(none)_ | API token for Browserless.io (required when using `browserless`) |
| `BROWSERLESS_URL` | `https://chrome.browserless.io` | Browserless endpoint base URL |
