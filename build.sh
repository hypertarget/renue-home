#!/usr/bin/env bash
# Regenerate generated assets (city pages + sitemap). Run from repo root.
set -e
node build-cities.mjs
node build-sitemap.mjs
echo "Done. Commit the new/updated *.html, sitemap.xml, robots.txt."
