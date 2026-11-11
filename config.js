import "dotenv/config";

/** Reads an ENABLE_* env var; any value other than the literal string "false" is treated as enabled. */
function isEnabled(envVar) {
  return process.env[envVar] !== "false";
}

export const PORT = process.env.PORT || 3003;

/** Per-site unfurler toggles, keyed by route slug. */
export const SITES = {
  reddit: isEnabled("ENABLE_REDDIT"),
  facebook: isEnabled("ENABLE_FACEBOOK"),
  twitter: isEnabled("ENABLE_TWITTER"),
  instagram: isEnabled("ENABLE_INSTAGRAM"),
  tiktok: isEnabled("ENABLE_TIKTOK"),
  bsky: isEnabled("ENABLE_BSKY"),
};
