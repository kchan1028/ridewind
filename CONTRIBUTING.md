# Contributing to RideWind

Thanks for helping. RideWind is a personal project with one maintainer, so the quickest way to get a change in is a small, focused pull request that passes CI and explains what it changes for riders.

## Before you start

- **Bugs:** [open a bug report](https://github.com/kchan1028/ridewind/issues/new/choose). Include the steps, what you expected, what happened and your browser. A GPX file that shows the problem helps a lot, but strip anything personal first.
- **Ideas and larger changes:** open an issue before you write code, so we can agree on the approach. RideWind deliberately has no backend, no accounts and no tracking, so changes that need any of those are unlikely to be accepted.
- **Security problems:** don't open a public issue. Follow [SECURITY.md](SECURITY.md).
- **Accessibility barriers:** these are treated as bugs. See [ACCESSIBILITY.md](ACCESSIBILITY.md).

## Make the change

1. Fork the repository and create a branch from `main`.
2. Set up and run the app with the steps in [docs/development.md](docs/development.md).
3. Make your change. [docs/architecture.md](docs/architecture.md) shows where things live and has a table of common changes.
4. Add or update tests in `tests/` for any change to `src/lib/`.
5. Run the same checks as CI:

   ```bash
   npm test
   npm run build
   ```

   Both must finish without errors. `npm test` ends with a summary such as `Tests 158 passed (158)`, and `npm run build` ends with `✓ built in …ms`.
6. For anything visible, check it in the browser as described in [Check a change](docs/development.md#check-a-change).
7. Open a pull request against `main` and fill in the template.

## Project conventions

- **Keep calculations separate from the page.** Logic goes in `src/lib/` as plain functions with tests. Code that touches the page goes in `src/ui/`. GPX parsing is the one exception, because it needs `DOMParser`.
- **TypeScript is strict.** `tsconfig.json` turns on `strict`, `noUnusedLocals`, `noUnusedParameters` and `noUncheckedIndexedAccess`. Fix type errors rather than silencing them.
- **No UI framework.** Markup is in `index.html` and behaviour in `src/ui/app.ts`.
- **Few dependencies.** The only runtime dependency is Leaflet, pinned to an exact version. If you need another, say why in the pull request.
- **Be honest about data.** Label values as forecast (from Open-Meteo) or estimate (RideWind's own maths). Never fill a missing forecast or missing elevation with a made-up value.
- **Respect the free services.** If a change sends more requests to Open-Meteo or OpenStreetMap, say how many in the pull request and update [docs/data-and-privacy.md](docs/data-and-privacy.md).
- **Errors are for riders.** Throw an `AppError` with a clear, plain message. See [`src/lib/errors.ts`](src/lib/errors.ts).
- **Accessibility counts.** Use native controls, keep keyboard access and visible focus, and never show meaning by colour alone.
- **Comments explain why.** Explain a choice or a constraint, not what the next line does.
- **Commit messages** start with a type, as in the existing history: `feat:`, `fix:`, `docs:` or `chore:`.

## Documentation

If your change affects how RideWind works, update the page that covers it. Each topic has one home:

| Topic | Page |
| --- | --- |
| What RideWind does and how to start | [README.md](README.md) |
| Setup, commands, tests, debugging | [docs/development.md](docs/development.md) |
| How the code fits together | [docs/architecture.md](docs/architecture.md) |
| How estimates are calculated | [docs/model.md](docs/model.md) |
| Outside services, limits, stored data | [docs/data-and-privacy.md](docs/data-and-privacy.md) |
| Building and publishing | [docs/deployment.md](docs/deployment.md) |
| Problems and fixes | [docs/troubleshooting.md](docs/troubleshooting.md) |

## How pull requests are merged

`main` only changes through pull requests. The `test-build` check must pass on the latest commit, and pull requests are merged by squash or rebase so the history stays linear. Only the owner can merge. [docs/maintaining.md](docs/maintaining.md) has the full branch rules.

Workflows on pull requests from forks need the maintainer's approval before they run, so CI may not start straight away.
