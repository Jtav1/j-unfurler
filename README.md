# unfurler

Standalone, high-speed link unfurler API. Accepts a URL and returns JSON fields (`title`, `description`, `image`, etc.) that chat apps and websites can use to render a link preview embed.

## Deployment: run behind a reverse proxy

This service has no built-in TLS. It's meant to be reached through a reverse proxy (Nginx Proxy Manager, Caddy, Traefik, etc.) that terminates TLS and sits in front of it. Bind it to localhost/an internal network and let the proxy handle the public-facing port.

It is safe to expose publicly through that proxy — there is no auth, but the service enforces its own abuse controls (below).

## Public exposure: what is enforced

**Outbound fetch safety** (`lib/httpFetch.js`, `lib/validateUrl.js`)

- Only `http(s)` URLs with no credentials, no explicit port, and ≤ 2048 chars are accepted.
- Each route only fetches its site's allowlisted hostnames. Redirects are followed manually (max 5 hops) and **every hop is re-checked against the allowlist** — an open redirector on an allowed host can't be used to reach anything else.
- DNS results are filtered at connect time: loopback, link-local (cloud metadata), RFC1918, CGNAT, multicast, ULA, and NAT64 ranges are refused, so a host that resolves to an internal address is never contacted. IP-literal hosts are checked the same way.
- Response bodies are capped at 1 MB and must match the expected content type (JSON for API-backed sites, HTML for scrapes). OG scraping only looks at `<head>` with a linear-time parser.
- `image` URLs in responses are only ever absolute `http(s)` URLs.

**Abuse controls** (`lib/rateLimit.js`, `lib/unfurlRunner.js`, `lib/cache.js`)

- Per-client-IP rate limit on `/api/*`: `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_SECONDS` (default 30/min), returning `429` with standard `RateLimit-*` headers. `/health` and `/` are exempt.
- The client IP is taken from `X-Forwarded-For` per Express's `trust proxy`, set from `TRUST_PROXY` (default `1` = Nginx Proxy Manager directly in front). If another hop sits between NPM and this container, set `TRUST_PROXY=2` (or a CIDR). Never set it to `true` — that trusts a spoofed header from anyone.
- A global cap of `MAX_CONCURRENT_UNFURLS` (default 32) simultaneous outbound unfurls; beyond it callers get `503`.
- Response cache: successful unfurls are cached for `CACHE_TTL_SECONDS` (default 600) and structured failures (login walls, upstream 4xx/5xx) for `CACHE_ERROR_TTL_SECONDS` (default 60). Responses carry `X-Cache: HIT|MISS`. This both speeds up repeated links and keeps our footprint on upstream sites low enough to avoid being rate-limited by them.
- Set `REDIS_URL` to back the cache and rate-limit counters with Redis (shared across replicas); leave it empty for in-process memory. A Redis outage degrades to "no cache, no limit" rather than failing requests.
- CORS headers are only sent for origins listed in `CORS_ORIGINS`; by default none are sent, so the API can't be called from arbitrary websites' visitors.

## Setup

```bash
cp .env.example .env   # first time only
npm install
npm run dev    # node --watch index.js
npm start       # node index.js
```

Default port: `3003` (override via `PORT` in `.env`). All tuning knobs are documented in `.env.example`.

### Docker

```bash
docker compose up --build -d
```

`docker-compose.yml` runs the service (bound to `127.0.0.1:3003`, for the reverse proxy) alongside a `redis:8-alpine` container and sets `REDIS_URL` for you. Images are built and pushed to GHCR by `.github/workflows/docker.yml` on pushes to `main` and `v*` tags.

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

`GET /` lists currently enabled routes. `GET /health` reports the toggle state for all sites, the cache backend (`memory`/`redis`), and redis connection status.

### Reliability by site

- **Reddit, TikTok, Bluesky** use the site's own public API (no auth/token needed for public content) and should be reliable in normal operation. Reddit's `.json` endpoint has been observed 403-ing from some datacenter/cloud IP ranges even with a browser-like `User-Agent` — if it fails consistently from your host, that's Reddit blocking the network, not a bug in this service.
- **Twitter/X** has had no stable public read API since 2023. This uses the unofficial syndication CDN that backs Twitter's own public embed widget (the same technique used by projects like fxtwitter/vxtwitter) — it's not an auth bypass, but it's undocumented and can change or rate-limit without notice.
- **Instagram and Facebook** have no viable unauthenticated API (their oEmbed endpoints require Meta app review/a token), and their post pages are aggressively login-gated. These routes scrape whatever OpenGraph tags survive in the logged-out HTML and will frequently return `ok: false` — that's the expected, honest result for a logged-out request, not something to "fix" without adding real Meta API credentials.

## Requesting-service detection

Routes try to detect which bot is calling via the request's `User-Agent` header (`req.requestingService`, one of `"discord"`, `"fluxer"`, or `"unknown"`), matched by a case-insensitive substring (`discord` / `fluxer`). This is best-effort: a caller's HTTP client must identify itself in its `User-Agent` (e.g. `dixcord-bot-discord/1.0`) for this to resolve — a bare axios/fetch default UA will detect as `"unknown"`.

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
