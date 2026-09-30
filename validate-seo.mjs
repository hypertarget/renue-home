#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ORIGIN, publicPages, guideFiles, canonical, attributes } from './build-sitemap.mjs';
export function validateSEO(root) {
  const errors = [];
  if (!existsSync(join(root, '404.html'))) errors.push('Missing root 404.html allows missing routes to serve the homepage.');
  const pages = publicPages(root);
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  const actual = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  const expected = pages.map((p) => p.url);
  if (new Set(actual).size !== actual.length) errors.push('Duplicate sitemap URLs.');
  for (const url of expected) if (!actual.includes(url)) errors.push(`Missing sitemap URL ${url}`);
  for (const url of actual) if (!expected.includes(url)) errors.push(`Unexpected sitemap URL ${url}`);
  const hub = readFileSync(join(root, 'guides.html'), 'utf8');
  const hubLinks = [...hub.matchAll(/<a\b[^>]*>/gi)].map((m) => attributes(m[0]).href);
  // Inspect every guide, including any excluded by a mistaken canonical.
  for (const file of guideFiles(root)) {
    const route = '/' + file.slice(0,-5), url = ORIGIN + route;
    const html = readFileSync(join(root, file), 'utf8');
    if (canonical(html) !== url) errors.push(`Wrong or missing canonical on ${route}`);
    if ((html.match(/<h1\b/gi) || []).length !== 1) errors.push(`Expected one H1 on ${route}`);
    if (!hubLinks.includes(route) && !hubLinks.includes(url)) errors.push(`Guide absent from hub ${route}`);
    for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
      const href = attributes(m[0]).href;
      if (!href) continue;
      let dest;
      try { dest = new URL(href, url); } catch { errors.push(`Invalid link on ${route}`); continue; }
      if (dest.origin !== ORIGIN) continue;
      let rel;
      try { rel = decodeURIComponent(dest.pathname).replace(/^\//, ''); } catch { errors.push(`Invalid link encoding on ${route}`); continue; }
      const candidates = [join(root, rel || 'index.html'), join(root, `${rel}.html`), join(root, rel, 'index.html')];
      if (!candidates.some((p) => existsSync(p) && statSync(p).isFile())) errors.push(`Missing internal destination ${dest.pathname} on ${route}`);
    }
  }
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const errors = validateSEO(process.cwd());
  errors.forEach((e) => console.error(e));
  if (errors.length) process.exitCode = 1;
  else console.log('SEO discovery checks passed.');
}
