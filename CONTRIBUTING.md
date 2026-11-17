# Contributing to Burnigator

Thanks for helping! Bug reports, ideas and pull requests are welcome.

## Before you start

- Search the [existing issues](https://github.com/galonga/burnigator/issues) first.
- For anything larger than a small fix, open an issue to discuss it before writing code.
- **Security problems:** do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Run it locally

You need PHP 7.4 or newer. There is no build step and no dependency installation.

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

When you change application code or the visitor page, increase both:

1. the build number in the footer of `index.php` (`Build NNNN`), and
2. the cache version in `sw.js` (`CACHE_PREFIX + 'vNN'`).

This makes installed and offline copies pick up the change. CI fails the pull request if either number did not increase.

## Checks

```sh
find . -name '*.php' -not -path './assets/vendor/*' -print0 | xargs -0 -n1 php -l
for f in assets/*.js sw.js; do node --check "$f"; done
php tests/event_auth_test.php
```

CI runs the PHP and JavaScript syntax checks and the version-bump check.

## Pull requests

- Keep each pull request focused on one change.
- Describe what changed and why, and how you tested it.
- Add screenshots for visible changes.
- Do not include runtime data, passwords, or uploaded images.

By contributing, you agree that your contribution is released under the project's license.

## Labels

Issues use these labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` and `wontfix`. See `docs/agents/triage-labels.md`.
