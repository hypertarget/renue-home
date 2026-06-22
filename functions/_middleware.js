// Cloudflare Pages edge middleware. Injects into every HTML page's <head>:
//  1. The Pinterest domain-verify meta tag (always) — for claiming renuehome.com.
//  2. The visitor's US state (from Cloudflare edge geo) so funnel.js can personalize the
//     hero. Relevance only — no fabricated "state program/rebate" claims. Falls back
//     silently when geo is missing/non-US/low-confidence.
export async function onRequest(context) {
  const response = await context.next();

  // Only touch HTML documents — leave JS/CSS/images and the /api/* JSON responses alone.
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;

  // Always present: Pinterest domain verification.
  let snippet = '<meta name="p:domain_verify" content="e592bdb73b32d572ef318517fd14a3b6"/>';

  // Conditionally add edge-geo state for the hero personalization.
  const cf = context.request.cf || {};
  if (cf.country === "US" && cf.region) {
    // Keep spaces so multi-word states render ("New York", "North Carolina").
    const clean = (s) => String(s).replace(/[<>"'`\\]/g, "").slice(0, 40);
    snippet +=
      "<script>window.RENUE_GEO_REGION=" + JSON.stringify(clean(cf.region)) +
      ";window.RENUE_GEO_REGION_CODE=" + JSON.stringify(clean(cf.regionCode || "")) + ";</script>";
  }

  return new HTMLRewriter()
    .on("head", { element(el) { el.append(snippet, { html: true }); } })
    .transform(response);
}
