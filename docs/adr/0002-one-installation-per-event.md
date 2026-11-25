# 2. One installation per event (isolated copies)

Status: accepted (documented retroactively)

## Context

Burnigator is offered as hosted events as well as self-hosted. The application stores its data in files next to the code and has no multi-tenant layer.

## Decision

Each event is its own installation: a complete application copy with its own `config.php`, `data/` and `uploads/`, set up separately and given a random installation ID. An installed copy must not be cloned into a second tenant. Each event is kept on its own subdomain. Session cookies (host-only, installation-specific) and service-worker cache names are namespaced by installation. Event-auth database rows carry the installation ID, so several installations may share one database without sharing orders, sessions, settings, rate limits or posts.

## Consequences

- Strong isolation between events; no cross-tenant queries in the application.
- Operating many events means deploying and updating many copies.
- Full reset and backup are per installation; reset leaves other installations in a shared database untouched.
- Why a copy-per-event model was preferred over a multi-tenant application is not documented. (Uncertain; plausibly tied to the shared-hosting target in ADR 0004.)
