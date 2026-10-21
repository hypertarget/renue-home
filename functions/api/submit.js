// Cloudflare Pages Function — POST /api/submit  [canonical Twyne version — do not overwrite from a stale clone]
// 2026-09-22: renter backstop (never posted) + NANP phone validation mirroring funnel.js.
// 2026-09-29: hvac -> Twyne #555 (PX HVAC) branch: PX enum transforms, Jornaya + SessionLength gates, istest forced until confirmed.
// Receives the lead, validates it, posts it to Twyne (HTM's lead platform),
// and returns a pay-per-call number for the thank-you screen.
//
// Campaign kinds:
//   kind "multi556" = opt-in bathroom-only ping/post auction; never count a ping as a sale.
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
//   RNH_BATHROOM_ROUTE unset or "ws554" preserves the direct route; "multi556" opts
//                      bathroom only into the verified multi-buyer configuration.
//                      Never enable on production until buyer mapping/consent and final payout are verified.

// ---- Twyne campaign map -------------------------------------------------------
const TWYNE = {
  endpoint: "https://htm.api.twyne.io/lead/submit",
  pid: "139",
  sid: "310",
  multi: {
    ping: "https://htm.api.twyne.io/multi/ping",
    post: "https://htm.api.twyne.io/multi/post",
    pid: "140", sid: "312",
  },
  bathroomMulti: { cid: "556", kind: "multi556", category: "bathroom" },
  campaigns: {
    // WestShore API campaign #554. Delivery is controlled by Twyne's campaign configuration.
    // cq1 category is hard-coded per funnel. Test acceptance is not proof of payable delivery.
    bathroom: { cid: "554", kind: "ws554", category: "bathroom" },
    windows:  { cid: "554", kind: "ws554", category: "window" },
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
  const bathroomRoute = env?.RNH_BATHROOM_ROUTE || "ws554";
  if (record.vertical === "bathroom") {
    if (bathroomRoute === "multi556") camp = TWYNE.bathroomMulti;
    else if (bathroomRoute !== "ws554") {
      // A typo cannot silently select a buyer or force real consumers into test mode.
      return json({ ok: false, message: "Submission route unavailable" }, 503);
    }
  }
  // Any diagnostic request stays in test mode, including the normal campaign route.
  let forceTest = isTestReq;
  if (isTestReq && lead.testCampaign === "ws554" && TWYNE.ws554Test[record.vertical]) {
    camp = TWYNE.ws554Test[record.vertical];
    forceTest = true; // staging route never posts a non-test lead
  }

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
    } else if ((camp.kind === "ws554" || camp.kind === "px555" || camp.kind === "multi556") && !record.trustedFormCertUrl) {
      twyne = { attempted: false, blocked: "trustedform-missing", cid: camp.cid };
    // PX requires JornayaLeadId: a post without it fails at PX, so refuse it here (spec gotcha: the token
    // populates a few seconds after page load — a real visitor who reached step 9 always has one).
    } else if ((camp.kind === "px555" || camp.kind === "multi556") && !record.jornayaLeadiD) {
      twyne = { attempted: false, blocked: "jornaya-missing", cid: camp.cid };
    // PX rejects a missing/zero SessionLength; the funnel stamps it client-side (funnel.js v20260929+).
    } else if (camp.kind === "px555" && !(sessionSeconds(lead) > 0)) {
      twyne = { attempted: false, blocked: "sessionlength-missing", cid: camp.cid };
    } else if (camp.kind === "multi556") {
      twyne = await submitBathroomMulti(lead, record, camp, {
        ip, ua, isTest, subid1: env?.TWYNE_SUBID1 || trafficSource(record.pageUrl, record.referrer),
      });
    } else {
      const subid1 = (env && env.TWYNE_SUBID1) ||
        ((camp.kind === "ws554" || camp.kind === "px555") ? trafficSource(record.pageUrl, record.referrer) : "renuehome");
      const params = buildTwyneParams(lead, record, camp, { ip, ua, subid1, isTest });
      try {
        const { httpStatus, body } = await fetchBoundedJson(TWYNE.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
          body: params,
        }, camp.kind === "ws554" ? MULTI_POST_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS);
        // Twyne answers HTTP 200 on everything — the JSON body's `status` is the truth
        // (Accepted / Queued / Rejected / Error). Never treat 200 as success.
        twyne = { attempted: true, httpStatus, status: body.status || "", reason: body.reason || "", errors: body.errors || [], leadid: body.leadid || "", cid: camp.cid, body };
      } catch (e) {
        twyne = { attempted: true, error: upstreamError(e), cid: camp.cid };
      }
    }
  }

  twyne.isTest = isTest || twyne.isTest === true || isTestResponse(twyne);
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
  let status = "not_attempted";
  if (test) status = "test";
  else if (twyne.blocked) status = "blocked";
  else if (twyne.kind === "multi556" && rawStatus === "rejected" && twyne.httpStatus === 400) status = "rejected";
  else if (twyne.error || (twyne.attempted && !(twyne.httpStatus >= 200 && twyne.httpStatus < 300))) status = "error";
  else if (twyne.attempted) status = ["accepted", "queued", "rejected", "error"].includes(rawStatus) ? rawStatus : "unknown";
  // Multi-buyer value comes ONLY from the final POST response, never a ping bid.
  const rawPayout = twyne.kind === "multi556"
    ? (twyne.body?.publisher_payout ?? twyne.body?.price)
    : twyne.body?.publisher_payout;
  const payout = typeof rawPayout === "number" || typeof rawPayout === "string" ? Number(rawPayout) : NaN;
  const transaction_id = twyne.leadid ? String(twyne.leadid).trim() : "";
  const finalDelivery = twyne.kind !== "multi556" || twyne.finalPostAccepted === true;
  const conversion_eligible = finalDelivery && status === "accepted" && Number.isFinite(payout) && payout > 0 && transaction_id !== "";
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

// Fixed upper bounds cover both headers and response-body reads. No retry occurs here:
// a timeout after a POST may mean the buyer received it but the response was lost.
const UPSTREAM_TIMEOUT_MS = 20000;
// WestShore's Twyne delivery step has a 30-second timeout (inspected 2026-10-21).
const MULTI_POST_TIMEOUT_MS = 35000;
const GEO_TIMEOUT_MS = 2500;
const MAX_UPSTREAM_BYTES = 65536;
async function fetchBoundedJson(url, init = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let reader;
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) throw new Error("upstream-redirect");
    if (Number(response.headers.get("content-length")) > MAX_UPSTREAM_BYTES) throw new Error("response-too-large");
    reader = response.body?.getReader();
    let text = "", bytes = 0;
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_UPSTREAM_BYTES) throw new Error("response-too-large");
        text += decoder.decode(value, { stream: true });
      }
    }
    text += decoder.decode();
    let body;
    try { body = JSON.parse(text); } catch (_) { throw new Error("invalid-response"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid-response");
    return { httpStatus: response.status, body };
  } catch (error) {
    if (controller.signal.aborted) throw new Error("upstream-timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    // Cancel an incomplete/oversized response and release its connection. Do not log bodies or PII.
    controller.abort();
    if (reader) {
      try { await reader.cancel(); } catch (_) {}
      reader.releaseLock();
    }
  }
}
function upstreamError(error) {
  return ["upstream-timeout", "response-too-large", "invalid-response", "upstream-redirect"].includes(error?.message)
    ? error.message : "upstream-unavailable";
}

const BATHROOM_PROJECTS = ["Tub-to-shower conversion", "Walk-in shower", "Full bathroom remodel", "Safety / mobility upgrade", "Not sure yet"];
const CREDIT_LABELS = ["", "Excellent", "Good", "Fair", "Poor", "Not sure"];
const US_STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));

async function submitBathroomMulti(lead, record, camp, opt) {
  const base = { kind: "multi556", cid: camp.cid, attempted: false, finalPostAccepted: false };
  const blocked = reason => ({ ...base, blocked: reason });
  // Keep raw option labels: Twyne's per-buyer conditions consume these exact cq values.
  if (lead.owner !== "Yes, I own the home") return blocked("homeowner-required");
  if (!record.consent || typeof record.consentText !== "string" || !record.consentText.trim()) return blocked("consent-missing");
  if (!BATHROOM_PROJECTS.includes(lead.project)) return blocked("project-invalid");
  const credit = lead.credit == null ? "" : lead.credit;
  if (!CREDIT_LABELS.includes(credit)) return blocked("credit-invalid");
  if (![record.first, record.last].every(value => typeof value === "string" && value.trim()) ||
      typeof record.address !== "string" || record.address.trim().length < 5) return blocked("contact-missing");
  await fillMultiGeo(record);
  if (!record.city || !US_STATES.has(record.state)) return blocked("geo-missing");
  // Temporary route guard: signed WestShore IO excludes California and this auction's
  // WestShore bidder has no verified CA filter. Lift only after buyer-level eligibility
  // is enforced and any alternate buyer's CA acceptance has been confirmed.
  if (record.state === "CA") return blocked("area-unavailable");

  const externalid = "rh-" + crypto.randomUUID();
  let gclid = "";
  try { gclid = new URL(record.pageUrl).searchParams.get("gclid") || ""; } catch (_) {}
  const payload = {
    // pid/sid are required by the live API; long spellings retained from the FPI.
    pid: TWYNE.multi.pid, sid: TWYNE.multi.sid,
    publisherid: TWYNE.multi.pid, sourceid: TWYNE.multi.sid, cid: camp.cid, clickid: externalid,
    consumer: {
      first: record.first, last: record.last, email: record.email, phone: record.phone,
      address1: record.address, city: record.city, state: record.state, zip: record.zip,
    },
    customquestions: { cq1: credit, cq2: lead.owner, cq3: lead.project, cq4: camp.category },
    click: {
      useragent: opt.ua, ip: opt.ip, subid1: opt.subid1, subid2: gclid, externalid,
      trustedform: record.trustedFormCertUrl, leadid: record.jornayaLeadiD,
      domain_url: record.pageUrl || "https://renuehome.com", devicetype: deviceType(opt.ua), os: osCode(opt.ua),
    },
  };
  if (opt.isTest) payload.istest = "true";
  let ping;
  try { ping = await multiCall(TWYNE.multi.ping, payload); }
  catch (error) { return { ...base, attempted: true, stage: "ping", error: upstreamError(error) }; }
  const pingTest = isTestResponse({ ...ping.body, body: ping.body });
  const pingStatus = String(ping.body.status || "").trim().toLowerCase();
  // An accepted ping is only a bid. Never copy its status, price or lead ID into a delivery result.
  const pingBase = { ...base, attempted: true, stage: "ping", isTest: pingTest, httpStatus: ping.httpStatus };
  if (ping.httpStatus < 200 || ping.httpStatus >= 300) return { ...pingBase, status: pingStatus === "rejected" ? "Rejected" : "Error", error: "ping-http-error" };
  if (pingStatus !== "accepted") return { ...pingBase, status: ["rejected", "error"].includes(pingStatus) ? ping.body.status : "Unknown" };
  const pingid = multiId(ping.body.pingid);
  const bids = numericBidIds(ping.body.bids);
  if (!pingid || !bids.length) return { ...pingBase, status: "Error", error: "invalid-ping-bids" };
  // If a supposedly live ping identifies itself as a test, do not turn it into a live POST.
  if (pingTest && !opt.isTest) return { ...pingBase, status: "Test" };

  const postBase = { ...base, attempted: true, stage: "post", isTest: pingTest, pingid };
  let post;
  try {
    // One final POST. Twyne owns exclusive winner selection; no second buyer/site fallback here.
    post = await multiCall(TWYNE.multi.post, { ...payload, pingid, bids });
  } catch (error) {
    return { ...postBase, error: upstreamError(error), deliveryUncertain: true };
  }
  const body = post.body;
  const postTest = isTestResponse({ ...body, body });
  const status = String(body.status || "").trim().toLowerCase();
  const responseId = multiId(body.leadid) || multiId(body.pingid);
  const mismatchedPing = body.pingid != null && multiId(body.pingid) !== pingid;
  const httpOk = post.httpStatus >= 200 && post.httpStatus < 300;
  const finalPostAccepted = httpOk && status === "accepted" && !mismatchedPing;
  const returnedPayout = body.publisher_payout ?? body.price;
  const payoutNumber = typeof returnedPayout === "number" || typeof returnedPayout === "string" ? Number(returnedPayout) : NaN;
  // Whitelist returned metadata. Never reflect upstream raw bodies, reason text, buyer PII or error stacks.
  return {
    ...postBase, httpStatus: post.httpStatus, isTest: pingTest || postTest,
    status: mismatchedPing ? "Error" : body.status === undefined ? "Unknown" :
      ["accepted", "queued", "rejected", "error"].includes(status) ? status : "Unknown",
    ...(!httpOk ? { error: "post-http-error", deliveryUncertain: status !== "rejected" } : {}),
    ...(mismatchedPing ? { error: "post-id-mismatch", deliveryUncertain: true } : {}),
    leadid: responseId, finalPostAccepted,
    body: { publisher_payout: Number.isFinite(payoutNumber) ? payoutNumber : null },
  };
}

async function multiCall(url, payload) {
  return fetchBoundedJson(url, {
    method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload),
  }, url === TWYNE.multi.post ? MULTI_POST_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS);
}
function multiId(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? String(value) : "";
  if (typeof value !== "string") return "";
  const id = value.trim();
  if (/^\d+$/.test(id)) return Number.isSafeInteger(Number(id)) && Number(id) > 0 ? id : "";
  return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : "";
}
function numericBidIds(bids) {
  if (!Array.isArray(bids) || !bids.length || bids.length > 100) return [];
  const sorted = bids.slice().sort((a, b) => Number(b?.bid || 0) - Number(a?.bid || 0));
  const ids = [];
  for (const bid of sorted) {
    const raw = bid?.bidid;
    if (!((typeof raw === "string" && /^\d+$/.test(raw)) || typeof raw === "number")) return [];
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) return [];
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}
async function fillMultiGeo(record) {
  // Client geo may belong to an earlier ZIP after back/edit or a failed/racing lookup.
  // Resolve the final ZIP server-side; never route on stale client city/state.
  record.city = "";
  record.state = "";
  try {
    const { httpStatus, body } = await fetchBoundedJson("https://api.zippopotam.us/us/" + record.zip, {}, GEO_TIMEOUT_MS);
    if (httpStatus < 200 || httpStatus >= 300) return;
    const place = body.places?.[0];
    if (!place) return;
    record.city = String(place["place name"] || "").trim();
    record.state = String(place["state abbreviation"] || "").trim().toUpperCase();
  } catch (_) { /* no buyer request unless required geo is present */ }
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
export async function onRequestGet({ env } = {}) {
  const route = env?.RNH_BATHROOM_ROUTE || "ws554";
  return json({ ok: true, service: "renue-home lead endpoint", method: "POST",
    bathroomRoute: ["ws554", "multi556"].includes(route) ? route : "unavailable",
    testMode: env?.TWYNE_TEST === "true" });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
