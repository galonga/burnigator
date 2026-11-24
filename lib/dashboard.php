<?php

declare(strict_types=1);

/**
 * Pure helpers for the admin dashboard. No I/O, so they can be tested without a server.
 */

/**
 * Places and timelines whose programme the visitor page shows. Keep this selection in step with
 * the visitor timetable (assets/map.js): places with hasProgram, then the first three timelines.
 */
function dashboardProgramOwners(array $map): array
{
    $entry = static fn (array $item): array => ['id' => (string) ($item['id'] ?? ''), 'name' => (string) ($item['name'] ?? ''), 'program' => (array) ($item['program'] ?? [])];
    $owners = [];
    foreach ((array) ($map['pois'] ?? []) as $poi) {
        if (is_array($poi) && ($poi['hasProgram'] ?? false) === true) {
            $owners[] = $entry($poi);
        }
    }
    foreach (array_slice((array) ($map['timelines'] ?? []), 0, 3) as $timeline) {
        if (is_array($timeline)) {
            $owners[] = $entry($timeline);
        }
    }
    return $owners;
}

/** Totals for the dashboard tiles. */
function dashboardCounts(array $map, ?array $owners = null): array
{
    $events = 0;
    $owned = 0;
    foreach ($owners ?? dashboardProgramOwners($map) as $owner) {
        foreach ($owner['program'] as $list) {
            if (!is_array($list)) {
                continue;
            }
            foreach ($list as $event) {
                if (!is_array($event)) {
                    continue;
                }
                $events++;
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
    ];
}
