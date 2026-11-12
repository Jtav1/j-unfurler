import { fetchHtml, BROWSER_HEADERS } from "../httpFetch.js";
import { extractOpenGraph } from "../ogScrape.js";
import { buildUnfurlResponse } from "../previewFormat.js";

export const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

/**
 * Best-effort only: Instagram's oEmbed now requires Meta app review/a token, and public pages
 * are heavily login-gated, so this scrapes whatever OG tags survive in the logged-out HTML.
 * Expect frequent ok:false responses for logged-out requests - that's the honest result, not a
 * bug to chase.
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object}>}
 */
export async function unfurlInstagram(parsedUrl, requestingService) {
  const { response, html } = await fetchHtml(parsedUrl, { headers: BROWSER_HEADERS, allowedHosts: INSTAGRAM_HOSTS });
  if (!response.ok) {
    return { status: 502, body: { ok: false, error: `Instagram returned ${response.status}` } };
  }

  const og = extractOpenGraph(html, parsedUrl);
  if (!og.title && !og.image) {
    return { status: 502, body: { ok: false, error: "Instagram unfurl unavailable (likely login-gated)" } };
  }

  return {
    status: 200,
    body: buildUnfurlResponse({
      site: "instagram",
      siteName: og.siteName || "Instagram",
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
