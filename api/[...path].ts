import type { IncomingMessage, ServerResponse } from 'node:http';

import { anipmApiMiddleware } from '../server/anipmApiHandler.ts';

/**
 * Vercel serverless catch-all for every /api/... route the front-end calls.
 *
 * The exact same middleware that serves `vite dev` / `vite preview` (see
 * server/anipmApiHandler.ts) is mounted here, so a production deployment has
 * the full live API surface instead of 404s that silently drop the UI onto
 * the 4-item offline catalog.
 *
 * Vercel routes /api/<anything> to this file automatically because of the
 * [...path] catch-all name; req.url carries the original full path and query
 * string, which is what the middleware dispatches on.
 */
export const config = {
  supportsResponseStreaming: true,
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  anipmApiMiddleware(req, res, () => {
    // No middleware route matched the path — surface a clean JSON 404 rather
    // than letting the function hang or return Vercel's HTML error page.
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found', path: req.url }));
  });
}
