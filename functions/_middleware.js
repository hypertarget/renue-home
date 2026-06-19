// Cloudflare Pages edge middleware: inject the visitor's US state (from Cloudflare's
// edge geo, request.cf) into the page so funnel.js can personalize the hero headline.
// Relevance only — no fabricated "state program/rebate" claims. Falls back silently
// (injects nothing) when geo is missing/non-US/low-confidence, so the hero stays generic.
export async function onRequest(context) {
  const response = await context.next();

  // Only touch HTML documents — leave JS/CSS/images and the /api/* JSON responses alone.
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;

  const cf = context.request.cf || {};
  const country = cf.country;             // e.g. "US"
  const region = cf.region;               // full state name, e.g. "Texas"
  const regionCode = cf.regionCode || ""; // e.g. "TX"

  // Require confident US geo. VPNs / mobile carriers often omit region -> skip and stay generic.
  if (country !== "US" || !region) return response;

  // Sanitize before embedding in a <script> (defense-in-depth; values are Cloudflare-controlled).
  // Keep spaces so multi-word states render ("New York", "North Carolina").
  const clean = (s) => String(s).replace(/[<>"'`\\]/g, "").slice(0, 40);
  const snippet =
    "<script>window.RENUE_GEO_REGION=" + JSON.stringify(clean(region)) +
    ";window.RENUE_GEO_REGION_CODE=" + JSON.stringify(clean(regionCode)) + ";</script>";

  return new HTMLRewriter()
    .on("head", { element(el) { el.append(snippet, { html: true }); } })
    .transform(response);
}
