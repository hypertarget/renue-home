// Cloudflare Pages edge middleware. Injects into every HTML page:
// 1. Google Tag Manager (GTM-TPBNQW4L) — head loader (top of <head>) + <body> noscript.
//    Container is owned/managed by the media-buying team (installed Aug 2026 per their spec).
// 2. The Pinterest domain-verify meta tag (always) — for claiming renuehome.com.
// 3. The visitor's US state (from Cloudflare edge geo) so funnel.js can personalize the
//    hero. Relevance only — no fabricated "state program/rebate" claims. Falls back
//    silently when geo is missing/non-US/low-confidence.
export async function onRequest(context) {
  const response = await context.next();

  // Only touch HTML documents — leave JS/CSS/images and the /api/* JSON responses alone.
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;

  // Google Tag Manager — loader goes at the TOP of <head> per Google's install spec.
  const GTM_ID = "GTM-TPBNQW4L";
  const gtmHead =
    "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','" +
    GTM_ID +
    "');<\/script>";
  const gtmBody =
    '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=' +
    GTM_ID +
    '" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>';

  // Always present: Pinterest domain verification.
  let snippet = '<meta name="p:domain_verify" content="e592bdb73b32d572ef318517fd14a3b6"/>';

  // Conditionally add edge-geo state for the hero personalization.
  const cf = context.request.cf || {};
  if (cf.country === "US" && cf.region) {
    // Keep spaces so multi-word states render ("New York", "North Carolina").
    const clean = (s) => String(s).replace(/[<>"'\`\\]/g, "").slice(0, 40);
    snippet +=
      "<script>window.RENUE_GEO_REGION=" + JSON.stringify(clean(cf.region)) +
      ";window.RENUE_GEO_REGION_CODE=" + JSON.stringify(clean(cf.regionCode || "")) + ";<\/script>";
  }

  return new HTMLRewriter()
    .on("head", {
      element(el) {
        el.prepend(gtmHead, { html: true });
        el.append(snippet, { html: true });
      },
    })
    .on("body", {
      element(el) {
        el.prepend(gtmBody, { html: true });
      },
    })
    .transform(response);
}
