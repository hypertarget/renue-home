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
  const dbg = { pages: 0, apiStatus: [], totalCalls: 0, sampleKeys: null, matchedOurs: 0, payableOurs: 0, withGclid: 0 };
  for (let page = 1; page <= 10; page++) {
    const companyId = env.RETREAVER_COMPANY_ID || '43677'; // HyperTarget Marketing
    const api = 'https://api.retreaver.com/api/v2/calls.json?api_key=' + env.RETREAVER_API_KEY +
      '&company_id=' + companyId +
      '&afid=' + encodeURIComponent('002 - Internal Eric') +
      '&created_at_start=2026-07-11T00:00:00Z&per_page=100&page=' + page;
    const r = await fetch(api, { headers: { 'Accept': 'application/json' } });
    dbg.apiStatus.push(r.status);
    if (!r.ok) break;
    dbg.pages = page;
    const data = await r.json();
    const calls = (Array.isArray(data) ? data : (data.calls || [])).map(function (c) { return c.call || c; });
    if (!calls.length) break;
    dbg.totalCalls += calls.length;
    if (!dbg.sampleKeys) { const s = calls[0]; dbg.sampleKeys = Object.keys(s).slice(0, 40); dbg.sampleCid = s.cid; dbg.sampleAfid = s.afid; dbg.sampleCreated = s.created_at; dbg.hasTags = ('tags' in s); dbg.hasTagValues = ('tag_values' in s); dbg.samplePayable = s.payable; dbg.sampleRevenue = s.revenue; dbg.sampleSysCampaign = s.system_campaign_id; dbg.sampleTags = s.tags; }
      if (!dbg.paidSample && (c.payable === true || Number(c.revenue) > 0)) { dbg.paidSample = { cid: c.cid, sysCampaign: c.system_campaign_id, revenue: c.revenue, dialed: c.dialed_number, tags: c.tags }; }
    for (const c of calls) {
      let gclid = c.tags && c.tags.gclid;
      if (!gclid && Array.isArray(c.tag_values)) { const tv = c.tag_values.find(function (x) { return x.key === 'gclid'; }); gclid = tv && tv.value; }
      const ours = c.cid === '01a27245' || c.afid === '002 - Internal Eric';
      if (ours) { dbg.matchedOurs++; if (c.payable) dbg.payableOurs++; if (gclid) dbg.withGclid++; }
      // 20+ char id filter keeps manual test gclids (TESTCALL710 etc.) out of the feed
      const paid = c.payable === true || Number(c.revenue) > 0;
      if (ours && paid && gclid && /^[A-Za-z0-9_-]{20,}$/.test(gclid)) {
        rows.push([gclid, 'RNH Qualified Call 90s', fmtTime(c.created_at), String(c.revenue || 150), 'USD']);
      }
    }
    if (calls.length < 100) break;
  }

  if (url.searchParams.get('debug')) {
    return new Response(JSON.stringify(dbg), { headers: { 'Content-Type': 'application/json' } });
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
