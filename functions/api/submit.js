// Cloudflare Pages Function — POST /api/submit  [canonical Twyne version — do not overwrite from a stale clone]
// 2026-09-22: renter backstop (never posted) + NANP phone validation mirroring funnel.js.
// 2026-09-29: hvac -> Twyne #555 (PX HVAC) branch: PX enum transforms, Jornaya + SessionLength gates, istest forced until confirmed.
// 2026-10-08: bathroom -> Twyne #556, windows -> Twyne #560 (multi-buyer, JSON POST /multi/post, pid 140 / sid 312). Raw site labels
//             in every cq slot, server-side zip->city/state fallback, state hard gate. #554 retired for these two verticals only.
//             Spec: shared brain sops/campaigns/renuehome-multibuyer-556-560--v2.
// Receives the lead, validates it, posts it to Twyne (HTM's lead platform),
// and returns a pay-per-call number for the thank-you screen.
//
// Two campaign kinds:
//   kind "fpi"   = classic ping-post FPI mapping (cq1=credit, cq2=homeowner, cq3=project). e.g. #550.
//   kind "multi" = Twyne multi-buyer direct post (#556 bathroom / #560 windows). JSON body to /multi/post,
//                  Twyne runs the Blue Ink / WestShore auction and delivers to the winner. cq slots carry the
//                  site's RAW option labels (Twyne conditions map them per buyer); Category is cq4 on bathroom
//                  and cq5 on windows. address1/city/state are REQUIRED (server fills city/state from zip if the
//                  browser lookup was empty; no state = no post). TrustedForm + Jornaya are hard gates.
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
  // Multi-buyer campaigns use a different API + publisher/source ids (JSON, not form-encoded).
  multi: { endpoint: "https://htm.api.twyne.io/multi/post", pid: "140", sid: "312" },
  campaigns: {
    // Multi-buyer campaigns #556 (bathroom) / #560 (windows): Twyne auctions Blue Ink vs WestShore and delivers
    // to the winner. category = hard-coded literal (same as #554). testUntilConfirmed: every post is istest=true
    // until Sergio confirms cq slots + winning buyers in Twyne, then flip to false (one-line change).
    bathroom: { cid: "556", kind: "multi", category: "bathroom", testUntilConfirmed: true },
    windows:  { cid: "560", kind: "multi", category: "window",   testUntilConfirmed: true },
    // Retired 2026-10-08 (multi-buyer replaces it): bathroom: { cid: "554", kind: "ws554", category: "bathroom" },
    //                                               windows:  { cid: "554", kind: "ws554", category: "window" },
    // Retired 2026-09-15: bathroom -> { cid: "550", kind: "fpi", projectField: "project" } (FPI #550).
    // PX HVAC Ping Post Exclusive via Twyne #555 (spec: shared brain sops/campaigns/px-hvac-555-renuehome-integration).
    // The site sends PX-format enum values (cq1-cq3 transform tables below), cq4 Own, cq5 credit, cq6 SessionLength.
    // testUntilConfirmed: every post is istest=true until Sergio confirms PX payouts + SessionLength look right,
    // then flip this to false (one-line change).
    hvac: { cid: "555", kind: "px555", testUntilConfirmed: true },
  },
  // Test-only #554 route. Reachable ONLY when the request carries x-rnh-test:1 AND the payload
  // sets testCampaign:"ws554". Posts through here are ALWAYS istest=true regardless of payload.
  // The real funnel never sends the header, so production traffic cannot reach this route.
  ws554Test: {
    // Retired 2026-10-08 with the #554 route for these verticals (restore both lines to re-verify #554):
    // bathroom: { cid: "554", kind: "ws554", category: "bathroom" },
    // windows:  { cid: "554", kind: "ws554", category: "window" },
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
  // Any diagnostic request stays in test mode, including the normal campaign route.
  let forceTest = isTestReq;
  if (isTestReq && lead.testCampaign === "ws554" && TWYNE.ws554Test[record.vertical]) {
    camp = TWYNE.ws554Test[record.vertical];
    forceTest = true; // staging route never posts a non-test lead
  }

  // Multi-buyer campaigns require city + 2-letter state. The browser fills them from a non-blocking zip
  // lookup that may not have returned by submit (and its city fallback can be "Austin, TX"), so clean
  // what arrived and fall back to a server-side zip lookup when either is still empty.
  if (camp && camp.kind === "multi") await fillGeoFromZip(record);

  // ---- Post to Twyne ----------------------------------------------------------
  const isTest = forceTest || camp?.testUntilConfirmed === true || env?.TWYNE_TEST === "true" || lead.istest === true || lead.istest === "true";
  let twyne = { attempted: false, isTest };
  const renter = /rent/i.test(String(lead.owner || ""));
  if (camp) {
    // Renters never post: no buyer takes them, so a post would only burn dedupe/quality stats.
    // (funnel.js also stops renters at the question; this is the server-side backstop.)
    if (renter) {
      twyne = { attempted: false, blocked: "renter", cid: camp.cid };
    // WestShore #554 hard gate: no TrustedForm cert, no post. Twyne would Accept a
    // cert-less lead (no server-side validation) — we refuse instead, per HTM policy.
    } else if ((camp.kind === "ws554" || camp.kind === "px555" || camp.kind === "multi") && !record.trustedFormCertUrl) {
      twyne = { attempted: false, blocked: "trustedform-missing", cid: camp.cid };
    // PX requires JornayaLeadId: a post without it fails at PX, so refuse it here (spec gotcha: the token
    // populates a few seconds after page load — a real visitor who reached step 9 always has one).
    // The multi-buyer campaigns keep the same gate (#556/#560 SOP verification: Jornaya-less = blocked pre-Twyne).
    } else if ((camp.kind === "px555" || camp.kind === "multi") && !record.jornayaLeadiD) {
      twyne = { attempted: false, blocked: "jornaya-missing", cid: camp.cid };
    // #556/#560 require address1 + city + state; a lead whose state is still unknown after the zip fallback
    // would be Rejected (and burn its dedupe key), so refuse it here instead.
    } else if (camp.kind === "multi" && !/^[A-Z]{2}$/.test(record.state || "")) {
      twyne = { attempted: false, blocked: "state-missing", cid: camp.cid };
    // PX rejects a missing/zero SessionLength; the funnel stamps it client-side (funnel.js v20260929+).
    } else if (camp.kind === "px555" && !(sessionSeconds(lead) > 0)) {
      twyne = { attempted: false, blocked: "sessionlength-missing", cid: camp.cid };
    } else if (camp.kind === "multi") {
      const subid1 = (env && env.TWYNE_SUBID1) || trafficSource(record.pageUrl, record.referrer);
      twyne = await postMulti(lead, record, camp, { ip, ua, subid1, isTest });
    } else {
      const subid1 = (env && env.TWYNE_SUBID1) ||
        ((camp.kind === "ws554" || camp.kind === "px555") ? trafficSource(record.pageUrl, record.referrer) : "renuehome");
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

  twyne.isTest = isTest || isTestResponse(twyne);
  const outcome = classifyOutcome(twyne);

  const callNumber = (env && env.CALL_NUMBER) || "";
  return json({
    ok: true,
    callNumber,
    value: outcome.value,
    transaction_id: outcome.transaction_id,
    outcome,
    twyne,
  });
}

// Explicit submission outcomes. Accepted is not proof of downstream sale or payment.
// A positive returned payout is a provisional conversion value, never a fallback estimate.
function isTestResponse(twyne) {
  const body = twyne.body || {};
  const truthyTest = value => value === true || /^(true|y|yes|1)$/i.test(String(value ?? ""));
  return [body.istest, body.isTest, body.is_test].some(truthyTest) ||
    /\btest[ -](lead|mode|request)\b|\bistest\s*=\s*n\b/i.test(`${twyne.status || ""} ${twyne.reason || ""}`);
}

function classifyOutcome(twyne) {
  const test = twyne.isTest === true || isTestResponse(twyne);
  const rawStatus = String(twyne.status || "").trim().toLowerCase();
  const knownStatus = ["accepted", "queued", "rejected", "error"].includes(rawStatus);
  let status = "not_attempted";
  if (test) status = "test";
  else if (twyne.blocked) status = "blocked";
  // A parsed JSON status wins over the HTTP code: the multi-buyer API returns Rejected/Error as HTTP 400.
  else if (twyne.attempted && knownStatus) status = rawStatus;
  else if (twyne.error || (twyne.attempted && !(twyne.httpStatus >= 200 && twyne.httpStatus < 300))) status = "error";
  else if (twyne.attempted) status = "unknown";
  // Payout: #554/#555 return publisher_payout; the multi-buyer post returns price (publisher payout, Dynamic 100%).
  const rawPayout = twyne.body?.publisher_payout ?? twyne.body?.price;
  const payout = typeof rawPayout === "number" || typeof rawPayout === "string" ? Number(rawPayout) : NaN;
  const transaction_id = twyne.leadid ? String(twyne.leadid).trim() : "";
  const conversion_eligible = status === "accepted" && Number.isFinite(payout) && payout > 0 && transaction_id !== "";
  return { status, test, conversion_eligible, value: conversion_eligible ? payout : null, transaction_id };
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

// ---- Twyne multi-buyer (#556 / #560) — JSON direct post ---------------------------------------
// One POST per lead; Twyne runs the auction and delivers to the winner. Every cq slot carries the site's
// RAW option label (no normalization — Twyne's per-buyer conditions use "contains"). Slot map (SOP v2):
//   #556 bathroom: cq1 credit · cq2 homeowner · cq3 project · cq4 Category("bathroom")
//   #560 windows:  cq1 credit · cq2 homeowner · cq3 nature  · cq4 Number of Windows (qty) · cq5 Category("window")
// Credit skipped -> "" (slot is Required: send empty, never omit).
function buildMultiBody(lead, record, camp, opt) {
  const raw = v => (v === undefined || v === null) ? "" : String(v);
  const externalid = "rh-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  let gclid = "";
  try { gclid = new URL(record.pageUrl || "https://renuehome.com").searchParams.get("gclid") || ""; } catch (_) {}
  const cq = { cq1: raw(lead.credit), cq2: raw(lead.owner), cq3: "", cq4: "" };
  if (record.vertical === "windows") {
    cq.cq3 = raw(lead.nature);
    cq.cq4 = raw(lead.qty);          // e.g. "2–3 windows" — en dash kept on purpose
    cq.cq5 = camp.category;          // "window"
  } else {
    cq.cq3 = raw(lead.project);
    cq.cq4 = camp.category;          // "bathroom"
  }
  const body = {
    // Live /multi/post reads `pid` / `sid` (verified 2026-10-08: `publisherid`/`sourceid` alone => "Invalid pid").
    // The FPI documents publisherid/sourceid, so both spellings are sent; extra root keys are ignored.
    pid: TWYNE.multi.pid,
    sid: TWYNE.multi.sid,
    publisherid: TWYNE.multi.pid,
    sourceid: TWYNE.multi.sid,
    cid: camp.cid,
    clickid: externalid,
    consumer: {
      first: record.first || "", last: record.last || "", email: record.email || "",
      phone: record.phone || "",                 // 10 digits, no formatting
      address1: record.address || "", city: record.city || "", state: record.state || "",
      zip: record.zip || "",
    },
    customquestions: cq,
    click: {
      useragent: opt.ua, subid1: opt.subid1, trustedform: record.trustedFormCertUrl,
      // REQUIRED on 556/560 (SOP v4, 2026-10-08): Twyne's buyer ping forwards {submitdate} verbatim because its own
      // {utccsubmitdate(...)} merge field never populated. ISO-8601 UTC, 24-hour, seconds precision, trailing Z,
      // stamped server-side at post time — never from the browser clock.
      submitdate: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      ip: opt.ip, leadid: record.jornayaLeadiD, externalid,
      domain_url: record.pageUrl || "https://renuehome.com",
      subid2: gclid, devicetype: deviceType(opt.ua), os: osCode(opt.ua),
    },
  };
  if (opt.isTest) body.istest = "true"; // root-level per FPI; omitted in production
  return body;
}

async function postMulti(lead, record, camp, opt) {
  const payload = buildMultiBody(lead, record, camp, opt);
  try {
    const r = await fetch(TWYNE.multi.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    // The FPI says "always 200" but its own Rejected/Error examples are HTTP 400 — parse the JSON
    // status regardless of the HTTP code and never branch on the code alone.
    const text = await r.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text.slice(0, 500) }; }
    const bids = Array.isArray(body.bids) ? body.bids : [];
    return {
      attempted: true, httpStatus: r.status,
      status: body.status || "", reason: body.reason || "", errors: body.errors || [],
      // pingid is Twyne's lead key for multi-buyer posts; keep it in leadid so GA4/Ads plumbing is unchanged.
      leadid: body.pingid || body.leadid || "", pingid: body.pingid || "", clickid: body.clickid || payload.clickid,
      price: body.price, bids, cid: camp.cid, body,
    };
  } catch (e) {
    return { attempted: true, error: String(e && e.message || e), cid: camp.cid };
  }
}

// city/state cleanup + server-side zip fallback (zippopotam.us, same source funnel.js uses client-side).
// Mutates record: strips a trailing ", ST" from city, uppercases state, fills blanks from the zip.
async function fillGeoFromZip(record) {
  record.city = String(record.city || "").replace(/\s*,\s*[A-Za-z]{2}\s*$/, "").trim();
  record.state = String(record.state || "").trim().toUpperCase().slice(0, 2);
  if (record.city && /^[A-Z]{2}$/.test(record.state)) return;
  if (!/^\d{5}$/.test(record.zip || "")) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch("https://api.zippopotam.us/us/" + record.zip, { signal: ctrl.signal, headers: { "Accept": "application/json" } });
    clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json();
    const p = j && j.places && j.places[0];
    if (!p) return;
    if (!record.city) record.city = String(p["place name"] || "").trim();
    if (!/^[A-Z]{2}$/.test(record.state)) record.state = String(p["state abbreviation"] || "").trim().toUpperCase().slice(0, 2);
  } catch (_) { /* leave as-is; the state gate decides */ }
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
  } else if (camp.kind === "px555") {
    // PX HVAC via Twyne #555 — PX-format enum values, per the #555 SOP transform tables.
    p.set("country", "US");
    const airType = pxAirType(lead.system);
    p.set("cq1", airType);                                   // PX AirType
    p.set("cq2", pxProjectType(lead.nature));                // PX ProjectType
    p.set("cq3", pxAirSubType(lead.system_type, airType));   // PX AirSubType
    p.set("cq4", "Own");                                     // homeowner (renters never reach here)
    if (lead.credit) p.set("cq5", String(lead.credit));      // credit rating, raw label, optional
    p.set("cq6", String(sessionSeconds(lead)));              // PX SessionLength, integer seconds
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

// ---- PX HVAC (#555) transforms — site option label -> PX enum. Unknown labels fall back to the
// "Not sure" row of each table (never send a raw label; PX rejects unknown enums). ----
function pxAirType(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "air conditioning") return "Cooling";
  if (s === "heating") return "Heating";
  return "Heating and Cooling"; // "Both heating & cooling", "Not sure", anything else
}
function pxProjectType(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "repair") return "Repair";
  if (s === "replacement" || s === "new installation") return "New Unit Installed";
  return "Service"; // "Not sure yet", anything else
}
function pxAirSubType(v, airType) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "central ac") return "Central Air";
  if (s === "ductless / mini-split" || s === "heat pump") return "Heat Pump";
  if (s === "furnace") return "Furnace";
  if (s === "boiler") return "Boiler";
  return airType === "Cooling" ? "Central Air" : "Furnace"; // "Not sure", anything else
}
// Integer seconds from quiz start to submit (funnel.js stamps `sessionLength`); 0 when absent.
function sessionSeconds(lead) {
  const n = Math.round(Number(lead.sessionLength));
  return Number.isFinite(n) && n > 0 ? n : 0;
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
