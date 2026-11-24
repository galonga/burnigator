<?php

declare(strict_types=1);

/**
 * Pure helpers for the admin dashboard. No I/O, so they can be tested without a server.
 */

/** Places and timelines whose programme the visitor page shows (same selection as the timetable). */
function dashboardProgramOwners(array $map): array
{
    $owners = [];
    foreach ((array) ($map['pois'] ?? []) as $poi) {
        if (is_array($poi) && ($poi['hasProgram'] ?? false) === true) {
            $owners[] = ['id' => (string) ($poi['id'] ?? ''), 'name' => (string) ($poi['name'] ?? ''), 'program' => (array) ($poi['program'] ?? [])];
        }
    }
    foreach (array_slice((array) ($map['timelines'] ?? []), 0, 3) as $timeline) {
        if (is_array($timeline)) {
            $owners[] = ['id' => (string) ($timeline['id'] ?? ''), 'name' => (string) ($timeline['name'] ?? ''), 'program' => (array) ($timeline['program'] ?? [])];
        }
    }
    return $owners;
}

/** Totals for the dashboard tiles. */
function dashboardCounts(array $map): array
{
    $events = 0;
    $owned = 0;
    $perDay = [];
    foreach (dashboardProgramOwners($map) as $owner) {
        foreach ($owner['program'] as $day => $list) {
            if (!is_array($list)) {
                continue;
            }
            foreach ($list as $event) {
                if (!is_array($event)) {
                    continue;
                }
                $events++;
                $perDay[(string) $day] = ($perDay[(string) $day] ?? 0) + 1;
                if (!empty($event['ownerOrderHash'])) {
                    $owned++;
                }
            }
        }
    }
    $pois = array_filter((array) ($map['pois'] ?? []), 'is_array');
    return [
        'pois' => count($pois),
        'poisWithProgram' => count(array_filter($pois, static fn ($p) => ($p['hasProgram'] ?? false) === true)),
        'timelines' => min(3, count((array) ($map['timelines'] ?? []))),
        'events' => $events,
        'eventsWithOwner' => $owned,
        'eventsPerDay' => $perDay,
    ];
}
