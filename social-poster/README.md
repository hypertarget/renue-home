# Renue Home — Social Auto-Poster + Generator

Posts branded cards to **Facebook**, **Instagram**, and **Pinterest** on a schedule, and
**generates fresh cards by itself every week** from a vetted content bank. Runs entirely as
GitHub Actions in this repo. No server.

Two Actions:
- **social-post** (Mon/Wed/Fri 9am CT) publishes the next card in the rotation to every platform
  whose secrets are set. Safe dry-run until `META_PAGE_TOKEN` (or `PINTEREST_TOKEN`) exists.
- **social-generate** (Sun 8am CT) composes new cards from the bank, renders them, and adds them
  to the rotation. No secrets needed, fully autonomous.

## How content stays fresh (and honest)
`content-bank.json` holds the source material: 7 stat cards (each with a **real, cited source**)
and 18 evergreen angles (tips, questions, checklists, myths, real-talk). `compose.mjs` pulls the
next unused items, renders each with a **seeded palette** so a recycled item looks different next
cycle, and never repeats until the whole bank has been used. There's **no LLM at runtime**, so
nothing gets invented. To add new material, edit `content-bank.json`.

**Copy rule (baked in):** no em dashes, no colons, no semicolons. Commas and periods only. Real
cited stats over fluff. Emoji live in captions, never in the card art (they tofu in these fonts).

## Files
- `content-bank.json` — the source stats + angles. Edit this to add content.
- `lib.mjs` — the rendering engine (layouts, fonts, palettes, square + Pinterest-pin render).
- `compose.mjs` — `node compose.mjs [count] [--fresh]` builds new cards into the rotation.
- `publish.mjs` — `node publish.mjs [--dry-run] [--platform=fb|ig|pin|all] [--id=…]` posts next.
- `content-calendar.json` — the live rotation (auto-managed).
- `state.json` / `bank-state.json` — rotation cursor / bank usage (auto-managed).
- `fonts/` — the TTFs (Anton, Caveat, Permanent Marker, Poppins) so the Action can render.
- `render.mjs` + `themes.json` — legacy manual renderer; `compose.mjs` is the path now.

## Secrets (repo → Settings → Secrets and variables → Actions)
- Facebook + Instagram: `META_PAGE_TOKEN`, `META_PAGE_ID`, `IG_USER_ID` (see `../META-API-TOKEN-GUIDE.md`)
- Pinterest (optional): `PINTEREST_TOKEN`, `PINTEREST_BOARD_ID` (see `PINTEREST-API-TOKEN-GUIDE.md`)

## Run / adjust
- Test a post: **Actions → social-post → Run workflow**. Generate now: **social-generate → Run**.
- Cadence: edit the `cron` lines in the two workflow files (UTC; 14:00 = 9am CDT, 13:00 = 8am CDT).
- One-off specific post: `node publish.mjs --id=<calendar id>`.

## Local re-render (optional, needs fonts)
`npm install` then put the TTFs from `fonts/` on the font path (`cp fonts/*.ttf ~/.fonts && fc-cache -f`),
then `node compose.mjs 3`.

## Move to the Hermes box later
Same scripts on a cron with the same env vars. Cloudflare Pages keeps hosting the images.
