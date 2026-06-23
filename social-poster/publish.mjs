#!/usr/bin/env node
// Publishes the next post in content-calendar.json to the Renue Home Facebook Page, Instagram
// (Meta Graph API) and Pinterest (Pinterest API v5). Evergreen rotation via a cursor in
// state.json. Each platform is independent and only fires if its secrets are present, so you
// can run FB+IG now and add Pinterest later with zero code changes.
//
// Env (GitHub Actions secrets, never commit):
//   META_PAGE_TOKEN / META_PAGE_ID / IG_USER_ID    Facebook + Instagram
//   PINTEREST_TOKEN / PINTEREST_BOARD_ID           Pinterest (optional)
//   GRAPH_VERSION   optional, defaults to v21.0
//
// Flags: --dry-run | --platform=fb|ig|pin|all (default all) | --id=<calendar id>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION || "v21.0"}`;
const TOKEN = process.env.META_PAGE_TOKEN || "";
const PAGE_ID = process.env.META_PAGE_ID || "";
const IG_ID = process.env.IG_USER_ID || "";
const PIN_TOKEN = process.env.PINTEREST_TOKEN || "";
const PIN_BOARD = process.env.PINTEREST_BOARD_ID || "";

const args = process.argv.slice(2);
const val = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : null; };
const platform = val("platform") || "all";
const want = (p) => platform === "all" || platform === p || (platform === "both" && (p === "fb" || p === "ig"));
const onlyId = val("id");
const dryRun = args.includes("--dry-run") || (!TOKEN && !PIN_TOKEN);

const calPath = join(__dir, "content-calendar.json");
const statePath = join(__dir, "state.json");
const calendar = JSON.parse(readFileSync(calPath, "utf8"));
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { cursor: 0 };
const post = onlyId ? calendar.find((p) => p.id === onlyId) : calendar[state.cursor % calendar.length];
if (!post) { console.error("No post found", onlyId || state.cursor); process.exit(1); }
const pinUrl = post.pin_image_url || post.image_url;

async function gpost(url, body) {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(body) });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`${res.status} ${JSON.stringify(json.error || json)}`);
  return json;
}
async function postFacebook() {
  const r = await gpost(`${GRAPH}/${PAGE_ID}/photos`, { url: post.image_url, caption: post.caption, access_token: TOKEN });
  return r.post_id || r.id;
}
async function postInstagram() {
  const c = await gpost(`${GRAPH}/${IG_ID}/media`, { image_url: post.image_url, caption: post.caption, access_token: TOKEN });
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${GRAPH}/${IG_ID}/media_publish`, { method: "POST", body: new URLSearchParams({ creation_id: c.id, access_token: TOKEN }) });
    const j = await res.json();
    if (res.ok && !j.error) return j.id;
    if (j.error && j.error.code === 9007) { await new Promise((s) => setTimeout(s, 4000)); continue; }
    throw new Error(`IG publish: ${JSON.stringify(j.error || j)}`);
  }
  throw new Error("IG container not ready after retries");
}
async function postPinterest() {
  const title = (post.alt || "Renue Home").slice(0, 95);
  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { Authorization: `Bearer ${PIN_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ board_id: PIN_BOARD, title, description: post.caption, link: "https://renuehome.com", media_source: { source_type: "image_url", url: pinUrl } }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Pinterest: ${res.status} ${JSON.stringify(j)}`);
  return j.id;
}

(async () => {
  console.log(`Post: ${post.id}\nImage: ${post.image_url}\nCaption:\n${post.caption}\n`);
  if (dryRun) { console.log("[DRY RUN] no secrets set or --dry-run; nothing published, cursor not advanced."); return; }
  const results = {};
  if (TOKEN && PAGE_ID && want("fb")) results.facebook = await postFacebook();
  if (TOKEN && IG_ID && want("ig")) results.instagram = await postInstagram();
  if (PIN_TOKEN && PIN_BOARD && want("pin")) results.pinterest = await postPinterest();
  console.log("Published:", JSON.stringify(results));
  if (!onlyId && Object.keys(results).length) {
    state.cursor = (state.cursor % calendar.length) + 1;
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    console.log("Advanced cursor to", state.cursor);
  }
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
