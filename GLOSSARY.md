# Glossary

Domain terms used in Burnigator. Use these words consistently in code, docs, issues and UI copy. "Event management" names the overall product; "map" is only the map feature.

## Event and installation

**Event**
Two meanings, kept apart by context. (1) The festival or gathering an installation serves ("the event"). (2) A single item on the programme, with start, end, title and optional host, description, categories and link. When ambiguity is possible, say "programme event" for the second meaning.
_Avoid_: "show", "session", "slot".

**Installation** (also **tenant**)
One complete, isolated copy of the application serving exactly one event, with its own configuration, data, uploads and installation ID. "Tenant" is the hosting-side word for the same thing.
_Avoid_: "site".

**Installation ID**
The random identifier setup assigns to an installation. It scopes the installation's session cookie, service-worker cache and event-auth records.

**Setup**
The first-run wizard that creates the installation's configuration and owner account. A reset returns the installation to setup.

## Map and programme content

**Map**
The interactive image map of the venue. It is an image with normalised coordinates, not a geographic map.

**POI** (point of interest)
A marked location on the map with name, icon, description, category and position. Shown to visitors as a **place**.

**Place**
The visitor-facing word for a POI. In the timetable, each place with a programme is a row.

**Has programme**
The POI flag that lets a place carry programme events.

**Category**
A named, coloured group for POIs. Programme events have their own **event categories**, which visitors can filter by.

**Programme** (also **timetable**)
The schedule of events across the days of the week. "Programme" is the content; "timetable" is the visitor view that shows it, one day at a time, with places as rows.

**Programme day**
One weekday (Monday to Sunday) of the programme. The first day of the week is configurable and individual days can be disabled.

**Timeline** (independent timeline)
A named programme row that is not attached to a place. An installation has up to three.

**Overnight event**
An event whose end time is earlier than its start time; it continues on the next day.

**Event owner**
Optional per-event setting: an order code that lets a signed-in attendee edit that event's time, description and categories. Not the same as the **Owner** role.

**Announcement**
A short dismissible banner (information or warning) the Owner can show to visitors.

**Change mark**
A marker shown for 24 hours on an event whose time, day, place or title changed.

**Deep link**
A URL that opens a specific event (`?event=<id>`) or place (`?poi=<id>`).

**Favourite**
An event a visitor has saved. Favourites live only in the visitor's browser on that device.

**Now / next strip**, **clash warning**
Optional visitor features: what is running and starting next today; and a flag on favourites that overlap in time.

## Roles and accounts

**Owner**
The full-access admin account of an installation. Only the Owner configures the installation, edits the programme, manages accounts, publishes, restores backups and moderates the pinboard.
_Avoid_: using "owner" for the event-owner order code (see **Event owner**).

**Admin panel**
The back-office interface (`admin.php`). It is an interface, not a role.

**POI editor**
Optional limited account that can add, move, edit and delete POIs but not categories, the map image or programme data.

**WWW account** (legacy)
Optional read-only account.

**Festival account**
Any signed-in Owner, POI editor or WWW account. Festival accounts can preview an unpublished installation.

**Attendee**
A visitor who signed in to the pinboard with an eligible order code. Distinct from admin accounts.

## Publication, backup and history

**Publication** (published / unpublished)
Whether the visitor view is visible to the public. New installations start unpublished; only the Owner can change this. Festival accounts see an unpublished installation as a **preview**.

**Snapshot**
An automatic copy of the map data taken before changes; the latest five are kept and the Owner can restore one.

**Backup** (full backup)
A downloadable JSON export of map, programme, configuration and uploaded images, restorable by the Owner. It does not include the database.

**History** (change history)
Log of recent admin changes by username and role.

**Reset**
Owner action that deletes the installation's data, uploads, accounts and event-auth records and returns to setup. It is not recoverable from a snapshot.

**Dashboard**
The Owner's default admin view with event status, counts, health and statistics.

## Event authentication and pinboard

**Pinboard**
Optional community board where attendees post messages. Anyone can read visible posts; posting needs an eligible order. Disabled by default.

**Moderation**
Owner hiding, restoring or deleting pinboard posts.

**Pretix**
The external ticketing system whose orders define eligibility.

**Order code**
The Pretix order code an attendee enters to sign in. Never stored; only its keyed hash is.

**Order hash**
The HMAC-SHA-256 of the normalised order code; the identity key of an attendee within one event.

**Eligible order**
An order that grants posting access: Pretix status paid and no completed or external refund with a positive amount. In CSV import, a status of `paid`, `p` or `bezahlt`.

**Order snapshot**
The set of orders (hashes plus eligibility) stored locally after the latest sync or import. A CSV import replaces it; orders missing from it lose access. Not the same as a map-data **snapshot**.

**Synchronisation** (sync)
Reading orders from the Pretix API to refresh the order snapshot. The CSV import is the manual fallback.

**Pseudonym**
The random two-word name (plus number) shown instead of a real identity on posts. Assigned per order hash and reused on later sign-ins.

**Participant identity**
In v1, one order code equals one identity: everyone sharing an order shares the pseudonym and posting access.

## Statistics

**Statistics** (built-in statistics)
Optional, off by default, anonymous daily counters for visits, opened events, opened places and favourites, kept for 90 days.

**Matomo**
Optional external tracking, enabled only when the Owner enters a URL and site ID. Separate from the built-in statistics.
