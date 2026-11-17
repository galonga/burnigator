# Security policy

## Supported versions

Only the latest release on the `main` branch receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: open the repository's **Security** tab, choose **Report a vulnerability**, and describe the problem. If you cannot use that form, open a public issue that only asks for a private contact channel and contains no details.

Helpful details:

- What you found and where (file, endpoint or admin screen)
- Steps to reproduce, and which role you used (visitor, event attendee, POI editor, owner)
- The impact you expect
- The PHP version and web server, if relevant

You can expect an acknowledgement within a few days. Fixes are released as soon as they are ready, and you will be credited if you wish.

## Scope

In scope: the PHP application, the admin panel, the event authentication and pinboard features, the service worker, and the setup wizard.

Out of scope: problems in a hosting provider's configuration, outdated PHP versions, and denial of service by sheer traffic.

## Hardening checklist for operators

- Serve the app over HTTPS only.
- Run `setup.php` immediately after uploading the files. Until setup has finished, anyone who can reach the URL can claim the installation.
- Keep `config.php`, `data/` and `uploads/` out of public repositories and make sure the `.htaccess` files are active. If your host ignores `.htaccess`, deny access to `config.php` and `data/` another way.
- Use a long owner password (at least 12 characters) and keep PHP and MariaDB up to date.
- Give the database account access to the Burnigator schema only.
- Back up `config.php`, `data/`, `uploads/` and the database separately from the application files.
