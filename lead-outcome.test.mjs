import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { onRequestPost } from './functions/api/submit.js';

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
