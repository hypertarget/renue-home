import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The diagnostic observer runs here against the REAL shared submit function, in a context where
// window is the global object (as in a browser). No live submissions: analytics and the network
// response are stubs, and nothing leaves the process.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const funnel = read('./funnel.js');
const tracker = read('./assets/lead-track.js');
const submitSource = funnel.slice(funnel.indexOf('  function doSubmit('), funnel.indexOf('  function wireFaq('));
const lead = { first: 'Fixture', email: 'fixture@example.com', phone: '2022347890' };
const sold = { status: 'accepted', test: false, conversion_eligible: true, value: 60, transaction_id: 'fixture-id' };
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function page({ search = '', cookie = '', withTracker = true, loads = 1, gtagMissing = false } = {}) {
  const sent = [];
  const listeners = [];
  const elements = { quiz: {}, err: {} };
  const context = {
    RF: {}, setTimeout, RENUE_VERTICAL: 'bathroom',
    document: {
      cookie, body: { classList: { add() {} } }, getElementById: id => elements[id],
      addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
    },
    location: { search },
    ADS_ID: 'fixture-ads', ADS_CONVERSION: 'fixture-conversion',
    SUBMIT_ENDPOINT: '/api/submit', PHONE_NUMBER: '', esc: x => x, telHref: x => x,
    scrollTo() {},
  };
  context.window = context; // browser-like: window.gtag and the bare gtag identifier are one binding
  if (!gtagMissing) context.gtag = function () { sent.push(Array.from(arguments)); };
  vm.createContext(context);
  if (withTracker) for (let i = 0; i < loads; i++) vm.runInContext(tracker, context);
  vm.runInContext(submitSource, context);
  async function submit(outcome, leadid = 'fixture-lead') {
    context.fetch = async () => ({ ok: true, json: async () => ({ outcome, twyne: { leadid } }) });
    let done;
    const finished = new Promise(resolve => { done = resolve; });
    context.scrollTo = done;
    context.doSubmit({ word: 'bathroom' }, lead, { dataset: {} });
    await finished;
    await tick();
    return plain(sent);
  }
  return { context, sent, listeners, submit };
}
const names = events => events.filter(e => e[0] === 'event').map(e => e[1]);
const track = events => events.filter(e => e[0] === 'event' && /^lead_track_/.test(e[1]));

for (const [name, search, cookie, kind, source] of [
  ['gclid in the landing URL', '?angle=tub&gclid=abc123', '', 'gclid', 'url'],
  ['iPhone-style IDs only', '?angle=tub&gbraid=g1&wbraid=w1', '', 'gbraid', 'url'],
  ['gclid wins when every ID is present', '?wbraid=w1&gbraid=g1&gclid=abc', '', 'gclid', 'url'],
  ['wbraid alone', '?utm_source=youtube&wbraid=w1', '', 'wbraid', 'url'],
  ['no click ID anywhere', '?utm_source=youtube', '_ga=1; _gcl_au=1.1.2', 'none', 'none'],
  ['gclid cookie when the URL has none', '', '_ga=1; _gcl_aw=GCL.1.abc', 'gclid', 'cookie'],
  ['gbraid cookie when the URL has none', '', '_gcl_gb=1.2.g1; _ga=1', 'gbraid', 'cookie'],
  ['empty value is not a click ID', '?gclid=&angle=tub', '', 'none', 'none'],
  ['look-alike parameter names are ignored', '?xgclid=abc&mygbraid=1', '', 'none', 'none'],
]) {
  test(`sold lead reports the Ads call and click ID kind: ${name}`, async () => {
    const events = await page({ search, cookie }).submit(sold);
    const hits = track(events);
    assert.equal(hits.length, 1);
    assert.equal(hits[0][1], `lead_track_sent_${kind}`);
    assert.deepEqual(hits[0][2], { vertical: 'bathroom', click_id_kind: kind, click_id_source: source, twyne_leadid: 'fixture-lead' });
    assert.deepEqual(names(events), ['quiz_submit_received', 'generate_lead', 'lead_result_accepted', 'conversion', hits[0][1]]);
  });
}

test('every original analytics call passes through unchanged, in order, with one event added', async () => {
  const before = await page({ search: '?gclid=abc', withTracker: false }).submit(sold);
  const after = await page({ search: '?gclid=abc' }).submit(sold);
  assert.equal(track(before).length, 0);
  assert.deepEqual(after.slice(0, before.length), before);
  assert.equal(after.length, before.length + 1);
  assert.equal(after[after.length - 1][1], 'lead_track_sent_gclid');
  assert.deepEqual(before.find(e => e[1] === 'conversion')[2], { send_to: 'fixture-conversion', value: 60, currency: 'USD', transaction_id: 'fixture-id' });
  assert.deepEqual(before.find(e => e[0] === 'set'), ['set', 'user_data', { email: 'fixture@example.com', phone_number: '+12022347890' }]);
});

test('accepted lead without a payout reports that the Ads call was skipped', async () => {
  const events = await page({ search: '?gbraid=g1' }).submit({ ...sold, conversion_eligible: false, value: null });
  assert.deepEqual(names(track(events)), ['lead_track_skipped_gbraid']);
  assert.equal(events.some(e => e[1] === 'conversion'), false);
});

test('accepted lead without a transaction ID reports skipped', async () => {
  const events = await page({ search: '?gclid=abc' }).submit({ ...sold, transaction_id: '' });
  assert.deepEqual(names(track(events)), ['lead_track_skipped_gclid']);
});

for (const outcome of [
  { ...sold, test: true }, { ...sold, status: 'test', test: true },
  { ...sold, status: 'queued' }, { ...sold, status: 'rejected' }, { ...sold, status: 'blocked' },
  { ...sold, status: 'error' }, { ...sold, status: 'not_attempted' }, { ...sold, status: 'made-up' }, {},
]) {
  test(`no diagnostic unless a real lead was accepted: ${JSON.stringify(outcome)}`, async () => {
    const withTracker = await page({ search: '?gclid=abc' }).submit(outcome);
    const without = await page({ search: '?gclid=abc', withTracker: false }).submit(outcome);
    assert.equal(track(withTracker).length, 0);
    assert.deepEqual(withTracker, without);
  });
}

test('a call-button conversion is never mistaken for the lead conversion', async () => {
  const p = page({ search: '?gclid=abc' });
  p.context.gtag('event', 'conversion', { send_to: 'fixture-call' });
  await tick();
  assert.equal(track(plain(p.sent)).length, 0);
  p.context.gtag('event', 'lead_result_accepted', { vertical: 'bathroom', twyne_leadid: '7' });
  p.context.gtag('event', 'conversion', { send_to: 'fixture-call' });
  await tick();
  assert.deepEqual(names(track(plain(p.sent))), ['lead_track_skipped_gclid']);
});

test('two leads in one visit are reported separately', async () => {
  const p = page({ search: '?wbraid=w1' });
  await p.submit(sold, 'first');
  const events = await p.submit({ ...sold, conversion_eligible: false, value: null }, 'second');
  assert.deepEqual(track(events).map(e => [e[1], e[2].twyne_leadid]), [['lead_track_sent_wbraid', 'first'], ['lead_track_skipped_wbraid', 'second']]);
});

test('loading the file twice still reports once', async () => {
  const events = await page({ search: '?gclid=abc', loads: 2 }).submit(sold);
  assert.equal(track(events).length, 1);
});

test('an analytics function replaced after load is wrapped again at the submit button', async () => {
  const p = page({ search: '?gbraid=g1' });
  const later = [];
  p.context.gtag = function () { later.push(Array.from(arguments)); };
  const click = p.listeners.find(l => l.type === 'click');
  assert.equal(click.capture, true);
  click.fn({ target: { closest: selector => selector === '[data-submit]' ? {} : null } });
  await p.submit(sold);
  assert.deepEqual(names(track(plain(later))), ['lead_track_sent_gbraid']);
  assert.equal(track(plain(p.sent)).length, 0);
});

test('clicks elsewhere on the page do nothing', () => {
  const p = page();
  const original = p.context.gtag;
  const click = p.listeners.find(l => l.type === 'click');
  click.fn({ target: { closest: () => null } });
  click.fn({ target: {} });
  click.fn({});
  assert.equal(p.context.gtag, original);
});

test('no analytics function means nothing is wrapped and nothing throws', async () => {
  const p = page({ search: '?gclid=abc', gtagMissing: true });
  assert.equal(p.context.gtag, undefined);
  await p.submit(sold);
  assert.equal(p.sent.length, 0);
});

test('odd analytics calls pass straight through', () => {
  const p = page();
  p.context.gtag();
  p.context.gtag('event');
  p.context.gtag('event', 'lead_result_accepted');
  p.context.gtag('event', 'conversion', null);
  p.context.gtag('js', new Date(0));
  assert.equal(p.sent.length, 5);
});

test('the diagnostic carries no personal data and no click ID value', async () => {
  const events = await page({ search: '?gclid=SECRET-CLICK-VALUE', cookie: '_gcl_aw=GCL.1.SECRET' }).submit(sold);
  const text = JSON.stringify(track(events));
  for (const leak of ['SECRET', 'fixture@example.com', '2022347890', 'Fixture']) assert.equal(text.includes(leak), false);
});

test('the quote page loads the observer after the shared engine and the engine file is untouched', () => {
  const html = read('./shower-options.html');
  const sources = [...html.matchAll(/<script defer src="([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
  assert.ok(sources.indexOf('/assets/lead-track.js') > sources.indexOf('/funnel.js'));
  assert.equal(funnel.includes('lead_track_'), false);
});
