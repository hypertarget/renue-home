# Renue Home — renuehome.com

Branded home-improvement lead-generation site. Clean white theme, Renue Home brand (logo, green→teal gradient `#14B8A6`→`#7ED957`, navy `#0F1A23`, Montserrat). Config-driven multi-step funnel (service → ZIP → timeline → homeowner → address → contact) with consent, trust scaffolding, value props, and a thank-you/pay-per-call screen.

## Structure
- `index.html` — the whole site + funnel (static, edit `CONFIG` and `STEPS` at the bottom of the file).
- `functions/api/submit.js` — Cloudflare Pages Function: the lead endpoint (validates + ping-post stub + returns call number).

## Deploy (Cloudflare Pages)
Connected to this GitHub repo → every push to `main` auto-deploys. No build step (static + Pages Functions). Build command: *(none)*; Output directory: `/`.

## Environment variables (Pages → Settings → Environment variables)
`CALL_NUMBER` (Ringba/Retreaver), `LEAD_POST_URL`, `LEAD_POST_API_KEY`, `LEAD_BUYER_IDS`, `LEAD_MAX_BUYERS`, plus pixel IDs when ready.

## Editing live
Change copy/questions/services in `index.html` (`STEPS`, `SERVICES`, `CONFIG`), commit, push — Cloudflare rebuilds in ~30s.

Fresh Starts. Better Homes.
