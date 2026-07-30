// functions/bathroom-call.js  (FIXED + debug headers — revert to clean before merge)
export async function onRequest(context) {
  const response = await context.next();
  try {
    const cf = context.request.cf || {};
    const country = cf.country || "";
    let region = typeof cf.region === "string" ? cf.region.trim() : "";

    const ct = response.headers.get("content-type") || "";
    const personalize = ct.includes("text/html") && country === "US" && region && region.length >= 3;

    let body = response;
    if (personalize) {
      body = new HTMLRewriter()
        .on("#geo-eyebrow", new TextReplacer(region + " Bathroom Remodel"))
        .on("#geo-area", new TextReplacer(region))
        .transform(response);
    }

    const out = new Response(body.body, body);
    out.headers.set("x-geo-fn", "1");
    out.headers.set("x-geo-country", country);
    out.headers.set("x-geo-region", region || "(none)");
    out.headers.set("x-geo-personalized", personalize ? "1" : "0");
    if (personalize) out.headers.set("Cache-Control", "no-store");
    return out;
  } catch (e) {
    const out = new Response(response.body, response);
    out.headers.set("x-geo-fn", "err");
    out.headers.set("x-geo-err", String(e && e.message || e).slice(0, 160));
    return out;
  }
}

// Replaces the inner text of a matched element.
// NOTE: the value property must NOT be named `text` — HTMLRewriter treats a
// `text` field on a handler object as a reserved text-node callback.
class TextReplacer {
  constructor(value) { this.value = value; }
  element(el) { el.setInnerContent(this.value, { html: false }); }
}
