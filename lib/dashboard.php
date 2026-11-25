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

/** True when the request host is the local machine (development), where plain HTTP is fine. */
function deploymentIsLocalHost(string $host): bool
{
    $host = strtolower(trim($host));
    if (preg_match('/^\[([^\]]+)\](?::\d+)?$/D', $host, $m)) {
        $host = $m[1];
    } elseif (substr_count($host, ':') === 1) {
        $host = explode(':', $host, 2)[0];
    }
    return $host === 'localhost' || $host === '::1' || substr($host, -10) === '.localhost' || preg_match('/^127(\.\d{1,3}){3}$/D', $host) === 1;
}

/**
 * True when setup should warn that the site is not served over HTTPS. Uses only what the app
 * already trusts for the Secure cookie flag (HTTPS server variable, port 443); forwarded-protocol
 * headers are deliberately ignored because clients can forge them.
 */
function deploymentNeedsHttpsWarning(array $server): bool
{
    $https = !empty($server['HTTPS']) && strtolower((string) $server['HTTPS']) !== 'off' || (int) ($server['SERVER_PORT'] ?? 0) === 443;
    return !$https && !deploymentIsLocalHost((string) ($server['HTTP_HOST'] ?? $server['SERVER_NAME'] ?? ''));
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
