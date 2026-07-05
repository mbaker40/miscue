import { defineConfig } from 'vite';

// base must match the repo name for GitHub Pages project sites.
export default defineConfig({
  base: '/miscue/',
  build: { target: 'es2020' },
});
