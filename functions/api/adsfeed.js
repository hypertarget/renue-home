// Google Ads scheduled-upload feed: paid RNH bathroom-campaign calls (with gclid),
// served as an offline-conversion CSV, pulled LIVE from the Retreaver API on each request.
// Google ignores duplicate (gclid, name, time) rows, so a full daily re-import is idempotent.
//
// Ads: Goals > Conversions > Uploads > Schedules > HTTPS
//   URL https://renuehome.com/api/adsfeed  (Basic auth user 'ads' / password = CONV_FEED_SECRET)
// Env (Cloudflare Pages > Settings > Variables): RETREAVER_API_KEY, CONV_FEED_SECRET
//
// Match note: the public v2 API hashes cid/afid, so we identify our traffic by the
// subid=renuehome tag the funnel always sets, or by the presence of a real gclid tag
// (only our own funnel ever writes a gclid tag onto a Retreaver call).
//
// Paging note: Retreaver returns calls newest-first and caps per_page at 100. The account
// runs ~200 calls/day across all publishers, so a fixed 12-page cap only reached ~6 days
// back and silently missed older conversions. We now walk a date window and stop as soon
// as the log goes older than the window start, so cost scales with the window, not the log.
//
// Query params (all optional):
//   days=N            lookback window in days, default 14, max 60
//   from=YYYY-MM-DD   explicit window start (overrides days)
//   to=YYYY-MM-DD     explicit window end, inclusive (for one-time backfills)
//   maxpages=N        page ceiling, default 40, max 48 (Workers allow 50 subrequests/request)
//   debug=1           return JSON diagnostics instead of CSV
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization') || '';
  let basicOk = false;
  if (auth.startsWith('Basic ')) {
    try { basicOk = atob(auth.slice(6)).split(':').pop() === env.CONV_FEED_SECRET; } catch (e) {}
  }
  if (!env.CONV_FEED_SECRET || (url.searchParams.get('key') !== env.CONV_FEED_SECRET && !basicOk)) {
    return new Response('auth required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="adsfeed"' } });
  }
  if (!env.RETREAVER_API_KEY) return new Response('missing RETREAVER_API_KEY', { status: 500 });

  // ---- window -------------------------------------------------------------
  const EPOCH = '2026-07-11'; // test start; never look further back than this
  const q = url.searchParams;
  let days = parseInt(q.get('days') || '14', 10);
  if (!isFinite(days) || days < 1) days = 14;
  if (days > 60) days = 60;
  let maxPages = parseInt(q.get('maxpages') || '40', 10);
  if (!isFinite(maxPages) || maxPages < 1) maxPages = 40;
  if (maxPages > 48) maxPages = 48;

  const dayRe = /^\d{4}-\d{2}-\d{2}$/;
  const now = new Date();
  let from = q.get('from');
  if (!from || !dayRe.test(from)) {
    from = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  }
  if (from < EPOCH) from = EPOCH;
  const to = dayRe.test(q.get('to') || '') ? q.get('to') : null;

  const dbg = {
    window: { from: from, to: to || 'now', maxPages: maxPages },
    pages: 0, total: 0, newestSeen: null, oldestSeen: null, stopped: 'maxpages',
    candidates: 0, paid: 0, withGclid: 0, emitted: 0, skippedNoGclid: 0, skippedUnpaid: 0
  };

  function tag(c, key) {
    if (c.tags && typeof c.tags === 'object' && !Array.isArray(c.tags) && c.tags[key] != null) return String(c.tags[key]);
    if (Array.isArray(c.tag_values)) { const t = c.tag_values.find(function (x) { return x.key === key; }); if (t) return String(t.value); }
    if (Array.isArray(c.tags)) { const t = c.tags.find(function (x) { return x.key === key; }); if (t) return String(t.value); }
    return '';
  }
  function day(c) { return String(c.created_at || c.start_time || '').slice(0, 10); }

  const rows = [];
  const seen = new Set();
  const cid = env.RETREAVER_COMPANY_ID || '43677';

  for (let page = 1; page <= maxPages; page++) {
    let api = 'https://api.retreaver.com/api/v2/calls.json?api_key=' + env.RETREAVER_API_KEY +
      '&company_id=' + cid +
      '&created_at_start=' + from + 'T00:00:00Z' +
      '&per_page=100&page=' + page;
    if (to) api += '&created_at_end=' + to + 'T23:59:59Z';

    const r = await fetch(api, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) { dbg.stopped = 'http_' + r.status; break; }
    dbg.pages = page;
    const data = await r.json();
    const calls = (Array.isArray(data) ? data : (data.calls || [])).map(function (c) { return c.call || c; });
    if (!calls.length) { dbg.stopped = 'empty_page'; break; }
    dbg.total += calls.length;

    let pageOldest = null;
    for (const c of calls) {
      const d = day(c);
      if (d) {
        if (!dbg.newestSeen || d > dbg.newestSeen) dbg.newestSeen = d;
        if (!dbg.oldestSeen || d < dbg.oldestSeen) dbg.oldestSeen = d;
        if (!pageOldest || d < pageOldest) pageOldest = d;
      }
      // client-side window filter, so we do not depend on the API honouring the date params
      if (d && d < from) continue;
      if (to && d && d > to) continue;
      if (c.uuid && seen.has(c.uuid)) continue;
      if (c.uuid) seen.add(c.uuid);

      const subid = tag(c, 'subid');
      const gclid = tag(c, 'gclid');
      const goodGclid = /^[A-Za-z0-9_-]{20,}$/.test(gclid);
      // ours if the funnel stamped subid, or if it carries a gclid at all (only we set that)
      if (subid !== 'renuehome' && !goodGclid) continue;
      dbg.candidates++;
      if (goodGclid) dbg.withGclid++;

      // Retreaver populates these independently; any one of them means the call was bought.
      const paid = c.payable === true || c.converted === true ||
        Number(c.revenue) > 0 || Number(c.payout) > 0;
      if (paid) dbg.paid++;

      if (!paid) { dbg.skippedUnpaid++; continue; }
      if (!goodGclid) { dbg.skippedNoGclid++; continue; }

      rows.push([
        gclid,
        'RNH Qualified Call 90s',
        fmtTime(c.start_time || c.created_at),
        String(Number(c.revenue) > 0 ? c.revenue : 150),
        'USD'
      ]);
      dbg.emitted++;
    }

    if (calls.length < 100) { dbg.stopped = 'short_page'; break; }
    // newest-first: once a whole page predates the window there is nothing left to find
    if (pageOldest && pageOldest < from) { dbg.stopped = 'reached_window_start'; break; }
  }

  if (q.get('debug')) {
    return new Response(JSON.stringify(dbg, null, 1), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
  const body = 'Parameters:TimeZone=+0000\n' +
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\n' +
    rows.map(function (r) { return r.join(','); }).join('\n') + (rows.length ? '\n' : '');
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// Retreaver timestamps carry a real offset (e.g. -05:00). The old version dropped it while
// the header declared +0000, shifting every conversion 5-6 hours earlier than it happened —
// which can place the conversion before its own click and get the row rejected. Keep the offset.
function fmtTime(iso) {
  const s = String(iso);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (!m) return '';
  const off = s.match(/([+-]\d{2}:\d{2})$/);
  return m[1] + ' ' + m[2] + (off ? off[1] : '+00:00');
}
