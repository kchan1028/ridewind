# Contributing to RideWind

Bug reports, ideas and pull requests are welcome. RideWind is a small personal project with one maintainer, so it's worth opening an issue before starting anything large.

Setup and the list of npm commands are in the [README](README.md#quick-start).

## Report a bug or suggest an idea

[Open an issue](https://github.com/kchan1028/ridewind/issues). For a bug, include:

- what you did and what you expected to happen
- your browser and device
- the route, if you can share it. A sample route that shows the problem is even better, since GPX files can reveal where you live or ride.

Report security problems privately as described in [SECURITY.md](SECURITY.md), not in a public issue. Accessibility barriers are bugs, so report them as issues too ([ACCESSIBILITY.md](ACCESSIBILITY.md) explains what to include).

## Propose a change

1. Check the [roadmap](ROADMAP.md) and the [open issues](https://github.com/kchan1028/ridewind/issues). If there's no issue for your change, open one first so we can agree on the approach.
2. Fork the repository and make your change on a branch.
3. Open a pull request against `main` that links the issue and says how you checked the change.

### What a pull request needs

- **The `test-build` check must pass.** It runs `npm test` and `npm run build` (which type-checks first). Run both locally before you push.
- **Tests for new calculations.** Anything in `src/lib/` should come with Vitest tests in `tests/`.
- **Docs that match.** If you change what the app does, update the README or the page in `docs/` that describes it.
- **Product fit.** Read [PRODUCT.md](PRODUCT.md). Changes that add accounts, a backend, tracking or commercial use of Open-Meteo won't be merged.
- **No personal data.** Don't commit real GPX files, API keys or anything that identifies a rider.

Pull requests are merged by squash or rebase once the check passes. [Maintaining RideWind](docs/maintaining.md) explains the branch rules.

## Licence

By contributing, you agree that your work is released under the project's [MIT License](LICENSE).
