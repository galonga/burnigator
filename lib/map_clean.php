<?php

declare (strict_types=1);
/*
 * Pure validation and sanitising helpers for map data. No request handling happens here, so the
 * functions can be loaded by api.php and by tests/map_clean_test.php alike.
 * Needs auth.php (appRole) and, for cleanProgram(), readMap() from api.php or a preset
 * $GLOBALS['burnigatorEventOwners'].
 */
function defaultTheme(): array
{
    return [
        'primary' => '#305EAA',
        'accent' => '#E94F85',
        'alert' => '#E63D1A',
        'background' => '#E6D0BB',
    ];
}

function cleanTheme($value): array
{
    $defaults = defaultTheme();
    $theme = [];
    foreach ($defaults as $key => $fallback) {
        $color = is_array($value) && is_string($value[$key] ?? null) ? $value[$key] : '';
        $theme[$key] = preg_match('/^#[0-9a-fA-F]{6}$/D', $color) ? strtoupper($color) : $fallback;
    }
    return $theme;
}

function cleanMatomoUrl($value): string
{
    $url = is_string($value) ? trim($value) : '';
    if ($url === '') {
        return '';
    }
    if (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return '';
    }
    $parts = parse_url($url);
    if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
        return '';
    }
    return rtrim($url, '/') . '/';
}

function cleanEnabledDays($value): array
{
    $days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    $enabled = is_array($value) ? array_values(array_filter($days, static function ($day) use ($value) {
        return in_array($day, $value, true);
    })) : [];
    return $enabled ?: $days;
}

function cleanWeekStart($value): string
{
    $days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return is_string($value) && in_array($value, $days, true) ? $value : 'mon';
}

function cleanOptionalHttpUrl($value): string
{
    $url = is_string($value) ? trim($value) : '';
    if ($url === '' || strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return '';
    }
    $parts = parse_url($url);
    if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
        return '';
    }
    return $url;
}

function cleanMatomoSiteId($value): string
{
    $id = (string) $value;
    return preg_match('/^[1-9][0-9]{0,8}$/D', $id) ? $id : '';
}

function defaultSoundCloudPlaylist(): string
{
    return '';
}

function cleanSoundCloudPlaylist($value): ?string
{
    $url = is_string($value) ? trim($value) : '';
    if ($url === '') {
        return '';
    }
    if (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)) {
        return null;
    }
    $parts = parse_url($url);
    if (!is_array($parts) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https' || !in_array(strtolower((string) ($parts['host'] ?? '')), ['soundcloud.com', 'www.soundcloud.com'], true) || isset($parts['user']) || isset($parts['pass']) || !preg_match('~^/[^/]+/sets/[^/]+/?$~D', (string) ($parts['path'] ?? ''))) {
        return null;
    }
    return 'https://' . strtolower((string) $parts['host']) . rtrim((string) $parts['path'], '/');
}

function cleanText($v, int $max): string
{
    if (!is_string($v)) {
        return '';
    }
    $v = trim(strip_tags($v));
    return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
}

function programHistoryDetail($value, string $poiName): string
{
    $labels = [];
    if (is_array($value)) {
        foreach ($value as $day => $events) {
            if (!is_array($events)) {
                continue;
            }
            foreach ($events as $event) {
                if (!is_array($event) || empty($event['text'])) {
                    continue;
                }
                $labels[] = (string) $day . ' ' . (string) ($event['start'] ?? $event['time'] ?? '') . ' ' . (string) $event['text'];
                if (count($labels) >= 4) {
                    break 2;
                }
            }
        }
    }
    return cleanText($poiName . ($labels ? ' · ' . implode(' | ', $labels) : ''), 180);
}

function invalidProgramTimes($value): bool
{
    if (!is_array($value)) {
        return false;
    }
    foreach ($value as $entries) {
        if (!is_array($entries)) {
            continue;
        }
        foreach ($entries as $event) {
            if (!is_array($event)) {
                continue;
            }
            $start = (string) ($event['start'] ?? $event['time'] ?? '');
            $end = (string) ($event['end'] ?? '');
            if ($end !== '' && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start) && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end) && $end === $start) {
                return true;
            }
        }
    }
    return false;
}

function cleanIndependentTimelines($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $out = [];
    foreach (array_slice($value, 0, 3) as $index => $timeline) {
        if (!is_array($timeline)) {
            continue;
        }
        $id = (string) ($timeline['id'] ?? '');
        if (!preg_match('/^[a-f0-9-]{1,40}$/', $id)) {
            $id = bin2hex(random_bytes(8));
        }
        $name = cleanText($timeline['name'] ?? '', 60);
        if ($name === '') {
            continue;
        }
        $out[] = [
            'id' => $id,
            'name' => $name,
            'program' => cleanProgram($timeline['program'] ?? []),
        ];
    }
    return $out;
}

function eventCategoryKeys(): array
{
    return [
        'performance',
        'music',
        'kink',
        'adultMind',
        'kidsMind',
        'movement',
        'quiet',
        'loud',
        'crafting',
    ];
}

/**
 * Event id => keyed hash of the owner's order code, for every event that has an owner.
 */
function eventOwnerMap(array $map): array
{
    $owners = [];
    foreach (['pois', 'timelines'] as $group) {
        foreach ((array) ($map[$group] ?? []) as $item) {
            foreach ((array) (is_array($item) ? $item['program'] ?? [] : []) as $entries) {
                foreach ((array) $entries as $event) {
                    $id = is_array($event) ? (string) ($event['id'] ?? '') : '';
                    $hash = is_array($event) ? (string) ($event['ownerOrderHash'] ?? '') : '';
                    if ($id !== '' && preg_match('/^[a-f0-9]{64}$/D', $hash)) {
                        $owners[$id] = $hash;
                    }
                }
            }
        }
    }
    return $owners;
}

/**
 * The owners stored in the current map, read once per request (restore flows may preset it).
 */
function eventOwners(): array
{
    if (!isset($GLOBALS['burnigatorEventOwners'])) {
        $GLOBALS['burnigatorEventOwners'] = eventOwnerMap(readMap());
    }
    return $GLOBALS['burnigatorEventOwners'];
}

/**
 * Removes the owner hashes from a map before it is sent out. Signed-in programme editors only get a
 * hasOwner flag, so they can see which events have an owner.
 */
function publicEventMap(array $map): array
{
    $showFlag = !empty($_SESSION['admin']) && in_array(appRole(), ['owner', 'www'], true);
    foreach (['pois', 'timelines'] as $group) {
        foreach ((array) ($map[$group] ?? []) as $i => $item) {
            if (!is_array($item) || !is_array($item['program'] ?? null)) {
                continue;
            }
            foreach ($item['program'] as $day => $entries) {
                foreach ((array) $entries as $j => $event) {
                    if (!is_array($event) || !array_key_exists('ownerOrderHash', $event)) {
                        continue;
                    }
                    $has = (string) $event['ownerOrderHash'] !== '';
                    unset($map[$group][$i]['program'][$day][$j]['ownerOrderHash']);
                    if ($showFlag && $has) {
                        $map[$group][$i]['program'][$day][$j]['hasOwner'] = true;
                    }
                }
            }
        }
    }
    return $map;
}

function cleanProgram($value): array
{
    $program = [];
    $allowed = eventCategoryKeys();
    $owners = eventOwners();
    $canAssignOwner = appRole() === 'owner';
    foreach ([
        'mon',
        'tue',
        'wed',
        'thu',
        'fri',
        'sat',
        'sun',
    ] as $day) {
        $program[$day] = [];
        $entries = is_array($value) ? $value[$day] ?? [] : [];
        if (!is_array($entries)) {
            continue;
        }
        foreach (array_slice($entries, 0, 100) as $event) {
            if (!is_array($event)) {
                continue;
            }
            $start = (string) ($event['start'] ?? $event['time'] ?? '');
            $end = (string) ($event['end'] ?? '');
            if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start)) {
                continue;
            }
            if ($end !== '' && !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end)) {
                continue;
            }
            $text = cleanText($event['text'] ?? '', 200);
            if ($text === '') {
                continue;
            }
            $eventId = (string) ($event['id'] ?? '');
            if (!preg_match('/^[a-f0-9-]{1,40}$/', $eventId)) {
                $eventId = bin2hex(random_bytes(16));
            }
            $selected = $event['categories'] ?? [];
            $selected = is_array($selected) ? array_values(array_unique(array_filter($selected, function ($category) use ($allowed) {
                return is_string($category) && in_array($category, $allowed, true);
            }))) : [];
            $linkUrl = cleanText($event['linkUrl'] ?? '', 2048);
            $parts = $linkUrl !== '' ? parse_url($linkUrl) : false;
            if (!$parts || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($linkUrl, FILTER_VALIDATE_URL)) {
                $linkUrl = '';
            }
            $ownerHash = $owners[$eventId] ?? '';
            if ($canAssignOwner) {
                if (!empty($event['ownerClear'])) {
                    $ownerHash = '';
                }
                $ownerCode = trim((string) ($event['ownerCode'] ?? ''));
                if ($ownerCode !== '') {
                    if (!preg_match('/^[A-Z0-9\-\s]{3,100}$/iD', $ownerCode)) {
                        respond(400, ['error' => 'event_owner_code_invalid']);
                    }
                    try {
                        $ownerHash = eventOrderHash($ownerCode);
                    } catch (Throwable $e) {
                        respond(400, ['error' => 'event_owner_unavailable']);
                    }
                }
            }
            $entry = [
                'id' => $eventId,
                'start' => $start,
                'end' => $end,
                'text' => $text,
                'host' => cleanText($event['host'] ?? '', 200),
                'description' => cleanText($event['description'] ?? '', 1000),
                'linkUrl' => $linkUrl,
                'linkText' => cleanText($event['linkText'] ?? '', 120),
                'categories' => $selected,
            ];
            if ($ownerHash !== '') {
                $entry['ownerOrderHash'] = $ownerHash;
            }
            $program[$day][] = $entry;
        }
    }
    return $program;
}

/**
 * The visitor announcement banner: null when there is no text, otherwise text, level and the time it
 * was last changed (kept from $previous when text and level did not change, so visitors who already
 * dismissed it are not shown it again).
 */
function cleanAnnouncement($value, $previous, string $now): ?array
{
    $text = is_array($value) ? cleanText($value['text'] ?? '', 300) : '';
    if ($text === '') {
        return null;
    }
    $level = is_array($value) && ($value['level'] ?? '') === 'warning' ? 'warning' : 'info';
    $unchanged = is_array($previous) && ($previous['text'] ?? null) === $text && ($previous['level'] ?? 'info') === $level;
    $updatedAt = $unchanged && is_string($previous['updatedAt'] ?? null) && $previous['updatedAt'] !== '' ? $previous['updatedAt'] : $now;
    return ['text' => $text, 'level' => $level, 'updatedAt' => $updatedAt];
}

/** Everything that makes an event "different" for a visitor: where, when and what it is called. */
function eventScheduleSignature(string $ownerId, string $day, array $event): string
{
    return json_encode([$ownerId, $day, (string) ($event['start'] ?? $event['time'] ?? ''), (string) ($event['end'] ?? ''), (string) ($event['text'] ?? '')], JSON_UNESCAPED_UNICODE);
}

/**
 * Marks events whose place, day, time or title changed since $old with a changedAt timestamp, and
 * carries an earlier changedAt over for events that did not change. New events get no mark.
 */
function stampEventChanges(array $old, array $new, string $now): array
{
    $known = [];
    $ambiguous = [];
    foreach (['pois', 'timelines'] as $group) {
        foreach ((array) ($old[$group] ?? []) as $item) {
            foreach ((array) (is_array($item) ? $item['program'] ?? [] : []) as $day => $entries) {
                foreach ((array) $entries as $event) {
                    $id = is_array($event) ? (string) ($event['id'] ?? '') : '';
                    if ($id !== '') {
                        if (isset($known[$id])) {
                            $ambiguous[$id] = true;
                        }
                        $known[$id] = [eventScheduleSignature((string) ($item['id'] ?? ''), (string) $day, $event), (string) ($event['changedAt'] ?? '')];
                    }
                }
            }
        }
    }
    // An id used by several events cannot be matched to one earlier event, so those are left alone.
    $seen = [];
    foreach (['pois', 'timelines'] as $group) {
        foreach ((array) ($new[$group] ?? []) as $item) {
            foreach ((array) (is_array($item) ? $item['program'] ?? [] : []) as $entries) {
                foreach ((array) $entries as $event) {
                    $id = is_array($event) ? (string) ($event['id'] ?? '') : '';
                    if ($id !== '' && isset($seen[$id])) {
                        $ambiguous[$id] = true;
                    }
                    $seen[$id] = true;
                }
            }
        }
    }
    foreach (['pois', 'timelines'] as $group) {
        foreach ((array) ($new[$group] ?? []) as $i => $item) {
            if (!is_array($item) || !is_array($item['program'] ?? null)) {
                continue;
            }
            foreach ($item['program'] as $day => $entries) {
                foreach ((array) $entries as $j => $event) {
                    $id = is_array($event) ? (string) ($event['id'] ?? '') : '';
                    if ($id === '' || !isset($known[$id]) || isset($ambiguous[$id])) {
                        continue;
                    }
                    $same = $known[$id][0] === eventScheduleSignature((string) ($item['id'] ?? ''), (string) $day, $event);
                    $stamp = $same ? $known[$id][1] : $now;
                    unset($new[$group][$i]['program'][$day][$j]['changedAt']);
                    if ($stamp !== '') {
                        $new[$group][$i]['program'][$day][$j]['changedAt'] = $stamp;
                    }
                }
            }
        }
    }
    return $new;
}
