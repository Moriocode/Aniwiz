import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

import { anipmApiMiddleware } from './server/anipmApiHandler.ts';


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

// ==========================================
// NOTE: __dirname → import.meta.dirname adaptation warning note:
// In native ESM environments or Node.js v20.11+, use import.meta.dirname or
// fileURLToPath(new URL('.', import.meta.url)) instead of CommonJS __dirname.
// ==========================================
// import.meta.dirname is available on Node >= 20.11 (Vite 8's floor).
const appRootDir = import.meta.dirname || process.cwd();

export default defineConfig(() => {
  return {
    plugins: [tailwindcss(), anipmPartnerApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(appRootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
