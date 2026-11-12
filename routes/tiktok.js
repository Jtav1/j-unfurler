import { Router } from "express";
import { extractUrl, parseAllowedUrl } from "../lib/validateUrl.js";
import { runUnfurl } from "../lib/unfurlRunner.js";
import { unfurlTiktok, TIKTOK_HOSTS } from "../lib/sites/tiktok.js";

const router = Router();
const entry = { site: "tiktok", unfurl: unfurlTiktok };

/**
 * POST /api/unfurl/tiktok
 * Body: { url: string } - a tiktok.com link
 * Fetches the video via TikTok's public oEmbed endpoint and returns unfurl fields.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  const parsedUrl = parseAllowedUrl(url, TIKTOK_HOSTS);
  if (!parsedUrl) return res.status(400).json({ ok: false, error: "url is not a tiktok.com link" });

  try {
    const { status, body, cached } = await runUnfurl(entry, parsedUrl, req.requestingService);
    res.set("X-Cache", cached ? "HIT" : "MISS");
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl/tiktok error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl TikTok link" });
  }
});

export default router;
