# HandPress

Free, offline-only video compressor for Android, built as a PWA.

## Delivery

The platform (birsoz.net infrastructure) delivers this repository under infrastructure#321 and ruling #320.

- Every pull request runs `lint` and `build-test` on GitHub-hosted runners; `ci-ok` is the required check.
- A push to `main` that passes `ci-ok` builds the image `ghcr.io/bahadirbirsoz/bahadirbirsoz-handpress:sha-<7>`, then the
  `deploy-staging` job (self-hosted, util01) deploys that image by digest to https://handpress.staging.birsoz.net.
- `/health` reports the deployed sha: `{"status":"ok","sha":"<sha40>"}`. The deploy fails, and the previous image is
  restored, unless the new sha shows there within two minutes.
- The deploy files are in `deploy/staging/` (`compose.yml`, `deploy-entry`); the entry is installed on the host by the
  platform, not by this repository's workflow.
- `.github/scripts/test-gate.mjs` is vendored from the infrastructure repository (`tools/ci/test-gate.mjs`); do not edit it here.
- Production follows in infrastructure#322.
