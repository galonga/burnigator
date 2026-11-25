<?php

declare(strict_types=1);

/** POST set-publication. */
function apiSetPublicationAction(array $in): void
{
    if (!is_bool($in['published'] ?? null)) {
        respond(400, ['error' => 'invalid_publication_state']);
    }
    $expected = (string) ($in['expectedUpdatedAt'] ?? '');
    $map = withMapLock(function () use ($in, $expected) {
        $m = readMap();
        if ($expected === '' || !hash_equals((string) ($m['updatedAt'] ?? ''), $expected)) {
            return 'conflict';
        }
        $m['published'] = $in['published'];
        return saveMap($m) ? $m : false;
    });
    if ($map === 'conflict') {
        respond(409, ['error' => 'map_conflict']);
    }
    if (!is_array($map)) {
        respond(500, ['error' => 'publication_save_failed']);
    }
    recordHistory('publication_change', 0, $map['published'] ? 'Published' : 'Unpublished');
    respond(200, ['ok' => true, 'map' => $map]);
}

/** POST save: the whole-map save (role guard is in the dispatcher). */
function apiSaveAction($action): void
{
    if ($action !== 'save' || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(404, ['error' => 'Unbekannte Anfrage']);
    }
    $in = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($in)) {
        respond(400, ['error' => 'Ungültige Daten.']);
    }
    foreach ((array) ($in['pois'] ?? []) as $incomingPoi) {
        if (is_array($incomingPoi) && invalidProgramTimes($incomingPoi['program'] ?? [])) {
            respond(400, ['error' => 'invalid_event_time']);
        }
    }
    $cats = [];
    foreach (array_slice((array) ($in['categories'] ?? []), 0, 100) as $c) {
        if (!is_array($c)) {
            continue;
        }
        $id = preg_match('/^[a-f0-9-]{1,40}$/', (string) ($c['id'] ?? '')) ? (string) $c['id'] : bin2hex(random_bytes(8));
        $color = (string) ($c['color'] ?? '#E94F85');
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) {
            $color = '#E94F85';
        }
        $cats[] = [
            'id' => $id,
            'name' => cleanText($c['name'] ?? '', 60),
            'color' => $color,
        ];
    }
    $catIds = array_column($cats, 'id');
    $pois = [];
    foreach (array_slice((array) ($in['pois'] ?? []), 0, 2000) as $p) {
        if (!is_array($p)) {
            continue;
        }
        $x = filter_var($p['x'] ?? null, FILTER_VALIDATE_FLOAT);
        $y = filter_var($p['y'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($x === false || $y === false || $x < 0 || $y < 0 || $x > 1 || $y > 1) {
            continue;
        }
        $cat = (string) ($p['categoryId'] ?? '');
        if (!in_array($cat, $catIds, true)) {
            $cat = '';
        }
        $rawIcon = $p['icon'] ?? 'fa-location-dot';
        $icon = is_string($rawIcon) && preg_match('/^fa-[a-z0-9-]{2,60}$/', $rawIcon) ? $rawIcon : (cleanText($rawIcon, 16) ?: '•');
        $pois[] = [
            'id' => preg_match('/^[a-f0-9-]{1,40}$/', (string) ($p['id'] ?? '')) ? (string) $p['id'] : bin2hex(random_bytes(8)),
            'x' => $x,
            'y' => $y,
            'name' => cleanText($p['name'] ?? '', 100),
            'description' => cleanText($p['description'] ?? '', 1000),
            'categoryId' => $cat,
            'icon' => $icon,
            'hasProgram' => !empty($p['hasProgram']),
            'program' => cleanProgram($p['program'] ?? []),
        ];
    }
    $old = readMap();
    $soundcloudPlaylist = array_key_exists('soundcloudPlaylist', $in) ? cleanSoundCloudPlaylist($in['soundcloudPlaylist']) : cleanSoundCloudPlaylist($old['soundcloudPlaylist'] ?? defaultSoundCloudPlaylist());
    if ($soundcloudPlaylist === null) {
        respond(400, ['error' => 'soundcloud_playlist_invalid']);
    }
    $rawTimelines = $in['timelines'] ?? [];
    if (!is_array($rawTimelines) || count($rawTimelines) > 3) {
        respond(400, ['error' => 'invalid_timelines']);
    }
    foreach ($rawTimelines as $timeline) {
        if (is_array($timeline)) {
            if (invalidProgramTimes($timeline['program'] ?? [])) {
                respond(400, ['error' => 'invalid_event_time']);
            }
            if (cleanText($timeline['name'] ?? '', 60) === '') {
                respond(400, ['error' => 'timeline_name_required']);
            }
        }
    }
    $timelines = array_key_exists('timelines', $in) ? cleanIndependentTimelines($rawTimelines) : (array) ($old['timelines'] ?? []);
    $mode = (string) ($in['iconMode'] ?? 'monochrome');
    if (!in_array($mode, ['monochrome', 'colored'], true)) {
        $mode = 'monochrome';
    }
    $custom = $in['customButton'] ?? [];
    $custom = is_array($custom) ? $custom : [];
    $customLabel = cleanText($custom['label'] ?? '', 40);
    $customUrl = cleanText($custom['url'] ?? '', 2048);
    $urlParts = $customUrl !== '' ? parse_url($customUrl) : false;
    if (!$urlParts || !in_array(strtolower((string) ($urlParts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($customUrl, FILTER_VALIDATE_URL)) {
        $customLabel = '';
        $customUrl = '';
    }
    $qrUrl = cleanText($in['qrUrl'] ?? '', 2048);
    $qrParts = $qrUrl !== '' ? parse_url($qrUrl) : false;
    if (!$qrParts || !in_array(strtolower((string) ($qrParts['scheme'] ?? '')), ['http', 'https'], true) || !filter_var($qrUrl, FILTER_VALIDATE_URL)) {
        $qrUrl = '';
    }
    $m = [
        'title' => cleanText($in['title'] ?? 'Mein Event', 100) ?: 'Mein Event',
        'theme' => cleanTheme($in['theme'] ?? $old['theme'] ?? null),
        'matomoUrl' => cleanMatomoUrl($in['matomoUrl'] ?? $old['matomoUrl'] ?? ''),
        'matomoSiteId' => cleanMatomoSiteId($in['matomoSiteId'] ?? $old['matomoSiteId'] ?? ''),
        'image' => (string) ($old['image'] ?? ''),
        'logo' => (string) ($old['logo'] ?? ''),
        'favicon' => (string) ($old['favicon'] ?? ''),
        'width' => (int) ($old['width'] ?? 0),
        'height' => (int) ($old['height'] ?? 0),
        'iconMode' => $mode,
        'browserTranslationEnabled' => !empty($in['browserTranslationEnabled']),
        'liveTimetableEnabled' => array_key_exists('liveTimetableEnabled', $in) ? $in['liveTimetableEnabled'] === true : ($old['liveTimetableEnabled'] ?? false) === true,
        'soundcloudEnabled' => array_key_exists('soundcloudEnabled', $in) ? $in['soundcloudEnabled'] !== false : $old['soundcloudEnabled'] ?? true,
        'soundcloudPlaylist' => $soundcloudPlaylist,
        'customButton' => ['label' => $customLabel, 'url' => $customUrl],
        'qrUrl' => $qrUrl,
        'impressUrl' => cleanOptionalHttpUrl($in['impressUrl'] ?? $old['impressUrl'] ?? ''),
        'weekStart' => cleanWeekStart($in['weekStart'] ?? $old['weekStart'] ?? 'mon'),
        'enabledDays' => cleanEnabledDays($in['enabledDays'] ?? $old['enabledDays'] ?? null),
        'titleLinkUrl' => cleanOptionalHttpUrl($in['titleLinkUrl'] ?? $old['titleLinkUrl'] ?? ''),
        'published' => ($old['published'] ?? true) === true,
        'pinboardEnabled' => ($old['pinboardEnabled'] ?? false) === true,
        'announcement' => $old['announcement'] ?? null,
        'statsEnabled' => ($old['statsEnabled'] ?? false) === true,
        'categories' => $cats,
        'pois' => $pois,
        'timelines' => $timelines,
    ];
    $expected = (string) ($in['expectedUpdatedAt'] ?? '');
    $saved = withMapLock(function () use (&$m, $expected) {
        $latest = readMap();
        if ($expected === '' || !hash_equals((string) ($latest['updatedAt'] ?? ''), $expected)) {
            return 'conflict';
        }
        foreach ([
            'image',
            'logo',
            'favicon',
            'width',
            'height',
        ] as $key) {
            $m[$key] = $latest[$key] ?? $m[$key] ?? '';
        }
        return saveMap($m) ? $m : false;
    });
    if ($saved === 'conflict') {
        respond(409, ['error' => 'map_conflict']);
    }
    if (!is_array($saved)) {
        respond(500, ['error' => 'Speichern fehlgeschlagen. Prüfe die Schreibrechte für data/.']);
    }
    $m = $saved;
    recordHistory('map_save', count($pois), 'Kategorien: ' . count($cats) . ' · POIs: ' . count($pois));
    respond(200, ['ok' => true, 'map' => $m]);
}
