import { fetchWithTimeout, BROWSER_HEADERS } from "../httpFetch.js";
import { buildUnfurlResponse } from "../previewFormat.js";

export const TWITTER_HOSTS = new Set(["twitter.com", "www.twitter.com", "x.com", "www.x.com", "mobile.twitter.com"]);

const STATUS_PATH_RE = /\/status(?:es)?\/(\d+)/;

/**
 * Computes the syndication CDN's client-side "token" param from the tweet id - a documented
 * public technique (used by e.g. fxtwitter/vxtwitter), not an auth bypass: the endpoint backs
 * Twitter's own public embed widget and needs no login.
 * @param {string} tweetId
 * @returns {string}
 */
function computeSyndicationToken(tweetId) {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

/** @param {object} data @returns {string|null} */
function extractImage(data) {
  return data.mediaDetails?.[0]?.media_url_https || data.photos?.[0]?.url || null;
}

/**
 * Twitter/X has had no stable public read API since 2023. This uses the syndication CDN that
 * backs Twitter's own public embed widget - unofficial, undocumented, and can break or
 * rate-limit without notice; always treat failures here as best-effort, not a bug to chase.
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object}>}
 */
export async function unfurlTwitter(parsedUrl, requestingService) {
  const match = parsedUrl.pathname.match(STATUS_PATH_RE);
  if (!match) {
    return { status: 400, body: { ok: false, error: "Not a tweet/post URL" } };
  }
  const tweetId = match[1];
  const token = computeSyndicationToken(tweetId);
  const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`;

  const response = await fetchWithTimeout(apiUrl, { headers: BROWSER_HEADERS });
  if (!response.ok) {
    return { status: 502, body: { ok: false, error: `Twitter/X syndication returned ${response.status}` } };
  }

  const data = await response.json();
  if (!data || data.__typename === "TweetTombstone") {
    return { status: 502, body: { ok: false, error: "Tweet unavailable (deleted, private, or age-restricted)" } };
  }

  return {
    status: 200,
    body: buildUnfurlResponse({
      site: "twitter",
      siteName: "X (Twitter)",
      url: parsedUrl.toString(),
      title: data.user?.name || null,
      description: data.text || null,
      image: extractImage(data),
      author: data.user?.screen_name ? `@${data.user.screen_name}` : null,
      type: "article",
      requestingService,
    }),
  };
}
