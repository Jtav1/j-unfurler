import { Router } from "express";
import { extractUrl, parseAllowedUrl } from "../lib/validateUrl.js";
import { unfurlBsky, BSKY_HOSTS } from "../lib/sites/bsky.js";

const router = Router();

/**
 * POST /api/unfurl/bsky
 * Body: { url: string } - a bsky.app link
 * Fetches the post via the AT Protocol public read API and returns unfurl fields.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  const parsedUrl = parseAllowedUrl(url, BSKY_HOSTS);
  if (!parsedUrl) return res.status(400).json({ ok: false, error: "url is not a bsky.app link" });

  try {
    const { status, body } = await unfurlBsky(parsedUrl, req.requestingService);
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl/bsky error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl Bluesky link" });
  }
});

export default router;
