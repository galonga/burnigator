# Releasing Burnigator

Notes for maintainers. Releases are cut from `main`.

## Version scheme (CalVer)

`YEAR.MONTH.BUILD`, for example `2026.11.1359`.

- `YEAR.MONTH` is the year and month of the release.
- `BUILD` is a build number that **only ever increases**. It does not reset when the month or year changes, so `2026.11.1359` is followed by, for example, `2026.11.1360` or `2027.01.1361`.
- The `VERSION` file holds the current version and is the single source of truth. The visitor footer, the asset cache-busting parameters and the service-worker cache name all derive from it.
- Git tags are `v` plus the version, for example `v2026.11.1359`.

## Every change to application code

Any pull request that changes PHP, JS or CSS files that ship to visitors must increase the build number in `VERSION` (CI checks this). Update year and month if they changed. Docs, workflows, tests and vendored libraries do not need a bump.

## Cutting a release

1. **Check the checklist** below, in particular the browser test and the upgrade test.
2. **Prepare a release pull request** that
   - sets `VERSION` (increase the build number, set the current year and month),
   - moves the changes into a new `## [VERSION] - YYYY-MM-DD` section in `CHANGELOG.md` and updates the link at the bottom,
   - adds notes for the version to `UPGRADING.md` if operators need to do anything.
3. **Merge** when CI is green.
4. **Tag and push** from `main`:
   ```sh
   git checkout main && git pull
   git tag -a v$(cat VERSION) -m "Burnigator $(cat VERSION)"
   git push origin v$(cat VERSION)
   ```
5. The **Release** workflow checks that tag, `VERSION` and `CHANGELOG.md` agree, lints, runs the tests, builds `burnigator-<version>.zip` with a `.sha256` file, checks the zip contents, and creates a **draft** GitHub Release.
6. **Test the zip**, not the git checkout: install it fresh, and upgrade a copy of a real installation with it.
7. **Publish** the draft release on GitHub.
8. **After publishing:** update the download link and version on burnigator.com, and announce the release.

If the workflow fails, fix the problem, delete the tag (`git push origin :refs/tags/v<version>` and `git tag -d v<version>`), and tag again.

## Release checklist

- [ ] CI is green on `main`
- [ ] Browser test with the Content-Security-Policy active: map, timetable, favourites, print exports, SoundCloud, Matomo, install as app, offline use, admin panel, setup wizard
- [ ] Fresh install from the zip on PHP 7.4 and a current PHP 8.x, with Apache and `.htaccess`
- [ ] Upgrade of a copy of a real installation: nothing lost, database migrated, offline cache refreshed
- [ ] MariaDB features: pinboard, Pretix API sync, CSV import, order summary
- [ ] Security pass: login throttling, CSRF, uploads, role limits, reset flow; no secrets or personal data in the zip
- [ ] `README.md`, `UPGRADING.md`, `CHANGELOG.md` and `THIRD_PARTY_NOTICES.md` are current
- [ ] Release notes mention anything operators must do

## Patch releases

Fix on `main`, increase the build number, add a changelog entry, and release as above. Security fixes go through a private GitHub security advisory first (see `SECURITY.md`).

## Vendored libraries

Leaflet, Font Awesome and QRCode.js live in `assets/vendor/` and are not tracked by an update tool. Check them for new versions every few months and update `THIRD_PARTY_NOTICES.md` when they change.
