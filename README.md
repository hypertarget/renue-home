# Renue Home — renuehome.com

Multi-page home-services brand + conversion site. **Homepage = brand/legitimacy showpiece. Vertical pages = direct-response quiz funnels.** Clean white theme, Renue Home brand (green→teal `#14B8A6`→`#7ED957`, navy `#0F1A23`, Montserrat).

## Structure
- `index.html` — brand homepage (hero, category grid → funnels, how-it-works, why-choose, disclaimer). Not a hard funnel.
- `styles.css` — shared design system.
- `funnel.js` — shared engine: injects header/footer/sticky-mobile-CTA on every page; renders the config-driven quiz on vertical pages (progress, easy-questions-first, contact-last, TCPA consent, double-submit guard, tel/email/numeric inputs, validation, success-hidden-until-submit, friendly error on failure).
- `verticals.js` — all vertical funnel content (headlines, step flows, FAQs). Edit here to change any funnel.
- Vertical pages (thin shells loading the engine): `windows, bathroom, roofing, hvac, kitchen, flooring, solar, gutters, painting, other` `.html` → served at `/windows`, `/bathroom`, etc.
- Legal: `privacy.html`, `terms.html`, `ccpa.html`, `do-not-sell.html`.
- `functions/api/submit.js` — Cloudflare Pages Function: lead endpoint (validate + ping-post stub + returns pay-per-call number).

## Configure (no build step; static + Pages Functions)
- **Phone / pay-per-call:** set `window.RENUE_PHONE` and `window.RENUE_NONCONSENT_PHONE` in each page's inline `<script>` (or globally) to show real "Call Now" + non-consent line. Empty = placeholder UI.
- **Backend / pixels:** Cloudflare Pages → Settings → Environment variables: `CALL_NUMBER`, `LEAD_POST_URL`, `LEAD_POST_API_KEY`, `LEAD_BUYER_IDS`, `LEAD_MAX_BUYERS`. Add Google Ads / Meta pixel IDs in the page heads when ready.

## Edit live
Change copy/questions/FAQs in `verticals.js`, or homepage in `index.html`, commit to `main` → Cloudflare Pages auto-deploys in ~30s.

Fresh Starts. Better Homes.
