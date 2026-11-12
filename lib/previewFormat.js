/**
 * Preview-length budget, applied uniformly regardless of requestingService: Discord's embed
 * limits (title 256/description 4096/...) and @fluxerjs/builders' are identical, and a link
 * preview card never needs the full 4096-char description budget anyway.
 */
export const PREVIEW_LIMITS = {
  title: 256,
  description: 300,
  siteName: 256,
  author: 256,
};

/**
 * Truncates to maxLength, appending an ellipsis if cut.
 * @param {string|null|undefined} value
 * @param {number} maxLength
 * @returns {string|null}
 */
export function truncate(value, maxLength) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

const MAX_IMAGE_URL_LENGTH = 2048;

/**
 * Keeps an image URL only if it is an absolute http(s) URL of sane length; upstream APIs and
 * scraped pages are untrusted and consumers will fetch whatever we hand them.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function sanitizeImageUrl(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Assembles the standard unfurl response envelope.
 * @param {object} fields
 * @returns {object}
 */
export function buildUnfurlResponse({ site, siteName, url, title, description, image, author, type, requestingService }) {
  return {
    ok: true,
    site,
    requestingService,
    url,
    title: truncate(title, PREVIEW_LIMITS.title),
    description: truncate(description, PREVIEW_LIMITS.description),
    image: sanitizeImageUrl(image),
    siteName: truncate(siteName, PREVIEW_LIMITS.siteName),
    author: truncate(author, PREVIEW_LIMITS.author),
    type: type || null,
  };
}
