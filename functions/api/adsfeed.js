// Google Ads scheduled-upload feed: payable RNH bathroom-campaign calls (with gclid),
// served as an offline-conversion CSV, pulled LIVE from the Retreaver API on each request.
// Google ignores duplicate (gclid, name, time) rows, so a full daily re-import is idempotent.
//
// Ads: Goals > Conversions > Uploads > Schedules > HTTPS
//   URL https://renuehome.com/api/adsfeed  (Basic auth user 'ads' / password = CONV_FEED_SECRET)
// Env (Cloudflare Pages > Settings > Variables): RETREAVER_API_KEY, CONV_FEED_SECRET
//
// Match note: the public v2 API hashes cid/afid, so we identify our traffic by the
// subid=renuehome tag the funnel always sets, plus payable + a real gclid tag.
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization') || '';
  let basicOk = false;
  if (auth.startsWith('Basic ')) {
    try { basicOk = atob(auth.slice(6)).split(':').pop() === env.CONV_FEED_SECRET; } catch (e) {}
  }
  if (!env.CONV_FEED_SECRET || (url.searchParams.get('key') !== env.CONV_FEED_SECRET && !basicOk)) {
    return new Response('forbidden', { status: 403 });
  }
  if (!env.RETREAVER_API_KEY) return new Response('missing RETREAVER_API_KEY', { status: 500 });
  const debug = url.searchParams.get('debug');
  const dbg = { pages: 0, total: 0, subidRenue: 0, paidRenue: 0, withGclid: 0, emitted: 0, samplePaidTags: null };

  function tag(c, key) {
    if (c.tags && typeof c.tags === 'object' && !Array.isArray(c.tags) && c.tags[key] != null) return String(c.tags[key]);
    if (Array.isArray(c.tag_values)) { const t = c.tag_values.find(function (x) { return x.key === key; }); if (t) return String(t.value); }
    if (Array.isArray(c.tags)) { const t = c.tags.find(function (x) { return x.key === key; }); if (t) return String(t.value); }
    return '';
  }

  const rows = [];
  const cid = env.RETREAVER_COMPANY_ID || '43677';
  for (let page = 1; page <= 12; page++) {
    const api = 'https://api.retreaver.com/api/v2/calls.json?api_key=' + env.RETREAVER_API_KEY +
      '&company_id=' + cid +
      '&created_at_start=2026-07-11T00:00:00Z&per_page=100&page=' + page;
    const r = await fetch(api, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) break;
    dbg.pages = page;
    const data = await r.json();
    const calls = (Array.isArray(data) ? data : (data.calls || [])).map(function (c) { return c.call || c; });
    if (!calls.length) break;
    dbg.total += calls.length;
    for (const c of calls) {
      if (tag(c, 'subid') !== 'renuehome') continue;
      dbg.subidRenue++;
      const paid = c.payable === true || Number(c.revenue) > 0;
      if (paid) { dbg.paidRenue++; if (!dbg.samplePaidTags) dbg.samplePaidTags = c.tags; }
      const gclid = tag(c, 'gclid');
      if (gclid) dbg.withGclid++;
      if (paid && /^[A-Za-z0-9_-]{20,}$/.test(gclid)) {
        rows.push([gclid, 'RNH Qualified Call 90s', fmtTime(c.start_time || c.created_at), String(c.revenue || 150), 'USD']);
        dbg.emitted++;
      }
    }
    if (calls.length < 100) break;
  }

  if (debug) return new Response(JSON.stringify(dbg), { headers: { 'Content-Type': 'application/json' } });
  const body = 'Parameters:TimeZone=-0500\n' +
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\n' +
    rows.map(function (r) { return r.join(','); }).join('\n') + (rows.length ? '\n' : '');
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function fmtTime(iso) {
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (!m) return '';
  return m[1] + ' ' + m[2];
}
