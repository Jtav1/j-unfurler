import { Router } from "express";
import { extractUrl, parseAllowedUrl } from "../lib/validateUrl.js";
import { unfurlInstagram, INSTAGRAM_HOSTS } from "../lib/sites/instagram.js";

const router = Router();

/**
 * POST /api/unfurl/instagram
 * Body: { url: string } - an instagram.com link
 * Best-effort: scrapes OG tags from the logged-out page HTML. Frequently unavailable since
 * Instagram login-gates most public post pages.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  const parsedUrl = parseAllowedUrl(url, INSTAGRAM_HOSTS);
  if (!parsedUrl) return res.status(400).json({ ok: false, error: "url is not an instagram.com link" });

  try {
    const { status, body } = await unfurlInstagram(parsedUrl, req.requestingService);
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl/instagram error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl Instagram link" });
  }
});

export default router;
