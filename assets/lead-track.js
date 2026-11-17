/* Lead tracking diagnostic, 2026-11-17. A read-only observer for the paid quote page.
   When the shared engine reports an accepted, non-test lead, this sends ONE extra analytics event named
   lead_track_<sent|skipped>_<gclid|gbraid|wbraid|none>. The name records two facts: whether the engine
   made its Google Ads conversion call for that lead, and which Google click ID the visit carried. Both
   sit in the event name so the Analytics Events report shows them with no custom dimensions.
   It never changes, delays or blocks any other event. It holds no personal data and no click ID value,
   and it is never a lead, a key event or a conversion. Load it after /funnel.js. */
(function () {
  "use strict";
  if (window.__rnhLeadTrack) return;
  window.__rnhLeadTrack = true;

  // The landing URL first (its query survives the quiz), then the first-party cookies Google's tag
  // writes (_gcl_aw = gclid, _gcl_gb = gbraid). Returns the kind only, never the value.
  function clickIdKind() {
    var kind = "none", source = "none";
    try {
      var q = (window.location && window.location.search) ? String(window.location.search) : "";
      var has = function (k) { return new RegExp("[?&]" + k + "=[^&#]+").test(q); };
      if (has("gclid")) { kind = "gclid"; source = "url"; }
      else if (has("gbraid")) { kind = "gbraid"; source = "url"; }
      else if (has("wbraid")) { kind = "wbraid"; source = "url"; }
      else {
        var c = (typeof document !== "undefined" && document && typeof document.cookie === "string") ? document.cookie : "";
        if (/(?:^|;\s*)_gcl_aw=/.test(c)) { kind = "gclid"; source = "cookie"; }
        else if (/(?:^|;\s*)_gcl_gb=/.test(c)) { kind = "gbraid"; source = "cookie"; }
      }
    } catch (e) {}
    return { kind: kind, source: source };
  }

  var pending = null;

  // The engine reports lead_result_accepted and then, in the same turn, makes its Ads conversion call
  // (the only conversion that carries a transaction ID). Watch for both, then report once.
  function observe(args) {
    if (!args || args[0] !== "event") return;
    var name = args[1], params = args[2] || {};
    if (name === "lead_result_accepted") {
      pending = { sent: false, vertical: params.vertical ? String(params.vertical) : "", leadid: params.twyne_leadid ? String(params.twyne_leadid) : "" };
      setTimeout(flush, 0);
    } else if (pending && name === "conversion" && params.transaction_id) {
      pending.sent = true;
    }
  }

  function flush() {
    var p = pending;
    pending = null;
    if (!p || typeof window.gtag !== "function") return;
    try {
      var cid = clickIdKind();
      window.gtag("event", "lead_track_" + (p.sent ? "sent" : "skipped") + "_" + cid.kind,
        { vertical: p.vertical, click_id_kind: cid.kind, click_id_source: cid.source, twyne_leadid: p.leadid });
    } catch (e) {}
  }

  // Every call is passed straight through to the real analytics function, whatever happens here.
  function wrap() {
    var current = window.gtag;
    if (typeof current !== "function" || current.__rnhLeadTrack) return;
    var wrapped = function () {
      try { observe(arguments); } catch (e) {}
      return current.apply(this, arguments);
    };
    wrapped.__rnhLeadTrack = true;
    window.gtag = wrapped;
  }

  wrap();
  // If the analytics function was defined or replaced after this file ran, wrap it when the visitor
  // reaches for the submit button, before any lead event can be sent.
  try {
    document.addEventListener("click", function (e) {
      var t = e && e.target && e.target.closest ? e.target.closest("[data-submit]") : null;
      if (t) wrap();
    }, true);
  } catch (e) {}
})();
