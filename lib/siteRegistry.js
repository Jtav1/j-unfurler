import { REDDIT_HOSTS, unfurlReddit } from "./sites/reddit.js";
import { TIKTOK_HOSTS, unfurlTiktok } from "./sites/tiktok.js";
import { BSKY_HOSTS, unfurlBsky } from "./sites/bsky.js";
import { TWITTER_HOSTS, unfurlTwitter } from "./sites/twitter.js";
import { INSTAGRAM_HOSTS, unfurlInstagram } from "./sites/instagram.js";
import { FACEBOOK_HOSTS, unfurlFacebook } from "./sites/facebook.js";

/** All site unfurlers, keyed by slug - used by the generic dispatch route to match a url's host. */
export const SITE_REGISTRY = [
  { site: "reddit", hosts: REDDIT_HOSTS, unfurl: unfurlReddit },
  { site: "tiktok", hosts: TIKTOK_HOSTS, unfurl: unfurlTiktok },
  { site: "bsky", hosts: BSKY_HOSTS, unfurl: unfurlBsky },
  { site: "twitter", hosts: TWITTER_HOSTS, unfurl: unfurlTwitter },
  { site: "instagram", hosts: INSTAGRAM_HOSTS, unfurl: unfurlInstagram },
  { site: "facebook", hosts: FACEBOOK_HOSTS, unfurl: unfurlFacebook },
];

/**
 * Finds the registry entry whose hosts include the given URL's hostname.
 * @param {URL} parsedUrl
 * @returns {{site: string, hosts: Set<string>, unfurl: Function}|null}
 */
export function matchSite(parsedUrl) {
  return SITE_REGISTRY.find((entry) => entry.hosts.has(parsedUrl.hostname.toLowerCase())) || null;
}
