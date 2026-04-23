// @ts-check
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';

const BASE = '/kbk-management';

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  plugins: [pluginReact(), pluginSass()],
  server: {
    base: BASE,
  },
  output: {
    assetPrefix: BASE + '/',
  },
  tools: {
    browserslist: [
      'Chrome >= 90',
      'Firefox >= 88',
      'Safari >= 14',
      'Edge >= 90',
    ],
  },
});
