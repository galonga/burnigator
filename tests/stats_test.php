<?php

declare(strict_types=1);
// Run with: php tests/stats_test.php
require_once __DIR__ . '/../lib/stats.php';

function check(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$map = [
    'pois' => [
        ['id' => 'poi1', 'name' => 'Main stage', 'program' => ['fri' => [['id' => 'ev1', 'text' => 'Opening'], ['id' => 'ev2', 'text' => 'Fire show']]]],
        ['id' => 'poi2', 'name' => 'Tent', 'program' => []],
    ],
    'timelines' => [['name' => 'Radio', 'program' => ['sat' => [['id' => 'ev3', 'text' => 'Morning show']]]]],
];
$targets = statsTargets($map);
check(array_keys($targets['events']) === ['ev1', 'ev2', 'ev3'], 'events from places and timelines are known');
check($targets['events']['ev3']['place'] === 'Radio', 'timeline events name their timeline as place');

check(statsValidHit('visit', '', $targets), 'a visit has no id');
check(!statsValidHit('visit', 'ev1', $targets), 'a visit with an id is rejected');
check(statsValidHit('event_open', 'ev1', $targets) && statsValidHit('favorite_add', 'ev3', $targets), 'known events are accepted');
check(!statsValidHit('event_open', 'poi1', $targets), 'a place id is not an event id');
check(!statsValidHit('event_open', 'nope', $targets), 'unknown ids are rejected so the file cannot grow');
check(statsValidHit('poi_open', 'poi2', $targets) && !statsValidHit('poi_open', 'ev1', $targets), 'places are validated against places');
check(!statsValidHit('evil_type', 'ev1', $targets), 'unknown types are rejected');

$today = '2026-11-24';
$stats = [];
$stats = statsRecord($stats, 'visit', '', $today);
$stats = statsRecord($stats, 'visit', '', $today);
$stats = statsRecord($stats, 'event_open', 'ev1', $today);
$stats = statsRecord($stats, 'favorite_add', 'ev1', $today);
$stats = statsRecord($stats, 'favorite_add', 'ev1', $today);
$stats = statsRecord($stats, 'favorite_remove', 'ev1', $today);
$stats = statsRecord($stats, 'event_open', 'ev2', $today);
$stats = statsRecord($stats, 'event_open', 'ev2', '2026-11-23');
$stats = statsRecord($stats, 'poi_open', 'poi1', $today);
$stats = statsRecord($stats, 'event_open', 'deleted-event', $today);
check($stats['days'][$today]['visit']['-'] === 2, 'visits are counted per day');
check(!array_key_exists('ip', $stats['days'][$today]) && count($stats['days']) === 2, 'only per-day counters are stored');

$summary = statsSummary($stats, $targets, $today, 7);
check($summary['totals']['visits'] === 2, 'total visits');
check($summary['totals']['eventOpens'] === 3, 'event opens exclude events that no longer exist');
check($summary['totals']['favorites'] === 1, 'favourites are net of removals');
check($summary['topEvents'][0]['id'] === 'ev1' && $summary['topEvents'][0]['favorites'] === 1, 'events are ranked by favourites first');
check($summary['topEvents'][1]['opens'] === 2, 'opens are summed over the period');
check($summary['topPois'][0]['name'] === 'Main stage', 'places are ranked');
check(count($summary['perDay']) === 7 && $summary['perDay'][6]['visits'] === 2 && $summary['perDay'][0]['visits'] === 0, 'per-day series is zero-filled and ends today');
$one = statsSummary($stats, $targets, $today, 1);
check($one['totals']['eventOpens'] === 2 && $summary['totals']['eventOpens'] === 3, 'a one day range only counts today');

$old = statsRecord([], 'visit', '', '2026-01-01');
$old = statsRecord($old, 'visit', '', '2026-11-24');
check(array_keys($old['days']) === ['2026-11-24'], 'days older than the retention period are pruned');
check(statsPrune(['days' => ['junk' => [1], '2026-11-24' => 'x']], '2026-11-24') === ['days' => []], 'malformed stats are dropped');

$file = sys_get_temp_dir() . '/burnigator-stats-' . bin2hex(random_bytes(4)) . '.json';
check(statsMutate($file, static fn (array $s) => statsRecord($s, 'visit', '', $today)), 'mutate writes the file');
check(statsMutate($file, static fn (array $s) => statsRecord($s, 'visit', '', $today)), 'mutate updates the file');
check(statsRead($file)['days'][$today]['visit']['-'] === 2, 'mutations accumulate');
file_put_contents($file, 'not json');
check(statsRead($file) === [], 'a corrupt file reads as empty');
check(statsMutate($file, static fn (array $s) => statsRecord($s, 'visit', '', $today)) && statsRead($file)['days'][$today]['visit']['-'] === 1, 'a corrupt file is replaced');
unlink($file);

// Flood protection: at most STATS_MAX_HITS_PER_MINUTE hits per minute, whatever the type or id
$t = strtotime('2026-11-24 12:00:30 UTC');
$flood = [];
for ($i = 0; $i < STATS_MAX_HITS_PER_MINUTE + 50; $i++) {
    $flood = statsRecord($flood, 'event_open', 'ev1', $today, $t);
}
check($flood['days'][$today]['event_open']['ev1'] === STATS_MAX_HITS_PER_MINUTE, 'hits beyond the per-minute limit are dropped');
$flood = statsRecord($flood, 'event_open', 'ev1', $today, $t + 60);
check($flood['days'][$today]['event_open']['ev1'] === STATS_MAX_HITS_PER_MINUTE + 1, 'the next minute counts again');

// Favourite removals need a matching add
$fav = statsRecord([], 'favorite_remove', 'ev1', $today, $t);
check(!isset($fav['days'][$today]['favorite_remove']), 'a removal without an add is ignored');
$fav = statsRecord(statsRecord([], 'favorite_add', 'ev1', $today, $t), 'favorite_remove', 'ev1', $today, $t);
check($fav['days'][$today]['favorite_remove']['ev1'] === 1, 'a removal after an add is counted');
for ($i = 0; $i < 5; $i++) {
    $fav = statsRecord($fav, 'favorite_remove', 'ev1', $today, $t);
}
check($fav['days'][$today]['favorite_remove']['ev1'] === 1, 'removals cannot exceed adds');

// An oversized file is trimmed from the oldest day, never replaced as a whole
$big = ['days' => []];
$padding = [];
for ($n = 0; $n < 30000; $n++) {
    $padding['id' . $n] = 12345;
}
for ($d = 3; $d >= 1; $d--) {
    $big['days'][gmdate('Y-m-d', strtotime($today . ' UTC') - $d * 86400)] = ['event_open' => $padding];
}
file_put_contents($file, json_encode($big));
check(strlen((string) file_get_contents($file)) > STATS_MAX_BYTES, 'test file is over the size limit');
check(statsMutate($file, static fn (array $s) => statsRecord($s, 'visit', '', $today, $t)), 'an oversized file can still be written');
$after = statsRead($file);
check(strlen((string) file_get_contents($file)) <= STATS_MAX_BYTES, 'the file fits the limit again');
check(isset($after['days'][$today]['visit']['-']) && count($after['days']) >= 2, 'recent days survive, only the oldest are dropped');
unlink($file);

echo "stats tests passed\n";
