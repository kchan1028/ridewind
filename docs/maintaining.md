# Maintaining RideWind

Every change reaches `main` through a pull request that passes the `test-build` check, and only the owner can merge. The rules behind that are below.

## Branch rules

`main` is protected by three repository rulesets. The owner can edit or remove them at any time in **Settings → Rules → Rulesets**.

| Ruleset | Rules | Who can bypass |
| --- | --- | --- |
| `main: no force-push or delete` | Block force pushes, restrict deletions | Nobody, including the owner |
| `main: PR + CI` | Pull request required (0 approvals), `test-build` check must pass on the latest commit, linear history (squash or rebase merges) | Nobody |
| `main: owner-only updates` | Restrict updates: only bypass actors can push or merge to `main` | Repository admin role (the owner) |

These rules are configured for a solo maintainer:

- **No approving review is required.** GitHub doesn't let you approve your own pull request, so requiring one would lock out the only maintainer.
- **Requiring pull requests alone doesn't restrict who can change `main`.** It only controls *how* changes arrive. The "Restrict updates" ruleset limits updates to the repository admin role, and in a personal repository with no collaborators that is only the owner.
- **GitHub's legacy "Restrict who can push to matching branches" setting** is only available for organisation-owned repositories. That's why a ruleset is used instead.
- **Collaborators:** none have been added. Adding a collaborator gives them write access, though "Restrict updates" would still stop them updating `main` unless they're given the admin role.
- **Forked pull requests:** their workflows need maintainer approval before they run, and the default `GITHUB_TOKEN` permission is read-only.

The repository is **public**. Anyone can view, clone and fork it and open pull requests, but that doesn't let them change this repository.
