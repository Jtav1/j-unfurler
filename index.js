import express from "express";
import helmet from "helmet";
import cors from "cors";
import { PORT, SITES } from "./config.js";
import { attachRequestingService } from "./lib/requestingService.js";

import redditRouter from "./routes/reddit.js";
import facebookRouter from "./routes/facebook.js";
import twitterRouter from "./routes/twitter.js";
import instagramRouter from "./routes/instagram.js";
import tiktokRouter from "./routes/tiktok.js";
import bskyRouter from "./routes/bsky.js";
import unfurlRouter from "./routes/unfurl.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "20kb" }));
app.use(attachRequestingService);

// Site routers, each gated by its own ENABLE_* env toggle (default enabled).
const siteRouters = {
  reddit: redditRouter,
  facebook: facebookRouter,
  twitter: twitterRouter,
  instagram: instagramRouter,
  tiktok: tiktokRouter,
  bsky: bskyRouter,
};

for (const [site, router] of Object.entries(siteRouters)) {
  if (SITES[site]) app.use(`/api/unfurl/${site}`, router);
}

// Generic dispatch route - matches a url's hostname to the right site unfurler above.
app.use("/api/unfurl", unfurlRouter);

app.get("/health", (req, res) => {
  res.json({ ok: true, sites: SITES });
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "unfurler",
    routes: [
      "POST /api/unfurl",
      ...Object.keys(siteRouters)
        .filter((site) => SITES[site])
        .map((site) => `POST /api/unfurl/${site}`),
    ],
  });
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.path} error:`, err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`unfurler listening on port ${PORT}`);
});
