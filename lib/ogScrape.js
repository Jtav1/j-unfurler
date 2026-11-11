/**
 * Extracts one <meta property="key" content="..."> or <meta name="key" content="..."> value,
 * tolerating either attribute order. OG tags are flat <meta> elements, so a regex pass is
 * enough here and avoids adding an HTML-parsing dependency.
 * @param {string} html
 * @param {string} key - e.g. "og:title"
 * @returns {string|null}
 */
function extractMetaTag(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return null;
}

/** @param {string} str @returns {string} */
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Best-effort OpenGraph/Twitter-card scrape from raw HTML, falling back to twitter:* tags when
 * og:* is absent.
 * @param {string} html
 * @returns {{title: string|null, description: string|null, image: string|null, siteName: string|null, type: string|null}}
 */
export function extractOpenGraph(html) {
  return {
    title: extractMetaTag(html, "og:title") ?? extractMetaTag(html, "twitter:title"),
    description: extractMetaTag(html, "og:description") ?? extractMetaTag(html, "twitter:description"),
    image: extractMetaTag(html, "og:image") ?? extractMetaTag(html, "twitter:image"),
    siteName: extractMetaTag(html, "og:site_name"),
    type: extractMetaTag(html, "og:type"),
  };
}
