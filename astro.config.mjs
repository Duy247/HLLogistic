import { defineConfig } from 'astro/config';
import { localApi } from './server-lib/astro-api.js';

export default defineConfig({
  output: 'static',
  build: { format: 'file' },
  trailingSlash: 'never',
  vite: { plugins: [localApi()] },
});
