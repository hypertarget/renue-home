#!/usr/bin/env node
/**
 * Renue Home — city/region landing-page generator (programmatic local SEO).
 *
 * Emits one flat HTML page per (vertical × city) into the repo root, e.g.
 *   bathroom-austin-tx.html  ->  served by Cloudflare at /bathroom-austin-tx
 * Each page reuses the shared funnel engine and sets window.RENUE_CITY so the
 * headline, intro, SEO copy and FAQ heading are localized to the metro.
 * Also writes locations.html — an index of every city page, grouped by vertical.
 *
 * Re-run any time you add cities or verticals:   node build-cities.mjs
 * Flat filenames are intentional: GitHub's web uploader flattens folders, and
 * Cloudflare Pages serves "/slug" from "slug.html" with no config.
 */
import { writeFileSync } from "fs";

// --- Edit these two lists to expand coverage ---------------------------------
const CITIES = [
  { metro: "Austin",      state: "TX", slug: "austin-tx" },
  { metro: "Dallas",      state: "TX", slug: "dallas-tx" },
  { metro: "Houston",     state: "TX", slug: "houston-tx" },
  { metro: "San Antonio", state: "TX", slug: "san-antonio-tx" },
  { metro: "Phoenix",     state: "AZ", slug: "phoenix-az" },
  { metro: "Denver",      state: "CO", slug: "denver-co" },
  { metro: "Tampa",       state: "FL", slug: "tampa-fl" },
  { metro: "Orlando",     state: "FL", slug: "orlando-fl" },
  { metro: "Atlanta",     state: "GA", slug: "atlanta-ga" },
  { metro: "Charlotte",   state: "NC", slug: "charlotte-nc" },
  { metro: "Nashville",   state: "TN", slug: "nashville-tn" },
  { metro: "Las Vegas",   state: "NV", slug: "las-vegas-nv" },
];

// vertical key -> { label, desc } used on the locations index + meta description
const VERTICALS = {
  bathroom: { label: "Bathroom Remodeling", word: "bathroom remodel" },
  windows:  { label: "Windows",             word: "window replacement" },
  roofing:  { label: "Roofing",             word: "roofing" },
  hvac:     { label: "HVAC",                word: "HVAC" },
  siding:   { label: "Siding",              word: "siding" },
  kitchen:  { label: "Kitchen Remodeling",  word: "kitchen remodel" },
};
// -----------------------------------------------------------------------------

const HEAD = (title, desc) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="https://renuehome.com/{CANON}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">`;

let pages = 0;
const byVertical = {};

for (const [vKey, v] of Object.entries(VERTICALS)) {
  byVertical[vKey] = [];
  for (const c of CITIES) {
    const slug = `${vKey}-${c.slug}`;
    const cityName = `${c.metro}, ${c.state}`;
    const title = `${v.label} in ${c.metro}, ${c.state} — Free Quotes | Renue Home`;
    const desc = `Compare free, no-obligation ${v.word} quotes from ${c.metro}, ${c.state} pros serving your area. Renue Home connects local homeowners with independent home-improvement professionals.`;
    const html = `${HEAD(title, desc).replace("{CANON}", slug)}
<script>
window.RENUE_PAGE="vertical";
window.RENUE_VERTICAL="${vKey}";
window.RENUE_CITY={name:"${cityName}",metro:"${c.metro}",state:"${c.state}"};
window.RENUE_PHONE="";window.RENUE_NONCONSENT_PHONE="";
</script>
<script defer src="/verticals.js"></script>
<script defer src="/funnel.js"></script>
</head>
<body><div id="app"></div></body>
</html>
`;
    writeFileSync(`${slug}.html`, html);
    byVertical[vKey].push({ slug, c });
    pages++;
  }
}

// locations.html — index of every city page
const groups = Object.entries(VERTICALS).map(([vKey, v]) => {
  const links = byVertical[vKey]
    .map(({ slug, c }) => `<a href="/${slug}">${v.label} — ${c.metro}, ${c.state}</a>`)
    .join("");
  return `<div class="loc-vert"><h3>${v.label}</h3><div class="loc-grid">${links}</div></div>`;
}).join("");

const locations = `${HEAD("Service Areas — Renue Home", "Renue Home connects homeowners with local home-improvement pros across major U.S. metros. Find your city and project type.").replace("{CANON}", "locations")}
<script>window.RENUE_PAGE="legal";window.RENUE_PHONE="";window.RENUE_NONCONSENT_PHONE="";</script>
<script defer src="/funnel.js"></script>
</head>
<body>
<main class="wrap" style="padding:46px 0 10px">
  <div class="seclabel">Service areas</div>
  <h1 class="sec-h" style="font-size:34px">Find local pros in your area</h1>
  <p class="lead" style="max-width:720px">Renue Home connects homeowners with independent local home-improvement professionals across the country. Choose your project and city to get started with a free, no-obligation quote.</p>
  ${groups}
</main>
</body>
</html>
`;
writeFileSync("locations.html", locations);

console.log(`Generated ${pages} city pages across ${Object.keys(VERTICALS).length} verticals × ${CITIES.length} cities, plus locations.html`);
