# Contributing to Burnigator

Thanks for helping! Bug reports, ideas and pull requests are welcome.

## Before you start

- Search the [existing issues](https://github.com/galonga/burnigator/issues) first.
- For anything larger than a small fix, open an issue to discuss it before writing code.
- **Security problems:** do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Run it locally

You need PHP 8.1 or newer. There is no build step and no dependency installation.

```sh
php -S 127.0.0.1:8080
```

Open `http://127.0.0.1:8080/setup.php`, finish the wizard, then sign in at `/admin.php`. Setup writes `config.php`, `data/` and `uploads/`; these are ignored by git, so do not commit them.

MariaDB is only needed for the event authentication and pinboard features.

## Code style

- **PHP:** four spaces, one statement per line, `declare(strict_types=1)` at the top of new files.
- **JavaScript and CSS:** formatted with [Prettier](https://prettier.io/) using the settings in `.prettierrc.json`. Run `npm run format` before you commit.
- **UI:** follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Use the shared tokens and component classes in `assets/design-system.css` instead of one-off styles.
- **Texts:** add both languages in `assets/i18n.js` (German and English, separated by `|`).

## Version bump (required, automated)

Versions use CalVer, `YEAR.MONTH.BUILD` (for example `2026.11.1359`), stored in the `VERSION` file. A pull request that changes application code (PHP, JS, CSS that ship to visitors) must increase the **build number**. You do not edit it by hand:

```sh
scripts/bump-version.sh            # compares with origin/main, bumps VERSION if needed
```

The script only bumps when application files changed, sets year and month to the current month, and does nothing if `VERSION` is already ahead of the base branch, so it is safe to run repeatedly. Commit the changed `VERSION`.

To have this happen on every commit, enable the optional hook once per clone:

```sh
scripts/install-hooks.sh           # git config core.hooksPath scripts/hooks
```

The hook bumps and stages `VERSION` when staged files include application code. Skip it once with `git commit --no-verify`. Fetch `origin/main` first (`git fetch origin`) so the base is current.

CI fails the pull request if the build number did not increase, and the failure message tells you the command to run. CI never pushes commits. See [RELEASING.md](RELEASING.md).

## Checks

The `package.json` is for developer tooling only (ESLint and Prettier, pinned by `package-lock.json`). The app itself has no build step and no runtime dependencies, and these files are not part of the release zip. Install once with Node 20 or newer:

```sh
npm ci
```

Then run:

```sh
npm run check        # everything below
npm run lint:php     # php -l over all PHP files (except assets/vendor)
npm run lint:js      # node --check plus ESLint
npm run format       # Prettier, writes changes
npm run format:check # Prettier, check only
npm run test:http    # HTTP integration tests (starts php -S on a temp copy of the app; needs php on PATH)
npm test             # PHP tests (needs pdo_sqlite), Node tests and the version-bump script test
```

`npm run test:php`, `npm run test:js`, `npm run lint:js:syntax` and `npm run lint:js:eslint` run the individual parts.

CI runs the PHP and JavaScript syntax checks, the PHP and Node tests, the HTTP integration tests (which start `php -S` on a copy of the app in a temp directory and need `php` on your PATH; they never touch your `config.php` or `data/`) on PHP 8.1, 8.3 and 8.4, Prettier, ESLint (correctness rules only), and the version check.

## Pull requests

- Keep each pull request focused on one change.
- Describe what changed and why, and how you tested it.
- Add screenshots for visible changes.
- Do not include runtime data, passwords, or uploaded images.

## License and contributor agreement

Burnigator is released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

By submitting a contribution (for example a pull request), you confirm and agree that:

1. You wrote the contribution yourself, or you have the right to submit it, and it does not include code you may not share (for example from an employer or from a project with an incompatible license).
2. Your contribution is licensed under the AGPL-3.0, like the rest of the project.
3. You also grant the project maintainer a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, modify, sublicense and distribute your contribution under any license, including commercial and proprietary terms. This lets the maintainer offer Burnigator under other terms, for example for hosting, without asking every contributor again.
4. You keep the copyright in your contribution.

If you cannot agree to this, please open an issue instead of a pull request so we can find another way.

## Labels

Issues use these labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`. See `docs/agents/triage-labels.md`.
