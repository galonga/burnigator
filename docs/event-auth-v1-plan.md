# Event Authentication v1 implementation plan (implemented)

## Architecture
- Preserved the JSON-backed map and owner account model; each installation is the event boundary.
- Added a PDO MySQL/MariaDB layer and versioned schema migration for eligible order hashes, event sessions, pinboard posts, and sync metadata.
- Kept Pretix credentials in server-side configuration; they are never returned to JavaScript.

## Public access
- The pinboard starts disabled; the Owner can enable it in setup or Configuration → Event & Pinboard. When enabled, visitors can read visible posts but need event authentication to write.
- Visitors authenticate with their Pretix order code. Burnigator normalizes it, computes an HMAC using the server secret, and compares it with imported or synchronized eligible order records.
- Requires paid order status `p`, uncanceled positions, and no completed or external refund listed in the paginated order response. Authentication failures use one generic response.
- Issues a random event-scoped session token; persists only its hash. Cookies use Secure, HttpOnly, and SameSite attributes, with CSRF checks for writes.
- Assigns a random two-word burner pseudonym; Owners can moderate all posts and participants can manage their own posts.

## Owner administration
- Provides separate owner-only Event Authentication and Event & Pinboard categories. Pretix settings, synchronization, and CSV import use the Event Authentication category; activation and moderation use Event & Pinboard.
- Provides paginated manual Pretix synchronization, last-sync time, and imported, eligible, and ineligible counts.
- Uses no webhooks and provides no ticket-based event editing.

## Verification and docs
- Added focused tests for Pretix state parsing, HMAC normalization, sessions, CSV import, and pinboard authorization.
- Documented MariaDB setup, migration, server-side secrets, Pretix endpoints, the two-column CSV format, synchronization, and hosting requirements.
