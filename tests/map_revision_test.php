<?php

declare(strict_types=1);
// Run with: php tests/map_revision_test.php
require_once __DIR__ . '/../lib/map_revision.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

/**
 * In-memory stand-in for the locked read-check-write in api.php: the same mapRevisionStale() decides,
 * and a successful write stamps a new revision like saveMap() does.
 */
function trySave(array &$stored, string $expected, string $title, string $stamp): array
{
    if (mapRevisionStale($stored, $expected)) {
        return ['status' => 409, 'body' => mapConflictBody($stored)];
    }
    $stored['title'] = $title;
    $stored['updatedAt'] = $stamp;
    return ['status' => 200, 'body' => ['ok' => true]];
}

check(!mapRevisionStale(['updatedAt' => 'rev1'], 'rev1'), 'matching revision is current');
check(mapRevisionStale(['updatedAt' => 'rev2'], 'rev1'), 'different revision is stale');
check(mapRevisionStale(['updatedAt' => 'rev1'], ''), 'a request without a revision is rejected');
check(mapRevisionStale(['updatedAt' => ''], ''), 'an empty stored revision does not make an empty request valid');
check(mapRevisionStale([], 'rev1'), 'a map without a revision never matches a client revision');

// Two admins load revision rev1, then save one after the other.
$stored = ['title' => 'Start', 'updatedAt' => 'rev1'];
$adminA = $adminB = 'rev1';

$first = trySave($stored, $adminA, 'Admin A', 'rev2');
check($first['status'] === 200 && $stored['title'] === 'Admin A', 'the first save succeeds');

$second = trySave($stored, $adminB, 'Admin B', 'rev3');
check($second['status'] === 409, 'the second save from the stale revision is rejected');
check($second['body']['error'] === 'map_conflict', 'the conflict has a stable error code');
check($second['body']['currentUpdatedAt'] === 'rev2', 'the conflict reports the current server revision');
check($stored['title'] === 'Admin A' && $stored['updatedAt'] === 'rev2', 'a rejected save leaves the stored map untouched');

// After reloading, admin B can save.
$adminB = $second['body']['currentUpdatedAt'];
$third = trySave($stored, $adminB, 'Admin B', 'rev3');
check($third['status'] === 200 && $stored['title'] === 'Admin B', 'a save from the reloaded revision succeeds');

echo "map_revision_test OK\n";
