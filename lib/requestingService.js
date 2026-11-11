const SERVICE_PATTERNS = [
  ["discord", /discord/i],
  ["fluxer", /fluxer/i],
];

/**
 * Best-effort detection of which bot is calling, from its User-Agent string. Falls back to
 * "unknown" - callers must identify themselves in their UA (e.g. "dixcord-bot-discord/1.0") for
 * this to resolve; a bare axios/fetch default UA won't match anything.
 * @param {string|undefined} userAgent
 * @returns {"discord"|"fluxer"|"unknown"}
 */
export function detectRequestingService(userAgent) {
  if (!userAgent) return "unknown";
  for (const [service, pattern] of SERVICE_PATTERNS) {
    if (pattern.test(userAgent)) return service;
  }
  return "unknown";
}

/** Attaches req.requestingService for route handlers to read. */
export function attachRequestingService(req, res, next) {
  req.requestingService = detectRequestingService(req.headers["user-agent"]);
  next();
}
