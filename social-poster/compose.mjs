#!/usr/bin/env node
// Autonomous content generator. Pulls the next unused items from content-bank.json, renders
// each as a fresh card (square + a tall Pinterest pin) with a seeded palette so recycled items
// look different each cycle, and appends them to content-calendar.json. Tracks bank-state.json
// so nothing repeats until the whole bank has been used, then it cycles with new visuals.
//
// Safe by design: every stat in the bank carries a real source, captions are pre-written in the
// human voice (no em dashes / colons / semicolons). No LLM, so nothing gets invented at runtime.
//
// Usage:  node compose.mjs [count]        # add <count> new cards (default 3)
//         node compose.mjs [count] --fresh # start a brand-new rotation (resets calendar+state)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderTheme, makePin, pickPalette } from "./lib.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, "..", "assets", "social-posts");
const SITE = "https://renuehome.com";
const calPath = join(__dir, "content-calendar.json");
const statePath = join(__dir, "bank-state.json");

const count = parseInt(process.argv.find((a) => /^\d+$/.test(a)) || "3", 10);
const fresh = process.argv.includes("--fresh");
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

const bank = JSON.parse(readFileSync(join(__dir, "content-bank.json"), "utf8")).items;
let calendar = (!fresh && existsSync(calPath)) ? JSON.parse(readFileSync(calPath, "utf8")) : [];
let state = (!fresh && existsSync(statePath)) ? JSON.parse(readFileSync(statePath, "utf8")) : { used: [], gen: 0 };
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function nextItems(n) {
  const picked = [];
  for (let i = 0; i < n; i++) {
    let pool = bank.filter((b) => !state.used.includes(b.id));
    if (pool.length === 0) { state.used = []; pool = bank.slice(); } // new cycle
    const item = pool[Math.floor(hash(item_seed(i)) % pool.length)] || pool[0];
    state.used.push(item.id);
    picked.push(item);
  }
  return picked;
}
function item_seed(i) { return `${state.gen}-${i}-renue`; }

const items = nextItems(count);
for (const item of items) {
  const gen = state.gen++;
  const palette = pickPalette(item.layout, hash(item.id) + gen);
  const theme = { ...item, ...palette };
  const slug = `${item.id}-${gen}`;
  const sq = join(OUT_DIR, `${slug}.png`);
  const pin = join(OUT_DIR, `${slug}-pin.png`);
  await renderTheme(theme, sq);
  await makePin(sq, pin, palette.bg);
  calendar.push({
    id: slug, bank_id: item.id, layout: item.layout,
    image_url: `${SITE}/assets/social-posts/${slug}.png`,
    pin_image_url: `${SITE}/assets/social-posts/${slug}-pin.png`,
    caption: item.caption, alt: item.alt, status: "pending",
  });
  console.log("composed", item.layout.padEnd(10), slug);
}
writeFileSync(calPath, JSON.stringify(calendar, null, 2) + "\n");
writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
if (fresh) writeFileSync(join(__dir, "state.json"), JSON.stringify({ cursor: 0 }, null, 2) + "\n");
console.log(`calendar now has ${calendar.length} posts; bank gen=${state.gen}`);
