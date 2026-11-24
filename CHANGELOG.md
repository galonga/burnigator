# Changelog

All notable changes to Burnigator are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions use CalVer in the form `YEAR.MONTH.BUILD`, for example `2026.11.1359`. The last number is the build number: it only ever increases and does not reset when the month changes. See [RELEASING.md](RELEASING.md).

## [Unreleased]

### Added

- **Admin dashboard (default view for owners):** the admin page now opens on a new **Dashboard** tab. It shows the event status (published or preview, last saved), the number of places, places with a programme, timelines, events and events with an event owner, the events running right now and the next ones today, the database connection (including response time), the pinboard state (on or off, posts, hidden posts, latest post), statistics of imported order IDs (total, allowed, blocked, last sync, breakdown by source and status), the visitor statistics of the last 7 days when they are switched on, and the latest changes. It refreshes every minute and has shortcuts to the pinboard moderation, the database setup and the full history. Programme and POI editors still open on their editor. The layout adapts from small phones (single column) to wide screens (up to four columns, with the order and history cards spanning two). The Configuration and Pinboard tabs are restructured as one column of equal-width sections (title left, controls right on wide screens, stacked on phones). Also removes a duplicated Database connection card that showed at the bottom of every Configuration tab. Read-only: no new settings or data.
- **Deep links and sharing:** every event and every place now has a link of the form `index.php?event=<id>` or `index.php?poi=<id>`. Opening an event link jumps to the event's day, scrolls to the event and opens its details; a place link opens the map at that place. A new **Share** button sits next to the heart in the event details (and in the place popup on the map): it opens the system share sheet where the browser has one and otherwise copies the link. A link to something that no longer exists shows a short notice. Saved filters are ignored for the linked event so it is always visible. The links work offline from the installed app too. Place links also make it easy to print QR codes for places.
- **Visitor announcement:** Configuration → Event has a new **Visitor announcement** card (owner). A short text (up to 300 characters, type Information or Warning) appears as a banner at the top of the visitor page, for example for a delay or a weather warning. Visitors can dismiss it; if the owner changes the text or type it shows again. Saving it empty removes it. It is part of the full backup.
- **"Recently changed" marks:** when an event's time, day, place or title changes, the server marks it and visitors see a small marker on the event block, a note in the event details and an extra screen-reader hint for the next 24 hours. New events and changes to the description, host or link are not marked.
- **Built-in statistics (optional, off by default):** Configuration → General has a new **Statistics** card. When switched on, the visitor page counts, anonymously and per day, visits, opened event details, opened places and favourites. The card shows totals, visits per day, the most popular events (by favourites, then opens) and the most opened places for the last 7, 30 or 90 days, and can reset the data. There are no cookies, IP addresses, user agents or visitor identifiers, and nothing finer than a day is stored; the data lives in `data/stats.json` and is kept for 90 days. Do Not Track and Global Privacy Control are honoured, and signed-in team members and the unpublished preview are not counted. Unknown ids are ignored, so the file cannot grow without bound.
- **Now / next strip and clash warnings are optional (off by default):** both are switched on together with the new setting **Show the “now and next” strip and clash warnings** in Configuration → General. When it is off, visitors see neither. It is part of the full backup.
- **Now / next strip:** the top of the timetable shows what is happening right now (with its end time) and the next three events today, across all places and timelines. Events carried over past midnight count while they last. Tapping an entry jumps to the event and opens its details; saved filters are ignored for that. The strip updates every minute and marks your favourites with a heart.
- **Clashing favourites:** favourite events that overlap in time on the selected day get a dashed outline and a warning icon, the event details say which favourites they overlap with, and a note above the timetable counts them. It updates immediately when you add or remove a favourite. Events that merely touch (one ends when the next starts) do not clash.

### Changed

- **Keyboard and screen-reader support:** opening an event's details now moves focus into the dialog and returns it to the event when the dialog closes (Escape, close button, save or cancel). The event no longer announces the whole dialog as its description. The day tabs and the Map/Timetable tabs follow the WAI-ARIA tabs pattern: one tab stop, arrow keys, Home and End switch tabs, and focus stays on the chosen day. Map markers now have the place name as their accessible name.
- **Code structure (no behaviour change):** the pure map-data validation helpers moved from `api.php` into `lib/map_clean.php`, and the time and overnight-event helpers moved from `assets/map.js` into `assets/timetable-core.js`, so both can be tested on their own.

### Added

- **Tests:** `tests/map_clean_test.php` (theme, URL, day, text, programme and owner-hash handling) and `tests/timetable-core.test.js` (overnight events, day wrap-around, labels). CI now runs both, plus Prettier and a correctness-only ESLint check (`eslint.config.mjs`).

### Fixed

- **Duplicate translation keys:** removed sixteen identical, duplicated entries from `assets/i18n.js`.
- **Event details dialog:** no longer shows a scrollbar for short text. The invisible pointer arrow under the dialog extended its scrollable area when it opened above the event; the arrow is removed. Long content still scrolls.

## [2026.11.1377] - 2026-11-19

### Added

- **Pinboard sign-in hint:** the visitor pinboard now tells signed-out guests that the Pretix order number (from the order confirmation email) is needed to post, and that reading works without signing in.
- **Database connection in the admin panel:** Configuration → User management has a new **Database connection** card (owner role) to add, change or remove the MariaDB/MySQL credentials without editing files. The connection is tested and the tables are created before `config.php` is updated; a blank password keeps the saved one. If the credentials come from `BURNIGATOR_DB_*` server variables the card shows that and is read-only. The pinboard moderation tab and the event authentication card now say that a database connection is required, show whether one is connected, and link to the card.

### Changed

- **Event authentication card:** moved to the bottom of User management, below the new Database connection card. It now starts with what it does, and is split into a Pretix connection (what Pretix is and which data is read: order numbers and status only, read-only) and an alternative CSV import, followed by the stored order data.

### Fixed

- **Restoring a full backup:** the restore no longer fails under the Content-Security-Policy (`connect-src 'self'` blocked reading the backup's embedded images via `fetch`). The images are now decoded directly in the browser.
- **Console warning:** the dangling Leaflet source map reference is removed, so browsers no longer log a 404 for `leaflet.js.map`.

## [2026.11.1373] - 2026-11-18

### Changed

- **Events past midnight:** an end time earlier than the start time (for example 22:00–02:00) now means the event ends the next day. The admin and event-owner forms show an "ends the next day" note, the timeline draws the event to midnight with an arrow and continues it on the next day, and the image export does the same. An end time of 00:00 is accepted as midnight. Equal start and end times are rejected. Existing events are unaffected.
- **Event editor for places and timelines:** tidied up. Each day is a collapsible section with an event counter (open when it has events), and each event is a collapsed row showing time and title. An opened event has labelled fields in groups (title and time, details, link, categories), and the Save and Delete buttons sit together at the bottom. New events open automatically.

### Added

- **Full week:** programme days now cover Monday to Sunday instead of Wednesday to Sunday, in the admin editor, the visitor timetable and the current-day detection. Existing programmes keep their days; days without events stay hidden for visitors.
- **Available event days:** Configuration → General lets the owner switch individual days off. Disabled days no longer appear in the programme editor for places and timelines; events already entered on them are kept. At least one day must stay enabled.
- **First day of the event:** Configuration → General has a new setting for the first day of the event, for example Thursday to Wednesday. The programme editor and the visitor day tabs start on that day. The default is Monday.

## [2026.11.1367] - 2026-11-18

### Added

- **Event owners:** an event can have an optional owner order code, set by the admin in the event editor (owner role only). A visitor who is signed in with that order code gets an edit button next to the favourite heart in the event details and can change the event time, description and categories. The code is stored only as an HMAC hash, never sent to visitors, and every change is checked on the server. Because sign-in is part of the pinboard, the pinboard has to be enabled. Downloaded full backups do not contain owner assignments; server-side snapshots keep them.
- **Avatars on the pinboard:** every pseudonym gets a generated avatar icon next to the name, in the visitor pinboard and in the moderation list. The animal in the name picks the icon (a cat, a fox, a feather, a fire for a phoenix, and so on). The colour is a random dark gradient: a colour word such as Amber or Scarlet steers the hue, everything else is random but fixed per name, so a name always looks the same. Colours are darkened until the white icon has a contrast of at least 5.7:1.

### Changed

- **Event owner edit form:** the form now also edits the host, opens centred and scrollable so it fits on small screens, and uses compact category chips. Owners change host, time frame, description and categories.
- **New events:** a newly added event shows its own **Save event** button directly below it (owner and place roles). It disappears once the event is saved.
- **Event editor:** the event title now comes before the start and end time. A missing title or start time shows a hint and a red outline right in the event row, and saving is blocked with a message until every event has both. Before, such events were silently dropped on save.
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

[Unreleased]: https://github.com/galonga/burnigator/compare/v2026.11.1377...HEAD
[2026.11.1377]: https://github.com/galonga/burnigator/compare/v2026.11.1373...v2026.11.1377
[2026.11.1373]: https://github.com/galonga/burnigator/compare/v2026.11.1367...v2026.11.1373
[2026.11.1367]: https://github.com/galonga/burnigator/compare/v2026.11.1359...v2026.11.1367
[2026.11.1359]: https://github.com/galonga/burnigator/releases/tag/v2026.11.1359
