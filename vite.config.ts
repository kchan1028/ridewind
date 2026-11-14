/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { contentSecurityPolicy } from './src/lib/csp';

/** Adds the CSP <meta> tag to production builds only; Vite's dev server needs inline styles for hot reload. */
function cspMeta(): Plugin {
  return {
    name: 'ridewind-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy() }, injectTo: 'head-prepend' }];
    },
  };
}

// BASE_PATH lets the GitHub Pages workflow serve the app from /<repo>/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [cspMeta()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
