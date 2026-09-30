import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSitemap } from './build-sitemap.mjs';
import { validateSEO } from './validate-seo.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'renue-seo-'));
  t.after(() => rmSync(root, {recursive:true, force:true}));
  mkdirSync(join(root, 'guides'));
  const put = (name, body) => writeFileSync(join(root, name), body);
  put('index.html', '<h1>Home</h1>');
  put('404.html', '<meta name="robots" content="noindex"><h1>Missing</h1>');
  put('guides.html', '<a href="/guides/hiring">Hiring</a>');
  put('guides/hiring.html', '<link rel="canonical" href="https://renuehome.com/guides/hiring"><h1>Hiring</h1><a href="/">Home</a>');
  return {root, put};
}
test('nested guides survive rebuilds and non-indexable pages stay out', (t) => {
  const {root, put} = fixture(t);
  put('bathroom-call.html', "<meta content='noindex, follow' name='robots'>");
  put('old.html', '<meta http-equiv="refresh" content="0;url=/">');
  put('duplicate.html', '<link href="https://renuehome.com/" rel="canonical">');
  put('_redirects', '/moved / 301\n'); put('moved.html','<h1>Moved</h1>');
  assert.deepEqual(buildSitemap(root).map((p) => p.route).sort(), ['/', '/guides', '/guides/hiring']);
  const first = readFileSync(join(root,'sitemap.xml'),'utf8');
  assert.doesNotMatch(first, /lastmod/);
  buildSitemap(root);
  assert.equal(readFileSync(join(root,'sitemap.xml'),'utf8'),first);
  assert.deepEqual(validateSEO(root),[]);
});
test('unpublished internal links and orphaned guides fail validation', (t) => {
  const {root,put} = fixture(t);
  put('guides.html','<h1>Guides</h1>');
  put('guides/hiring.html','<link rel="canonical" href="https://renuehome.com/guides/hiring"><h1>Hiring</h1><a href="/guides/invented">Next</a>');
  buildSitemap(root);
  assert.match(validateSEO(root).join('\n'),/absent from hub/);
  assert.match(validateSEO(root).join('\n'),/Missing internal destination/);
});
test('a wrong canonical cannot hide a guide from checks', (t) => {
  const {root,put} = fixture(t);
  put('guides/hiring.html','<link rel="canonical" href="https://renuehome.com/hiring"><h1>Hiring</h1>');
  buildSitemap(root);
  assert.match(validateSEO(root).join('\n'),/Wrong or missing canonical/);
});
test('a sitemap entry for a nonexistent page fails validation', (t) => {
  const {root,put} = fixture(t); buildSitemap(root);
  put('sitemap.xml',readFileSync(join(root,'sitemap.xml'),'utf8').replace('</urlset>','<url><loc>https://renuehome.com/missing</loc></url></urlset>'));
  assert.match(validateSEO(root).join('\n'),/Unexpected sitemap URL/);
});
