# Renue Home — Social Auto-Poster

Posts branded cards to the Renue Home **Facebook Page** + **Instagram** on a schedule
(Mon/Wed/Fri 9am CT) using the Meta Graph API. Runs as a **GitHub Action in this repo** — no
extra server. Generated images are committed to `assets/social-posts/` so Cloudflare Pages
serves them at a public URL (Instagram's API requires a public image URL).

It runs in **safe dry-run mode until you add the `META_PAGE_TOKEN` secret**, so nothing posts
until you flip it on.

## Files
- `themes.json` — the post templates (headline, subhead, caption, tag, alt).
- `render.mjs` — renders the 1080×1080 cards → `assets/social-posts/*.png` and rebuilds
  `content-calendar.json`. Run `npm install` then `node render.mjs`. (Needs `sharp`.)
- `content-calendar.json` — the ordered post list the publisher reads.
- `publish.mjs` — posts the next card to FB + IG; evergreen rotation via `state.json`. Pure
  Node (no deps). `node publish.mjs --dry-run` to preview.
- `state.json` — `{ "cursor": N }` rotation pointer (auto-committed by the Action).
- `../.github/workflows/social-post.yml` — the cron + the secrets wiring.

## Go-live (3 things, all yours)
1. **Create the Meta app + token** — follow `../META-API-TOKEN-GUIDE.md`. You'll end up with:
   App ID, **Page access token**, **Page ID**, **Instagram Business account id**.
2. **Confirm Instagram is a Business account linked to the Page** (the guide's prerequisite).
3. **Add three GitHub repo secrets** (repo → Settings → Secrets and variables → Actions → New
   repository secret):
   - `META_PAGE_TOKEN` = the long-lived Page token
   - `META_PAGE_ID` = the Page id
   - `IG_USER_ID` = the Instagram Business account id

Then test once: repo → **Actions → social-post → Run workflow** (leave dry-run off). It posts
the next card to both platforms. After that it runs automatically Mon/Wed/Fri.

## Adjusting
- **Cadence:** edit the `cron` in `social-post.yml` (it's UTC; 14:00 UTC = 9am CDT).
- **Content:** edit `themes.json`, then `node render.mjs` to rebuild the cards + calendar.
- **One-off / specific post:** `node publish.mjs --id=bathroom` or `--platform=ig`.

## Voice & design rules (don't look like AI slop)
- **No em dashes, no colons, no semicolons** in any card text or caption. Use commas and
  periods. These punctuation marks are the easiest "written by AI" tells.
- **Be perfect by being imperfect.** Vary the layouts, fonts, palettes and sizes so the feed
  never looks templated. Lowercase, a casual aside, a question, a doodle = good.
- **Real beats fluff.** Use actual stats and cite the source on the card. Emoji belong in the
  caption, not baked into the image (they tofu in these fonts).

## Notes / guardrails
- Captions use honest, advertising/matching-service framing (no outcome guarantees) to stay
  within FTC + Meta rules and match the site disclaimers. Keep new captions in that voice.
- The Page token is long-lived but can be invalidated (password change / manual revoke). If the
  Action starts failing on auth, regenerate the token (guide) and update the secret.
- **Moving to the Hermes box later:** it's just `node publish.mjs` on a cron with the same three
  env vars — drop this folder on Hermes and add a crontab line instead of the Action. The image
  hosting (Cloudflare Pages) stays the same.
