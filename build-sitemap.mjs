#!/usr/bin/env node
// Generate discovery files from public root pages and nested editorial guides.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
export const ORIGIN = 'https://renuehome.com';
export function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map((m) => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4]]));
}
export function canonical(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attributes(m[0]))
    .find((a) => a.rel?.toLowerCase().split(/\s+/).includes('canonical'))?.href;
}
export function guideFiles(root) {
  return existsSync(join(root, 'guides')) ? readdirSync(join(root, 'guides'))
    .filter((f) => f.endsWith('.html') && f !== '404.html').map((f) => `guides/${f}`) : [];
}
export function publicPages(root) {
  const redirects = existsSync(join(root, '_redirects'))
    ? readFileSync(join(root, '_redirects'), 'utf8').split('\n')
      .filter((s) => s.trim() && !s.trim().startsWith('#')).map((s) => s.trim().split(/\s+/)[0]) : [];
  const files = [...readdirSync(root).filter((f) => f.endsWith('.html')), ...guideFiles(root)];
  return files.sort().flatMap((file) => {
    if (file === '404.html') return [];
    const route = file === 'index.html' ? '/' : `/${file.slice(0, -5)}`;
    if (redirects.includes(route)) return [];
    const html = readFileSync(join(root, file), 'utf8');
    const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attributes(m[0]));
    if (metas.some((a) => /^(robots|googlebot)$/i.test(a.name || '') && /\bnoindex\b/i.test(a.content || ''))) return [];
    if (metas.some((a) => a['http-equiv']?.toLowerCase() === 'refresh')) return [];
    const url = ORIGIN + route;
    if (canonical(html) && canonical(html) !== url) return [];
    return [{ file, route, url }];
  });
}
export function buildSitemap(root) {
  const pages = publicPages(root);
  // Build time is not an editorial change date. Omit lastmod until it is tracked.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${p.url}</loc></url>`).join('\n')}\n</urlset>\n`;
  writeFileSync(join(root, 'sitemap.xml'), xml);
  writeFileSync(join(root, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  return pages;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Wrote sitemap.xml (${buildSitemap(process.cwd()).length} URLs) and robots.txt`);
}
