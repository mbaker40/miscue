import { defineConfig } from 'vite';

// v2 preview lives under the v1 Pages site: /miscue/v2/.
// rapier3d-compat inlines its WASM as base64 — exclude it from dep
// pre-bundling so the dev server doesn't choke on the large module.
export default defineConfig({
  base: '/miscue/v2/',
  build: { target: 'es2020', chunkSizeWarningLimit: 4000 },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
  // stamped into the corner of the screen so a phone playtester can always tell
  // whether they're on a fresh build or a stale Pages/Safari cache
  define: { __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z') },
});
