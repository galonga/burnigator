<?php

declare(strict_types=1);

/**
 * Optimistic concurrency for data/map.json. Every save stamps a new `updatedAt`; a client sends the
 * value it loaded as `expectedUpdatedAt`, and the server refuses the write when the stored value moved on.
 * No I/O here, so it can be tested without a server. Call it while holding the map lock.
 */

/** True when the stored map is not the revision the client loaded (a missing revision always counts as stale). */
function mapRevisionStale(array $map, string $expected): bool
{
    return $expected === '' || !hash_equals((string) ($map['updatedAt'] ?? ''), $expected);
}

/** Body of the 409 answer; `currentUpdatedAt` lets the admin UI show which version won. */
function mapConflictBody(array $map): array
{
    return ['error' => 'map_conflict', 'currentUpdatedAt' => (string) ($map['updatedAt'] ?? '')];
}
