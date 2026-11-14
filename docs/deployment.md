# Deploying RideWind

RideWind builds to plain files in `dist/`, so any static host can serve it. This repository includes a GitHub Pages workflow (`.github/workflows/deploy-pages.yml`) that only runs when you start it manually, so nothing is published until you choose to:

1. Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
2. Go to **Actions → Deploy to GitHub Pages → Run workflow**.
3. The site is published at `https://<user>.github.io/ridewind/`.

The workflow sets `BASE_PATH=/<repo>/` so asset paths work under the repository subpath. To deploy on every merge, change its trigger to `push: branches: [main]`.
