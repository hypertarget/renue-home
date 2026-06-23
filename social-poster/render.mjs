#!/usr/bin/env node
// Renders VARIED, intentionally human-feeling social cards for Renue Home from themes.json.
// Multiple layouts (stat / note / question / checklist / marker / myth / realtalk), mixed
// palettes, real fonts (Anton, Caveat, Permanent Marker, Poppins), hand-drawn marks and a
// little asymmetry — so the set doesn't read as a uniform AI template.
//
// Output PNGs -> ../assets/social-posts/<slug>.png  (served publicly by Cloudflare Pages;
// Instagram's publishing API requires a public image URL). Rebuilds content-calendar.json.
//
// Usage:  node render.mjs            # render all + rebuild calendar
//         node render.mjs <slug>     # render one
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, "..", "assets", "social-posts");
const SITE = "https://renuehome.com";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rnd = (seed) => { let x = Math.sin(seed) * 10000; return x - Math.floor(x); };

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = []; let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars && line) { lines.push(line); line = w; }
    else line = (line + " " + w).trim();
  }
  if (line) lines.push(line);
  return lines;
}

// --- hand-drawn bits -------------------------------------------------------
function roughUnderline(x1, x2, y, color, sw = 7) {
  const mid = (x1 + x2) / 2;
  return `<path d="M ${x1} ${y} Q ${mid} ${y - 9} ${x2} ${y - 2}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
}
function handCheck(x, y, s, color) {
  return `<path d="M ${x} ${y} l ${s * 0.35} ${s * 0.4} l ${s * 0.75} ${-s * 1.05}" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function highlightBehind(x, y, w, h, color, rot) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}" opacity="0.45" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"/>`;
}
function star(x, y, s, color) {
  return `<path d="M ${x} ${y - s} L ${x + s * 0.28} ${y - s * 0.28} L ${x + s} ${y - s * 0.28} L ${x + s * 0.42} ${y + s * 0.18} L ${x + s * 0.62} ${y + s} L ${x} ${y + s * 0.5} L ${x - s * 0.62} ${y + s} L ${x - s * 0.42} ${y + s * 0.18} L ${x - s} ${y - s * 0.28} L ${x - s * 0.28} ${y - s * 0.28} Z" fill="${color}"/>`;
}
function cornerTag(W, H, color) {
  return `<text x="${W - 60}" y="${H - 52}" text-anchor="end" font-family="Poppins SemiBold" font-size="30" fill="${color}" opacity="0.85">renuehome.com</text>`;
}
function footerLeft(H, textColor, markColor) {
  return `${mark(140, H - 150, 1.4, markColor)}<text x="226" y="${H - 132}" font-family="Poppins SemiBold" font-size="34" fill="${textColor}" opacity="0.82">renuehome.com</text>`;
}
// small house mark
function mark(cx, cy, scale, color) {
  return `<g transform="translate(${cx},${cy}) scale(${scale}) translate(-32,-32)" fill="none" stroke="${color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 28.5 L32 9 L53 28.5"/>
    <path d="M15 27 V51 a3 3 0 0 0 3 3 H46 a3 3 0 0 0 3 -3 V27"/>
    <path d="M25 49 V31 H35 a6 6 0 0 1 0 12 H27 M34 43 L41 50"/>
  </g>`;
}
const frame = (W, H, fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${fill}"/>`;

// --- layouts ---------------------------------------------------------------
function L_stat(t) {
  const W = 1080, H = 1080;
  const sup = wrap(t.support, 30);
  const supT = sup.map((l, i) => `<tspan x="84" dy="${i ? 56 : 0}">${esc(l)}</tspan>`).join("");
  return frame(W, H, t.bg) +
    `${mark(W - 96, 96, 1.4, t.accent)}
     <text x="84" y="200" font-family="Poppins SemiBold" font-size="34" letter-spacing="5" fill="${t.accent}">${esc(t.kicker)}</text>
     <text x="78" y="510" font-family="Anton" font-size="340" fill="${t.accent}">${esc(t.number)}</text>
     ${roughUnderline(86, 86 + t.number.length * 110, 545, t.accent, 9)}
     <text x="84" y="650" font-family="Poppins" font-size="44" fill="${t.ink}">${supT}</text>
     <text x="84" y="1000" font-family="Poppins" font-size="27" font-style="italic" fill="${t.ink}" opacity="0.7">${esc(t.source)}</text>` +
    `</svg>`;
}

function L_note(t) {
  const W = 1080, H = 1350;
  // ruled paper
  let rules = "";
  for (let y = 360; y < H - 120; y += 96) rules += `<line x1="120" y1="${y}" x2="${W - 90}" y2="${y}" stroke="#d8cdb4" stroke-width="2"/>`;
  const lines = t.lines.map((l, i) => `<text x="150" y="${430 + i * 150}" font-family="Caveat" font-size="128" fill="${t.ink}">${esc(l)}</text>`).join("");
  return frame(W, H, t.bg) +
    `<rect x="118" y="120" width="6" height="${H - 240}" fill="#e0a89a" opacity="0.7"/>
     ${rules}
     <g transform="rotate(-2 ${W / 2} ${H / 2})">
       <text x="150" y="300" font-family="Permanent Marker" font-size="46" fill="${t.accent}">quick tip ✶</text>
       ${lines}
       <text x="152" y="${430 + t.lines.length * 150 + 40}" font-family="Caveat" font-size="64" fill="${t.accent}">${esc(t.aside)}</text>
     </g>
     ${star(900, 250, 34, t.accent)}
     ${mark(150, H - 150, 1.5, "#9a8f76")}
     <text x="230" y="${H - 132}" font-family="Poppins SemiBold" font-size="34" fill="#9a8f76">renuehome.com</text>` +
    `</svg>`;
}

function L_question(t) {
  const W = 1080, H = 1080;
  const chip = (x, y, w, label, circled) =>
    `<rect x="${x}" y="${y}" width="${w}" height="92" rx="46" fill="none" stroke="${t.ink}" stroke-width="4"/>
     <text x="${x + w / 2}" y="${y + 60}" text-anchor="middle" font-family="Poppins SemiBold" font-size="40" fill="${t.ink}">${esc(label)}</text>
     ${circled ? `<ellipse cx="${x + w / 2}" cy="${y + 46}" rx="${w / 2 + 16}" ry="62" fill="none" stroke="${t.accent === t.ink ? "#E1604A" : t.accent}" stroke-width="5" transform="rotate(-4 ${x + w / 2} ${y + 46})"/>` : ""}`;
  return frame(W, H, t.bg) +
    `<text x="84" y="250" font-family="Poppins ExtraBold" font-size="92" fill="${t.ink}">${esc(t.headline)}</text>
     <text x="80" y="370" font-family="Anton" font-size="104" fill="${t.ink}">${esc(t.subhead)}</text>
     ${chip(84, 470, 380, t.options[0], true)}
     ${chip(516, 470, 480, t.options[1], false)}
     ${chip(84, 600, 420, t.options[2], false)}
     ${chip(556, 600, 360, t.options[3], false)}
     <text x="84" y="820" font-family="Caveat" font-size="78" fill="${t.ink}">${esc(t.foot)}</text>
     <path d="M 840 800 q 36 28 8 78" stroke="${t.accent === t.ink ? "#E1604A" : t.accent}" stroke-width="6" fill="none" stroke-linecap="round"/>
     <path d="M 838 858 l 10 24 l 22 -14" stroke="${t.accent === t.ink ? "#E1604A" : t.accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     ${mark(W - 96, H - 96, 1.3, t.ink)}` +
    `</svg>`;
}

function L_checklist(t) {
  const W = 1080, H = 1350;
  const tl = wrap(t.title, 22).map((l, i) => `<tspan x="90" dy="${i ? 84 : 0}">${esc(l)}</tspan>`).join("");
  const titleLines = wrap(t.title, 22).length;
  let y0 = 200 + titleLines * 84 + 110;
  const items = t.items.map((it, i) => {
    const y = y0 + i * 165;
    return `<rect x="86" y="${y - 64}" width="84" height="84" rx="16" fill="none" stroke="#cdd6da" stroke-width="4"/>
            ${handCheck(104, y - 14, 60, t.accent)}
            <text x="206" y="${y}" font-family="Poppins SemiBold" font-size="58" fill="${t.ink}">${esc(it)}</text>`;
  }).join("");
  return frame(W, H, t.bg) +
    `<text x="90" y="200" font-family="Poppins ExtraBold" font-size="76" fill="${t.ink}">${tl}</text>
     ${roughUnderline(94, 720, 200 + (titleLines - 1) * 84 + 26, t.accent, 8)}
     ${items}
     ${star(W - 150, 150, 30, t.accent)}
     ${mark(140, H - 140, 1.4, t.accent)}
     <text x="220" y="${H - 122}" font-family="Poppins SemiBold" font-size="34" fill="${t.ink}" opacity="0.75">renuehome.com</text>` +
    `</svg>`;
}

function L_marker(t) {
  const W = 1080, H = 1080, FS = 106;
  const lineH = 150, y0 = 430;
  let hl = "";
  const lines = t.lines.map((l, i) => {
    const y = y0 + i * lineH;
    const x = 80 + (rnd(i + 7) * 22 - 11); // tiny horizontal jitter
    if (t.highlight && l.trim() === t.highlight.trim()) {
      const w = l.length * 53;
      hl = highlightBehind(x - 12, y - 96, w, 124, t.accent, -1.5);
    }
    return `<text x="${x}" y="${y}" font-family="Permanent Marker" font-size="${FS}" fill="${t.ink}">${esc(l)}</text>`;
  }).join("");
  return frame(W, H, t.bg) +
    `${hl}${lines}
     ${footerLeft(H, t.ink, t.accent)}` +
    `</svg>`;
}

function L_myth(t) {
  const W = 1080, H = 1080;
  const my = wrap(t.myth, 26).map((l, i) => `<tspan x="84" dy="${i ? 56 : 0}">${esc(l)}</tspan>`).join("");
  const myN = wrap(t.myth, 26).length;
  const tr = wrap(t.truth, 24).map((l, i) => `<tspan x="148" dy="${i ? 64 : 0}">${esc(l)}</tspan>`).join("");
  const trY = 470 + myN * 56;
  return frame(W, H, t.bg) +
    `<text x="84" y="200" font-family="Anton" font-size="60" fill="#E1604A" letter-spacing="3">MYTH</text>
     <text x="84" y="280" font-family="Poppins" font-size="46" fill="${t.ink}" opacity="0.8">${my}</text>
     <line x1="84" y1="${360 + (myN - 1) * 56}" x2="996" y2="${360 + (myN - 1) * 56}" stroke="${t.ink}" stroke-width="2" opacity="0.25"/>
     <text x="84" y="${trY}" font-family="Anton" font-size="60" fill="${t.accent}" letter-spacing="3">TRUTH</text>
     ${handCheck(770, trY - 40, 70, t.accent)}
     <text x="148" y="${trY + 100}" font-family="Poppins SemiBold" font-size="56" fill="${t.ink}">${tr}</text>
     ${footerLeft(H, t.ink, t.accent)}` +
    `</svg>`;
}

function L_realtalk(t) {
  const W = 1080, H = 1080;
  const lines = wrap(t.text, 22);
  const body = lines.map((l, i) => `<tspan x="96" dy="${i ? 86 : 0}">${esc(l)}</tspan>`).join("");
  return frame(W, H, t.bg) +
    `<text x="96" y="200" font-family="Anton" font-size="120" fill="${t.accent}" opacity="0.25">&#8220;</text>
     <text x="96" y="360" font-family="Poppins SemiBold" font-size="66" fill="${t.ink}">${body}</text>
     <text x="96" y="${360 + lines.length * 86 + 90}" font-family="Caveat" font-size="64" fill="${t.accent}">${esc(t.sign)}</text>
     ${mark(W - 96, H - 96, 1.3, t.accent)}` +
    `</svg>`;
}

const LAYOUTS = { stat: L_stat, note: L_note, question: L_question, checklist: L_checklist, marker: L_marker, myth: L_myth, realtalk: L_realtalk };

async function render(t) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const fn = LAYOUTS[t.layout];
  if (!fn) throw new Error("unknown layout " + t.layout);
  const file = `${t.slug}.png`;
  await sharp(Buffer.from(fn(t))).png().toFile(join(OUT_DIR, file));
  return file;
}

async function main() {
  const themes = JSON.parse(readFileSync(join(__dir, "themes.json"), "utf8"));
  const only = process.argv[2];
  const calendar = [];
  for (const t of themes) {
    if (only && t.slug !== only) continue;
    const file = await render(t);
    calendar.push({ id: t.slug, layout: t.layout, image_path: `/assets/social-posts/${file}`,
      image_url: `${SITE}/assets/social-posts/${file}`, caption: t.caption, alt: t.alt, status: "pending" });
    console.log("rendered", t.layout.padEnd(10), file);
  }
  if (!only) {
    writeFileSync(join(__dir, "content-calendar.json"), JSON.stringify(calendar, null, 2) + "\n");
    console.log("wrote content-calendar.json with", calendar.length, "posts");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
