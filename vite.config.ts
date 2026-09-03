import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The base path is configurable and defaults to the Pages sub-path. A hardcoded
// root base deploys green and 404s every asset, so `scripts/check-static-bundle.mjs`
// asserts this prefix is actually present in the built output.
const base = process.env.SITE_BASE ?? '/oaklands-wiki/';

/**
 * Build provenance bound to the artifact being produced: the version from
 * package.json and the real commit from git. Never launch time, never a
 * hand-entered label. When the commit cannot be resolved the value is null and
 * every surface renders an honest unavailable state instead of inventing one.
 */
function buildProvenance() {
  const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
  let commit = '';
  try {
    commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) return null;
  return { version, commit, builtAtIso: new Date().toISOString() };
}

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    __BUILD_PROVENANCE__: JSON.stringify(buildProvenance()),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Everything is bundled locally. No CDN, no remote font, no analytics.
    rollupOptions: { output: { manualChunks: undefined } },
  },
});
