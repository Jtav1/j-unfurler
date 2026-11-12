import { Router } from "express";
import { extractUrl, parseAllowedUrl } from "../lib/validateUrl.js";
import { runUnfurl } from "../lib/unfurlRunner.js";
import { unfurlTwitter, TWITTER_HOSTS } from "../lib/sites/twitter.js";

const router = Router();
const entry = { site: "twitter", unfurl: unfurlTwitter };

/**
 * POST /api/unfurl/twitter
 * Body: { url: string } - a twitter.com or x.com link
 * Best-effort: fetches the tweet via the unofficial syndication CDN and returns unfurl fields.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  const parsedUrl = parseAllowedUrl(url, TWITTER_HOSTS);
  if (!parsedUrl) return res.status(400).json({ ok: false, error: "url is not a twitter.com/x.com link" });

  try {
    const { status, body, cached } = await runUnfurl(entry, parsedUrl, req.requestingService);
    res.set("X-Cache", cached ? "HIT" : "MISS");
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl/twitter error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl Twitter/X link" });
  }
});

export default router;
