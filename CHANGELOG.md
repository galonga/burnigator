# Changelog

All notable changes to Burnigator are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions use CalVer in the form `YEAR.MONTH.BUILD`, for example `2026.11.1359`. The last number is the build number: it only ever increases and does not reset when the month changes. See [RELEASING.md](RELEASING.md).

## [Unreleased]

### Added

- **Avatars on the pinboard:** every pseudonym gets a generated avatar icon next to the name, in the visitor pinboard and in the moderation list. The animal in the name picks the icon (a cat, a fox, a feather, a fire for a phoenix, and so on), a colour word such as Amber or Scarlet picks the colour, and the rest comes from the name itself, so a name always looks the same.

### Changed

- **Moderate pinboard** has its own tab in the admin panel, to the right of Programme & places and Configuration. The post list scrolls inside the page instead of growing endlessly.
- The map upload is now called **Veranstaltungskarte** (German) and **Event map** (English) everywhere in the admin panel, instead of "Hintergrundbild" / "Background image".

### Fixed

- **Stale scripts after an update:** scripts and styles are now cache-busted by the file's change time as well as the version, so a browser never keeps using an old `admin.js` or `i18n.js` after the files were replaced (even if `VERSION` was not uploaded or updated). A missing translation no longer shows its raw key (for example `adminPinboardView`); the label keeps its default text instead.
- **Download full backup** could produce a backup without the uploaded event map, logo and favicon, and restoring such a file failed. On slower connections the admin script that creates the full backup could finish loading after the admin panel was ready and never attach itself, so the button fell back to the old export that stores no images. The full backup is now the only export, it attaches reliably, and it refuses to create a file when an image is missing.
- Enabling **Has programme** on a place was not saved: after saving, the place came back without it. Owners can now save the programme setting together with the place. Adding an event to a place that has not been saved yet also saves the place first.

## [2026.11.1359] - 2026-11-17

First public release.

### Added

- Version display in the visitor footer, taken from the new `VERSION` file.
- A "Source code" link in the footer (AGPL network-use source offer).
- Optional title link: owners can link the event title to a website of their choice (Configuration → General).
- Security headers on HTML pages (Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) and in `.htaccess` for static files.
- `config.sample.php`: the repository ships a template, and setup creates `config.php`.
- AGPL-3.0 license, third-party notices, `SECURITY.md`, `CONTRIBUTING.md` with a contributor agreement, and issue and pull request templates.

### Changed

- **Matomo tracking and the SoundCloud player are off until configured.** Earlier builds fell back to a built-in Matomo address and playlist. If your installation relied on them, enter your Matomo URL, site ID and playlist URL again. See [UPGRADING.md](UPGRADING.md).
- The footer credit now reads "Powered by burnigator.com".
- The service-worker cache name and asset cache-busting now follow `VERSION`, so installed and offline copies update with every new version.
- Source code reformatted for readability. No behavior change.

### Fixed

- The saved theme colors are applied before the first paint, so pages no longer flash the default palette.

### Security

- Event authentication hardening: write rate limits, safer imports that guard against mass access revocation, installation reset, and HTTP Pretix support.
- `config.php`, `data/` and `uploads/` are ignored by git and excluded from release zips.

[2026.11.1359]: https://github.com/galonga/burnigator/releases/tag/v2026.11.1359
