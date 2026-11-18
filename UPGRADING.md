# Upgrading Burnigator

Always upgrade by uploading the new release files over your existing installation. **Keep these three, they hold your event:**

- `config.php` (installation ID, owner password hash, secrets, database credentials)
- `data/` (map data, programme, accounts, history, snapshots)
- `uploads/` (event map, logo, favicon)

Releases never contain a `config.php`, a `data/` or an `uploads/` with content, so uploading a release zip does not overwrite them as long as you upload the zip's contents into the existing folder and do not delete the folder first.

## Steps

1. **Back up.** In the admin panel open Configuration → Security & History and download a full backup. Also copy `config.php`, `data/` and `uploads/` with FTP, and back up the MariaDB database if the pinboard or event authentication is enabled.
2. **Download** the release zip from the [Releases page](https://github.com/galonga/burnigator/releases) and check it against the `.sha256` file if you like.
3. **Upload** the zip's contents (not the zip itself, and not a parent folder) into your installation folder, overwriting existing files. Keep the `.htaccess` files in the application root, `data/` and `uploads/`. If you customized application files, merge your changes first.
4. **Open the site and the admin panel.** The version is shown in the visitor footer. Database changes are applied automatically the first time a page that uses the database is opened.
5. **Check Configuration** for anything listed under your version below.
6. **Hard reload once** if a browser still shows old content. Installed and offline copies update by themselves when the visitor next opens the app online.

## Rolling back

Restore your backup of the previous version's files. Restore `config.php`, `data/` and `uploads/` from your backup only if they changed, and restore the database backup if you use MariaDB. Database changes are not reversed automatically, so restore the database backup too if the new version had already migrated it.

## Notes per version

### 2026.11.1359 (first public release)

- **Matomo and SoundCloud are off by default.** Older builds used a built-in Matomo address (and site ID) and a built-in SoundCloud playlist when none was saved. If your event relied on that, open Configuration → General and enter your Matomo URL and site ID, and your public SoundCloud playlist URL. Until you do, tracking is off and the player is hidden.
- **`config.php` is no longer part of the repository.** Release zips contain `config.sample.php` only. Never replace your live `config.php`.
- **Security headers.** HTML pages now send a Content-Security-Policy that allows the site itself, the SoundCloud player and your configured Matomo host. If you embed other external content through custom setups, check that it still works.
- **Footer.** The footer shows the version and a source link, and the credit reads "Powered by burnigator.com".
- **Optional title link.** The event title is no longer linked to a website. To link it, set a Title link under Configuration → General.
