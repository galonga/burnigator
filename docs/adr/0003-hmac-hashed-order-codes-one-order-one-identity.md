# 3. Order codes stored as HMAC hashes; one order is one identity (v1)

Status: accepted for event auth v1 (see `docs/event-auth-v1.md`)

## Context

The pinboard should only be open to paying attendees, using Pretix orders as the source of truth, while keeping attendee data minimal and anonymous.

## Decision

- Only an HMAC-SHA-256 of the normalised order code, keyed with a server-side secret, is stored. The entered code, buyer details and ticket-position details are not stored, and order codes are not put in URLs, history or logs.
- A random pseudonym is assigned per (event, order hash) and reused on later sign-ins.
- v1 treats one order code as one participant identity; people sharing a multi-ticket order share the pseudonym and posting access.
- Access depends on the current eligible flag: the next successful sync or import revokes access for orders that are no longer eligible. Pretix API sync is primary; a two-column CSV import is the fallback. Webhooks are not used.
- Failures return the same message whether an order is unknown, unpaid, canceled, refunded or from another event.

## Consequences

- A database leak does not reveal order codes, but changing the secret invalidates all hashes, rate-limit keys and the encrypted Pretix token.
- Sharing an order shares an identity; the docs say the key should move to a specific order position or ticket if orders later cover multiple people.
- Revocation is not immediate: it needs a manual sync or import.
- A CSV import replaces the order snapshot and cannot express refunds.
