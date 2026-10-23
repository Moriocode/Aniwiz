import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

import { anipmApiMiddleware } from './server/anipmApiHandler.ts';
import { seoMiddleware } from './server/seoRoutes.ts';


function anipmPartnerApiPlugin(): Plugin {
  return {
    name: 'anipm-partner-api-plugin',
    configureServer(server) {
      server.middlewares.use(anipmApiMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(anipmApiMiddleware);
    },
  };
}

/** Serves /sitemap.xml and /robots.txt in dev and preview (same code as Vercel). */
function seoRoutesPlugin(): Plugin {
  return {
    name: 'seo-routes-plugin',
    configureServer(server) {
      server.middlewares.use(seoMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(seoMiddleware);
    },
  };
}

// ==========================================
// NOTE: __dirname → import.meta.dirname adaptation warning note:
// In native ESM environments or Node.js v20.11+, use import.meta.dirname or
// fileURLToPath(new URL('.', import.meta.url)) instead of CommonJS __dirname.
// ==========================================
// import.meta.dirname is available on Node >= 20.11 (Vite 8's floor).
const appRootDir = import.meta.dirname || process.cwd();

export default defineConfig(() => {
  return {
    plugins: [tailwindcss(), seoRoutesPlugin(), anipmPartnerApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(appRootDir, '.'),
      },
    },
    server: {
      // The cloud preview panel proxies this dev server through its own hostname,
      // so Vite has to be told that host is trusted (Host-header check).
      // Hostnames are per-VM, so extra ones can be supplied without editing this
      // file: VITE_DEV_ALLOWED_HOSTS=host-a,host-b npm run dev
      allowedHosts: [
        'pv-1d54c1142988-a39c5fbd-92d1-4dae-b31c-421fcf0ddba9.style.dev',
        ...(process.env.VITE_DEV_ALLOWED_HOSTS || '')
          .split(',')
          .map((host) => host.trim())
          .filter(Boolean),
      ],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
