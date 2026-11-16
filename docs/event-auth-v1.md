# Event Authentication v1

## Scope and data model

Each Burnigator installation represents one event. Event-auth records also carry the installation ID, so multiple installations can share one MariaDB database without sharing orders, sessions, settings, rate limits, or pinboard posts.

Public map and timetable data remain in the existing JSON files. Event authentication and pinboard data use PDO with MariaDB/MySQL. The first request that connects to the database applies schema migration version 1 and records it in the schema migrations table.

The database stores only an HMAC-SHA-256 hash of a normalized Pretix order code. It does not store the entered code, buyer details, or ticket-position details. A random two-word pseudonym is assigned to that event's order hash and reused if the attendee authenticates again. Attendee cookies contain a random token; only its SHA-256 hash is stored. Session lookups join the order record, so the next successful sync/import revokes access when an order is no longer eligible.

V1 treats one order code as one participant identity. People sharing a multi-ticket order therefore share the same pseudonym and posting access. If orders later contain multiple access products or people, the identity key should move to a specific Pretix order position/ticket.

## Server configuration

Configure these server-side environment variables for PHP. Do not put their values in browser code or commit them:

| Variable | Example | Purpose |
| --- | --- | --- |
| BURNIGATOR_DB_DSN | mysql:host=localhost;dbname=burnigator;charset=utf8mb4 | MariaDB connection |
| BURNIGATOR_DB_USER | burnigator_user | Database account |
| BURNIGATOR_DB_PASSWORD | — | Database password |
| BURNIGATOR_EVENT_AUTH_SECRET | random value of at least 32 characters | HMAC secret for order codes and rate-limit keys, and encryption key material for the Pretix API token |

The setup wizard can optionally collect and test MariaDB connection details. It writes them to the server-side `config.php` and generates a random event-auth secret even if database setup is skipped. Environment variables override values in `config.php`. Keep that file private and out of version control.

Use a database account limited to the Burnigator schema and keep the HMAC secret stable. The Pretix token is encrypted at rest with AES-256-GCM and is never returned to the browser. Changing the secret invalidates existing order hashes and rate-limit keys and prevents decrypting the saved token; configure a replacement token and sync the orders again after rotating it. Use HTTPS in production. Attendee session cookies are Secure, HttpOnly, and SameSite=Strict; the separate CSRF cookie is Secure and SameSite=Strict.

For ALL-INKL, create a MariaDB database and user in KAS, then confirm the selected PHP runtime has pdo_mysql enabled; cURL is needed for Pretix synchronization. No Docker or command-line migration is required on the web host.

## Owner setup

1. Enter database access in the setup wizard, or configure it server-side later. The wizard generates the event-auth secret.
2. Sign in with the existing Owner account and open Configuration → Event Authentication.
3. Enter the Pretix HTTPS base URL, organizer slug, event slug, and a server-side API token with read access to this event's orders.
4. Save, then use Jetzt synchronisieren. The panel shows the last run and total, eligible, and ineligible order counts.
5. If the Pretix API is unavailable, import a CSV using the two-column format below. The Owner can enable the pinboard separately under Configuration → Event & Pinboard. The admin panel shows the stored order data grouped by status, source, posting eligibility, and count; it never displays order codes or hashes.

The CSV import format is exactly two columns, `Order code,Status`, one order per row. Example:

    Order code,Status
    RBJVJ,paid
    XWDYD,canceled
    9U7EN,expired

The header and status values are case-insensitive; blank rows are ignored. `paid`, Pretix's `p` code, or `bezahlt` allows posting. `canceled`, `expired`, pending, refunded, and unknown values block access. This fallback has no separate refund column, so do not import refunded orders with status `paid`; use Pretix API sync where possible. The CSV import replaces the local event order snapshot: orders missing from the uploaded file lose posting access. The Pretix API is the primary source. Webhooks are not used.

## Pretix API behavior

The integration uses the documented paginated event order-list endpoint:

    GET /api/v1/organizers/{organizer}/events/{event}/orders/

The order resource includes code, status, payments, and refunds. Burnigator only reads code, status, and refunds in memory; it stores the HMAC of code. An order is eligible only when its status is p and it has no completed (done) or external (external) refund with a positive amount. If Pretix does not provide the documented refunds array, the order is treated as ineligible. The API token is held server-side and is never returned to the browser. No order code is placed in a Burnigator URL or application log.

Reference: [Pretix Orders API](https://docs.pretix.eu/dev/api/resources/orders.html) (order-list response, status values, payment and refund resources).

## Pinboard permissions

The pinboard is disabled by default. The Owner can enable it during setup or later from Configuration → Event & Pinboard. A MariaDB database is required to save posts. Pretix credentials, synchronization, and CSV import are managed separately under Configuration → Event Authentication.

- When enabled, anyone can read visible posts.
- A paid, non-refunded order for this event can create posts and edit/delete posts associated with that order hash.
- The Owner can hide, restore, or delete any post through the admin moderation panel.
- Event map and programme changes remain Owner-only. There is no ticket-based event editing and no new Event Editor role.

Authentication failures use the same message regardless of whether an order is unknown, unpaid, canceled, refunded, or belongs to another event. Authentication attempts and pinboard writes are rate-limited by a keyed hash of the client IP; raw IP addresses are not stored. Order codes are sent in a JSON request body, not a URL, and are not written to Burnigator history or application logs.

## Operations

Database tables are created automatically on first use. Back up the MariaDB database together with config.php, data/, and uploads/. Do not serve database dumps or backups from the web directory. Manual sync/import is required to reflect Pretix changes; access is revoked on the next successful run.

The Owner can reset the current installation from Configuration → Security & History. Reset requires the current Owner password and the exact phrase `RESET BURNIGATOR`; it removes the current installation's map/programme data, uploads, accounts, and event-auth/pinboard database rows, then returns to first-time setup. It leaves application code and data for other installations sharing the database untouched. Create a backup first; the reset cannot be undone from Burnigator.

Run the focused checks locally with:

    php tests/event_auth_test.php
