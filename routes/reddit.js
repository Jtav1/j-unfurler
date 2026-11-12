import { Router } from "express";
import { extractUrl, parseAllowedUrl } from "../lib/validateUrl.js";
import { runUnfurl } from "../lib/unfurlRunner.js";
import { unfurlReddit, REDDIT_HOSTS } from "../lib/sites/reddit.js";

const router = Router();
const entry = { site: "reddit", unfurl: unfurlReddit };

/**
 * POST /api/unfurl/reddit
 * Body: { url: string } - a reddit.com/redd.it link
 * Fetches the post via Reddit's public .json API and returns unfurl fields.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  const parsedUrl = parseAllowedUrl(url, REDDIT_HOSTS);
  if (!parsedUrl) return res.status(400).json({ ok: false, error: "url is not a reddit.com/redd.it link" });

  try {
    const { status, body, cached } = await runUnfurl(entry, parsedUrl, req.requestingService);
    res.set("X-Cache", cached ? "HIT" : "MISS");
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl/reddit error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl Reddit link" });
  }
});

export default router;
