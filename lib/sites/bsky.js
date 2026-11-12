import { fetchJson } from "../httpFetch.js";
import { buildUnfurlResponse } from "../previewFormat.js";

export const BSKY_HOSTS = new Set(["bsky.app"]);

const BSKY_API_HOSTS = new Set(["public.api.bsky.app"]);
const POST_PATH_RE = /^\/profile\/([^/]+)\/post\/([^/]+)/;

/**
 * Resolves a handle to its DID via the AT Protocol public read API. Not needed when the URL
 * already carries a did:plc:... actor.
 * @param {string} handle
 * @returns {Promise<string|null>}
 */
async function resolveHandleToDid(handle) {
  try {
    const { response, data } = await fetchJson(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { allowedHosts: BSKY_API_HOSTS },
    );
    if (!response.ok) return null;
    return data?.did || null;
  } catch {
    return null;
  }
}

/** @param {object} post @returns {string|null} */
function extractImage(post) {
  return post.embed?.images?.[0]?.fullsize || post.embed?.images?.[0]?.thumb || post.embed?.external?.thumb || null;
}

/**
 * Resolves a bsky.app post URL via the AT Protocol public read-only API
 * (public.api.bsky.app) - no auth required for public posts.
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object}>}
 */
export async function unfurlBsky(parsedUrl, requestingService) {
  const match = parsedUrl.pathname.match(POST_PATH_RE);
  if (!match) {
    return { status: 400, body: { ok: false, error: "Not a Bluesky post URL" } };
  }
  const [, actor, rkey] = match;

  const did = actor.startsWith("did:") ? actor : await resolveHandleToDid(actor);
  if (!did) {
    return { status: 502, body: { ok: false, error: "Could not resolve Bluesky handle" } };
  }

  const atUri = `at://${did}/app.bsky.feed.post/${rkey}`;
  const threadUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`;

  const { response, data } = await fetchJson(threadUrl, { allowedHosts: BSKY_API_HOSTS });
  if (!response.ok) {
    return { status: 502, body: { ok: false, error: `Bluesky API returned ${response.status}` } };
  }

  const post = data?.thread?.post;
  if (!post) {
    return { status: 502, body: { ok: false, error: "Could not parse Bluesky post" } };
  }

  return {
    status: 200,
    body: buildUnfurlResponse({
      site: "bsky",
      siteName: "Bluesky",
      url: parsedUrl.toString(),
      title: post.author?.displayName || post.author?.handle || null,
      description: post.record?.text || null,
      image: extractImage(post),
      author: post.author?.handle ? `@${post.author.handle}` : null,
      type: "article",
      requestingService,
    }),
  };
}
