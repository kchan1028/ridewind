/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// BASE_PATH lets the GitHub Pages workflow serve the app from /<repo>/.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
