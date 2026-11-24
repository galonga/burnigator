<?php

declare(strict_types=1);
// Run with: php tests/dashboard_test.php
require_once __DIR__ . '/../lib/dashboard.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$map = [
    'pois' => [
        ['id' => 'p1', 'name' => 'Main stage', 'hasProgram' => true, 'program' => ['fri' => [['id' => 'e1'], ['id' => 'e2', 'ownerOrderHash' => str_repeat('a', 64)]], 'sat' => [['id' => 'e3']]]],
        ['id' => 'p2', 'name' => 'Tent', 'hasProgram' => false, 'program' => ['fri' => [['id' => 'hidden-one']]]],
        ['id' => 'p3', 'name' => 'Bar'],
        'not-a-poi',
    ],
    'timelines' => [
        ['id' => 't1', 'name' => 'Radio', 'program' => ['fri' => [['id' => 'e4']]]],
        ['id' => 't2', 'program' => []],
        ['id' => 't3', 'program' => []],
        ['id' => 't4', 'program' => ['fri' => [['id' => 'ignored']]]],
    ],
];
$counts = dashboardCounts($map);
check($counts['pois'] === 3, 'all valid places are counted, invalid entries are not');
check($counts['poisWithProgram'] === 1, 'only places with the programme flag count as having a programme');
check($counts['timelines'] === 3, 'at most three timelines are counted');
check($counts['events'] === 4, 'events of hidden programmes and a fourth timeline are not counted');
check($counts['eventsWithOwner'] === 1, 'events with an owner hash are counted');

$owners = dashboardProgramOwners($map);
check(array_column($owners, 'id') === ['p1', 't1', 't2', 't3'], 'owners are places with a programme followed by up to three timelines');

$empty = dashboardCounts([]);
check($empty['pois'] === 0 && $empty['events'] === 0, 'an empty map gives zero counts');

echo "dashboard tests passed\n";
