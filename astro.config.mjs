import { defineConfig } from 'astro/config';
import { localApi } from './server-lib/astro-api.js';

export default defineConfig({
  output: 'static',
  build: { format: 'file' },
  trailingSlash: 'never',
  // Keep the component menu script external for strict script-src CSP.
  vite: { build: { assetsInlineLimit: 0 }, plugins: [localApi()] },
});
