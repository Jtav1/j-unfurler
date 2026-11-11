import { fetchWithTimeout, BROWSER_HEADERS } from "../httpFetch.js";
import { buildUnfurlResponse } from "../previewFormat.js";

export const REDDIT_HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "np.reddit.com", "redd.it"]);

/**
 * Resolves redirects (redd.it short links, AMP variants) to get the canonical permalink.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function resolveCanonicalUrl(url) {
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD", headers: BROWSER_HEADERS });
    return response.url || url;
  } catch {
    return url;
  }
}

/** @param {object} post @returns {string|null} */
function extractImage(post) {
  if (post.preview?.images?.[0]?.source?.url) {
    return post.preview.images[0].source.url.replace(/&amp;/g, "&");
  }
  if (typeof post.thumbnail === "string" && post.thumbnail.startsWith("http")) return post.thumbnail;
  return null;
}

/**
 * Fetches a Reddit post via its public .json API (no auth needed for public posts).
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object}>}
 */
export async function unfurlReddit(parsedUrl, requestingService) {
  const canonicalUrl = await resolveCanonicalUrl(parsedUrl.toString());
  const jsonUrl = `${canonicalUrl.split("?")[0].replace(/\/+$/, "")}.json`;

  const response = await fetchWithTimeout(jsonUrl, { headers: BROWSER_HEADERS });
  if (!response.ok) {
    return { status: 502, body: { ok: false, error: `Reddit returned ${response.status}` } };
  }

  const data = await response.json();
  const post = data?.[0]?.data?.children?.[0]?.data;
  if (!post) {
    return { status: 502, body: { ok: false, error: "Could not parse Reddit post" } };
  }

  return {
    status: 200,
    body: buildUnfurlResponse({
      site: "reddit",
      siteName: "Reddit",
      url: parsedUrl.toString(),
      title: post.title,
      description: post.selftext || null,
      image: extractImage(post),
      author: post.author ? `u/${post.author}` : null,
      type: "article",
      requestingService,
    }),
  };
}
