// Google Ads scheduled-upload feed: payable RNH bathroom-campaign calls (with gclid)
// served as an offline-conversion CSV, pulled LIVE from the Retreaver API on each request.
// No storage needed; Google ignores duplicate (gclid, name, time) rows, so a full
// daily re-import is safe and idempotent.
//
// Ads setup: Goals > Conversions > Uploads > Schedules > HTTPS source
//   URL: https://renuehome.com/api/adsfeed   (Basic auth: user ads / password = CONV_FEED_SECRET)
// Env vars (Cloudflare Pages project settings):
//   RETREAVER_API_KEY  - Retreaver company API key
//   CONV_FEED_SECRET   - shared secret protecting this feed
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

  const rows = [];
  for (let page = 1; page <= 10; page++) {
    const companyId = env.RETREAVER_COMPANY_ID || '43677'; // HyperTarget Marketing
    const api = 'https://api.retreaver.com/api/v2/calls.json?api_key=' + env.RETREAVER_API_KEY +
      '&company_id=' + companyId +
      '&created_at_start=2026-07-11T00:00:00Z&order=desc&per_page=100&page=' + page;
    const r = await fetch(api, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) break;
    const data = await r.json();
    const calls = (Array.isArray(data) ? data : (data.calls || [])).map(function (c) { return c.call || c; });
    if (!calls.length) break;
    for (const c of calls) {
      const gclid = c.tags && c.tags.gclid;
      const ours = c.cid === '01a27245' || c.afid === '002 - Internal Eric';
      // 20+ char id filter keeps manual test gclids (TESTCALL710 etc.) out of the feed
      if (ours && c.payable && gclid && /^[A-Za-z0-9_-]{20,}$/.test(gclid)) {
        rows.push([gclid, 'RNH Qualified Call 90s', fmtTime(c.created_at), String(c.revenue || 150), 'USD']);
      }
    }
    if (calls.length < 100) break;
  }

  const body = 'Parameters:TimeZone=-0500\n' +
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\n' +
    rows.map(function (r) { return r.join(','); }).join('\n') + (rows.length ? '\n' : '');
  return new Response(body, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

// Retreaver timestamps arrive in account-local time (Central) with offset; keep the
// wall-clock portion - the feed's Parameters row declares the -0500 timezone.
function fmtTime(iso) {
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? (m[1] + ' ' + m[2]) : '';
}
