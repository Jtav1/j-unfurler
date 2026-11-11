import { fetchWithTimeout, BROWSER_HEADERS } from "../httpFetch.js";
import { extractOpenGraph } from "../ogScrape.js";
import { buildUnfurlResponse } from "../previewFormat.js";

export const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"]);

/**
 * Best-effort only: Facebook's oEmbed requires a Graph API app token, and post pages are
 * aggressively login-gated, so this scrapes whatever OG tags survive in the logged-out HTML.
 * Expect frequent ok:false responses for logged-out requests - that's the honest result, not a
 * bug to chase.
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object}>}
 */
export async function unfurlFacebook(parsedUrl, requestingService) {
  const response = await fetchWithTimeout(parsedUrl.toString(), { headers: BROWSER_HEADERS });
  if (!response.ok) {
    return { status: 502, body: { ok: false, error: `Facebook returned ${response.status}` } };
  }

  const html = await response.text();
  const og = extractOpenGraph(html);
  if (!og.title && !og.image) {
    return { status: 502, body: { ok: false, error: "Facebook unfurl unavailable (likely login-gated)" } };
  }

  return {
    status: 200,
    body: buildUnfurlResponse({
      site: "facebook",
      siteName: og.siteName || "Facebook",
      url: parsedUrl.toString(),
      title: og.title,
      description: og.description,
      image: og.image,
      author: null,
      type: og.type || "article",
      requestingService,
    }),
  };
}
