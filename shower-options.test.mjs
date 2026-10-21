import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const verticals = read('./verticals.js');
const presentation = read('./assets/shower-options/shower-options.js');
const html = read('./shower-options.html');

function load(search = '') {
  const nodes = new Map(['so-heading-main', 'so-heading-accent', 'so-image-tag', 'so-planning-title'].map(id => [id, { textContent: '' }]));
  const image = {};
  const priorities = Array.from({ length: 3 }, () => {
    const children = { dt: { textContent: '' }, dd: { textContent: '' } };
    return { children, querySelector: selector => children[selector] };
  });
  const context = vm.createContext({
    URLSearchParams,
    window: { location: { search } },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById: id => nodes.get(id) || null,
      querySelector: selector => selector === '.so-hero-art > img' ? image : null,
      querySelectorAll: selector => selector === '#so-priorities > div' ? priorities : []
    }
  });
  vm.runInContext(verticals, context);
  const original = JSON.parse(JSON.stringify(context.window.RENUE_VERTICALS.bathroom));
  vm.runInContext(presentation, context);
  return {
    original, nodes, image, priorities,
    config: JSON.parse(JSON.stringify(context.window.RENUE_VERTICALS.bathroom)),
    commands: JSON.parse(JSON.stringify(Array.from(context.window.dataLayer, command => Array.from(command))))
  };
}

function buyerFields(steps) {
  return steps.map(({ q, sub, ...rest }) => rest);
}

test('all angles retain the full qualification flow and exact buyer answer values', () => {
  for (const angle of ['', 'general', 'tub', 'shower', 'remodel']) {
    const state = load('?angle=' + angle);
    assert.equal(state.config.steps.length, 7);
    assert.deepEqual(buyerFields(state.config.steps), buyerFields(state.original.steps));
    assert.deepEqual(state.config.steps.map(step => step.id), ['project', 'zip', 'timeline', 'owner', 'credit', 'name', 'contact']);
    assert.equal(state.config.steps.find(step => step.id === 'owner').dq.match, 'No, I rent');
  }
});

test('angle attribution is queued before shared funnel startup without fabricating an answer or conversion', () => {
  for (const angle of ['general', 'tub', 'shower', 'remodel']) {
    const state = load('?angle=' + angle + '&gclid=unchanged-example');
    assert.deepEqual(state.commands, [['set', { page_variant: 'shower_options_v2', page_angle: angle }]]);
  }
  const sources = [...html.matchAll(/<script defer src="([^"?]+)(?:\?[^"]*)?"/g)].map(match => match[1]);
  assert.deepEqual(sources, ['/verticals.js', '/assets/shower-options/shower-options.js', '/funnel.js']);
});

test('unsupported and inherited property names fall back safely without reflection', () => {
  for (const angle of ['constructor', '__proto__', 'toString', '<img src=x onerror=alert(1)>', 'unknown']) {
    const state = load('?angle=' + encodeURIComponent(angle));
    assert.equal(state.commands[0][1].page_angle, 'general');
    assert.equal(state.nodes.get('so-heading-main').textContent, 'Ready to replace');
    assert.equal(state.nodes.get('so-heading-accent').textContent, 'your tub or shower?');
  }
});

test('recognized angles select the corresponding introduction and supporting content', () => {
  const tub = load('?angle=tub');
  const shower = load('?angle=shower');
  const remodel = load('?angle=remodel');
  assert.match(tub.config.headline, /Only use your tub for showers\?/);
  assert.match(shower.config.headline, /your outdated shower\?/);
  assert.match(remodel.config.headline, /your whole bathroom\?/);
  assert.match(tub.priorities[0].children.dd.textContent, /removing your existing tub/);
  assert.match(shower.priorities[0].children.dd.textContent, /wall finishes/);
  assert.equal(remodel.image.src, '/assets/shower-options/full-bathroom.webp');
  assert.match(remodel.priorities[1].children.dd.textContent, /vanity, flooring and fixtures/);
});
