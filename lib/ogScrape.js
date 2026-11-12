const MAX_SCAN_BYTES = 256 * 1024;

/** @param {string} str @returns {string} */
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** @param {string} ch @returns {boolean} */
function isSpace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

/**
 * Single-pass attribute tokenizer for the inside of one tag. Hand-rolled rather than a regex
 * because any regex with an unbounded name/value class re-scans from every start position on
 * hostile input, which is quadratic over a 256 KB tag.
 * @param {string} tag - text between `<meta` and `>`
 * @returns {Map<string, string>} lowercase attribute name -> raw value (first occurrence wins)
 */
function parseAttributes(tag) {
  const attrs = new Map();
  let i = 0;
  const n = tag.length;
  while (i < n) {
    while (i < n && (isSpace(tag[i]) || tag[i] === "/")) i++;
    const nameStart = i;
    while (i < n && !isSpace(tag[i]) && tag[i] !== "=" && tag[i] !== "/") i++;
    if (i === nameStart) {
      i++;
      continue;
    }
    const name = tag.slice(nameStart, i).toLowerCase();
    while (i < n && isSpace(tag[i])) i++;
    let value = "";
    if (tag[i] === "=") {
      i++;
      while (i < n && isSpace(tag[i])) i++;
      const quote = tag[i];
      if (quote === '"' || quote === "'") {
        const end = tag.indexOf(quote, i + 1);
        value = tag.slice(i + 1, end === -1 ? n : end);
        i = end === -1 ? n : end + 1;
      } else {
        const valueStart = i;
        while (i < n && !isSpace(tag[i])) i++;
        value = tag.slice(valueStart, i);
      }
    }
    if (!attrs.has(name)) attrs.set(name, value);
  }
  return attrs;
}

/**
 * Collects every <meta property|name="key" content="..."> in the document head into a map,
 * keeping the first occurrence of each key. Scanning is indexOf-driven and always advances past
 * each tag's closing `>`, so total work is linear in the scanned bytes.
 * @param {string} html
 * @returns {Map<string, string>}
 */
function collectMetaTags(html) {
  let scope = html.slice(0, MAX_SCAN_BYTES);
  const lower = scope.toLowerCase();
  const headEnd = lower.indexOf("</head");
  if (headEnd !== -1) scope = scope.slice(0, headEnd);

  const tags = new Map();
  let pos = 0;
  for (;;) {
    const open = lower.indexOf("<meta", pos);
    if (open === -1 || open >= scope.length) break;
    const afterName = open + 5;
    if (afterName < scope.length && !isSpace(scope[afterName]) && scope[afterName] !== "/" && scope[afterName] !== ">") {
      pos = afterName;
      continue;
    }
    const close = scope.indexOf(">", afterName);
    if (close === -1) break;
    pos = close + 1;

    const attrs = parseAttributes(scope.slice(afterName, close));
    const key = (attrs.get("property") ?? attrs.get("name"))?.toLowerCase();
    const content = attrs.get("content");
    if (key && content !== undefined && !tags.has(key)) tags.set(key, decodeHtmlEntities(content));
  }
  return tags;
}

/**
 * Resolves an og:image value against the page URL and keeps it only if it is an absolute
 * http(s) URL - drops javascript:/data: and anything unparseable.
 * @param {string|null} value
 * @param {URL|undefined} pageUrl
 * @returns {string|null}
 */
function resolveImageUrl(value, pageUrl) {
  if (!value) return null;
  try {
    const resolved = new URL(value, pageUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort OpenGraph/Twitter-card scrape from raw HTML, falling back to twitter:* tags when
 * og:* is absent.
 * @param {string} html
 * @param {URL} [pageUrl] - used to resolve a relative og:image
 * @returns {{title: string|null, description: string|null, image: string|null, siteName: string|null, type: string|null}}
 */
export function extractOpenGraph(html, pageUrl) {
  const tags = collectMetaTags(html);
  const get = (key) => tags.get(key) ?? null;
  return {
    title: get("og:title") ?? get("twitter:title"),
    description: get("og:description") ?? get("twitter:description"),
    image: resolveImageUrl(get("og:image") ?? get("twitter:image"), pageUrl),
    siteName: get("og:site_name"),
    type: get("og:type"),
  };
}
