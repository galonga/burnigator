# 5. Privacy-friendly, anonymous built-in statistics

Status: accepted (documented retroactively)

## Context

Owners want to know which events and places are popular. Matomo is available as an optional external integration, but needs configuration and sends interaction data to a third party.

## Decision

Offer optional built-in statistics, off by default. When enabled, the server only increments anonymous daily counters (visits, opened events, opened places, favourites) in `data/stats.json`. It stores no cookies, IP addresses, user agents or visitor/session identifiers, and nothing finer than a day. Counters older than 90 days are dropped, unknown ids are ignored so the file stays bounded, Do Not Track and Global Privacy Control are respected, and signed-in team members and the unpublished preview are not counted. The browser remembers per tab (`sessionStorage`) that a visit was counted. The Owner can reset the data. Matomo and SoundCloud remain off until configured.

## Consequences

- No per-visitor funnels, unique-visitor counts or retention analysis.
- Favourites are counted but stay stored only in the visitor's browser.
- Whether this removes the need for a consent notice is a legal judgement the repo does not make; treat it as unconfirmed.
