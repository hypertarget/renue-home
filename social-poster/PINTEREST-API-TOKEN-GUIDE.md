# Pinterest API Token Guide (Renue Home)

Goal: the two values the poster needs to auto-pin: `PINTEREST_TOKEN` and `PINTEREST_BOARD_ID`.
The poster already supports Pinterest; it just stays dormant until these two secrets exist.

> Pinterest needs a **business account**. The Renue Home profile is already set up; if it's a
> personal account, convert it (free) in Pinterest settings before starting.

## Part 1 — make a board to pin into
In Pinterest (logged in as Renue Home), create a board, e.g. **"Home Improvement Tips"** or
**"Smart Homeowner Tips."** Public. This is where the auto-pins land. (You can make a few boards
later and we can rotate, but one is enough to start.)

## Part 2 — create the developer app
1. Go to **developers.pinterest.com** and log in with the Renue Home account.
2. Open the **App** area (or "Connect apps") and **create a new app** for Renue Home. Accept the
   developer terms. Note the **App ID** and **App secret** (keep the secret in your password
   manager, the poster does not need it unless we add auto-refresh later).
3. Under the app, set the scopes / permissions to include **`boards:read`**, **`pins:read`**, and
   **`pins:write`**.

## Part 3 — generate the access token
In the developer portal, on your app, use **"Generate access token"** (the portal walks you
through approving your own account). Select the scopes above. Copy the token.
This is `PINTEREST_TOKEN`.

## Part 4 — get the board id
Easiest way: with that token, open a browser tab to this (it returns JSON) or use any REST tool:
```
GET https://api.pinterest.com/v5/boards
Authorization: Bearer <your token>
```
Find your board in the list and copy its **`id`**. That's `PINTEREST_BOARD_ID`.
(If you'd rather, tell me when you have the token and I'll fetch the board id for you, the same
way we pulled your Instagram id.)

## Part 5 — add the two secrets
Repo **Settings → Secrets and variables → Actions → New repository secret**:
- `PINTEREST_TOKEN` = the access token
- `PINTEREST_BOARD_ID` = the board id

That's it. On the next scheduled run (or a manual "Run workflow" on **social-post**), each post
also goes out as a tall pin linking back to renuehome.com.

## Heads up on expiry
Pinterest access tokens last about **30 days** (Meta's Page token does not expire, Pinterest's
does). So once a month either regenerate the token and update the secret, or tell me and I'll
add an auto-refresh step (that needs the App ID, App secret, and refresh token stored as
secrets). For now, simple is fine, just know a pin failure after ~a month means "refresh the
token."
