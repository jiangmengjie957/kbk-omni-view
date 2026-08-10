# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start the dev server (available at http://localhost:3000, opens browser automatically)
- `npm run build` — Build for production
- `npm run preview` — Preview the production build locally

Package manager is `npm` (or `pnpm` — a pnpm lockfile may be present). There is no test runner configured.

## Deployment

- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Pushes to `main` deploy automatically to the Baota server over SSH
- Deployment syncs `dist/` to the server target defined by `DEPLOY_TARGET`
- After upload, the server runs `sudo systemctl reload nginx`

## Architecture

This is a minimal React 19 single-page application bundled with [Rsbuild](https://rsbuild.rs) (Rspack-based, webpack-compatible).

- `src/index.jsx` — entry point, mounts `<App>` into `#root`
- `src/App.jsx` — root component
- `rsbuild.config.js` — build config (currently only `pluginReact()`)
- `public/` — static assets served as-is

All source files use JSX (`.jsx`). There is no TypeScript, no router, and no state management library — add them as needed.

## Reference Docs

- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt
