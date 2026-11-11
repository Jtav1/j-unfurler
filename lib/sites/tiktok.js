import { fetchWithTimeout } from "../httpFetch.js";
import { buildUnfurlResponse } from "../previewFormat.js";

export const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"]);

/**
 * TikTok's public oEmbed endpoint - no auth required, resolves short vm.tiktok.com links
 * server-side. title/author_name/thumbnail_url are frequently absent from the response (TikTok
 * has trimmed this payload over time), so embed_product_id is the only field treated as
 * required - everything else degrades to null rather than failing the whole request.
 * @param {URL} parsedUrl
 * @param {string} requestingService
 * @returns {Promise<{status: number, body: object}>}
 */
export async function unfurlTiktok(parsedUrl, requestingService) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(parsedUrl.toString())}`;

  const response = await fetchWithTimeout(oembedUrl);
  if (!response.ok) {
    return { status: 502, body: { ok: false, error: `TikTok oEmbed returned ${response.status}` } };
  }

  const data = await response.json();
  if (!data.embed_product_id) {
    return { status: 502, body: { ok: false, error: "Could not parse TikTok oEmbed response" } };
  }

  return {
    status: 200,
    body: buildUnfurlResponse({
      site: "tiktok",
      siteName: "TikTok",
      url: parsedUrl.toString(),
      title: data.title,
      description: null,
      image: data.thumbnail_url || null,
      author: data.author_name || null,
      type: "video",
      requestingService,
    }),
  };
}
