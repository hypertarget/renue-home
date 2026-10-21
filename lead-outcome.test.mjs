import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { onRequestPost, onRequestGet } from './functions/api/submit.js';

// No live submissions. Every buyer call is intercepted by a scoped mock.
const lead = {
  first: 'Fixture', last: 'Only', email: 'fixture@example.com', phone: '2022347890',
  zip: '20001', owner: 'Own', vertical: 'bathroom', consent: true,
  xxTrustedFormCertUrl: 'https://example.com/fixture-cert', universal_leadid: 'fixture-id',
  sessionLength: 45, pageUrl: 'https://renuehome.com/bathroom?utm_source=google&utm_medium=organic',
};
async function submit(t, body, { input = {}, env = {}, headers = {}, status = 200, throws = false } = {}) {
  const posts = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://htm.api.twyne.io/lead/submit');
    posts.push(new URLSearchParams(init.body));
    if (throws) throw new Error('mock network failure');
    return new Response(JSON.stringify(body), { status });
  });
  const request = new Request('https://renuehome.com/api/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'FixtureAgent', ...headers },
    body: JSON.stringify({ ...lead, ...input }),
  });
  const response = await onRequestPost({ request, env });
  return { response, result: await response.json(), posts };
}
const accepted = { status: 'Accepted', leadid: 'fixture-twyne-id', publisher_payout: '42.50' };

test('non-test accepted response with payout keeps a provisional value and transaction ID', async t => {
  const { result, posts } = await submit(t, accepted);
  assert.deepEqual(result.outcome, { status: 'accepted', test: false, conversion_eligible: true, value: 42.5, transaction_id: 'fixture-twyne-id' });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].get('cid'), '554');
  assert.equal(posts[0].get('cq1'), 'bathroom');
  assert.equal(posts[0].get('istest'), 'false');
  assert.equal(posts[0].get('ip'), '192.0.2.1');
  assert.equal(posts[0].get('useragent'), 'FixtureAgent');
});

for (const [name, body, options, outcome] of [
  ['test reason despite accepted status', { ...accepted, reason: 'Test lead, change isTest=N once approved' }, {}, 'test'],
  ['test flag in response', { ...accepted, isTest: 'Y' }, {}, 'test'],
  ['request explicitly in test', accepted, { input: { istest: true } }, 'test'],
  ['environment test mode', accepted, { env: { TWYNE_TEST: 'true' } }, 'test'],
  ['diagnostic header without override', accepted, { headers: { 'x-rnh-test': '1' } }, 'test'],
  ['diagnostic campaign override', accepted, { headers: { 'x-rnh-test': '1' }, input: { testCampaign: 'ws554' } }, 'test'],
  ['HVAC remains forced test', accepted, { input: { vertical: 'hvac', system: 'Heating', nature: 'Repair', system_type: 'Furnace' } }, 'test'],
  ['queued with payout is pending', { ...accepted, status: 'Queued' }, {}, 'queued'],
  ['rejected with payout', { ...accepted, status: 'Rejected' }, {}, 'rejected'],
  ['error with payout', { ...accepted, status: 'Error' }, {}, 'error'],
  ['unknown status', { ...accepted, status: 'Accepted-ish' }, {}, 'unknown'],
  ['failed HTTP status', accepted, { status: 500 }, 'error'],
  ['network error', {}, { throws: true }, 'error'],
  ['empty response', {}, {}, 'unknown'],
]) {
  test(name + ' cannot create a revenue-valued conversion', async t => {
    const { result, posts } = await submit(t, body, options);
    assert.equal(result.outcome.status, outcome);
    assert.equal(result.outcome.conversion_eligible, false);
    assert.equal(result.value, null);
    if (options.input?.istest || options.env?.TWYNE_TEST || options.headers || options.input?.vertical === 'hvac') assert.equal(posts[0].get('istest'), 'true');
    if (options.input?.vertical === 'hvac') {
      assert.equal(posts[0].get('cid'), '555');
      assert.equal(posts[0].get('cq6'), '45');
    }
  });
}
for (const payout of [undefined, null, '', 0, -1, '60 dollars', 'Infinity', true, {}]) {
  test(`invalid or missing payout ${JSON.stringify(payout)} never falls back to a CPL`, async t => {
    const { result } = await submit(t, { ...accepted, publisher_payout: payout });
    assert.equal(result.outcome.status, 'accepted');
    assert.equal(result.outcome.conversion_eligible, false);
    assert.equal(result.value, null);
  });
}
test('accepted without a transaction ID cannot fire an Ads conversion', async t => {
  const { result } = await submit(t, { ...accepted, leadid: '' });
  assert.equal(result.outcome.conversion_eligible, false);
});
for (const input of [{ owner: 'Rent' }, { xxTrustedFormCertUrl: '' }, { vertical: 'roofing' }]) {
  test(`unroutable lead never posts or receives a conversion value ${JSON.stringify(input)}`, async t => {
    const { result, posts } = await submit(t, accepted, { input });
    assert.equal(posts.length, 0);
    assert.equal(result.outcome.conversion_eligible, false);
    assert.equal(result.value, null);
  });
}
test('bad contact fields do not post', async t => {
  const { response, posts } = await submit(t, accepted, { input: { phone: '1111111111' } });
  assert.equal(response.status, 400);
  assert.equal(posts.length, 0);
});

// Execute the real submission function against a small in-memory DOM and analytics stub.
// This tests emitted analytics without a browser, a real consumer or any network access.
const funnel = readFileSync(new URL('./funnel.js', import.meta.url), 'utf8');
const submitSource = funnel.slice(funnel.indexOf('  function doSubmit('), funnel.indexOf('  function wireFaq('));
async function emitted(resp) {
  const events = [], meta = [];
  let done;
  const finished = new Promise(resolve => { done = resolve; });
  const gtag = (...args) => events.push(args);
  const fbq = (...args) => meta.push(args);
  const elements = { quiz: {}, err: {} };
  const context = {
    RF: {}, document: { body: { classList: { add() {} } }, getElementById: id => elements[id] },
    window: { RENUE_VERTICAL: 'bathroom', gtag, fbq, scrollTo: done },
    gtag, fbq, ADS_ID: 'fixture-ads', ADS_CONVERSION: 'fixture-conversion',
    SUBMIT_ENDPOINT: '/api/submit', PHONE_NUMBER: '', esc: x => x, telHref: x => x,
    fetch: async () => ({ ok: true, json: async () => resp }),
  };
  vm.createContext(context);
  vm.runInContext(submitSource, context);
  context.doSubmit({ word: 'bathroom' }, lead, { dataset: {} });
  await finished;
  return { events, meta };
}
for (const [status, testFlag, eligible, value, leadEvent, adsEvent] of [
  ['test', true, false, null, false, false],
  ['test', true, true, 60, false, false],
  ['accepted', true, true, 60, false, false],
  ['queued', false, false, null, true, false],
  ['queued', false, true, 60, true, false],
  ['accepted', false, false, null, true, false],
  ['accepted', false, true, 42.5, true, true],
  ['accepted', false, true, '60', true, false],
  ['rejected', false, false, null, false, false],
  ['blocked', false, false, null, false, false],
  ['error', false, false, null, false, false],
]) {
  test(`client gates ${status}, test=${testFlag}, value=${value}, eligible=${eligible}`, async () => {
    const { events, meta } = await emitted({ outcome: { status, test: testFlag, conversion_eligible: eligible, value, transaction_id: 'fixture-id' } });
    assert.equal(events.some(e => e[1] === 'generate_lead'), leadEvent);
    assert.equal(events.some(e => e[1] === 'conversion'), adsEvent);
    assert.equal(events.some(e => e[1] === 'lead_result_sold'), false);
    assert.equal(meta.length, leadEvent ? 1 : 0);
    if (testFlag) assert.equal(events.some(e => e[1] === 'quiz_submit_received'), false);
    if (adsEvent) assert.equal(events.find(e => e[1] === 'conversion')[2].value, value);
  });
}
test('legacy response without normalized outcome never creates a conversion', async () => {
  const { events } = await emitted({ twyne: { attempted: true, status: 'Accepted' }, value: 60 });
  assert.equal(events.some(e => e[1] === 'generate_lead' || e[1] === 'conversion'), false);
});

// Bathroom multi-buyer integration: every ping, post and geo lookup is mocked.
const multiLead = {
  ...lead, owner: 'Yes, I own the home', project: 'Tub-to-shower conversion', credit: 'Good',
  address: '123 Fixture Street', city: 'Washington', state: 'DC', consentText: 'Fixture consent text',
  pageUrl: 'https://renuehome.com/shower-options?angle=tub&gclid=fixture-click',
};
const pingAccepted = { status: 'Accepted', pingid: 'fixture-ping', price: 999,
  bids: [{ bidid: '123', bid: 10 }, { bidid: '456', bid: 60 }] };
const postAccepted = { status: 'Accepted', pingid: 'fixture-ping', price: '60.00' };
async function multiSubmit(t, {
  ping = pingAccepted, post = postAccepted, pingStatus = 200, postStatus = 200,
  input = {}, env = {}, headers = {}, handler, geoHandler,
  geo = { places: [{ 'place name': 'Washington', 'state abbreviation': 'DC' }] },
} = {}) {
  // Buyer calls and ZIP lookups are separate so retry/fallback assertions count delivery traffic.
  const calls = [], geoCalls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(['https://htm.api.twyne.io/multi/ping', 'https://htm.api.twyne.io/multi/post', 'https://api.zippopotam.us/us/20001'].includes(url), 'unexpected endpoint / fallback');
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal instanceof AbortSignal);
    const call = { url, payload: init.body ? JSON.parse(init.body) : null, signal: init.signal };
    if (url.includes('zippopotam')) {
      geoCalls.push(call);
      return geoHandler ? geoHandler(url, init) : new Response(JSON.stringify(geo));
    }
    calls.push(call);
    if (handler) return handler(url, init, call);
    return new Response(JSON.stringify(url.endsWith('/ping') ? ping : post), { status: url.endsWith('/ping') ? pingStatus : postStatus });
  });
  const request = new Request('https://renuehome.com/api/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'FixtureAgent', ...headers },
    body: JSON.stringify({ ...multiLead, ...input }),
  });
  const response = await onRequestPost({ request, env: { RNH_BATHROOM_ROUTE: 'multi556', ...env } });
  return { response, result: await response.json(), calls, geoCalls };
}
test('multi route sends exact buyer fields, stable IDs, numeric bids and final payout only', async t => {
  const { result, calls } = await multiSubmit(t);
  assert.equal(calls.length, 2);
  const [ping, post] = calls.map(c => c.payload);
  assert.equal(ping.pid, '140'); assert.equal(ping.sid, '312'); assert.equal(ping.cid, '556');
  assert.deepEqual(ping.customquestions, { cq1: 'Good', cq2: 'Yes, I own the home', cq3: 'Tub-to-shower conversion', cq4: 'bathroom' });
  assert.equal(ping.click.domain_url, multiLead.pageUrl);
  assert.equal(ping.click.subid1, 'google-cpc'); assert.equal(ping.click.subid2, 'fixture-click');
  assert.equal(ping.click.trustedform, multiLead.xxTrustedFormCertUrl);
  assert.equal(ping.click.leadid, multiLead.universal_leadid);
  assert.equal(ping.click.ip, '192.0.2.1'); assert.equal(ping.click.useragent, 'FixtureAgent');
  assert.equal(ping.istest, undefined);
  assert.deepEqual(post, { ...ping, pingid: 'fixture-ping', bids: [456, 123] });
  assert.deepEqual(result.outcome, { status: 'accepted', test: false, conversion_eligible: true, value: 60, transaction_id: 'fixture-ping' });
  assert.equal(result.twyne.finalPostAccepted, true);
  assert.equal((await emitted(result)).events.filter(e => e[1] === 'conversion').length, 1);
});
test('final publisher payout overrides final price; ping value is never used', async t => {
  const { result } = await multiSubmit(t, { post: { ...postAccepted, publisher_payout: '42.50' } });
  assert.equal(result.value, 42.5);
});
for (const clickId of ['gclid', 'gbraid', 'wbraid']) {
  for (const [name, utms, expected] of [
    ['explicit YouTube pilot', 'utm_source=youtube&utm_medium=paid_video', 'youtube-paid-video'],
    ['Search pilot', 'utm_source=google&utm_medium=cpc', 'google-cpc'],
    ['unlabeled Google traffic', '', 'google-cpc'],
    ['unrelated UTMs cannot override Google', 'utm_source=facebook&utm_medium=paid_social', 'google-cpc'],
    ['incomplete YouTube label', 'utm_source=youtube', 'google-cpc'],
    ['different YouTube medium', 'utm_source=youtube&utm_medium=organic', 'google-cpc'],
  ]) {
    test(`multi source: ${name} with ${clickId}`, async t => {
      const pageUrl = `https://renuehome.com/shower-options?angle=tub&${utms}&${clickId}=fixture-click`;
      const { calls } = await multiSubmit(t, { input: { pageUrl } });
      assert.equal(calls.length, 2);
      for (const { payload } of calls) {
        assert.equal(payload.click.subid1, expected);
        assert.equal(payload.click.domain_url, pageUrl);
        assert.equal(payload.click.subid2, clickId === 'gclid' ? 'fixture-click' : '');
      }
    });
  }
}
for (const [name, pageUrl, referrer, expected] of [
  ['YouTube without click ID', 'https://renuehome.com/shower-options?utm_source=youtube&utm_medium=paid_video', '', 'youtube-paid-video'],
  ['case-normalized YouTube pair', 'https://renuehome.com/shower-options?utm_source=YouTube&utm_medium=PAID_VIDEO&gclid=fixture', '', 'youtube-paid-video'],
  ['Search without click ID', 'https://renuehome.com/shower-options?utm_source=google&utm_medium=cpc', '', 'google-cpc'],
  ['Bing click ID retains precedence', 'https://renuehome.com/shower-options?utm_source=youtube&utm_medium=paid_video&msclkid=fixture', '', 'bing-cpc'],
  ['Facebook click ID retains precedence', 'https://renuehome.com/shower-options?utm_source=youtube&utm_medium=paid_video&fbclid=fixture', '', 'facebook-cpc'],
  ['unlabeled Google referrer', 'https://renuehome.com/shower-options', 'https://www.google.com/', 'google-organic'],
  ['unlabeled direct traffic', 'https://renuehome.com/shower-options', '', 'direct'],
  ['missing page URL', '', '', 'direct'],
  ['malformed page URL', 'not a valid URL', '', 'renuehome'],
]) {
  test(`source fallback: ${name}`, async t => {
    const { calls } = await multiSubmit(t, { input: { pageUrl, referrer } });
    assert.equal(calls.length, 2);
    assert.ok(calls.every(({ payload }) => payload.click.subid1 === expected));
  });
}
test('direct route uses the same YouTube source label and preserves its gclid', async t => {
  const pageUrl = 'https://renuehome.com/shower-options?utm_source=youtube&utm_medium=paid_video&gclid=fixture-click';
  const { posts } = await submit(t, accepted, { input: { pageUrl } });
  assert.equal(posts.length, 1);
  assert.equal(posts[0].get('subid1'), 'youtube-paid-video');
  assert.equal(posts[0].get('subid2'), 'fixture-click');
  assert.equal(posts[0].get('domain_url'), pageUrl);
});
test('explicit source environment override is unchanged', async t => {
  const pageUrl = 'https://renuehome.com/shower-options?utm_source=youtube&utm_medium=paid_video&gclid=fixture-click';
  const { calls } = await multiSubmit(t, { input: { pageUrl }, env: { TWYNE_SUBID1: 'configured-source' } });
  assert.ok(calls.every(({ payload }) => payload.click.subid1 === 'configured-source'));
});
for (const [name, options, status, count] of [
  ['post network failure', { handler: async url => { if (url.endsWith('/ping')) return new Response(JSON.stringify(pingAccepted)); throw new Error('private upstream failure'); } }, 'error', 2],
  ['ping network failure', { handler: async () => { throw new Error('private upstream failure'); } }, 'error', 1],
  ['ping rejected', { ping: { ...pingAccepted, status: 'Rejected' } }, 'rejected', 1],
  ['ping queued', { ping: { ...pingAccepted, status: 'Queued' } }, 'unknown', 1],
  ['ping accepted HTTP500', { pingStatus: 500 }, 'error', 1],
  ['post rejected', { post: { ...postAccepted, status: 'Rejected' } }, 'rejected', 2],
  ['post rejected HTTP400', { post: { ...postAccepted, status: 'Rejected' }, postStatus: 400 }, 'rejected', 2],
  ['post queued', { post: { ...postAccepted, status: 'Queued' } }, 'queued', 2],
  ['post accepted HTTP500', { postStatus: 500 }, 'error', 2],
  ['post accepted HTTP400', { postStatus: 400 }, 'error', 2],
  ['post schema complaint is not retried', { post: { status: 'Error', reason: 'Invalid bids' } }, 'error', 2],
  ['post unexpected status', { post: { ...postAccepted, status: 'Accepted-ish' } }, 'unknown', 2],
  ['post ID mismatch', { post: { ...postAccepted, pingid: 'other-ping' } }, 'error', 2],
]) {
  test(`multi ${name}: no false conversion or fallback`, async t => {
    const { result, calls } = await multiSubmit(t, options);
    assert.equal(calls.length, count);
    assert.equal(result.outcome.status, status);
    assert.equal(result.outcome.conversion_eligible, false);
    assert.equal(result.value, null);
    assert.equal((await emitted(result)).events.some(e => e[1] === 'conversion'), false);
  });
}
for (const [name, patch] of [
  ['no final ID', { pingid: undefined }], ['invalid final ID', { pingid: 0 }],
  ['no price', { price: undefined }], ['zero price', { price: 0 }], ['negative price', { price: -1 }],
  ['invalid price', { price: 'private text' }], ['boolean price', { price: true }],
  ['zero publisher payout with positive price', { publisher_payout: 0 }],
]) {
  test(`multi ${name}: no estimated conversion value`, async t => {
    const { result } = await multiSubmit(t, { post: { ...postAccepted, ...patch } });
    assert.equal(result.outcome.conversion_eligible, false);
    assert.equal(result.value, null);
  });
}
for (const ping of [
  { ...pingAccepted, pingid: '' }, { ...pingAccepted, bids: [] },
  { ...pingAccepted, bids: [{ bidid: 'abc' }] }, { ...pingAccepted, bids: [{ bidid: '123.5' }] },
  { ...pingAccepted, bids: [{ bidid: true }] }, { ...pingAccepted, bids: [{ bidid: '9007199254740993' }] },
]) {
  test(`multi invalid ping does not post: ${JSON.stringify(ping)}`, async t => {
    const { result, calls } = await multiSubmit(t, { ping });
    assert.equal(calls.length, 1); assert.equal(result.value, null);
    assert.equal(result.outcome.conversion_eligible, false);
  });
}
for (const input of [
  { owner: 'No, I rent' }, { owner: '' }, { xxTrustedFormCertUrl: '' }, { universal_leadid: '' },
  { consent: false }, { consentText: '' }, { first: '' }, { address: '' },
  { project: 'Unsupported project' }, { credit: 'Invented' },
]) {
  test(`multi required-data gate prevents buyer traffic: ${JSON.stringify(input)}`, async t => {
    const { result, calls } = await multiSubmit(t, { input });
    assert.equal(calls.length, 0); assert.equal(result.outcome.status, 'blocked');
  });
}
for (const [name, options] of [
  ['diagnostic header', { headers: { 'x-rnh-test': '1' } }],
  ['environment test', { env: { TWYNE_TEST: 'true' } }],
  ['payload test', { input: { istest: true } }],
  ['final response test', { post: { ...postAccepted, istest: true } }],
  ['final reason test', { post: { ...postAccepted, reason: 'Test lead' } }],
]) {
  test(`multi ${name} never produces a conversion`, async t => {
    const { result, calls } = await multiSubmit(t, options);
    assert.equal(result.outcome.status, 'test'); assert.equal(result.value, null);
    if (!name.startsWith('final')) for (const call of calls) assert.equal(call.payload.istest, 'true');
  });
}
test('unexpected test ping is never turned into a live final post', async t => {
  const { result, calls } = await multiSubmit(t, { ping: { ...pingAccepted, istest: true } });
  assert.equal(calls.length, 1); assert.equal(result.outcome.status, 'test');
});
test('server ZIP lookup fills city/state before ping and post', async t => {
  const { result, calls, geoCalls } = await multiSubmit(t, { input: { city: '', state: '' } });
  assert.equal(calls.length, 2); assert.equal(geoCalls.length, 1); assert.equal(result.value, 60);
  assert.equal(calls[0].payload.consumer.city, 'Washington'); assert.equal(calls[0].payload.consumer.state, 'DC');
});
test('failed server ZIP lookup does not trust otherwise valid client geo', async t => {
  const { result, calls, geoCalls } = await multiSubmit(t, { geoHandler: async () => { throw new Error('geo unavailable'); } });
  assert.equal(calls.length, 0); assert.equal(geoCalls.length, 1); assert.equal(result.twyne.blocked, 'geo-missing');
});
test('temporary multi CA guard prevents all buyer traffic without exposing contact data', async t => {
  const { result, calls } = await multiSubmit(t, { input: { city: 'San Diego', state: 'CA' },
    geo: { places: [{ 'place name': 'San Diego', 'state abbreviation': 'CA' }] } });
  assert.equal(calls.length, 0); assert.equal(result.outcome.status, 'blocked');
  assert.equal(result.twyne.blocked, 'area-unavailable'); assert.equal(result.value, null);
  assert.ok(!JSON.stringify(result).includes(multiLead.email));
});
test('CA ZIP with stale Texas client geo is blocked before ping', async t => {
  const { result, calls, geoCalls } = await multiSubmit(t, { input: { city: 'Austin', state: 'TX' },
    geo: { places: [{ 'place name': 'San Diego', 'state abbreviation': 'CA' }] } });
  assert.equal(calls.length, 0); assert.equal(geoCalls.length, 1);
  assert.equal(result.twyne.blocked, 'area-unavailable'); assert.equal(result.value, null);
});
test('malformed post response is uncertain and is never retried or reflected', async t => {
  const { result, calls } = await multiSubmit(t, { handler: async url => url.endsWith('/ping') ? new Response(JSON.stringify(pingAccepted)) : new Response('<private upstream HTML>') });
  assert.equal(calls.length, 2); assert.equal(result.value, null);
  assert.equal(result.twyne.deliveryUncertain, true);
  assert.equal(result.twyne.error, 'invalid-response');
  assert.ok(!JSON.stringify(result).includes('private upstream'));
});
test('oversized streamed post response is bounded, uncertain and never retried', async t => {
  const { result, calls } = await multiSubmit(t, { handler: async url => url.endsWith('/ping') ? new Response(JSON.stringify(pingAccepted)) : new Response('x'.repeat(65537)) });
  assert.equal(calls.length, 2); assert.equal(result.value, null);
  assert.equal(result.twyne.error, 'response-too-large'); assert.equal(result.twyne.deliveryUncertain, true);
});
test('post timeout aborts the request, never retries and cannot count the ping', async t => {
  const originalSetTimeout = globalThis.setTimeout;
  const durations = [];
  t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => { durations.push(ms); return originalSetTimeout(fn, 10, ...args); });
  const { result, calls } = await multiSubmit(t, { handler: async (url, init) => {
    if (url.endsWith('/ping')) return new Response(JSON.stringify(pingAccepted));
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true }));
  } });
  assert.deepEqual(durations, [2500, 20000, 35000]);
  assert.equal(calls.length, 2); assert.equal(calls[1].signal.aborted, true);
  assert.equal(result.twyne.error, 'upstream-timeout'); assert.equal(result.twyne.deliveryUncertain, true);
  assert.equal(result.outcome.conversion_eligible, false);
});
test('post timeout also covers a stalled response body', async t => {
  const originalSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => originalSetTimeout(fn, 10, ...args));
  const { result, calls } = await multiSubmit(t, { handler: async (url, init) => {
    if (url.endsWith('/ping')) return new Response(JSON.stringify(pingAccepted));
    return new Response(new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => controller.error(new Error('body aborted')), { once: true });
    } }));
  } });
  assert.equal(calls.length, 2); assert.equal(result.value, null);
  assert.equal(result.twyne.error, 'upstream-timeout'); assert.equal(result.twyne.deliveryUncertain, true);
});
test('all actual bathroom choices preserve their raw cq3 value and optional credit', async t => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('./verticals.js', import.meta.url), 'utf8'), context);
  const projects = context.window.RENUE_VERTICALS.bathroom.steps.find(step => step.id === 'project').options;
  for (const project of projects) {
    const { result, calls } = await multiSubmit(t, { input: { project, credit: undefined } });
    assert.equal(result.value, 60);
    assert.equal(calls[0].payload.customquestions.cq3, project);
    assert.equal(calls[0].payload.customquestions.cq1, '');
  }
});
test('redirect response cannot forward lead data to another destination', async t => {
  const { result, calls } = await multiSubmit(t, { handler: async () => new Response('', { status: 307, headers: { Location: 'https://example.com' } }) });
  assert.equal(calls.length, 1); assert.equal(result.value, null); assert.equal(result.twyne.error, 'upstream-redirect');
});
test('multi route emits only whitelisted metadata, not raw upstream fields or reasons', async t => {
  const { result } = await multiSubmit(t, { post: { ...postAccepted, reason: 'private reason', consumer: { email: 'private@example.com' }, bids: [{ dba: 'private business' }] } });
  assert.equal(result.value, 60); assert.ok(!JSON.stringify(result).includes('private'));
});
test('bathroom activation leaves windows on554 and HVAC555 in forced-test mode', async t => {
  for (const vertical of ['windows', 'hvac']) {
    const { posts } = await submit(t, accepted, { input: { vertical }, env: { RNH_BATHROOM_ROUTE: 'multi556' } });
    assert.equal(posts[0].get('cid'), vertical === 'windows' ? '554' : '555');
    assert.equal(posts[0].get('istest'), vertical === 'windows' ? 'false' : 'true');
  }
});
test('direct WestShore route allows its30-second buyer timeout plus response overhead', async t => {
  const originalSetTimeout = globalThis.setTimeout;
  const durations = [];
  t.mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => { durations.push(ms); return originalSetTimeout(fn, ms, ...args); });
  const { result } = await submit(t, accepted);
  assert.deepEqual(durations, [35000]); assert.equal(result.outcome.conversion_eligible, true);
});
test('unknown route flag fails closed without any upstream call', async t => {
  const { response, calls } = await multiSubmit(t, { env: { RNH_BATHROOM_ROUTE: 'typo' } });
  assert.equal(response.status, 503); assert.equal(calls.length, 0);
});
test('read-only endpoint reports effective route without a lead submission', async () => {
  assert.equal((await (await onRequestGet()).json()).bathroomRoute, 'ws554');
  assert.equal((await (await onRequestGet({ env: { RNH_BATHROOM_ROUTE: 'multi556' } })).json()).bathroomRoute, 'multi556');
});
