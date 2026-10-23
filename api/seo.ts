import type { IncomingMessage, ServerResponse } from 'node:http';

import { seoMiddleware } from '../server/seoRoutes.ts';

/**
 * Vercel entry point for /sitemap.xml and /robots.txt.
 *
 * vercel.json rewrites those two paths here (adding ?file=... so this function
 * knows which document was requested). The same middleware runs in `vite dev`
 * and `vite preview`, which keeps SEO output identical across environments.
 */
export const config = {
  supportsResponseStreaming: false,
};

export default function handler(req: IncomingMessage, res: ServerResponse) {
  seoMiddleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
  });
}
