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
- **JavaScript and CSS:** formatted with [Prettier](https://prettier.io/) using the settings in `.prettierrc.json`. Run `npx prettier --write assets/*.js sw.js assets/*.css` before you commit.
- **UI:** follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md). Use the shared tokens and component classes in `assets/design-system.css` instead of one-off styles.
- **Texts:** add both languages in `assets/i18n.js` (German and English, separated by `|`).

## Version bump (required)

Versions use CalVer, `YEAR.MONTH.BUILD` (for example `2026.11.1359`), stored in the `VERSION` file. When you change application code or the visitor page, increase the **build number** (the last number) in `VERSION`, and update year and month if they changed. The footer, the asset cache-busting and the service-worker cache all derive from `VERSION`, so there is nothing else to edit.

This makes installed and offline copies pick up the change. CI fails the pull request if the build number did not increase. See [RELEASING.md](RELEASING.md).

## Checks

```sh
find . -name '*.php' -not -path './assets/vendor/*' -print0 | xargs -0 -n1 php -l
for f in assets/*.js sw.js; do node --check "$f"; done
php tests/event_auth_test.php
php tests/map_clean_test.php
php tests/stats_test.php
php tests/dashboard_test.php
node tests/timetable-core.test.js
node tests/deeplink.test.js
npx prettier@3 --check "assets/*.js" "assets/*.css" sw.js "tests/*.js" eslint.config.mjs
npx eslint@9 .
```

CI runs the PHP and JavaScript syntax checks, the PHP and Node tests, Prettier, ESLint (correctness rules only), and the version check.

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
