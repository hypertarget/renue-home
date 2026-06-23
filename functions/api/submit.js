// Cloudflare Pages Function — POST /api/submit
// Receives the lead, validates it, posts it to Twyne (HTM's ping-post platform),
// and returns a pay-per-call number for the thank-you screen.
//
// Twyne is the lead destination: renuehome.com -> Twyne -> ping-post to multiple buyers.
// We do NOT post to individual buyers (e.g. BlueInk) directly; Twyne handles that.
//
// Optional env (Cloudflare Pages -> Settings -> Environment variables):
//   CALL_NUMBER       static pay-per-call number shown on the thank-you screen
//   TWYNE_SUBID1      publisher main traffic source id (defaults to "renuehome")
//   TWYNE_TEST        "true" forces istest=true on every post (use on staging)

// ---- Twyne campaign map -------------------------------------------------------
// pid/sid are constant for this publisher+source; cid changes per vertical (per FPI).
// projectField = the funnel step id that holds the buyer's "Project Type" (cq3).
// Add a line here as each vertical's Field Publisher Instructions arrive.
const TWYNE = {
  endpoint: "https://htm.api.twyne.io/lead/submit",
  pid: "139",
  sid: "310",
  campaigns: {
    bathroom: { cid: "550", projectField: "project" }, // FPI #550 - Home Improvement - Bathroom
  },
};

export async function onRequestPost({ request, env }) {
  let lead = {};
  try { lead = await request.json(); } catch (_) {}

  // basic server-side validation
  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email || "");
  if (!emailOk || phoneDigits.length < 10 || !/^\d{5}$/.test(lead.zip || "")) {
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
    pageUrl: lead.pageUrl || "", ip, userAgent: ua, ts: Date.now(),
  };

  // ---- Post to Twyne ----------------------------------------------------------
  let twyne = { attempted: false };
  const camp = TWYNE.campaigns[record.vertical];
  if (camp) {
    const isTest = (env && env.TWYNE_TEST === "true") || lead.istest === true || lead.istest === "true";
    const params = buildTwyneParams(lead, record, camp, {
      ip, ua, subid1: (env && env.TWYNE_SUBID1) || "renuehome", isTest,
    });
    try {
      const r = await fetch(TWYNE.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body: params,
      });
      const body = await r.json().catch(() => ({}));
      twyne = { attempted: true, httpStatus: r.status, status: body.status || "", reason: body.reason || "", leadid: body.leadid || "", body };
    } catch (e) {
      twyne = { attempted: true, error: String(e && e.message || e) };
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

// Build the x-www-form-urlencoded body Twyne expects (FPI field grid).
function buildTwyneParams(lead, record, camp, opt) {
  const projectType = lead[camp.projectField] || lead.project || lead.nature || "";
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
  // contact + location
  p.set("first", record.first || "");
  p.set("last", record.last || "");
  p.set("email", record.email || "");
  p.set("phone", record.phone || "");
  p.set("zip", record.zip || "");
  p.set("address1", record.address || "");
  if (lead.address2) p.set("address2", lead.address2);
  p.set("state", (record.state || "").toUpperCase().slice(0, 2));
  p.set("city", record.city || "");
  // custom questions
  p.set("cq1", lead.credit || "");                 // Credit Rating
  p.set("cq2", homeowner(lead.owner));             // Homeowner (Yes/No)
  p.set("cq3", projectType);                        // Project Type
  return p.toString();
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
