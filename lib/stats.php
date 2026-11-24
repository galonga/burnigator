<?php

declare(strict_types=1);
/*
 * Built-in, privacy-friendly statistics.
 *
 * Only anonymous daily counters are kept: how often something was opened on a given day. There are
 * no cookies, no IP addresses, no user agents, no visitor or session identifiers and no timestamps
 * finer than the day, so nothing can be tied back to a person. The counters live in data/stats.json.
 *
 * These functions are pure (no request handling) so tests/stats_test.php can load them directly.
 */
const STATS_RETENTION_DAYS = 90;
const STATS_MAX_BYTES = 1048576;
/** Most hits accepted per minute across all visitors; a flood cannot inflate or load more than this. */
const STATS_MAX_HITS_PER_MINUTE = 600;
const STATS_TYPES = ['visit', 'event_open', 'poi_open', 'favorite_add', 'favorite_remove'];

/** Ids of all events and places in the map, keyed by id, with a display name and (for events) the place. */
function statsTargets(array $map): array
{
    $events = [];
    $pois = [];
    foreach ((array) ($map['pois'] ?? []) as $poi) {
        if (!is_array($poi)) {
            continue;
        }
        $poiId = (string) ($poi['id'] ?? '');
        if ($poiId !== '') {
            $pois[$poiId] = (string) ($poi['name'] ?? '');
        }
        foreach ((array) ($poi['program'] ?? []) as $entries) {
            foreach ((array) $entries as $event) {
                $id = is_array($event) ? (string) ($event['id'] ?? '') : '';
                if ($id !== '') {
                    $events[$id] = ['name' => (string) ($event['text'] ?? ''), 'place' => (string) ($poi['name'] ?? '')];
                }
            }
        }
    }
    foreach ((array) ($map['timelines'] ?? []) as $timeline) {
        foreach ((array) (is_array($timeline) ? $timeline['program'] ?? [] : []) as $entries) {
            foreach ((array) $entries as $event) {
                $id = is_array($event) ? (string) ($event['id'] ?? '') : '';
                if ($id !== '') {
                    $events[$id] = ['name' => (string) ($event['text'] ?? ''), 'place' => (string) ($timeline['name'] ?? '')];
                }
            }
        }
    }
    return ['events' => $events, 'pois' => $pois];
}

/** Whether a counter of this type may be recorded for this id. Unknown ids are rejected, which keeps the file small. */
function statsValidHit(string $type, string $id, array $targets): bool
{
    if (!in_array($type, STATS_TYPES, true)) {
        return false;
    }
    if ($type === 'visit') {
        return $id === '';
    }
    if ($type === 'poi_open') {
        return isset($targets['pois'][$id]);
    }
    return isset($targets['events'][$id]);
}

function statsPrune(array $stats, string $today): array
{
    $limit = gmdate('Y-m-d', strtotime($today . ' UTC') - (STATS_RETENTION_DAYS - 1) * 86400);
    $days = [];
    foreach ((array) ($stats['days'] ?? []) as $day => $counts) {
        if (is_string($day) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day) && $day >= $limit && is_array($counts)) {
            $days[$day] = $counts;
        }
    }
    ksort($days);
    return ['days' => $days];
}

/** Favourite adds and removes seen for an id over all stored days. */
function statsFavoriteBalance(array $stats, string $id): array
{
    $adds = 0;
    $removes = 0;
    foreach ((array) ($stats['days'] ?? []) as $counts) {
        $adds += (int) ($counts['favorite_add'][$id] ?? 0);
        $removes += (int) ($counts['favorite_remove'][$id] ?? 0);
    }
    return [$adds, $removes];
}

/**
 * Counts one hit. Returns the stats unchanged when the hit is dropped: more than
 * STATS_MAX_HITS_PER_MINUTE hits in the current minute, or a favourite removal with no matching add.
 * $now is a Unix time (injectable for tests).
 */
function statsRecord(array $stats, string $type, string $id, string $today, ?int $now = null): array
{
    $minute = gmdate('Y-m-d\TH:i', $now ?? time());
    $rate = is_array($stats['rate'] ?? null) ? $stats['rate'] : [];
    $hits = ($rate['minute'] ?? '') === $minute ? (int) ($rate['n'] ?? 0) : 0;
    $stats = statsPrune($stats, $today);
    if ($hits >= STATS_MAX_HITS_PER_MINUTE) {
        $stats['rate'] = ['minute' => $minute, 'n' => $hits];
        return $stats;
    }
    $stats['rate'] = ['minute' => $minute, 'n' => $hits + 1];
    if ($type === 'favorite_remove') {
        [$adds, $removes] = statsFavoriteBalance($stats, $id);
        if ($removes >= $adds) {
            return $stats;
        }
    }
    $key = $type === 'visit' ? '-' : $id;
    $stats['days'][$today][$type][$key] = (int) ($stats['days'][$today][$type][$key] ?? 0) + 1;
    return $stats;
}

/** Totals and rankings for the last $days days (including today). */
function statsSummary(array $stats, array $targets, string $today, int $days): array
{
    $days = max(1, min(STATS_RETENTION_DAYS, $days));
    $from = gmdate('Y-m-d', strtotime($today . ' UTC') - ($days - 1) * 86400);
    $perDay = [];
    $events = [];
    $pois = [];
    $totals = ['visits' => 0, 'eventOpens' => 0, 'poiOpens' => 0, 'favorites' => 0];
    for ($i = $days - 1; $i >= 0; $i--) {
        $perDay[gmdate('Y-m-d', strtotime($today . ' UTC') - $i * 86400)] = 0;
    }
    foreach ((array) ($stats['days'] ?? []) as $day => $counts) {
        if ($day < $from || $day > $today || !is_array($counts)) {
            continue;
        }
        $visits = (int) array_sum((array) ($counts['visit'] ?? []));
        $perDay[$day] = $visits;
        $totals['visits'] += $visits;
        foreach ((array) ($counts['event_open'] ?? []) as $id => $n) {
            $events[$id]['opens'] = ($events[$id]['opens'] ?? 0) + (int) $n;
        }
        foreach ((array) ($counts['favorite_add'] ?? []) as $id => $n) {
            $events[$id]['favorites'] = ($events[$id]['favorites'] ?? 0) + (int) $n;
        }
        foreach ((array) ($counts['favorite_remove'] ?? []) as $id => $n) {
            $events[$id]['favorites'] = ($events[$id]['favorites'] ?? 0) - (int) $n;
        }
        foreach ((array) ($counts['poi_open'] ?? []) as $id => $n) {
            $pois[$id] = ($pois[$id] ?? 0) + (int) $n;
        }
    }
    $topEvents = [];
    foreach ($events as $id => $row) {
        if (!isset($targets['events'][$id])) {
            continue;
        }
        $opens = (int) ($row['opens'] ?? 0);
        $fav = max(0, (int) ($row['favorites'] ?? 0));
        $totals['eventOpens'] += $opens;
        $totals['favorites'] += $fav;
        $topEvents[] = ['id' => (string) $id, 'name' => $targets['events'][$id]['name'], 'place' => $targets['events'][$id]['place'], 'opens' => $opens, 'favorites' => $fav];
    }
    $topPois = [];
    foreach ($pois as $id => $opens) {
        if (!isset($targets['pois'][$id])) {
            continue;
        }
        $totals['poiOpens'] += (int) $opens;
        $topPois[] = ['id' => (string) $id, 'name' => $targets['pois'][$id], 'opens' => (int) $opens];
    }
    usort($topEvents, static function ($a, $b) {
        return [$b['favorites'], $b['opens'], $a['name']] <=> [$a['favorites'], $a['opens'], $b['name']];
    });
    usort($topPois, static function ($a, $b) {
        return [$b['opens'], $a['name']] <=> [$a['opens'], $b['name']];
    });
    $series = [];
    foreach ($perDay as $day => $count) {
        $series[] = ['day' => $day, 'visits' => $count];
    }
    return ['days' => $days, 'totals' => $totals, 'perDay' => $series, 'topEvents' => array_slice($topEvents, 0, 10), 'topPois' => array_slice($topPois, 0, 10)];
}

/** Reads, changes and writes data/stats.json under an exclusive lock. */
function statsMutate(string $path, callable $change): bool
{
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        return false;
    }
    $fp = @fopen($path, 'c+');
    if (!$fp) {
        return false;
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }
    $raw = (string) stream_get_contents($fp);
    $stats = $raw !== '' ? json_decode($raw, true) : [];
    $stats = $change(is_array($stats) ? $stats : []);
    $json = json_encode($stats, JSON_UNESCAPED_UNICODE);
    // Over the size limit: drop the oldest days until it fits, never the existing file as a whole.
    while ($json !== false && strlen($json) > STATS_MAX_BYTES && count((array) ($stats['days'] ?? [])) > 1) {
        reset($stats['days']);
        unset($stats['days'][key($stats['days'])]);
        $json = json_encode($stats, JSON_UNESCAPED_UNICODE);
    }
    $ok = false;
    if ($json !== false && strlen($json) <= STATS_MAX_BYTES) {
        $ok = ftruncate($fp, 0) && rewind($fp) && fwrite($fp, $json) !== false;
    }
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok;
}

function statsRead(string $path): array
{
    $raw = is_file($path) ? (string) @file_get_contents($path) : '';
    $stats = $raw !== '' ? json_decode($raw, true) : [];
    return is_array($stats) ? $stats : [];
}
