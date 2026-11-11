# unfurler code standards

Short on purpose — this is a small, single-package service. Match neighboring files over anything written here if the two disagree. No ESLint/Prettier config exists; enforced by review.

## Format

ESM (`"type": "module"`), explicit `.js` extensions on relative imports, double quotes, semicolons, 2-space indent, trailing commas in multiline literals. Named `function` declarations for exported helpers; arrow functions fine for Express handlers.

## Layout — where new code goes

- `routes/<site>.js` — **thin**: extract/validate the url, call the matching `lib/sites/<site>.js` function, map its `{status, body}` to `res`. No fetch/parse logic here.
- `lib/sites/<site>.js` — one file per site. Exports a `<SITE>_HOSTS` Set and an `async unfurlX(parsedUrl, requestingService)` that returns `{ status, body }` and never throws for *expected* failures (bad response, unparsable payload, login wall) — only a genuine bug should reach the route's `try/catch`.
- `lib/siteRegistry.js` — add new sites here too, so the generic `/api/unfurl` dispatch route picks them up automatically.
- `lib/*.js` — shared helpers only (`httpFetch.js`, `ogScrape.js`, `previewFormat.js`, `validateUrl.js`, `requestingService.js`). Don't duplicate one of these into a site file.

## Response envelope

Success: `buildUnfurlResponse({...})` from `lib/previewFormat.js` → `{ ok: true, site, requestingService, url, title, description, image, siteName, author, type }`. Failure: `{ ok: false, error: "human-readable message" }`. Never `{ error, message }` or a bare `{ error }`.

## Error handling

- A site module returns `{ status: 4xx/5xx, body: { ok:false, error } }` for anything the upstream site itself signals (non-2xx, missing fields, login gate) — this is the *normal* path for Instagram/Facebook, not an exceptional one.
- Route handlers still wrap the call in `try/catch` for unexpected errors → `console.error("<METHOD path> error:", err)` then `500`.
- Don't fabricate a field the upstream response didn't provide — return `null`, not a placeholder string.

## JSDoc / comments

`/** */` block above every exported function: one-line description, `@param`, `@returns`. Add a one-line "why" comment only when a technique is non-obvious (an unofficial endpoint, a quirky response shape, a field that's gone missing from an API over time) — no multi-line prose blocks.

## Dependencies

No HTML-parsing library is used — `lib/ogScrape.js` extracts `<meta>` OpenGraph tags with regex, matching `webapi/services/facebookMarketplace.js`'s existing convention. Don't add `cheerio`/`jsdom`/etc. without discussing it first; for anything else, prefer an established library over hand-rolling.

## Guidance for LLM-generated changes

- **Adding a new site** = adding one `lib/sites/<site>.js` (hosts + unfurl fn) + one `routes/<site>.js` (copy an existing thin route, e.g. `routes/bsky.js`) + one entry in `lib/siteRegistry.js` + one entry in `config.js`'s `SITES` map + one `ENABLE_<SITE>` toggle in `.env.example` + a mount line in `index.js`. Do all six; a partial wire-up (e.g. registry entry with no route) is a bug, not a valid intermediate state.
- Before implementing a new site's fetch logic, identify which of three tiers it falls into and say so in a comment: **official public API** (reddit/tiktok/bsky-style — no auth), **documented-but-unofficial endpoint** (twitter-style — note it can break without notice), or **best-effort OG scrape** (instagram/facebook-style — expect frequent `ok:false`). Don't silently assume a scrape will be reliable.
- Never invent an API shape, field name, or endpoint you haven't verified — check the actual response (via a real request, not memory) before writing the parser. Upstream API shapes drift (see TikTok oEmbed no longer always including `title`); write code tolerant of missing optional fields rather than assuming the first response you saw is the stable shape.
- Keep `PREVIEW_LIMITS` in `lib/previewFormat.js` as the one place truncation lengths live — don't hardcode a length inline in a site module.
- Don't add auth, caching, or a database to this service without being asked — it is deliberately a stateless, no-auth, reverse-proxied unfurl-only service (see root `README.md`).
