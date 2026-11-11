import { Router } from "express";
import { extractUrl, parseAllowedUrl } from "../lib/validateUrl.js";
import { unfurlFacebook, FACEBOOK_HOSTS } from "../lib/sites/facebook.js";

const router = Router();

/**
 * POST /api/unfurl/facebook
 * Body: { url: string } - a facebook.com link
 * Best-effort: scrapes OG tags from the logged-out page HTML. Frequently unavailable since
 * Facebook login-gates most public post pages.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  const parsedUrl = parseAllowedUrl(url, FACEBOOK_HOSTS);
  if (!parsedUrl) return res.status(400).json({ ok: false, error: "url is not a facebook.com link" });

  try {
    const { status, body } = await unfurlFacebook(parsedUrl, req.requestingService);
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl/facebook error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl Facebook link" });
  }
});

export default router;
