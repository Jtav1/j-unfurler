import { Router } from "express";
import { extractUrl } from "../lib/validateUrl.js";
import { matchSite } from "../lib/siteRegistry.js";
import { SITES } from "../config.js";

const router = Router();

/**
 * POST /api/unfurl
 * Body: { url: string } - any supported link
 * Matches the url's hostname to the right site unfurler and dispatches to it, so callers that
 * don't know (or don't want to track) which site a link belongs to can hit one endpoint.
 */
router.post("/", async (req, res) => {
  const url = extractUrl(req.body);
  if (!url) return res.status(400).json({ ok: false, error: "Missing or invalid url" });

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid url" });
  }

  const match = matchSite(parsedUrl);
  if (!match) return res.status(400).json({ ok: false, error: "No unfurler supports this url's domain" });
  if (!SITES[match.site]) return res.status(404).json({ ok: false, error: `${match.site} unfurler is disabled` });

  try {
    const { status, body } = await match.unfurl(parsedUrl, req.requestingService);
    res.status(status).json(body);
  } catch (err) {
    console.error("POST /api/unfurl error:", err);
    res.status(500).json({ ok: false, error: "Failed to unfurl link" });
  }
});

export default router;
