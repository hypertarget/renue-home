#!/usr/bin/env node
// Publishes the next post in content-calendar.json to the Renue Home Facebook Page
// and/or Instagram via the Meta Graph API. Evergreen rotation via a cursor in state.json.
//
// Env (set as GitHub Actions secrets — never commit):
//   META_PAGE_TOKEN   long-lived Page access token (from the token guide)
//   META_PAGE_ID      Facebook Page numeric id
//   IG_USER_ID        Instagram Business account id (instagram_business_account.id)
//   GRAPH_VERSION     optional, defaults to v21.0
//
// Flags:
//   --dry-run         print what would post; do not call the API or advance the cursor
//   --platform=fb|ig|both   default both
//   --id=<slug>       post a specific calendar entry instead of the next one
//
// With no token present it automatically runs in dry-run mode, so it's safe to run
// before go-live.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION || "v21.0"}`;
const TOKEN = process.env.META_PAGE_TOKEN || "";
const PAGE_ID = process.env.META_PAGE_ID || "";
const IG_ID = process.env.IG_USER_ID || "";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : null; };
const platform = val("platform") || "both";
const onlyId = val("id");
const dryRun = has("--dry-run") || !TOKEN;

const calPath = join(__dir, "content-calendar.json");
const statePath = join(__dir, "state.json");
const calendar = JSON.parse(readFileSync(calPath, "utf8"));
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { cursor: 0 };

const post = onlyId
  ? calendar.find((p) => p.id === onlyId)
  : calendar[state.cursor % calendar.length];
if (!post) { console.error("No post found", onlyId || state.cursor); process.exit(1); }

async function gpost(url, body) {
  const res = await fetch(url, { method: "POST", body: new URLSearchParams(body) });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`${res.status} ${JSON.stringify(json.error || json)}`);
  return json;
}

async function postFacebook() {
  // Page photo post with a caption + link in the text.
  const r = await gpost(`${GRAPH}/${PAGE_ID}/photos`, {
    url: post.image_url,
    caption: post.caption,
    access_token: TOKEN,
  });
  return r.post_id || r.id;
}

async function postInstagram() {
  // 1) create a media container, 2) publish it.
  const c = await gpost(`${GRAPH}/${IG_ID}/media`, {
    image_url: post.image_url,
    caption: post.caption,
    access_token: TOKEN,
  });
  // image containers are usually ready immediately; small retry just in case.
  for (let i = 0; i < 5; i++) {
    const pub = await fetch(`${GRAPH}/${IG_ID}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: c.id, access_token: TOKEN }),
    });
    const j = await pub.json();
    if (pub.ok && !j.error) return j.id;
    if (j.error && j.error.code === 9007) { await new Promise((s) => setTimeout(s, 4000)); continue; }
    throw new Error(`IG publish: ${JSON.stringify(j.error || j)}`);
  }
  throw new Error("IG container not ready after retries");
}

(async () => {
  console.log(`Post: ${post.id}`);
  console.log(`Image: ${post.image_url}`);
  console.log(`Caption:\n${post.caption}\n`);
  if (dryRun) {
    console.log(`[DRY RUN]${TOKEN ? "" : " (no META_PAGE_TOKEN set)"} — nothing published, cursor not advanced.`);
    return;
  }
  const results = {};
  if (platform === "fb" || platform === "both") results.facebook = await postFacebook();
  if (platform === "ig" || platform === "both") results.instagram = await postInstagram();
  console.log("Published:", JSON.stringify(results));
  if (!onlyId) {
    state.cursor = (state.cursor % calendar.length) + 1;
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    console.log("Advanced cursor to", state.cursor);
  }
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
