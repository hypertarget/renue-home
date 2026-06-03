// Cloudflare Pages Function — POST /api/submit
// Receives the lead, (later) fraud-scores it, ping-posts to buyers, and returns a pay-per-call number.
// v1: validates + logs + echoes a call number if configured via env. Wire real services later.
//
// Set these in Cloudflare Pages → Settings → Environment variables:
//   LEAD_POST_URL, LEAD_POST_API_KEY, LEAD_BUYER_IDS, LEAD_MAX_BUYERS
//   CALL_NUMBER (static Ringba/Retreaver number to show on the thank-you screen)
//   ANURA_INSTANCE_ID / EHAWK_API_KEY (fraud scoring)

export async function onRequestPost({ request, env }) {
  let lead = {};
  try { lead = await request.json(); } catch (_) {}

  // basic server-side validation
  const phoneDigits = (lead.phone || "").replace(/\D/g, "");
  if (!lead.email || phoneDigits.length < 10 || !lead.zip) {
    return json({ ok: false, message: "Missing required fields" }, 400);
  }

  // INTEGRATE: fraud score (Anura/eHawk), phone/email verification, TrustedForm + Jornaya capture.
  // INTEGRATE: ping-post to LEAD_POST_URL with LEAD_BUYER_IDS (Boberdoo/LeadProsper/Phonexa).
  if (env && env.LEAD_POST_URL && env.LEAD_POST_API_KEY) {
    // await fetch(env.LEAD_POST_URL, { method:"POST", headers:{Authorization:`Bearer ${env.LEAD_POST_API_KEY}`}, body: JSON.stringify(lead) });
  }

  const callNumber = (env && env.CALL_NUMBER) || "";
  return json({ ok: true, callNumber, soldTo: Number((env && env.LEAD_MAX_BUYERS) || 4) });
}

// Optional: respond to non-POST so the route exists
export async function onRequestGet() {
  return json({ ok: true, service: "renue-home lead endpoint", method: "POST" });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
