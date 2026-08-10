# Rsbuild project

## Setup

Install the dependencies:

```bash
npm install
```

## Get started

Start the dev server, and the app will be available at [http://localhost:3000](http://localhost:3000).

```bash
npm run dev
```

Build the app for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deploy

This project uses GitHub Actions to deploy on push to `main`.

Workflow: `.github/workflows/deploy.yml`

### Required GitHub Secrets

- `SSH_PRIVATE_KEY` can reuse an existing deploy key such as `~/.ssh/github_actions_deploy`.
- `REMOTE_HOST`
- `REMOTE_USER`
- `REMOTE_PORT`
- `DEPLOY_TARGET`

### Deployment flow

1. GitHub Actions installs dependencies with pnpm.
2. It runs `pnpm run build`.
3. The generated `dist/` directory is synced to the Baota server over SSH.
4. The server runs `sudo systemctl reload nginx` after upload.

### Notes

- Only the built `dist/` output is deployed.
- The app is built for the `/kbk-management` base path, so the server should serve the site under that path.
- `DEPLOY_TARGET` should point to the Baota web root for this app.
- Deployment excludes Baota's protected `.user.ini` file while keeping `--delete` enabled for stale build assets.

## Learn more

To learn more about Rsbuild, check out the following resources:

- [Rsbuild documentation](https://rsbuild.rs) - explore Rsbuild features and APIs.
- [Rsbuild GitHub repository](https://github.com/web-infra-dev/rsbuild) - your feedback and contributions are welcome!
