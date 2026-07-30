// functions/bathroom-call.js
// Edge geo-personalization for /bathroom-call.
// Rewrites the hero eyebrow + subline with the visitor's US state, resolved
// from Cloudflare's request geo (request.cf.region = full state name).
// Fully defensive: any failure falls back to the static page unchanged.

export async function onRequest(context) {
  // Always fetch the underlying static asset first.
  const response = await context.next();

  try {
    const ct = response.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return response;

    const cf = context.request.cf || {};
    const country = cf.country;
    // region = full state name (e.g. "Pennsylvania"); may be undefined.
    let region = typeof cf.region === "string" ? cf.region.trim() : "";

    // Only personalize for US visitors with a resolvable state name.
    // Anything else (no geo, non-US, datacenter IP) keeps the generic copy.
    if (country !== "US" || !region || region.length < 3) {
      return response;
    }

    const eyebrowText = region + " Bathroom Remodel";
    const areaText = region;

    const rewritten = new HTMLRewriter()
      .on("#geo-eyebrow", new TextReplacer(eyebrowText))
      .on("#geo-area", new TextReplacer(areaText))
      .transform(response);

    // Never let a personalized page get cached and served to another state.
    const out = new Response(rewritten.body, rewritten);
    out.headers.set("Cache-Control", "no-store");
    return out;
  } catch (e) {
    // On any error, serve the original page untouched.
    return response;
  }
}

// Replaces the inner text of a matched element.
class TextReplacer {
  constructor(text) {
    this.text = text;
    this.first = true;
  }
  element(el) {
    // Clear existing children, then insert the new text once.
    el.setInnerContent(this.text, { html: false });
  }
}
