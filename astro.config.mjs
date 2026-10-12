import { defineConfig } from 'astro/config';
import { pageFlipLifecycle } from './scripts/page-flip-lifecycle.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://qais8r.github.io',
  base: process.env.BASE_PATH || '/',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  vite: {
    plugins: [pageFlipLifecycle()],
    // Ensure development uses the same patched module as the production build.
    optimizeDeps: { exclude: ['page-flip'] },
  },
});
