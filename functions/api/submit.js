// Cloudflare Pages Function — POST /api/submit  [canonical Twyne version — do not overwrite from a stale clone]
// 2026-09-22: renter backstop (never posted) + NANP phone validation mirroring funnel.js.
// Receives the lead, validates it, posts it to Twyne (HTM's lead platform),
// and returns a pay-per-call number for the thank-you screen.
//
// Two campaign kinds:
//   kind "fpi"   = classic ping-post FPI mapping (cq1=credit, cq2=homeowner, cq3=project). e.g. #550.
//   kind "ws554" = WestShore API direct post (#554, CPL). cq1 = category hard-coded per funnel
//                  ("bathroom"/"window") — NEVER derived from user input (no server-side validation
//                  on Twyne's end; correctness lives here). trustedform is REQUIRED: if the cert is
//                  missing the lead is NOT posted (consumer still sees the thank-you screen).
//                  Spec: shared brain sops/campaigns/westshore-api-554-direct-post--v1.
//
// Optional env (Cloudflare Pages -> Settings -> Environment variables):
//   CALL_NUMBER       static pay-per-call number shown on the thank-you screen
//   TWYNE_SUBID1      overrides the derived traffic source for subid1 (fpi default "renuehome")
//   TWYNE_TEST        "true" forces istest=true on every post (use on staging)

// ---- Twyne campaign map -------------------------------------------------------
const TWYNE = {
  endpoint: "https://htm.api.twyne.io/lead/submit",
  pid: "139",
  sid: "310",
  campaigns: {
    // WestShore API campaign #554 — Twyne runs its ping-post auction on every post (WestShore =
    // the anchor API buyer; highest bidder wins). cq1 category hard-coded per funnel.
    // ACTIVE 2026-09-15 per Eric, after istest verification (leadids 6253630/6253631).
    bathroom: { cid: "554", kind: "ws554", category: "bathroom" },
    windows:  { cid: "554", kind: "ws554", category: "window" },
    // Retired 2026-09-15: bathroom -> { cid: "550", kind: "fpi", projectField: "project" } (FPI #550).
  },
  // Test-only #554 route. Reachable ONLY when the request carries x-rnh-test:1 AND the payload
  // sets testCampaign:"ws554". Posts through here are ALWAYS istest=true regardless of payload.
  // The real funnel never sends the header, so production traffic cannot reach this route.
  ws554Test: {
    bathroom: { cid: "554", kind: "ws554", category: "bathroom" },
    windows:  { cid: "554", kind: "ws554", category: "window" },
  },
};

export async function onRequestPost({ request, env }) {
  let lead = {};
  try { lead = await request.json(); } catch (_) {}

  // basic server-side validation (phone rules mirror funnel.js normPhone: 10 NANP digits, leading 1 dropped,
  // area code + exchange start 2-9, not all one digit, not the 555-01XX fictional block)
  const phoneDigits = normPhone(lead.phone);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email || "");
  if (!emailOk || !phoneDigits || !/^\d{5}$/.test(lead.zip || "")) {
    return json({ ok: false, message: "Missing or invalid required fields" }, 400);
  }

  // Test-only override: when the request carries x-rnh-test:1, allow ip/useragent
  // from the payload so ping tests can vary source. The real funnel never sends
  // this header, so production leads always use the true request ip/ua.
  const isTestReq = request.headers.get("x-rnh-test") === "1";
  const ip = (isTestReq && lead.ip) ? String(lead.ip) : (request.headers.get("CF-Connecting-IP") || "");
  const ua = (isTestReq && lead.useragent) ? String(lead.useragent) : (request.headers.get("User-Agent") || "");

  // Normalized record (handy for logging / future fraud scoring).
  const record = {
    first: lead.first, last: lead.last, email: lead.email, phone: phoneDigits,
    zip: lead.zip, address: lead.address || "", city: lead.city || "", state: lead.state || "",
    vertical: lead.vertical || "", answers: lead,
    consent: lead.consent === true, consentText: lead.consentText || "",
    trustedFormCertUrl: lead.xxTrustedFormCertUrl || "",
    jornayaLeadiD: lead.universal_leadid || "",
    pageUrl: lead.pageUrl || "", referrer: lead.referrer || "", ip, userAgent: ua, ts: Date.now(),
  };

  // ---- Campaign selection -------------------------------------------------------
  let camp = TWYNE.campaigns[record.vertical];
  let forceTest = false;
  if (isTestReq && lead.testCampaign === "ws554" && TWYNE.ws554Test[record.vertical]) {
    camp = TWYNE.ws554Test[record.vertical];
    forceTest = true; // staging route never posts a non-test lead
  }

  // ---- Post to Twyne ----------------------------------------------------------
  let twyne = { attempted: false };
  const renter = /rent/i.test(String(lead.owner || ""));
  if (camp) {
    // Renters never post: no buyer takes them, so a post would only burn dedupe/quality stats.
    // (funnel.js also stops renters at the question; this is the server-side backstop.)
    if (renter) {
      twyne = { attempted: false, blocked: "renter", cid: camp.cid };
    // WestShore #554 hard gate: no TrustedForm cert, no post. Twyne would Accept a
    // cert-less lead (no server-side validation) — we refuse instead, per HTM policy.
    } else if (camp.kind === "ws554" && !record.trustedFormCertUrl) {
      twyne = { attempted: false, blocked: "trustedform-missing", cid: camp.cid };
    } else {
      const isTest = forceTest || (env && env.TWYNE_TEST === "true") || lead.istest === true || lead.istest === "true";
      const subid1 = (env && env.TWYNE_SUBID1) ||
        (camp.kind === "ws554" ? trafficSource(record.pageUrl, record.referrer) : "renuehome");
      const params = buildTwyneParams(lead, record, camp, { ip, ua, subid1, isTest });
      try {
        const r = await fetch(TWYNE.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: params,
        });
        // Twyne answers HTTP 200 on everything — the JSON body's `status` is the truth
        // (Accepted / Queued / Rejected / Error). Never treat 200 as success.
        const body = await r.json().catch(() => ({}));
        twyne = { attempted: true, httpStatus: r.status, status: body.status || "", reason: body.reason || "", errors: body.errors || [], leadid: body.leadid || "", cid: camp.cid, body };
      } catch (e) {
        twyne = { attempted: true, error: String(e && e.message || e), cid: camp.cid };
      }
    }
  }

  // Conversion value for Google Ads = accepted buyer payout from Twyne (if any), else null (client falls back).
  const payoutRaw = twyne && twyne.body ? twyne.body.publisher_payout : undefined;
  const payout = payoutRaw != null ? parseFloat(payoutRaw) : NaN;
  const txnId = (twyne && twyne.leadid) ? String(twyne.leadid) : (record.jornayaLeadiD || "");

  const callNumber = (env && env.CALL_NUMBER) || "";
  return json({
    ok: true,
    callNumber,
    value: payout > 0 ? payout : null,
    transaction_id: txnId,
    twyne,
  });
}

// Derive subid1 (publisher main traffic source) for #554 so results break out by source.
// Order: paid click ids -> utm_source[-medium] -> referrer engine -> direct.
function trafficSource(pageUrl, referrer) {
  try {
    const u = new URL(pageUrl || "https://renuehome.com");
    const q = u.searchParams;
    if (q.get("gclid") || q.get("gbraid") || q.get("wbraid")) return "google-cpc";
    if (q.get("msclkid")) return "bing-cpc";
    if (q.get("fbclid")) return "facebook-cpc";
    const us = (q.get("utm_source") || "").toLowerCase();
    const um = (q.get("utm_medium") || "").toLowerCase();
    if (us) return (us + (um ? "-" + um : "")).replace(/[^a-z0-9-]/g, "").slice(0, 40);
    const r = (referrer || "").toLowerCase();
    if (r.indexOf("google.") > -1) return "google-organic";
    if (r.indexOf("bing.") > -1) return "bing-organic";
    if (r.indexOf("facebook.") > -1 || r.indexOf("fb.") > -1) return "facebook";
    if (r) return "referral";
    return "direct";
  } catch (_) { return "renuehome"; }
}

// Build the x-www-form-urlencoded body Twyne expects.
function buildTwyneParams(lead, record, camp, opt) {
  const p = new URLSearchParams();
  // required hidden ids
  p.set("pid", TWYNE.pid);
  p.set("sid", TWYNE.sid);
  p.set("cid", camp.cid);
  p.set("ip", opt.ip);
  p.set("subid1", opt.subid1);
  p.set("useragent", opt.ua);
  // device + os (optional, derived from UA)
  p.set("devicetype", deviceType(opt.ua));
  p.set("os", osCode(opt.ua));
  // consent proof
  if (record.jornayaLeadiD) p.set("leadid", record.jornayaLeadiD);
  if (record.trustedFormCertUrl) p.set("trustedform", record.trustedFormCertUrl);
  // tracking
  p.set("domain_url", record.pageUrl || "https://renuehome.com");
  p.set("externalid", "rh-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  p.set("istest", opt.isTest ? "true" : "false");
  // contact
  p.set("first", record.first || "");
  p.set("last", record.last || "");
  p.set("email", record.email || "");
  p.set("phone", record.phone || "");   // 10 digits, no formatting (Twyne validates phone upfront)
  p.set("zip", record.zip || "");

  if (camp.kind === "ws554") {
    // WestShore API #554 — spec fields only (sops/campaigns/westshore-api-554-direct-post--v1).
    p.set("country", "US");
    p.set("cq1", camp.category);        // hard-coded category: "bathroom" | "window"
    // subid2 = gclid when present (fixed order per spec note)
    try {
      const g = new URL(record.pageUrl || "https://renuehome.com").searchParams.get("gclid");
      if (g) p.set("subid2", g);
    } catch (_) {}
  } else {
    // Classic FPI mapping (e.g. #550): address + custom questions from the funnel.
    const projectType = lead[camp.projectField] || lead.project || lead.nature || "";
    p.set("address1", record.address || "");
    if (lead.address2) p.set("address2", lead.address2);
    p.set("state", (record.state || "").toUpperCase().slice(0, 2));
    p.set("city", record.city || "");
    p.set("cq1", lead.credit || "");                 // Credit Rating
    p.set("cq2", homeowner(lead.owner));             // Homeowner (Yes/No)
    p.set("cq3", projectType);                        // Project Type
  }
  return p.toString();
}

// 10 NANP digits or "" (see funnel.js normPhone for the client twin).
function normPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  if (d.length !== 10) return "";
  if (/^(\d)\1{9}$/.test(d)) return "";
  if (!/^[2-9]/.test(d) || !/^[2-9]/.test(d.slice(3))) return "";
  if (d[1] === "1" && d[2] === "1") return "";
  if (/^\d{3}55501\d{2}$/.test(d)) return "";
  return d;
}
function homeowner(v) {
  if (!v) return "";
  return /own|yes/i.test(v) ? "Yes" : "No";
}
function deviceType(ua) {
  if (/tablet|ipad/i.test(ua)) return "T";
  if (/mobi|iphone|android/i.test(ua)) return "M";
  return "D";
}
function osCode(ua) {
  if (/iphone|ipad|ios|mac os/i.test(ua)) return "I";
  if (/android/i.test(ua)) return "A";
  if (/windows/i.test(ua)) return "W";
  return "";
}

// Optional: respond to non-POST so the route exists
export async function onRequestGet() {
  return json({ ok: true, service: "renue-home lead endpoint", method: "POST" });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
