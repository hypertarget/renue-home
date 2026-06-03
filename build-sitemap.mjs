#!/usr/bin/env node
/**
 * Generates sitemap.xml + robots.txt by scanning the repo's .html files.
 * Run after adding pages:  node build-sitemap.mjs
 * (build.sh runs cities + sitemap together.)
 */
import { readdirSync, writeFileSync } from "fs";

const ORIGIN = "https://renuehome.com";
const today = new Date().toISOString().slice(0, 10);

const files = readdirSync(".").filter((f) => f.endsWith(".html"));
const routes = files.map((f) => {
  const r = f.replace(/\.html$/, "");
  return r === "index" ? "/" : "/" + r;
});

// Priority: home highest, core verticals high, city/legal lower.
const CORE = new Set(["/", "/bathroom", "/windows", "/roofing", "/hvac", "/kitchen",
  "/flooring", "/solar", "/gutters", "/painting", "/siding", "/plumbing", "/water-damage", "/other", "/locations"]);
const LEGAL = new Set(["/privacy", "/terms", "/ccpa", "/do-not-sell", "/partners"]);

function priority(r) {
  if (r === "/") return "1.0";
  if (CORE.has(r)) return "0.9";
  if (LEGAL.has(r)) return "0.3";
  return "0.7"; // city pages
}

const urls = routes.sort().map((r) =>
  `  <url><loc>${ORIGIN}${r}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${priority(r)}</priority></url>`
).join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
writeFileSync("sitemap.xml", sitemap);

const robots = `User-agent: *
Allow: /
Sitemap: ${ORIGIN}/sitemap.xml
`;
writeFileSync("robots.txt", robots);

console.log(`Wrote sitemap.xml (${routes.length} URLs) and robots.txt`);
