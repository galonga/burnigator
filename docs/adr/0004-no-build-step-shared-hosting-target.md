# 4. No build step; shared PHP hosting as the target

Status: accepted (documented retroactively)

## Context

The README names shared PHP hosting such as ALL-INKL as the design target. Operators upload files by FTP and may have no command-line access ("No Docker or command-line migration is required on the web host").

## Decision

- No Docker, Composer, npm install or compilation. Leaflet, Font Awesome and the QR code library are committed locally under `assets/vendor/`.
- PHP 7.4 or newer, Apache-compatible server with `.htaccess` support.
- Database schema is created automatically on first use.
- Setup is a browser wizard that writes `config.php`.
- Versioning is a single `VERSION` file (CalVer) from which cache-busting and the service-worker cache derive, so no build step is needed to ship a new version. CI requires a build-number increase when application files change.
- JS and CSS are formatted with Prettier, but are shipped as written.

## Consequences

- Anyone can deploy by uploading files; updates must preserve `config.php`, `data/` and `uploads/`.
- A modern JS toolchain (bundling, TypeScript) and newer-PHP-only features are not available without revisiting this decision.
- Security headers are partly delivered through `.htaccess`, tying the app to Apache-compatible hosting. If the host ignores it, `data/` must be protected otherwise.
