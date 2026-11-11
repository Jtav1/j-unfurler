# unfurler

Standalone, high-speed link unfurler API. Accepts a URL and returns JSON fields (`title`, `description`, `image`, etc.) that chat apps and websites can use to render a link preview embed.

## Deployment note: run behind a reverse proxy

This service has no built-in TLS, and no auth/rate-limiting of its own. It's meant to be reached through a reverse proxy (nginx, Caddy, Traefik, etc.) that terminates TLS and sits in front of it — do not expose it directly to the internet. Bind it to localhost/an internal network and let the proxy handle the public-facing port.

## Setup

```bash
cp .env.example .env   # first time only
npm install
npm run dev    # node --watch index.js
npm start       # node index.js
```

Default port: `3003` (override via `PORT` in `.env`).

## Routes

Each site has its own route, enabled by default, plus one generic dispatch route that matches any URL to the right site. Set the matching `.env` toggle to `false` to disable a site at startup — a disabled site's dedicated route 404s, and the generic route returns `{ "ok": false, "error": "<site> unfurler is disabled" }` for a matching URL instead of silently succeeding.

| Site | Route | Toggle | Technique |
| --- | --- | --- | --- |
| *(any supported site)* | `POST /api/unfurl` | n/a | Matches the url's hostname to one of the routes below |
| Reddit | `POST /api/unfurl/reddit` | `ENABLE_REDDIT` | Public `.json` API |
| TikTok | `POST /api/unfurl/tiktok` | `ENABLE_TIKTOK` | Public oEmbed API |
| Bluesky | `POST /api/unfurl/bsky` | `ENABLE_BSKY` | AT Protocol public read API |
| Twitter / X | `POST /api/unfurl/twitter` | `ENABLE_TWITTER` | Unofficial syndication CDN (best-effort) |
| Instagram | `POST /api/unfurl/instagram` | `ENABLE_INSTAGRAM` | OG-tag scrape (best-effort) |
| Facebook | `POST /api/unfurl/facebook` | `ENABLE_FACEBOOK` | OG-tag scrape (best-effort) |

Each route takes a JSON body `{ "url": "<link>" }`. The per-site routes validate the URL's hostname against that site's allowed domains (400 if it doesn't match); the generic `/api/unfurl` route instead looks up the hostname across all sites and 400s with `"No unfurler supports this url's domain"` if none match. Either way, the matched handler fetches/parses the target and returns an unfurl payload. Failures (network error, unparsable response, login-gated page) return `{ "ok": false, "error": "..." }` with an appropriate status — never a thrown exception.

Use the per-site routes when the caller already knows which site a link belongs to; use the generic route when it doesn't (e.g. a bot scanning arbitrary chat messages for links).

`GET /` lists currently enabled routes. `GET /health` reports the toggle state for all sites.

### Reliability by site

- **Reddit, TikTok, Bluesky** use the site's own public API (no auth/token needed for public content) and should be reliable in normal operation. Reddit's `.json` endpoint has been observed 403-ing from some datacenter/cloud IP ranges even with a browser-like `User-Agent` — if it fails consistently from your host, that's Reddit blocking the network, not a bug in this service.
- **Twitter/X** has had no stable public read API since 2023. This uses the unofficial syndication CDN that backs Twitter's own public embed widget (the same technique used by projects like fxtwitter/vxtwitter) — it's not an auth bypass, but it's undocumented and can change or rate-limit without notice.
- **Instagram and Facebook** have no viable unauthenticated API (their oEmbed endpoints require Meta app review/a token), and their post pages are aggressively login-gated. These routes scrape whatever OpenGraph tags survive in the logged-out HTML and will frequently return `ok: false` — that's the expected, honest result for a logged-out request, not something to "fix" without adding real Meta API credentials.

## Requesting-service detection

Routes try to detect which service is making a request by the request's `User-Agent` header (`req.requestingService`, one of `"discord"`, `"fluxer"`, or `"unknown"`), matched by a case-insensitive substring (`discord` / `fluxer`). This is best-effort: a caller's HTTP client must identify itself in its `User-Agent` for this to resolve — a bare axios/fetch default UA will detect as `"unknown"`.

The detected service is currently echoed back as metadata only (`requestingService` field in the response). Preview field lengths are the same for every caller regardless of detection — Discord's and `@fluxerjs/builders`' embed limits are identical (title 256 / description 4096 / fields 25 / field name 256 / field value 1024 / footer 2048 / author 256 / total 6000), so there's no real per-platform divergence to apply. Instead, all responses use one shorter preview-length budget (see `lib/previewFormat.js`) since a link-preview card never needs the full embed description budget either platform allows.

## Response shape

```json
{
  "ok": true,
  "site": "reddit",
  "requestingService": "discord",
  "url": "https://www.reddit.com/r/aww/comments/.../",
  "title": "...",
  "description": "...",
  "image": "https://...",
  "siteName": "Reddit",
  "author": "u/...",
  "type": "article"
}
```

On failure:

```json
{ "ok": false, "error": "human-readable message" }
```
