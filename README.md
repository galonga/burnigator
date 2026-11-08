# Burnigator

Burnigator is a self-hosted, database-free festival map and programme for standard PHP web hosting. Visitors can explore an image map, browse a 24-hour timetable, filter and save favourite events, and install the site as a web app. Owners manage the map, programme, accounts, appearance, and integrations from the admin panel.

The application uses [Leaflet](https://leafletjs.com/) with `CRS.Simple`; the map is an image, not a geographic map. It is designed for shared PHP hosting such as ALL-INKL and does not need Docker, a database, Composer, or a build step.

## Features

- **Interactive image map:** The visitor view opens on the timetable by default. Visitors can switch to the image map, which fits the full image into view the first time it is opened, then pan and zoom. POIs have Font Awesome icons and categories. Visitors can search places, show or hide POI names, and hide categories; owners can choose monochrome or colored POI icons.
- **Festival timetable:** Browse Wednesday through Sunday one day at a time. Each day spans 24 hours, places appear as rows, and event blocks are positioned at their start and end times. The current-time indicator, favourite filter, and event-category filters help visitors find programme items.
- **Independent timelines:** Add up to three named programme rows that are not attached to a place.
- **Event details and favourites:** Events can include a host, description, multiple categories, and an external link with a custom label. Visitors open the details card by selecting an event and can save favourites in their browser; favourites remain after a reload on that device.
- **Print exports:** Export the map with a numbered place index or export the selected timetable day as a high-resolution JPEG. The exports target A2 printing and 300 DPI where browser canvas limits permit. A configured QR URL is included in the exports.
- **Admin panel:** Manage POIs, categories, events, independent timelines, general configuration, accounts, backups, and change history. Places are grouped by category and can be collapsed for a more compact overview.
- **Optional integrations:** Configure a SoundCloud playlist, Matomo tracking URL and site ID, and the browser's experimental translation API for event descriptions. The compact SoundCloud player offers play/pause, random next track, 30-second skip, volume control, and a link to the current track.
- **Branding and navigation:** Upload a title logo and favicon, set a custom top-bar button, and configure an optional legal notice link. The favicon is also used to generate the installed web app icon.
- **Responsive German and English interface:** The visitor and admin views adapt to mobile screens. Users can switch the UI language; the selection is kept in the browser.
- **Installable and offline visitor view:** A service worker caches the visitor shell, map data, and current image assets. On app start, the app requests fresh data when online and falls back to its cached copy while offline.

## Requirements

- PHP 7.4 or newer with JSON, sessions, file uploads, and filesystem locking enabled
- An Apache-compatible web server with `.htaccess` support
- HTTPS for normal use and service-worker/PWA support (localhost is suitable for local development)
- Writable `data/` and `uploads/` directories; `config.php` must also be writable during first-time setup
- GD is recommended for generating resized app icons from the uploaded favicon. If it is unavailable, the built-in app icons are used.

Leaflet, Font Awesome, and the QR code library are bundled locally. SoundCloud and Matomo require an internet connection. Browser translation is experimental and only appears in browsers that support the relevant APIs.

## Installation

1. Download or clone this repository.
2. Upload the **contents of the repository root** to a web directory, for example `www/burnigator/`. Do not upload a parent archive folder as an extra nested directory.
3. Make sure PHP can write to `config.php`, `data/`, and `uploads/` for the initial setup. The setup creates `data/map.json` and installs the owner account.
4. Open `https://your-domain.example/burnigator/setup.php` and follow the wizard. Set a strong owner password of at least 12 characters. The wizard also collects basic appearance and optional settings, including the legal notice URL.
5. Sign in at `https://your-domain.example/burnigator/admin.php` with username `owner` and the password you chose.
6. Upload a PNG/JPG map image, create categories, and add places. Set each POI's name, icon, description, category, and position. Enable **Has programme** to add events.
7. Use the Configuration tab to set optional branding, integrations, appearance, accounts, and the legal notice link.

After setup, `config.php` does not need to remain writable. Keep `data/` and `uploads/` writable by PHP because the application stores changes there.

## Updating an existing installation

Upload updated application files over the existing installation, but **preserve the server's `config.php`, `data/`, and `uploads/`**. These contain the installed owner credential hash, map and programme data, additional accounts, snapshots, change history, and uploaded images. In particular, do not replace the live `config.php` with the repository's uninstalled setup template.

Keep the `.htaccess` files in the application root, `data/`, and `uploads/`. If you have made local customizations to application files, merge those before replacing them.

## Admin accounts and permissions

The owner account has full access, including general configuration, categories, map image, backups, snapshots, and account management. The owner can change their password in the Configuration tab.

The owner can create two optional limited accounts:

| Account | Permissions |
| --- | --- |
| POI editor | Add, move, edit, and delete POIs, including assigning them to existing categories. It cannot create or edit categories, change map images, or edit programme data. It cannot delete a POI that has programme events attached. |
| WWW editor | Edit event programmes and independent timelines, without changing POI details or general configuration. |

Each limited account has its own username and password. Passwords must be at least 12 characters. Leaving a password blank while saving keeps an existing password; clearing the username and saving removes that account.

## Configuration

The owner-only Configuration tab contains:

- General title, custom top-bar button, optional legal notice URL, optional WWW-export QR URL, and browser translation toggle
- SoundCloud player visibility and public playlist URL
- Main UI colors, title logo, and favicon
- Matomo base URL and site ID; an empty Matomo URL disables tracking
- Limited account management and owner password change
- Change history, data import/export, and snapshot restore

The default theme uses blue `#305EAA`, pink `#E94F85`, orange-red `#E63D1A`, and warm cream `#E6D0BB`. The SoundCloud player is visible by default and uses the Minmon podcast playlist.

## Data model and storage

The application stores structured data as JSON and images as files; no SQL database is used. The public visitor page reads map data from `api.php`. All write actions require an authenticated session, a matching role, and a CSRF token.

At a high level, the map data contains:

- **Categories:** names and colors
- **POIs:** a stable ID, normalized `x`/`y` coordinates, name, description, category, icon, and optional programme
- **Events:** start/end time, title, host, description, selected event categories, and optional external link and link text
- **Independent timelines:** up to three named rows with the same event structure
- **Configuration:** theme, branding paths, optional links, tracking, translation, and SoundCloud settings

POI coordinates are normalized from `0` to `1`, so marker positions scale with the uploaded image. Programme days use the keys Wednesday through Sunday; event times use 24-hour `HH:MM` format. An event end time, when set, must be later than its start time on the same day.

Runtime files are stored as follows:

| Path | Contents |
| --- | --- |
| `config.php` | Installed flag and initial owner password hash |
| `data/map.json` | Map, categories, POIs, programmes, timelines, and configuration |
| `data/accounts.json` | Active owner and optional limited-account password hashes after account changes |
| `data/history.json` | Recent admin changes by username and role |
| `data/login-attempts.json` | Login throttling state |
| `data/snapshots/` | Up to five recent map-data snapshots |
| `uploads/` | Map image, title logo, and favicon |

Do not commit live runtime data, password hashes, or uploaded event/map images to a public repository. Back up `config.php`, `data/`, and `uploads/` separately from the application source.

## Security and hosting notes

- The root `.htaccess` prevents directory listings and blocks direct access to `config.php`.
- `data/.htaccess` blocks all direct web access to JSON data and snapshots.
- `uploads/.htaccess` blocks PHP and other script execution while allowing the browser to load uploaded images for the public map.
- Passwords are stored as password hashes. Login attempts are throttled after five failed attempts from the same IP address for 15 minutes.
- Sessions use `HttpOnly` and `SameSite=Lax` cookies; cookies are marked `Secure` when HTTPS is active.
- Image uploads are validated by format and size. Map images may be up to 20 MB; branding PNGs may be up to 5 MB.
- The application uses file locks and revision checks to prevent concurrent saves from silently overwriting newer map data.

If the host ignores `.htaccess`, do not expose the `data/` directory publicly. Ask the hosting provider how to deny direct access or move private storage outside the web root and adjust the application paths accordingly. The `uploads/` directory must serve the referenced image files to visitors, while script execution there must remain disabled.

## Backups and recovery

The Configuration tab provides a full JSON backup and restore workflow. A full backup contains the map, categories, POIs, programmes, timelines, configuration, and uploaded image assets. Before data changes, the application also creates snapshots and retains the latest five; the owner can restore these in the admin panel.

Keep an independent FTP or hosting backup of `config.php`, `data/`, and `uploads/`. A full backup downloaded from the admin panel is convenient for migration, but it should also be stored somewhere safe outside the web server.

## Privacy and analytics

Matomo tracking is configurable and disabled by clearing its URL. When enabled, the app sends page views and interaction events such as map POI clicks, timetable event interactions, favourites, and media-player actions to the configured Matomo installation. SoundCloud playback is served by SoundCloud. Browser-stored favourites and map/category display preferences remain local to the visitor's device.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.php` | Public map and timetable |
| `admin.php` | Login and admin interface |
| `setup.php` | First-install configuration wizard |
| `api.php` | Public read endpoint and authenticated write actions |
| `auth.php` | Account, role, and login support |
| `assets/map.js` | Map, timetable, player, exports, and visitor interactions |
| `assets/admin.js` | Admin editing and configuration |
| `assets/style.css` | Application styles |
| `assets/design-system.css` | Shared UI tokens, components, and states |
| `assets/i18n.js` | German and English UI strings |
| `sw.js` | Offline cache and service-worker behavior |
| `docs/agents/` | Issue tracker, triage-label, and domain-doc guidance for engineering skills |
| `DESIGN_SYSTEM.md` | Design-system guidance for interface changes |

## Development notes

- There is no compilation step or dependency installation. The local Leaflet, Font Awesome, and QR code assets are committed with the application.
- Follow [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) and `assets/design-system.css` when changing UI. Use the semantic color, typography, spacing, shape, and control-size tokens, and keep applicable interaction states consistent across visitor and admin screens.
- When changing application code or the visitor shell, increment the build number shown in the visitor footer and update the cache name in `sw.js` so installed/offline clients receive the new version.
- GitHub Issues for this project live at [galonga/burnigator](https://github.com/galonga/burnigator). Repository-specific issue, triage, and domain-doc conventions are in `docs/agents/`.
